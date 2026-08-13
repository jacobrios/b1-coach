// Tests for the serverless proxy.
//
// This file is the reason the suite exists. Local development never runs
// api/coach.js (vite.config.js proxies /api/coach straight to Anthropic), so
// during Slice 2 every one of these cases was checked by hand against a deployed
// preview, and a throwaway harness was written and discarded. This is that
// harness, kept.
//
// Nothing here touches the network: fetch is stubbed, so no test costs money.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from './coach.js'

const PINNED_MODEL = 'claude-sonnet-4-6'
const PINNED_MAX_TOKENS = 4096
const MAX_INPUT_BYTES = 128 * 1024

// Vercel hands the handler a Node response object with status/json helpers. This
// records what the handler did instead of writing it to a socket.
function makeRes() {
  const res = { statusCode: null, body: undefined, ended: false, headers: {} }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (payload) => { res.body = payload; return res }
  res.end = () => { res.ended = true; return res }
  res.setHeader = (k, v) => { res.headers[k] = v; return res }
  return res
}

let sentToAnthropic

beforeEach(() => {
  sentToAnthropic = null
  vi.stubGlobal('fetch', async (url, init) => {
    sentToAnthropic = { url, body: JSON.parse(init.body) }
    // A real fetch Response computes `ok` from the status; this stand-in has to
    // set it explicitly, since a plain object does not.
    return { status: 200, ok: true, json: async () => ({ content: [{ type: 'text', text: '{}' }] }) }
  })
})

// A test that leaves fake timers on would corrupt every test that runs after
// it in this file, not just itself. This runs whether the test above it
// passed, failed, or threw, so that can never happen.
afterEach(() => {
  vi.useRealTimers()
})

async function call(req) {
  const res = makeRes()
  await handler(req, res)
  return res
}

const validBody = () => ({
  system: 'you are a coach',
  messages: [{ role: 'user', content: 'hello' }],
})

