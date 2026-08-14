// Tests for the single choke point every coach request goes through.
//
// Two behaviors matter here and neither is visible on a happy path: the one
// automatic retry, which fires only for failures that never reached a good
// response and only while the call's time budget can still afford it, and the
// unwrapping of a model response that arrives fenced in Markdown. Both were
// added because the real thing went wrong; both are silent when they work.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callApi, goalContext, generateDebrief, sendChatMessage, CoachError } from './coachApi.js'
import { distanceDistributionLine } from './ballFlight.js'

const RETRY_DELAY_MS = 1500
const REQUEST_TIMEOUT_MS = 50000

const ok = (text) => ({
  ok: true,
  status: 200,
  json: async () => ({ content: [{ type: 'text', text }] }),
})

// A non-ok response carrying the server's classified envelope from api/coach.js:
// { error: { reason, upstreamStatus, upstreamMs, cold } }.
const serverError = (status, reason, cold = false) => ({
  ok: false,
  status,
  headers: { get: () => null },
  json: async () => ({ error: { reason, upstreamStatus: status, upstreamMs: 10, cold } }),
})

// The legacy caller-shape refusal from api/coach.js's `reject`, where `error` is
// a bare string rather than the classified envelope object.
const legacyInvalid = (status = 400) => ({
  ok: false,
  status,
  headers: { get: () => null },
  json: async () => ({ error: 'Invalid request' }),
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

  // power, contact and popup quote their target numbers, so they read the shared
  // definition without checking it is there. Nothing else keeps this switch and
  // GOAL_TARGETS in step, and a goal that lost its target would throw here
  // rather than in a test: every debrief for that goal would fail before the
  // request was even sent. This is that missing check.
  it.each(['power', 'contact', 'popup', 'allfields', 'open', 'dashboard'])(
    'builds the context for %s without throwing',
    (id) => {
      expect(() => goalContext({ id })).not.toThrow()
    },
  )
})

describe('reading the reason a failure carries', () => {
  // The five classification branches from the plan, each checked by reading
  // `reason` and `cold` off the CoachError callApi throws, not by string
  // matching a message.

  it('branch 1: an abort is classified timeout', async () => {
    const fetchMock = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted')
        err.name = 'AbortError'
        reject(err)
      })
    }))
    vi.stubGlobal('fetch', fetchMock)

    const promise = callApi({ messages: [] })
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    await expect(promise).rejects.toMatchObject({ reason: 'timeout' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // Found by review: the deadline used to cover only the wait for headers.
  // clearTimeout sat in a finally around the fetch call alone, so once headers
  // arrived, reading the body had no deadline at all. These two pin that the
  // same AbortController now covers the body read too, for both the coach's
  // reply and the server's error envelope.

  it('the deadline covers reading a successful reply, not just the wait for headers', async () => {
    const fetchMock = vi.fn((_url, { signal }) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const promise = callApi({ messages: [] })
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    await expect(promise).rejects.toMatchObject({ reason: 'timeout', respondedOk: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('the deadline covers reading the server error envelope, not just the wait for headers', async () => {
    const fetchMock = vi.fn((_url, { signal }) => Promise.resolve({
      ok: false,
      status: 502,
      headers: { get: () => null },
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const promise = callApi({ messages: [] })
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    await expect(promise).rejects.toMatchObject({ reason: 'timeout' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('branch 2: any other thrown error is classified unreachable', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('network down') })
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'unreachable' })
  })

  it('branch 3: a non-ok response with a server envelope uses its reason and cold verbatim', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => serverError(502, 'credits', true)))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'credits', cold: true })
  })

  it('branch 4: a non-ok response with no usable envelope reads timeout off a 504 status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 504,
      headers: { get: () => null },
      json: async () => { throw new Error('not json') },
    })))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'timeout' })
  })

  it('branch 4: a non-ok response with no usable envelope reads timeout off an x-vercel-error header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 502,
      headers: { get: (name) => (name === 'x-vercel-error' ? 'FUNCTION_INVOCATION_TIMEOUT' : null) },
      json: async () => ({}),
    })))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'timeout' })
  })

  it('branch 4: a non-ok response with no usable envelope otherwise reads unreachable, and a bare string error does not crash it', async () => {
    // The older 400 caller-shape refusal answers { error: 'Invalid request' },
    // a string rather than the classified envelope object. Reading `.reason`
    // off a string must not throw and must not be mistaken for a real reason.
    vi.stubGlobal('fetch', vi.fn(async () => legacyInvalid(400)))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'unreachable' })
  })

  it('branch 5: an ok response with no text content is classified trouble', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ content: [] }) })))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'trouble' })
  })

  it('branch 5: an ok response that will not parse is classified trouble', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('I am afraid I cannot do that.')))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'trouble' })
  })

  // Found by review after this task's first pass: an ok response whose body is
  // not valid JSON at all (not even an unparseable coach reply, the envelope
  // itself) reached response.json() outside any try, so it threw a raw
  // SyntaxError with no `reason`. A caller switching on `.reason` would see
  // `undefined`, which is exactly the blank-screen failure this slice exists
  // to prevent.
  it('branch 5: an ok response whose body is not JSON at all is classified trouble, not a raw SyntaxError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token in JSON') },
    })))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'trouble', respondedOk: true })
  })

  // A null body reaches the same unguarded `.content` read and throws a raw
  // TypeError instead, for the same reason.
  it('branch 5: an ok response whose body is null is classified trouble, not a raw TypeError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => null })))

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'trouble', respondedOk: true })
  })
})

