// Tests for the single choke point every coach request goes through.
//
// Two behaviors matter here and neither is visible on a happy path: the one
// automatic retry that covers a sleeping server, and the unwrapping of a model
// response that arrives fenced in Markdown. Both were added because the real
// thing went wrong; both are silent when they work.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callApi, goalContext } from './coachApi.js'

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

// The numbers below are written as literals rather than read from goalTargets.js.
// Asserting the prompt against the same module it is built from would pass no
// matter what those numbers became, which is exactly the change worth catching:
// this is the text the coach reads before telling the player what to aim for.
describe('the targets the coach is told about', () => {
  it('tells the coach power is 25 to 35 degrees at 88 mph', () => {
    const context = goalContext({ id: 'power' })
    expect(context).toContain('25-35 degrees')
    expect(context).toContain('88+ mph')
  })

  it('tells the coach contact is 8 to 18 degrees at 85 mph', () => {
    const context = goalContext({ id: 'contact' })
    expect(context).toContain('8-18 degrees')
    expect(context).toContain('85+ mph')
  })

  it('tells the coach popup is 10 to 25 degrees', () => {
    expect(goalContext({ id: 'popup' })).toContain('10-25 degrees')
  })

  it('tells the coach that Open Session has no target metrics', () => {
    expect(goalContext({ id: 'open' })).toContain('no specific target metrics')
  })

  it('gives Hit to All Fields its spray-direction context and no launch angle target', () => {
    const context = goalContext({ id: 'allfields' })
    expect(context).toContain('all three zones')
    expect(context).not.toContain('target launch angle')
  })

  it('says nothing at all for a goal it does not know', () => {
    expect(goalContext({ id: 'dashboard' })).toBe('')
    expect(goalContext(undefined)).toBe('')
  })
})

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

  // ── Fixed in Slice 4 ──────────────────────────────────────────────────────
  // The two cases below used to be thrown away. Both surfaced to the player as a
  // connection error, which was wrong on the facts: the connection worked, the
  // model answered, and the answer was discarded on the way in. On the debrief
  // that was the full "coach unavailable" screen; in chat it was "Sorry, I
  // couldn't connect right now."

  it('reads a fence with no json tag', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('```\n{"a":1}\n```')))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('reads a fence with no json tag and prose in front of it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('Sure thing:\n\n```\n{"a":1}\n```')))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('keeps a literal fence that is part of the coach message, rather than truncating there', async () => {
    // The coach may quote a code fence inside its own answer. That is content,
    // not a wrapper, and everything after it used to be discarded.
    vi.stubGlobal('fetch', vi.fn(async () => ok('{"note":"use ``` for code","after":1}')))
    await expect(run(() => callApi({}))).resolves.toEqual({ note: 'use ``` for code', after: 1 })
  })

  it('keeps a literal fence inside a value that is itself wrapped in a fence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('```json\n{"note":"use ``` for code"}\n```')))
    await expect(run(() => callApi({}))).resolves.toEqual({ note: 'use ``` for code' })
  })

  it('reads the real shape of a chat reply, fence and all', async () => {
    const reply = '```json\n{"message":"Nice work.","chart":"trend_ev"}\n```'
    vi.stubGlobal('fetch', vi.fn(async () => ok(reply)))
    await expect(run(() => callApi({}))).resolves.toEqual({ message: 'Nice work.', chart: 'trend_ev' })
  })

  it('still refuses prose that only looks like an answer', async () => {
    // The point of the fix is to stop discarding real answers, not to start
    // accepting things that are not answers.
    vi.stubGlobal('fetch', vi.fn(async () => ok('```\nI am afraid I cannot do that.\n```')))
    await expect(run(() => callApi({}))).rejects.toThrow('Failed to parse coach response as JSON')
  })
})
