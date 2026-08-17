import { describe, it, expect } from 'vitest'
import { CoachCallError, buildFailureRecord } from './coachFailureRecord.js'

// See scripts/coachFailureRecord.js for why this logic was pulled out of
// scripts/bench-coach-brevity.mjs: that script runs `main()` at import time
// and cannot be imported by a test without spending money or exiting.
//
// This tests the deterministic half of the Slice 7b pivot's Task 10: the
// shape of a failure record, not the model's behaviour. Whether a real call
// actually hits MAX_TOKENS is the bench's job to observe, not this suite's
// to assert.

describe('CoachCallError', () => {
  it('defaults rawText, stopReason and outputTokens to null when not given', () => {
    const err = new CoachCallError('No text content in the response')
    expect(err.message).toBe('No text content in the response')
    expect(err.name).toBe('CoachCallError')
    expect(err.rawText).toBeNull()
    expect(err.stopReason).toBeNull()
    expect(err.outputTokens).toBeNull()
  })

  it('carries the raw reply, stop_reason and output token count when given', () => {
    const err = new CoachCallError('Failed to parse coach response as JSON', {
      rawText: '{"coachingSummary": "Jake, you hit the ball ha',
      stopReason: 'max_tokens',
      outputTokens: 4096,
    })
    expect(err.rawText).toBe('{"coachingSummary": "Jake, you hit the ball ha')
    expect(err.stopReason).toBe('max_tokens')
    expect(err.outputTokens).toBe(4096)
  })
})

describe('buildFailureRecord', () => {
  it('records only conditionKey, cell, run and the message for a plain Error', () => {
    const err = new Error('Anthropic returned 401 Unauthorized')
    const record = buildFailureRecord({ conditionKey: 'shipped', cell: 'power-s1', run: 3 }, err)
    expect(record).toEqual({
      conditionKey: 'shipped',
      cell: 'power-s1',
      run: 3,
      failed: 'Anthropic returned 401 Unauthorized',
    })
  })

  it('adds stopReason, outputTokens and rawText for a CoachCallError', () => {
    const err = new CoachCallError('Failed to parse coach response as JSON', {
      rawText: '{"coachingSummary": "cut off mid-sente',
      stopReason: 'max_tokens',
      outputTokens: 4096,
    })
    const record = buildFailureRecord({ conditionKey: 'shipped', cell: 'power-s1', run: 2 }, err)
    expect(record).toEqual({
      conditionKey: 'shipped',
      cell: 'power-s1',
      run: 2,
      failed: 'Failed to parse coach response as JSON',
      stopReason: 'max_tokens',
      outputTokens: 4096,
      rawText: '{"coachingSummary": "cut off mid-sente',
    })
  })

  it('keeps stopReason and outputTokens but leaves rawText null when there was no reply text to keep', () => {
    const err = new CoachCallError('No text content in the response', {
      stopReason: 'end_turn',
      outputTokens: 0,
    })
    const record = buildFailureRecord({ conditionKey: 'baseline', cell: 'open-s4', run: 1 }, err)
    expect(record.rawText).toBeNull()
    expect(record.stopReason).toBe('end_turn')
    expect(record.outputTokens).toBe(0)
  })
})
