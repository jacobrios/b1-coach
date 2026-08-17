// The bench's own failure record.
//
// Added in the Slice 7b pivot (17 August 2026), after the before-run for the
// session-1 MAX_TOKENS bug threw away every piece of evidence it produced.
// Before this, a failed call in scripts/bench-coach-brevity.mjs landed in the
// results array as `{ conditionKey, cell, run, failed: err.message }` and
// nothing else — no raw reply, no stop_reason, no output token count.
// Diagnosing why 7 of 10 session-1 calls hit the 4096-token ceiling needed a
// separate scratch script and real money, because the bench itself had never
// kept the evidence it generated on the way to failing.
//
// This lives in its own module, not inline in bench-coach-brevity.mjs,
// because that script runs `main()` unconditionally at import time (it is a
// hand-run script, not a library) — importing it in a test would try to
// spend money or exit on a missing API key. Same reasoning as
// contentWordOverlap.js and factSheet.js: pull the pure, testable piece out
// so it can be checked without the network.

// Thrown by scripts/bench-coach-brevity.mjs's callCoach when a call reaches
// Anthropic and gets a response, but that response cannot be turned into a
// usable debrief — either there was no text at all, or the text did not
// parse as JSON. `rawText`, `stopReason` and `outputTokens` are whatever the
// response actually carried; each defaults to null rather than being
// omitted, so a caller can always read all three without an `in` check.
//
// Deliberately NOT used for the case where the HTTP response itself was not
// ok (a non-2xx status). That path already has a reason not to echo the
// response body: an auth failure can carry a key fragment back in its error
// text, and this output gets written to disk and pasted around. Only a
// response that Anthropic actually answered successfully reaches this class.
export class CoachCallError extends Error {
  constructor(message, { rawText = null, stopReason = null, outputTokens = null } = {}) {
    super(message)
    this.name = 'CoachCallError'
    this.rawText = rawText
    this.stopReason = stopReason
    this.outputTokens = outputTokens
  }
}

// Turns a caught error into the record the bench pushes onto its results
// array. A plain Error (network failure, non-ok HTTP status) produces the
// same three-field record the bench has always written. A CoachCallError
// adds the three evidence fields on top, so a parse failure or an empty
// reply keeps what the model actually sent instead of just the fact that it
// failed.
export function buildFailureRecord({ conditionKey, cell, run }, err) {
  const record = { conditionKey, cell, run, failed: err.message }
  if (err instanceof CoachCallError) {
    record.stopReason = err.stopReason
    record.outputTokens = err.outputTokens
    record.rawText = err.rawText
  }
  return record
}
