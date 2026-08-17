// How much one piece of coach prose restates another, measured
// deterministically so a word-count floor cannot be satisfied by padding.
//
// Built for scripts/bench-coach-brevity.mjs to check whatThisMeans against
// coachingSummary: Slice 7b raised whatThisMeans's floor to three sentences,
// and the failure mode that invites is a coach that hits the floor by saying
// the summary again in different words rather than adding anything. This is
// the check for that, no model call needed.
//
// It lives in src/ rather than inside the bench script itself so it can be
// reached by the test suite, on the same "pull pure logic out so a test can
// reach it" pattern this project already uses for chartSlots.js,
// ballFlight.js and scrollFade.js. One thing is different about this one and
// is worth naming rather than leaving implicit: those modules are consumed by
// the running app AND by scripts; this one is consumed only by the bench.
// That is a deliberate, disclosed departure from the usual shape, made
// because the alternative (a function that only ever lives inside a
// scripts/*.mjs file) can never be reached by vitest, and the whole point of
// writing this as a pure function was to make it testable.
//
// DEFINITION. Jaccard similarity over lowercased content words: split on
// anything that is not a letter, digit or apostrophe, drop tokens under
// three letters, and drop a short stopword list of connective tissue (the,
// a, was, that, you, and, and so on) that two sentences about the same swing
// will always share regardless of whether real content repeats. Jaccard is
// |intersection| / |union| of the two resulting word sets: 0 means no shared
// content words, 1 means the same set of content words on both sides. It is
// deliberately not a substring or edit-distance measure; two sentences can
// share every content word while being reordered or reworded, which is
// exactly the restatement this exists to catch.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'so', 'to', 'of', 'in', 'on',
  'at', 'by', 'for', 'with', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'it', 'its', 'you', 'your', 'that', 'this', 'these',
  'those', 'there', 'here', 'what', 'which', 'who', 'whom', 'not', 'no',
  'do', 'does', 'did', 'has', 'have', 'had', 'will', 'would', 'can', 'could',
  'should', 'shall', 'may', 'might', 'than', 'then', 'when', 'where', 'while',
  'about', 'into', 'over', 'out', 'off', 'up', 'down', 'more', 'most', 'one',
  'get', 'got', 'just', 'right', 'like', 'now', 'next', 'still', 'also',
])

export function contentWords(text) {
  if (typeof text !== 'string') return new Set()
  const tokens = text
    .toLowerCase()
    .replace(/[*_`#>]/g, ' ')
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
  return new Set(tokens)
}

export function contentWordOverlap(textA, textB) {
  const a = contentWords(textA)
  const b = contentWords(textB)
  if (a.size === 0 || b.size === 0) return 0

  let intersection = 0
  for (const w of a) {
    if (b.has(w)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}
