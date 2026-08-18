// Tests for the pure half of the grader's --input flag: merging the parsed
// contents of a directory of bench output files into one gradeable list.
// The filesystem half (readdir, readFile, JSON.parse) stays in
// scripts/grade-coach-accuracy.mjs; what is tested here is every decision
// made after parsing, so a wrong merge shows up as a red test rather than a
// wrong grading run later.

import { describe, it, expect } from 'vitest'
import { mergeInputRecords } from './inputRecords.js'

const ok = (cell, run) => ({ conditionKey: 'shipped', cell, run, fields: { coachingSummary: 'text' } })
const failed = (cell, run) => ({ conditionKey: 'shipped', cell, run, failed: true, error: 'parse failure' })

describe('mergeInputRecords', () => {
  it('concatenates records across files in the order given', () => {
    const { records } = mergeInputRecords([
      { name: 'a.json', records: [ok('power-s1', 1), ok('power-s1', 2)] },
      { name: 'b.json', records: [ok('popup-s4', 1)] },
    ])
    expect(records.map((r) => `${r.cell}/${r.run}`)).toEqual([
      'power-s1/1', 'power-s1/2', 'popup-s4/1',
    ])
  })

  it('sets aside failed bench records rather than grading their empty fields', () => {
    // A bench call that failed to parse produces a record with failed: true
    // and no fields (see scripts/coachFailureRecord.js). Grading one would
    // send an empty debrief to the extraction model and spend money asking
    // about nothing, so they are partitioned out and reported, never graded.
    const { records, skippedFailed } = mergeInputRecords([
      { name: 'a.json', records: [ok('power-s1', 1), failed('power-s1', 2), ok('power-s1', 3)] },
    ])
    expect(records.map((r) => r.run)).toEqual([1, 3])
    expect(skippedFailed).toHaveLength(1)
    expect(skippedFailed[0].run).toBe(2)
  })

  it('refuses a file whose content is not an array, naming the file', () => {
    expect(() => mergeInputRecords([
      { name: 'a.json', records: [ok('power-s1', 1)] },
      { name: 'notes.json', records: { some: 'object' } },
    ])).toThrow(/notes\.json/)
  })

  it('refuses an empty input set outright', () => {
    // A directory with no .json files, or files that were all empty arrays,
    // means there is nothing to grade; proceeding would print a report about
    // nothing and read as a clean run.
    expect(() => mergeInputRecords([])).toThrow(/no records/i)
    expect(() => mergeInputRecords([{ name: 'a.json', records: [] }])).toThrow(/no records/i)
  })

  it('a set that is all failures is refused, not reported as clean', () => {
    expect(() => mergeInputRecords([
      { name: 'a.json', records: [failed('power-s1', 1)] },
    ])).toThrow(/no records/i)
  })
})
