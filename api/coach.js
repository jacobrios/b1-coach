// The model and the response length are pinned here, on the server, so that a
// caller cannot choose what this endpoint spends on the project's key.
//
// They are ALSO set in src/coachApi.js:1-2, deliberately, and the two must be
// kept in step. Local development never runs this file: vite.config.js proxies
// /api/coach straight to api.anthropic.com, and Anthropic requires model and
// max_tokens in the body. Change one of these places without the other and
// local development quietly tests a different model than production ships.
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

export default async function handler(req, res) {
  // Liveness only, for the uptime monitor that keeps this function warm. It must
  // never read the body or call Anthropic, so a ping every five minutes is free.
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.status(200)
    return req.method === 'HEAD' ? res.end() : res.json({ ok: true })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid request' })
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request' })
  }
  if (typeof body.system !== 'string') {
    return res.status(400).json({ error: 'Invalid request' })
  }

  // Rebuild the payload from scratch rather than editing the caller's copy, so
  // only the two fields this app actually sends can ever reach Anthropic.
  const payload = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: body.system,
    messages: body.messages,
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
