// The model and the response length are pinned here, on the server, so that a
// caller cannot choose what this endpoint spends on the project's key.
//
// They are ALSO set at the top of src/coachApi.js, deliberately, and the two
// must be kept in step. Local development never runs this file: vite.config.js
// proxies /api/coach straight to api.anthropic.com, and Anthropic requires model
// and max_tokens in the body. Change one of these places without the other and
// local development quietly tests a different model than production ships.
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

// Measured on 30 July 2026 by running four real sessions: a session 4 debrief,
// the largest request the app sends on its own, is 13.7 KB, and each further
// chat turn adds roughly 0.9 KB on top. 128 KB is about nine times the largest
// real request and leaves room for well over a hundred chat turns, so it caps
// what a stranger can push through this key without ever being reachable by a
// visitor who simply went further than anyone else.
const MAX_INPUT_BYTES = 128 * 1024

// One shape for every refusal. A caller learns that the request was refused and
// nothing else: not what was wrong with it, not that a size limit exists, not
// where that limit sits.
//
// This is the caller-shape refusal only, kept exactly as it was. It is not a
// visitor-facing failure reason (see the classification below); it means a
// caller sent something this app never sends, and there is no product reason
// to describe it any further.
const reject = (res) => res.status(400).json({ error: 'Invalid request' })

// How long this function waits on Anthropic before giving up on its own terms.
// vercel.json pins this function's platform deadline at 60 seconds; 40 sits
// inside that on purpose, so the function always has time left to answer with
// a real error rather than being killed mid-response.
const UPSTREAM_DEADLINE_MS = 40000

// Whether this instance has handled a request before. Module scope, so it
// survives between invocations on the same warm instance and resets to false
// only when Vercel spins up a fresh one. Every invocation reads it into
// `wasCold` before setting it true, including the GET/HEAD liveness pings: an
// instance the uptime monitor just woke is genuinely warm by the time a
// visitor's POST lands, so a ping has to count as the thing that warmed it, not
// just POSTs.
let instanceWarm = false

// The three reasons a visitor-facing failure can carry: 'credits' (the prepaid
// balance is drained), 'timeout' (this function gave up at its own deadline),
// 'trouble' (anything else). These strings are also written in src/, on the
// client side that renders them into a message. That duplication is
// deliberate, the same call already made for MODEL and MAX_TOKENS above:
// importing across the api/ and src/ boundary is an unproven build seam on
// this project, so the two sides are kept in step by hand instead.

export default async function handler(req, res) {
  const wasCold = !instanceWarm
  instanceWarm = true

  // Liveness only, for the uptime monitor that keeps this function warm. It must
  // never read the body or call Anthropic, so a ping every five minutes is free.
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.status(200)
    return req.method === 'HEAD' ? res.end() : res.json({ ok: true })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, HEAD, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reject(res)
  }
  if (typeof body.system !== 'string') {
    return reject(res)
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return reject(res)
  }
  // Plain text only. Anthropic also accepts content blocks that point at a URL,
  // and it fetches and bills those itself, which would put the cost of a request
  // back in the caller's hands no matter what the size cap below says. This app
  // has only ever sent a string.
  for (const message of body.messages) {
    if (!message || typeof message !== 'object' || typeof message.content !== 'string') {
      return reject(res)
    }
  }

  // Rebuild the payload from scratch rather than editing the caller's copy, so
  // only the two fields this app actually sends can ever reach Anthropic.
  const payload = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: body.system,
    messages: body.messages,
  }

  // Deeply nested input parses fine and then blows the stack on the way back
  // out, so serializing is inside the guard rather than assumed safe.
  let forwarded
  try {
    forwarded = JSON.stringify(payload)
  } catch {
    return reject(res)
  }
  if (new TextEncoder().encode(forwarded).length > MAX_INPUT_BYTES) {
    return reject(res)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_DEADLINE_MS)
  const startedAt = Date.now()
  let upstreamMs

  try {
    let response
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: forwarded,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
      upstreamMs = Date.now() - startedAt
    }

    const data = await response.json()

    if (response.ok) {
      res.setHeader('x-coach-upstream-ms', String(upstreamMs))
      res.setHeader('x-coach-cold', String(wasCold))
      return res.status(response.status).json(data)
    }

    // A 400 knowingly covers two different situations: Anthropic refusing a
    // drained balance, and Anthropic refusing a request malformed in some way
    // this app has never sent. The second is far more likely our own bug than
    // Anthropic having trouble, so it falls into 'trouble' rather than getting
    // its own reason. Matched against the serialized body rather than a nested
    // field, because Anthropic nests the message inside an error object and
    // this check must not depend on that shape holding.
    const isCreditsFailure = response.status === 400 && /credit balance is too low/i.test(JSON.stringify(data))
    const reason = isCreditsFailure ? 'credits' : 'trouble'
    return res.status(502).json({
      error: { reason, upstreamStatus: response.status, upstreamMs, cold: wasCold },
    })
  } catch {
    if (upstreamMs === undefined) {
      clearTimeout(timer)
      upstreamMs = Date.now() - startedAt
    }
    const reason = controller.signal.aborted ? 'timeout' : 'trouble'
    return res.status(reason === 'timeout' ? 504 : 502).json({
      error: { reason, upstreamStatus: null, upstreamMs, cold: wasCold },
    })
  }
}