describe('the retry policy: cheap failures repeat once, an already-spent wait never does', () => {
  it('does not retry when the first attempt works', async () => {
    const fetchMock = vi.fn(async () => ok('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)

    await run(() => callApi({ messages: [] }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries for unreachable: the fetch never reached the server', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(ok('{"recovered":true}'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await run(() => callApi({ messages: [] }))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ recovered: true })
  })

  it('retries for trouble: the server answered quickly with an error, not a good reply', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(serverError(502, 'trouble'))
      .mockResolvedValueOnce(ok('{"recovered":true}'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await run(() => callApi({ messages: [] }))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ recovered: true })
  })

  it('does not retry credits on a cold instance either, because a dry balance is not a waking-up problem', async () => {
    // This test used to assert the opposite, and the opposite was wrong. Cold is
    // the ordinary state of a stranger's first click, and a drained balance is
    // the failure this whole slice exists to report honestly. Retrying it told
    // the visitor "Trying once more" for something a second try can never fix.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(serverError(502, 'credits', true))
      .mockResolvedValueOnce(ok('{"recovered":true}'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'credits', cold: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a cold timeout either, so cold changes no answer the reason had not already given', async () => {
    // The other half of why cold is not consulted at all: every reason it could
    // have flipped either must not retry (credits, timeout) or already retries
    // without it (unreachable, trouble).
    const fetchMock = vi.fn(async () => serverError(504, 'timeout', true))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'timeout' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry timeout: the visitor already waited the whole budget', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 504,
      headers: { get: () => null },
      json: async () => ({}),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'timeout' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('trap: does not retry timeout even when cold is also set, because timeout wins', async () => {
    const fetchMock = vi.fn(async () => serverError(504, 'timeout', true))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'timeout', cold: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry credits: reloading the balance is not something a second try fixes', async () => {
    const fetchMock = vi.fn(async () => serverError(502, 'credits', false))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'credits' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('trap: does not retry a parse failure that followed a successful response, because that attempt already spent its full wait', async () => {
    const fetchMock = vi.fn(async () => ok('I am afraid I cannot do that.'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'trouble' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // Found by the whole-branch review. The ceiling used to rest on an assumption
  // stated in a comment: that everything retryable "answered quickly." Nothing
  // in the code held it. A degraded Anthropic answering 529 at 35 seconds is a
  // server-classified 'trouble', and it bought a second attempt with a fresh
  // full deadline, so the roughly 50 second promise quietly became roughly 90.
  // The budget below is the same promise made structural: one wall clock for
  // the whole call, spent down by each attempt.

  it('a trouble that took 35 seconds does not buy a second full wait', async () => {
    const startedAt = Date.now()
    let finishedAt = null

    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        setTimeout(() => resolve(serverError(502, 'trouble')), 35000)
      }))
      .mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }))
    vi.stubGlobal('fetch', fetchMock)

    const promise = callApi({ messages: [] })
    const settled = promise.then(
      () => { finishedAt = Date.now() },
      () => { finishedAt = Date.now() },
    )
    await vi.advanceTimersByTimeAsync(4 * REQUEST_TIMEOUT_MS)
    await settled

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(finishedAt - startedAt).toBeLessThanOrEqual(REQUEST_TIMEOUT_MS)
  })

  it('does not start a second attempt with almost none of the budget left', async () => {
    // A retry here could not finish before the ceiling anyway, so all it would
    // buy the visitor is a longer silence before the same honest message.
    const onRetry = vi.fn()
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        setTimeout(() => resolve(serverError(502, 'trouble')), 49000)
      }))
      .mockResolvedValue(ok('{"recovered":true}'))
    vi.stubGlobal('fetch', fetchMock)

    const promise = callApi({ messages: [] }, { onRetry })
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(4 * REQUEST_TIMEOUT_MS)

    await expect(promise).rejects.toMatchObject({ reason: 'trouble' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('tells the caller a retry is happening, and what it is retrying for', async () => {
    const onRetry = vi.fn()
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(ok('{}')))

    await run(() => callApi({ messages: [] }, { onRetry }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith({ reason: 'unreachable', cold: false })
  })

  it('does not announce a retry that never happened', async () => {
    const onRetry = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => ok('{}')))

    await run(() => callApi({ messages: [] }, { onRetry }))

    expect(onRetry).not.toHaveBeenCalled()
  })

  it('gives up after the second failure rather than retrying forever', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('genuinely dead') })
    vi.stubGlobal('fetch', fetchMock)

    await expect(run(() => callApi({ messages: [] }))).rejects.toMatchObject({ reason: 'unreachable' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('survives a caller that passes no options at all', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(ok('{}')))

    await expect(run(() => callApi({ messages: [] }))).resolves.toEqual({})
  })

  it('every CoachError thrown is an instance callers can check with instanceof', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => serverError(502, 'credits', false)))

    await expect(run(() => callApi({ messages: [] }))).rejects.toBeInstanceOf(CoachError)
  })

  // A note on the ceiling tests above, because an earlier version of this file
  // got them wrong twice and the second mistake is the instructive one.
  //
  // The first attempt mocked two instant fetches, advanced 1500ms, and asserted
  // the resolved result, which was 'retries for unreachable' under a grander
  // name. It would have passed no matter what REQUEST_TIMEOUT_MS was.
  //
  // It was replaced by an argument rather than a test: that a timeout is the
  // only failure that can spend the whole budget, and it never retries, so
  // everything else must fail fast. The whole-branch review found the hole. A
  // server-classified 'trouble' can take 35 seconds to arrive and still retry,
  // so "fails fast" was an assumption about Anthropic's behavior, not a
  // property of this code. The two tests above measure the clock instead of
  // reasoning about it, which is why they could go red and the argument could
  // not.
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

  // Found by an independent review of Slice 4, before merge. The first version of
  // the fix read the reply as it stood and then fell back to the outermost
  // braces, which quietly regressed two cases the old regex did handle: a brace
  // anywhere in the prose around the fence dragged the slice past the JSON. The
  // coach writes prose for a living, so a stray brace in a friendly closing
  // sentence is not exotic, and it would have reached the player as a connection
  // error.

  it('reads a fenced reply with prose after the closing fence', async () => {
    const reply = '```json\n{"message":"ok"}\n```\nWant the {spray} chart too?'
    vi.stubGlobal('fetch', vi.fn(async () => ok(reply)))
    await expect(run(() => callApi({}))).resolves.toEqual({ message: 'ok' })
  })

  it('reads a fenced reply with a brace in the prose before it', async () => {
    const reply = 'Quick note {see below}:\n```json\n{"message":"ok"}\n```'
    vi.stubGlobal('fetch', vi.fn(async () => ok(reply)))
    await expect(run(() => callApi({}))).resolves.toEqual({ message: 'ok' })
  })

  it('reads a bare object with a sentence in front of it and no fence at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('Here you go: {"a":1}')))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('reads the answer when the reply carries a third fence after it', async () => {
    // The fence match is greedy to the last fence, so a trailing code sample
    // swallows the real closing fence. The braces inside the block still find it.
    const reply = '```json\n{"a":1}\n```\nAlso ```code``` if you want it.'
    vi.stubGlobal('fetch', vi.fn(async () => ok(reply)))
    await expect(run(() => callApi({}))).resolves.toEqual({ a: 1 })
  })

  it('refuses a reply that opens an object and never closes it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('{"a":1')))
    await expect(run(() => callApi({}))).rejects.toThrow('Failed to parse coach response as JSON')
  })

  it('still refuses prose that only looks like an answer', async () => {
    // The point of the fix is to stop discarding real answers, not to start
    // accepting things that are not answers.
    vi.stubGlobal('fetch', vi.fn(async () => ok('```\nI am afraid I cannot do that.\n```')))
    await expect(run(() => callApi({}))).rejects.toThrow('Failed to parse coach response as JSON')
  })
})

// Task 4 of the honest-ball-flight slice: the debrief prompt and the chat
// prompt both used to write out the same 160-220/220-260/260-300/300-340/340+
// filter logic by hand, tuned to the old dishonest carry formula. The chat
// prompt is the one CLAUDE.md names as "easy to miss" — Slice 4's chart-slot
// validation had exactly this failure once already. These tests read the
// actual text callApi sends, not a copy of the buckets, so a hand-written
// range creeping back into either prompt fails here.
describe('the distance distribution both prompts describe', () => {
  // src/App.jsx's mockSwings distances, the hand-written session 1 every
  // visitor opens on.
  const mockDistances = [170, 122, 310, 126, 345, 224, 150, 277, 185, 241, 279, 97, 290, 201, 346]
  const swings = mockDistances.map((distance) => ({
    plateLocHeight: 2.5,
    plateLocSide: 0,
    hit: {
      launch: { exitSpeed: 80, angle: 15, direction: 0 },
      landing: { distance },
    },
  }))
  const session = {
    sessionNumber: 1,
    stats: { avgExitVelocity: 80, avgLaunchAngle: 15, inZoneCount: 10, totalSwings: 15 },
    swings,
  }
  const goal = { id: 'open', label: 'Open Session' }
  const player = { firstName: 'Test' }

  // Runs a real call through callApi with fetch stubbed, and hands back the
  // exact user-message text that was about to leave the browser.
  async function capturedMessage(sendCall) {
    const fetchMock = vi.fn(async () => ok('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)
    await run(sendCall)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    return body.messages[0].content
  }

  it('the debrief prompt states the exact five-bucket distribution', async () => {
    const message = await capturedMessage(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    // Hardcoded rather than built from distanceDistributionLine, so this does
    // not just prove the prompt echoes whatever that function currently
    // returns — it proves the buckets are actually the ones the plan chose.
    expect(message).toContain(
      'Distance distribution: Under 150ft: 3 swings, 150-200ft: 3 swings, 200-250ft: 3 swings, 250-300ft: 3 swings, 300+ft: 3 swings',
    )
  })

  it('the chat prompt — the copy that is easy to miss — states the identical distribution', async () => {
    const message = await capturedMessage(() =>
      sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'What should I work on next round?' }],
      }),
    )
    expect(message).toContain(
      'Distance distribution: Under 150ft: 3 swings, 150-200ft: 3 swings, 200-250ft: 3 swings, 250-300ft: 3 swings, 300+ft: 3 swings',
    )
  })

  it('cannot drift apart: the debrief prompt and the chat prompt report the same sentence for the same swings', async () => {
    const debriefMessage = await capturedMessage(() =>
      generateDebrief({ goal, player, sessions: [session], viewingSessionNumber: 1 }),
    )
    const chatMessage = await capturedMessage(() =>
      sendChatMessage({
        goal, player, sessions: [session], viewingSessionNumber: 1,
        messages: [{ role: 'user', content: 'What should I work on next round?' }],
      }),
    )
    const extract = (text) => text.match(/Distance distribution: [^\n]+/)[0]
    expect(extract(debriefMessage)).toBe(extract(chatMessage))
    // Also matches the function both prompts actually call, confirming the
    // request that left the browser is not some third, independent value.
    expect(extract(debriefMessage)).toBe(`Distance distribution: ${distanceDistributionLine(swings)}`)
  })
})
