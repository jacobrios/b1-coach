import { describe, it, expect } from 'vitest'
import { readGradingOutput } from './gradingOutput.js'

// scripts/gradingOutput.js exists to read a grading run's JSON in either
// shape it might be found in. Every file written before the 19 August 2026
// self-describing-output change is a bare array; every file written after it
// is { meta, results }. Split out of scripts/replay-grading.mjs (Slice 8d,
// Task 4) so the shape check can be unit tested without spending money on a
// live grading run.

describe('readGradingOutput', () => {
  it('reads a bare array as results with no meta', () => {
    const input = [{ record: { cell: 'power-s1' }, claims: [], flagged: false }]
    expect(readGradingOutput(input)).toEqual({ meta: null, results: input })
  })

  it('reads an empty bare array', () => {
    expect(readGradingOutput([])).toEqual({ meta: null, results: [] })
  })

  it('reads a { meta, results } wrapper as-is', () => {
    const meta = { generatedAt: '2026-08-19T00:00:00.000Z', model: 'claude-haiku-4-5-20251001', handedEra: 'current', seed: 20260814 }
    const results = [{ record: { cell: 'open-s4' }, claims: [], flagged: true }]
    expect(readGradingOutput({ meta, results })).toEqual({ meta, results })
  })

  it('defaults meta to null when the wrapper omits it but results is still an array', () => {
    const results = [{ record: { cell: 'open-s4' }, claims: [], flagged: false }]
    expect(readGradingOutput({ results })).toEqual({ meta: null, results })
  })

  it('throws a plain-language error on null', () => {
    expect(() => readGradingOutput(null)).toThrow(/must be either a bare array/)
  })

  it('throws a plain-language error on a string', () => {
    expect(() => readGradingOutput('not json')).toThrow(/must be either a bare array/)
  })

  it('throws a plain-language error on a number', () => {
    expect(() => readGradingOutput(42)).toThrow(/must be either a bare array/)
  })

  it('throws a plain-language error on an object with no results field', () => {
    expect(() => readGradingOutput({ meta: { seed: 1 } })).toThrow(/must be either a bare array/)
  })

  it('throws a plain-language error when results is present but not an array', () => {
    expect(() => readGradingOutput({ meta: {}, results: { not: 'an array' } })).toThrow(/must be either a bare array/)
  })
})
