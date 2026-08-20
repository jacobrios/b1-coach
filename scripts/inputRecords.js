// The pure half of the grader's --input flag: merge the parsed contents of a
// directory of bench output files into one gradeable list.
//
// Added in Slice 8b so the grader can read a fresh bench round (a directory
// of --out files) instead of the committed 96-debrief fixture. Split out of
// scripts/grade-coach-accuracy.mjs on the same pattern as factSheet.js,
// contentWordOverlap.js, coachFailureRecord.js and claimVerdict.js: the
// filesystem reads stay in the hand-run script, and every decision made
// after parsing lives here where scripts/inputRecords.test.js can reach it
// without spending money.

// ─────────────────────────────────────────────────────────────────────────────
// Which files in an --input directory are bench records
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS, ADDED 20 AUGUST 2026. Until Slice 9 an --input directory
// held nothing but bench output, so "every .json in the directory" and "every
// bench records file" were the same set and the loader could just concatenate
// them. Slice 9 is the first slice to write a round's GRADING output back into
// the round's own directory, beside the records it graded, and that broke the
// assumption for good.
//
// The crash was the lucky half. A { meta, results } grading file is not an
// array, so it threw, loudly, and took the free dry run down with it. The
// unlucky half is the shape every grading run wrote before 19 August 2026 and
// that both files in docs/eval-fixtures/slice8-grader-validation/ still carry:
// a BARE ARRAY of grading results. That would have been concatenated in
// silence, sent to the extraction model as though each grading result were a
// coach debrief, and billed, producing a full plausible-looking report about
// nothing. Nothing would have said so.
//
// So the fix is positive identification rather than exclusion by name: every
// file is classified by its own contents, a bench-records file is graded, a
// grading-output file is set aside and reported, and ANYTHING ELSE is refused
// by name. A file the loader cannot recognise never reaches the model. That
// holds no matter what a future slice decides to keep beside its records, and
// it needs no filename convention for anybody to remember or get wrong.

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

// scripts/bench-coach-brevity.mjs --out: a condition, a cell, a run, and
// either the coach's parsed fields or the failure marker
// scripts/coachFailureRecord.js writes.
const looksLikeBenchRecord = (e) =>
  isObject(e) &&
  typeof e.conditionKey === 'string' &&
  typeof e.cell === 'string' &&
  (e.failed === true || isObject(e.fields))

// scripts/grade-coach-accuracy.mjs --out: one entry per graded record, each
// wrapping the bench record it graded plus the claims extracted from it.
const looksLikeGradingResult = (e) => isObject(e) && isObject(e.record) && Array.isArray(e.claims)

// Returns 'bench records' or 'grading output', or throws naming the file.
// Exported so scripts/inputRecords.test.js can pin each shape directly, and
// so a caller can report what it set aside in the words a reader will
// recognise from the run header.
export function classifyInputFile(name, parsed) {
  // The { meta, results } wrapper introduced 19 August 2026; see
  // scripts/gradingOutput.js, which reads both grading shapes.
  if (isObject(parsed) && Array.isArray(parsed.results)) return 'grading output'
  if (!Array.isArray(parsed)) {
    throw new Error(
      `${name} is neither a JSON array of bench records nor a grading run's output ` +
      '({ meta, results }). Refusing to guess what it is: an --input directory is read whole, and a file ' +
      'nobody can identify must never be graded as if it were coach prose.',
    )
  }
  // An empty array carries no evidence either way. Reading it as bench
  // records changes nothing (it contributes no records) and keeps the
  // long-standing "no records to grade" refusal below as the message a
  // genuinely empty directory produces.
  if (parsed.length === 0) return 'bench records'
  if (parsed.every(looksLikeGradingResult)) return 'grading output'
  if (parsed.every(looksLikeBenchRecord)) return 'bench records'
  throw new Error(
    `${name} is an array, but its entries are not all bench records and not all grading results. ` +
    'Refusing: a file that is only half recognised is a file nobody understands, and grading the half ' +
    'that parses would be a guess. First entry keys: ' +
    `${isObject(parsed[0]) ? Object.keys(parsed[0]).join(', ') || '(none)' : typeof parsed[0]}.`,
  )
}

// filesWithRecords is an array of { name, records } entries, one per file,
// where records is whatever that file's JSON parsed to. Returns
// { records, skippedFailed, skippedFiles }: the gradeable records
// concatenated in the order given, the failed bench records set aside, and
// the whole files set aside as something other than bench records.
//
// Failed records are the ones the bench writes when a live call did not
// parse (scripts/coachFailureRecord.js): failed: true and no fields. Grading
// one would send an empty debrief to the extraction model, so they are
// partitioned out for the caller to report, never silently graded and never
// silently dropped without a count.
export function mergeInputRecords(filesWithRecords) {
  const records = []
  const skippedFailed = []
  const skippedFiles = []
  for (const { name, records: parsed } of filesWithRecords) {
    const kind = classifyInputFile(name, parsed)
    if (kind !== 'bench records') {
      skippedFiles.push({ name, kind })
      continue
    }
    for (const record of parsed) {
      if (record?.failed) skippedFailed.push(record)
      else records.push(record)
    }
  }
  if (records.length === 0) {
    const asides = []
    if (skippedFailed.length) asides.push(`${skippedFailed.length} failed record(s) were set aside`)
    if (skippedFiles.length) {
      asides.push(`${skippedFiles.length} file(s) were set aside as grading output: ` +
        skippedFiles.map((f) => f.name).join(', '))
    }
    throw new Error(
      'No records to grade: the input directory held no gradeable bench records' +
      (asides.length ? ` (${asides.join('; ')}).` : '.'),
    )
  }
  return { records, skippedFailed, skippedFiles }
}
