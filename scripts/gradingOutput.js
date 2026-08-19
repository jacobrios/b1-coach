// Reads a grading run's JSON in either shape it might be found in: a bare
// array of results (every file written before 19 August 2026's
// self-describing-output change, including the two Slice 8c fixtures this
// slice replays) or the { meta, results } wrapper that change introduced.
//
// Split out of scripts/replay-grading.mjs (Slice 8d, Task 4) on the same
// pattern as factSheet.js and inputRecords.js: the shape check is pure, so
// it lives here where scripts/gradingOutput.test.js can reach it without a
// network call or an API key.

export function readGradingOutput(json) {
  if (Array.isArray(json)) {
    return { meta: null, results: json }
  }
  if (json && typeof json === 'object' && Array.isArray(json.results)) {
    return { meta: json.meta ?? null, results: json.results }
  }
  throw new Error(
    'Grading output must be either a bare array of results (the shape every file written before ' +
    '19 August 2026 used) or an object of the form { meta, results } with results as an array. ' +
    `Got: ${describeValue(json)}.`,
  )
}

function describeValue(json) {
  if (json === null) return 'null'
  if (Array.isArray(json)) return 'an array' // unreachable given the check above; kept for a clear message if that ever changes
  return typeof json
}