describe('liveness, which must never cost anything', () => {
  it('answers GET with 200 and does not call Anthropic', async () => {
    const res = await call({ method: 'GET' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(sentToAnthropic).toBeNull()
  })

  it('answers HEAD with 200, no body, and does not call Anthropic', async () => {
    const res = await call({ method: 'HEAD' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBeUndefined()
    expect(res.ended).toBe(true)
    expect(sentToAnthropic).toBeNull()
  })

  it('does not read the request body on a liveness ping', async () => {
    // Reading the body is what would cost something on a monitor's ping, so this
    // gives the handler a body that screams if touched rather than merely
    // checking the status code twice.
    let bodyWasRead = false
    const req = { method: 'GET' }
    Object.defineProperty(req, 'body', {
      get() { bodyWasRead = true; throw new Error('body was read on a liveness ping') },
    })

    const res = await call(req)

    expect(res.statusCode).toBe(200)
    expect(bodyWasRead).toBe(false)
  })
})

describe('methods this endpoint does not serve', () => {
  it.each(['PUT', 'DELETE', 'PATCH', 'OPTIONS'])('refuses %s with 405', async (method) => {
    const res = await call({ method, body: validBody() })
    expect(res.statusCode).toBe(405)
    expect(sentToAnthropic).toBeNull()
  })

  it('names the methods it does serve, which is what a monitor looks for', async () => {
    const res = await call({ method: 'PUT' })
    expect(res.headers.Allow).toBe('GET, HEAD, POST')
  })
})

describe('the server, not the caller, decides what a request costs', () => {
  it('forwards the pinned model and response length', async () => {
    await call({ method: 'POST', body: validBody() })
    expect(sentToAnthropic.body.model).toBe(PINNED_MODEL)
    expect(sentToAnthropic.body.max_tokens).toBe(PINNED_MAX_TOKENS)
  })

  it('ignores an expensive model and a huge response length asked for by the caller', async () => {
    await call({
      method: 'POST',
      body: { ...validBody(), model: 'claude-opus-4-1', max_tokens: 60000 },
    })
    expect(sentToAnthropic.body.model).toBe(PINNED_MODEL)
    expect(sentToAnthropic.body.max_tokens).toBe(PINNED_MAX_TOKENS)
  })

  it('forwards nothing beyond the four fields it builds itself', async () => {
    await call({
      method: 'POST',
      body: { ...validBody(), temperature: 1, stream: true, tools: [{ name: 'x' }], metadata: {} },
    })
    expect(Object.keys(sentToAnthropic.body).sort()).toEqual(
      ['max_tokens', 'messages', 'model', 'system'],
    )
  })

  it('passes the caller system prompt and messages through unchanged', async () => {
    const body = validBody()
    await call({ method: 'POST', body })
    expect(sentToAnthropic.body.system).toBe(body.system)
    expect(sentToAnthropic.body.messages).toEqual(body.messages)
  })
})

describe('requests shaped like nothing this app sends', () => {
  const rejected = {
    'no body at all': undefined,
    'a body that is not an object': 'hello',
    'an array body': [1, 2, 3],
    'no messages': { system: 'x' },
    'messages as a string': { system: 'x', messages: 'hello' },
    'an empty messages array': { system: 'x', messages: [] },
    'system as a number': { system: 42, messages: [{ role: 'user', content: 'hi' }] },
    'a non-string content': { system: 'x', messages: [{ role: 'user', content: 42 }] },
    'a non-string content on a later message': {
      system: 'x',
      messages: [{ role: 'user', content: 'ok' }, { role: 'user', content: 42 }],
    },
    'a null message': { system: 'x', messages: [null] },
  }

  it.each(Object.entries(rejected))('refuses %s with 400, before spending anything', async (_label, body) => {
    const res = await call({ method: 'POST', body })
    expect(res.statusCode).toBe(400)
    expect(sentToAnthropic).toBeNull()
  })

  it('refuses content that points at a URL, which Anthropic would fetch and bill', async () => {
    // The byte cap cannot catch this: the request is tiny and the cost is not.
    const res = await call({
      method: 'POST',
      body: {
        system: 'x',
        messages: [{
          role: 'user',
          content: [{ type: 'document', source: { type: 'url', url: 'https://example.com/big.pdf' } }],
        }],
      },
    })
    expect(res.statusCode).toBe(400)
    expect(sentToAnthropic).toBeNull()
  })

  it('refuses input that cannot be serialized, rather than crashing', async () => {
    // The realistic route here is input nested deeply enough to blow the stack on
    // the way back out, which parses fine and only fails on the return trip. That
    // depth is not a fixed number, though: it moves with the Node version and the
    // platform, and a test tuned to it would eventually go red for no reason. A
    // circular reference reaches the same guard deterministically.
    const body = { system: 'x', messages: [{ role: 'user', content: 'hi' }] }
    body.messages[0].self = body

    const res = await call({ method: 'POST', body })

    expect(res.statusCode).toBe(400)
    expect(sentToAnthropic).toBeNull()
  })

  it('says the same thing however the request was wrong', async () => {
    // Two different messages would let someone probe for where the limits sit.
    const tooBig = await call({
      method: 'POST',
      body: { system: 'x', messages: [{ role: 'user', content: 'x'.repeat(MAX_INPUT_BYTES) }] },
    })
    const malformed = await call({ method: 'POST', body: { system: 'x' } })
    expect(tooBig.body).toEqual(malformed.body)
    expect(tooBig.body).toEqual({ error: 'Invalid request' })
  })
})

describe('the size cap', () => {
  it('lets through a request the size of a real session 4 debrief', async () => {
    // Measured at 13,729 bytes on 30 July 2026 by running four real sessions.
    const res = await call({
      method: 'POST',
      body: { system: 'x'.repeat(4482), messages: [{ role: 'user', content: 'x'.repeat(9100) }] },
    })
    expect(res.statusCode).toBe(200)
    expect(sentToAnthropic).not.toBeNull()
  })

  it('lets through a request just under the cap', async () => {
    const res = await call({
      method: 'POST',
      body: { system: 'x', messages: [{ role: 'user', content: 'x'.repeat(120 * 1024) }] },
    })
    expect(res.statusCode).toBe(200)
  })

  it('refuses a request over the cap', async () => {
    const res = await call({
      method: 'POST',
      body: { system: 'x', messages: [{ role: 'user', content: 'x'.repeat(200 * 1024) }] },
    })
    expect(res.statusCode).toBe(400)
    expect(sentToAnthropic).toBeNull()
  })

  // Build a request whose forwarded payload serializes to exactly `bytes`. All
  // ASCII, so one character is one byte. Without this the cap is only tested from
  // 6% away on one side, and flipping the comparison to >= would go unnoticed.
  const bodyOfExactly = (bytes) => {
    const overhead = JSON.stringify({
      model: PINNED_MODEL,
      max_tokens: PINNED_MAX_TOKENS,
      system: 'x',
      messages: [{ role: 'user', content: '' }],
    }).length
    return { system: 'x', messages: [{ role: 'user', content: 'a'.repeat(bytes - overhead) }] }
  }

  it('accepts a request of exactly the cap, because the cap is the last allowed size', async () => {
    const res = await call({ method: 'POST', body: bodyOfExactly(MAX_INPUT_BYTES) })
    expect(res.statusCode).toBe(200)
  })

  it('refuses a request one byte over the cap', async () => {
    const res = await call({ method: 'POST', body: bodyOfExactly(MAX_INPUT_BYTES + 1) })
    expect(res.statusCode).toBe(400)
    expect(sentToAnthropic).toBeNull()
  })

  it('measures the payload it forwards, not the one it was handed', async () => {
    // A caller could otherwise pad with fields that get dropped and never counted.
    const res = await call({
      method: 'POST',
      body: {
        system: 'x',
        messages: [{ role: 'user', content: 'hi' }],
        ignored: 'x'.repeat(200 * 1024),
      },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('what comes back on success', () => {
  it('returns the success body byte for byte unchanged, since callApi parses it', async () => {
    const res = await call({ method: 'POST', body: validBody() })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ content: [{ type: 'text', text: '{}' }] })
  })

  it('carries the upstream timing and cold-instance headers', async () => {
    const res = await call({ method: 'POST', body: validBody() })
    expect(res.headers['x-coach-upstream-ms']).toBeDefined()
    expect(res.headers['x-coach-cold']).toBeDefined()
  })
})

describe('the server classifies its own failures', () => {
  it('turns an aborted request into timeout, 504, once the 40 second deadline fires', async () => {
    vi.useFakeTimers()
    let aborted = false
    vi.stubGlobal('fetch', (url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        aborted = true
        const err = new Error('This operation was aborted')
        err.name = 'AbortError'
        reject(err)
      })
    }))

    const resPromise = call({ method: 'POST', body: validBody() })

    // Bound the deadline from below too, not just above: advancing to 40000
    // alone would still pass if the real deadline had regressed to something
    // much shorter, like 5000ms.
    await vi.advanceTimersByTimeAsync(39999)
    expect(aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    const res = await resPromise

    expect(res.statusCode).toBe(504)
    expect(res.body).toEqual({
      error: { reason: 'timeout', upstreamStatus: null, upstreamMs: expect.any(Number), cold: expect.any(Boolean) },
    })
  })

  // Found by the whole-branch review. The 40 second deadline used to stop at
  // the headers: clearTimeout sat in a finally around the fetch call alone, so
  // the moment Anthropic answered, reading the body had no deadline at all.
  // src/coachApi.js had already fixed exactly this bug on its own side of the
  // wire, which left the two files contradicting each other. A stalled body
  // read here runs past 40 seconds, the browser's 50 second backstop fires
  // first, and the visitor gets the browser's generic guess instead of this
  // function's specific answer, which is the whole outcome this slice exists to
  // prevent. These four mirror the shape src/coachApi.js uses.

  it('the deadline covers reading a successful body, not just the wait for headers', async () => {
    vi.useFakeTimers()
    let aborted = false
    vi.stubGlobal('fetch', async (url, init) => ({
      status: 200,
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          aborted = true
          const err = new Error('This operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }),
    }))

    const resPromise = call({ method: 'POST', body: validBody() })

    // Bounded from below as well as above, the same way the abort test is: the
    // body read must still be running at 39999ms, or a deadline that had
    // regressed to something much shorter would pass this unnoticed.
    await vi.advanceTimersByTimeAsync(39999)
    expect(aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    const res = await resPromise

    expect(aborted).toBe(true)
    expect(res.statusCode).toBe(504)
    expect(res.body.error.reason).toBe('timeout')
  })

  it('the deadline covers reading a non-ok body too', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', async (url, init) => ({
      status: 529,
      ok: false,
      json: () => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('This operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }),
    }))

    const resPromise = call({ method: 'POST', body: validBody() })
    await vi.advanceTimersByTimeAsync(40000)
    const res = await resPromise

    expect(res.statusCode).toBe(504)
    expect(res.body.error.reason).toBe('timeout')
    // The response did arrive, so its status is reported even though what
    // followed was a timeout. null here would mean nobody answered at all.
    expect(res.body.error.upstreamStatus).toBe(529)
  })

  it('measures upstream time through the body read, since that is time the visitor waited', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', async () => ({
      status: 200,
      ok: true,
      json: () => new Promise((resolve) => {
        setTimeout(() => resolve({ content: [{ type: 'text', text: '{}' }] }), 5000)
      }),
    }))

    const resPromise = call({ method: 'POST', body: validBody() })
    await vi.advanceTimersByTimeAsync(5000)
    const res = await resPromise

    expect(Number(res.headers['x-coach-upstream-ms'])).toBeGreaterThanOrEqual(5000)
  })

  it('reports the real upstream status when a successful body will not parse', async () => {
    // upstreamStatus is null only when there was no response. A 200 whose body
    // then failed had a response, and saying otherwise makes the one diagnostic
    // field in this envelope untrue.
    vi.stubGlobal('fetch', async () => ({
      status: 200,
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0') },
    }))
    const res = await call({ method: 'POST', body: validBody() })
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({
      error: { reason: 'trouble', upstreamStatus: 200, upstreamMs: expect.any(Number), cold: expect.any(Boolean) },
    })
  })

  it('reports the real upstream status when a non-ok response is not JSON', async () => {
    // An infrastructure gateway returning a 502/503 with an HTML error page,
    // not a JSON body, is exactly the case this diagnostic exists to catch.
    // Losing the real status here and reporting null (meaning "no response at
    // all") would be worse than not having the field.
    vi.stubGlobal('fetch', async () => ({
      status: 503,
      ok: false,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0') },
    }))
    const res = await call({ method: 'POST', body: validBody() })
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({
      error: { reason: 'trouble', upstreamStatus: 503, upstreamMs: expect.any(Number), cold: expect.any(Boolean) },
    })
  })

  it('turns a drained balance into credits, 502, matched against the serialized body', async () => {
    vi.stubGlobal('fetch', async () => ({
      status: 400,
      ok: false,
      json: async () => ({
        error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Claude API' },
      }),
    }))
    const res = await call({ method: 'POST', body: validBody() })
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({
      error: { reason: 'credits', upstreamStatus: 400, upstreamMs: expect.any(Number), cold: expect.any(Boolean) },
    })
  })

  it('turns any other non-ok status into trouble, 502', async () => {
    vi.stubGlobal('fetch', async () => ({
      status: 529,
      ok: false,
      json: async () => ({ error: { type: 'overloaded_error', message: 'Overloaded' } }),
    }))
    const res = await call({ method: 'POST', body: validBody() })
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({
      error: { reason: 'trouble', upstreamStatus: 529, upstreamMs: expect.any(Number), cold: expect.any(Boolean) },
    })
  })

  it('turns a 400 that is not about credits into trouble, not credits', async () => {
    vi.stubGlobal('fetch', async () => ({
      status: 400,
      ok: false,
      json: async () => ({ error: { type: 'invalid_request_error', message: 'messages: at least one message is required' } }),
    }))
    const res = await call({ method: 'POST', body: validBody() })
    expect(res.statusCode).toBe(502)
    expect(res.body.error.reason).toBe('trouble')
  })

  it('turns a thrown fetch into trouble, 502, rather than crashing', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('socket hang up') })
    const res = await call({ method: 'POST', body: validBody() })
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({
      error: { reason: 'trouble', upstreamStatus: null, upstreamMs: expect.any(Number), cold: expect.any(Boolean) },
    })
  })
})

