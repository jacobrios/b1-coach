// Tests for the single choke point every coach request goes through.
//
// Two behaviors matter here and neither is visible on a happy path: the one
// automatic retry that covers a sleeping server, and the unwrapping of a model
// response that arrives fenced in Markdown. Both were added because the real
// thing went wrong; both are silent when they work.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callApi } from './coachApi.js'

const RETRY_DELAY_MS = 1500

const ok = (text) => ({
  ok: true,
  status: 200,
  json: async () => ({ content: [{ type: 'text', text }] }),
})

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

// callApi waits 1500ms before its retry, so a test that simply awaits would sit
// there. Start the call, push the clock past the delay, then take the result.
async function run(promiseFactory) {
  const promise = promiseFactory()
  // Attach a handler now so a rejection landing while the clock advances is not
  // reported as unhandled. The assertion still sees the original promise.
  promise.catch(() => {})
  await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
  return promise
}

describe('the one retry that covers a sleeping server', () => {
  it('does not retry when the first attempt works', async () => {
    const fetchMock = vi.fn(async () => ok('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)

    await run(() => callApi({ messages: [] }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries once when the connection fails, and succeeds on the second try', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(ok('{"recovered":true}'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await run(() => callApi({ messages: [] }))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ recovered: true })
  })

  it('retries on a server error too, not only on a dropped connection', async () => {
    // A cold Vercel function can answer 500 rather than refusing the socket, so
    // the retry has to cover both or it misses the case it exists for.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
      .mockResolvedValueOnce(ok('{"recovered":true}'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await run(() => callApi({ messages: [] }))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ recovered: true })
  })

  it('tells the caller a retry is happening, which is what puts the explanation on screen', async () => {
    const onRetry = vi.fn()
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(ok('{}')))

    await run(() => callApi({ messages: [] }, { onRetry }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('does not announce a retry that never happened', async () => {
    const onRetry = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => ok('{}')))

    await run(() => callApi({ messages: [] }, { onRetry }))

    expect(onRetry).not.toHaveBeenCalled()
  })

  it('gives up after the second failure rather than retrying forever', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('genuinely dead'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toThrow('genuinely dead')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('survives a caller that passes no options at all', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(ok('{}')))

    await expect(run(() => callApi({ messages: [] }))).resolves.toEqual({})
  })
})

describe('unwrapping what the model actually returns', () => {
  it('parses a bare JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('{"coachingSummary":"nice swing"}')))
    await expect(run(() => callApi({}))).resolves.toEqual({ coachingSummary: 'nice swing' })
  })

  it('strips a ```json fence, which the model adds unpredictably', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('```json\n{"a":1}\n```')))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('strips a fence with prose in front of it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('Here you go:\n\n```json\n{"a":1}\n```')))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('throws a recognizable error when the response holds no text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ content: [] }) })))
    await expect(run(() => callApi({}))).rejects.toThrow('No text content in API response')
  })

  it('throws a recognizable error when the text is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('I am afraid I cannot do that.')))
    await expect(run(() => callApi({}))).rejects.toThrow('Failed to parse coach response as JSON')
  })

  // ── Pinned, not endorsed ──────────────────────────────────────────────────
  // The two tests below record what the stripping does today, including where it
  // is wrong. They are here so a future change to that regex cannot alter these
  // outcomes silently. If the fence handling is ever fixed, these tests are
  // expected to change in the same commit.

  it('currently fails on a fence with no json tag (recorded, not endorsed)', async () => {
    // The first regex only looks for ```json, so it does not match a plain fence
    // and strips nothing. The second regex then matches from the opening fence to
    // the end and takes the JSON with it, leaving an empty string to parse. Not
    // seen in practice, since the prompt asks for JSON by name.
    vi.stubGlobal('fetch', vi.fn(async () => ok('```\n{"a":1}\n```')))
    await expect(run(() => callApi({}))).rejects.toThrow('Failed to parse coach response as JSON')
  })

  it('currently truncates at a literal fence inside a string value (recorded, not endorsed)', async () => {
    // The closing-fence regex matches from the leftmost ``` it finds, so a coach
    // message that quotes a code fence loses everything from there on.
    vi.stubGlobal('fetch', vi.fn(async () => ok('{"note":"use ``` for code","after":1}')))
    await expect(run(() => callApi({}))).rejects.toThrow('Failed to parse coach response as JSON')
  })
})
