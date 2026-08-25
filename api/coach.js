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
  //
  // It carries the same warmth header the success path sets below, and that is
  // the whole point of it being here: a POST costs an Anthropic call, so before
  // this line the only way to ask whether an instance had been asleep was to pay
  // for the answer, which meant nobody ever asked. Here the question is free,
  // repeatable, and answerable with curl by a session that has none of this
  // conversation's context.
  //
  // Read it precisely. The ping itself is what warms the instance, so this
  // reports whether the instance serving THIS request was already awake when it
  // arrived, not whether some other instance is warm now. On an app with this
  // little traffic that is the question worth asking; on a busy one it would not
  // be. See docs/pre-deploy-checklist.md for what to do with the answer.
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('x-coach-cold', String(wasCold))
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

  // The deadline covers the whole exchange, not just the wait for headers. The
  // timer is cleared in the outer finally below, once this handler is done with
  // the response body, so a body that stalls after a fast set of headers is
  // still aborted at 40 seconds rather than running unbounded. src/coachApi.js
  // carries the same shape on its own side of the wire, and the two must agree:
  // when this function overruns, the browser's 50 second backstop fires first
  // and the visitor gets a generic guess instead of the specific answer this
  // function exists to give.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_DEADLINE_MS)
  const startedAt = Date.now()

  // Elapsed time is read where it is reported rather than pinned when the
  // headers land, because a slow body is time the visitor spent waiting too.
  const upstreamMsNow = () => Date.now() - startedAt

  // Null means nobody answered, and only that. It is filled in the moment
  // Anthropic responds, so a failure that happens after a real response still
  // reports the status that response carried.
  let upstreamStatus = null

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: forwarded,
      signal: controller.signal,
    })
    upstreamStatus = response.status

    if (response.ok) {
      const data = await response.json()
      res.setHeader('x-coach-upstream-ms', String(upstreamMsNow()))
      res.setHeader('x-coach-cold', String(wasCold))
      return res.status(response.status).json(data)
    }

    // A non-ok response is not guaranteed to be JSON. An infrastructure gateway
    // failing (a 502 or 503) commonly answers with an HTML error page instead,
    // and that is exactly the case this diagnostic exists to catch, so a body
    // that fails to parse falls back to an empty object rather than throwing
    // and losing the reason classification below.
    let data = {}
    try {
      data = await response.json()
    } catch (err) {
      // Unless the deadline is what interrupted the read. That is a timeout and
      // must be reported as one, not swallowed into 'trouble' by the fallback
      // this catch exists for.
      if (controller.signal.aborted) throw err
      // Otherwise leave data as {}; the status below is still the real one.
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
      error: { reason, upstreamStatus, upstreamMs: upstreamMsNow(), cold: wasCold },
    })
  } catch {
    // Everything that failed after Anthropic answered arrives here too: an
    // aborted body read, or a 200 whose body would not parse. Those had a real
    // response, so upstreamStatus reports it rather than claiming nobody
    // answered at all.
    const reason = controller.signal.aborted ? 'timeout' : 'trouble'
    return res.status(reason === 'timeout' ? 504 : 502).json({
      error: { reason, upstreamStatus, upstreamMs: upstreamMsNow(), cold: wasCold },
    })
  } finally {
    clearTimeout(timer)
  }
}