describe('cold instance detection', () => {
  // Each test here resets the module registry so it gets its own fresh
  // `instanceWarm` module-scope flag, rather than inheriting whatever earlier
  // tests in this file left behind.
  async function freshHandler() {
    vi.resetModules()
    const mod = await import('./coach.js')
    return mod.default
  }

  it('reports cold on the first invocation of a fresh instance', async () => {
    const handlerFn = await freshHandler()
    const res = makeRes()
    await handlerFn({ method: 'POST', body: validBody() }, res)
    expect(res.headers['x-coach-cold']).toBe('true')
  })

  it('reports warm on a later invocation of the same instance', async () => {
    const handlerFn = await freshHandler()
    await handlerFn({ method: 'POST', body: validBody() }, makeRes())
    const res = makeRes()
    await handlerFn({ method: 'POST', body: validBody() }, res)
    expect(res.headers['x-coach-cold']).toBe('false')
  })

  it('a liveness GET marks the instance warm for the POST that follows', async () => {
    const handlerFn = await freshHandler()
    await handlerFn({ method: 'GET' }, makeRes())
    const res = makeRes()
    await handlerFn({ method: 'POST', body: validBody() }, res)
    expect(res.headers['x-coach-cold']).toBe('false')
  })

  it('pins cold: true in a failure envelope on a genuinely cold instance', async () => {
    const handlerFn = await freshHandler()
    vi.stubGlobal('fetch', async () => { throw new Error('socket hang up') })
    const res = makeRes()
    await handlerFn({ method: 'POST', body: validBody() }, res)
    expect(res.body.error.cold).toBe(true)
  })

  it('pins cold: false in a failure envelope once the instance has warmed', async () => {
    const handlerFn = await freshHandler()
    // The default beforeEach stub is still in place here, so this first call
    // succeeds and only warms the instance.
    await handlerFn({ method: 'POST', body: validBody() }, makeRes())
    vi.stubGlobal('fetch', async () => { throw new Error('socket hang up') })
    const res = makeRes()
    await handlerFn({ method: 'POST', body: validBody() }, res)
    expect(res.body.error.cold).toBe(false)
  })
})
