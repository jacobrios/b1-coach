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

// filesWithRecords is an array of { name, records } entries, one per file,
// where records is whatever that file's JSON parsed to. Returns
// { records, skippedFailed }: the gradeable records concatenated in the
// order given, and the failed bench records set aside.
//
// Failed records are the ones the bench writes when a live call did not
// parse (scripts/coachFailureRecord.js): failed: true and no fields. Grading
// one would send an empty debrief to the extraction model, so they are
// partitioned out for the caller to report, never silently graded and never
// silently dropped without a count.
export function mergeInputRecords(filesWithRecords) {
  const records = []
  const skippedFailed = []
  for (const { name, records: parsed } of filesWithRecords) {
    if (!Array.isArray(parsed)) {
      throw new Error(`${name} did not parse to a JSON array of bench records.`)
    }
    for (const record of parsed) {
      if (record?.failed) skippedFailed.push(record)
      else records.push(record)
    }
  }
  if (records.length === 0) {
    throw new Error(
      'No records to grade: the input directory held no gradeable bench records' +
      (skippedFailed.length ? ` (${skippedFailed.length} failed record(s) were set aside).` : '.'),
    )
  }
  return { records, skippedFailed }
}
