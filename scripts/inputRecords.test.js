// Tests for the pure half of the grader's --input flag: merging the parsed
// contents of a directory of bench output files into one gradeable list.
// The filesystem half (readdir, readFile, JSON.parse) stays in
// scripts/grade-coach-accuracy.mjs; what is tested here is every decision
// made after parsing, so a wrong merge shows up as a red test rather than a
// wrong grading run later.

import { describe, it, expect } from 'vitest'
import { mergeInputRecords, classifyInputFile } from './inputRecords.js'

const ok = (cell, run) => ({ conditionKey: 'shipped', cell, run, fields: { coachingSummary: 'text' } })
// The real shape scripts/coachFailureRecord.js:48 writes: `failed` is the
// caught error's MESSAGE, a string, never the boolean `true`. This helper
// used to fabricate `failed: true`, which is why 9 tests built on it never
// caught the predicate bug fixed in inputRecords.js on 20 August 2026: the
// fabricated boolean happened to satisfy the wrong `e.failed === true` check
// the same way the real string never could.
const failed = (cell, run) => ({ conditionKey: 'shipped', cell, run, failed: 'JSON.parse failed on model reply' })
// What a grading run writes: the { meta, results } wrapper since 19 August
// 2026, and a bare array of the same results before that. Slice 9 is the
// first slice to commit one of these INSIDE a round directory, beside the
// bench records it graded, which is what made this classification necessary.
const gradingResult = (cell, run) => ({
  record: ok(cell, run),
  claims: [{ kind: 'threshold', verdict: 'TRUE' }],
  flagged: false,
})
const gradingWrapper = (...results) => ({ meta: { builder: 'current', seed: 20260814 }, results })

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

  // ── Grading output sitting beside bench records ────────────────────────────
  //
  // Slice 9 writes each round's grading.json into the round's own directory,
  // so every --input directory now holds a file that is NOT bench records.
  // Two shapes have to be recognised, and the second is the dangerous one:
  // the { meta, results } wrapper is at least not an array, so it used to
  // crash; a bare-array grading file (every run before 19 August 2026, and
  // both files in docs/eval-fixtures/slice8-grader-validation/) would have
  // been concatenated in silence and sent to the extraction model as if it
  // were coach prose, at real cost, producing a plausible wrong report.

  it('sets aside a { meta, results } grading file rather than grading it', () => {
    const { records, skippedFiles } = mergeInputRecords([
      { name: 'grading.json', records: gradingWrapper(gradingResult('power-s1', 1)) },
      { name: 'shipped-64.json', records: [ok('power-s1', 1), ok('power-s1', 2)] },
    ])
    expect(records).toHaveLength(2)
    expect(skippedFiles).toEqual([{ name: 'grading.json', kind: 'grading output' }])
  })

  it('sets aside a BARE-ARRAY grading file rather than concatenating it', () => {
    const { records, skippedFiles } = mergeInputRecords([
      { name: 'validate-96.json', records: [gradingResult('power-s1', 1), gradingResult('power-s1', 2)] },
      { name: 'shipped-64.json', records: [ok('power-s1', 1)] },
    ])
    expect(records).toHaveLength(1)
    expect(records[0].cell).toBe('power-s1')
    expect(skippedFiles).toEqual([{ name: 'validate-96.json', kind: 'grading output' }])
  })

  it('refuses a directory that holds grading output and nothing gradeable', () => {
    expect(() => mergeInputRecords([
      { name: 'validate-96.json', records: [gradingResult('power-s1', 1)] },
    ])).toThrow(/grading output/i)
  })

  it('refuses an array of things that are neither bench records nor grading results', () => {
    expect(() => mergeInputRecords([
      { name: 'shipped-64.json', records: [ok('power-s1', 1)] },
      { name: 'notes.json', records: [{ note: 'ran this round twice' }] },
    ])).toThrow(/notes\.json/)
  })

  it('refuses a file that is bench records with one foreign entry mixed in', () => {
    // Half-recognised is not recognised: a file that is mostly bench records
    // with something else in it is a file nobody understands, and grading the
    // recognised part of it would be a guess.
    expect(() => mergeInputRecords([
      { name: 'shipped-64.json', records: [ok('power-s1', 1), { note: 'oops' }] },
    ])).toThrow(/shipped-64\.json/)
  })
})

describe('classifyInputFile', () => {
  it('names the bench-records shape', () => {
    expect(classifyInputFile('shipped-64.json', [ok('power-s1', 1)])).toBe('bench records')
    expect(classifyInputFile('shipped-64.json', [failed('power-s1', 1)])).toBe('bench records')
  })

  it('names both grading-output shapes', () => {
    expect(classifyInputFile('grading.json', gradingWrapper(gradingResult('power-s1', 1)))).toBe('grading output')
    expect(classifyInputFile('grading.json', [gradingResult('power-s1', 1)])).toBe('grading output')
  })

  it('reads an empty array as bench records, so it contributes nothing and refuses nothing', () => {
    expect(classifyInputFile('empty.json', [])).toBe('bench records')
  })

  it('refuses anything it cannot positively identify, naming the file', () => {
    expect(() => classifyInputFile('notes.json', { some: 'object' })).toThrow(/notes\.json/)
    expect(() => classifyInputFile('notes.json', 'a string')).toThrow(/notes\.json/)
    expect(() => classifyInputFile('notes.json', null)).toThrow(/notes\.json/)
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
