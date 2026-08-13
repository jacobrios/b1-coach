// Tests for the approved copy table a failed debrief or chat reply is read
// from. The strings are written out here as literals on purpose, matching the
// convention in goalTargets.test.js: reading them from the module under test
// would let a wording change quietly rewrite its own test, which is exactly
// the change that most deserves to fail loudly. These strings were approved
// by the product manager on 13 August 2026 and must match character for
// character.

import { describe, it, expect } from 'vitest'
import { failureCopy, MID_WAIT_MESSAGE, RETRYING_MESSAGE } from './failureCopy.js'

describe('the approved copy for each failure reason', () => {
  it('credits: out of API credits, no Try Again button', () => {
    expect(failureCopy('credits')).toEqual({
      message: "The coach runs on prepaid Anthropic API credits, and they've run dry. That's a funding problem on my end, not a bug. They'll be topped back up.",
      showRetry: false,
    })
  })

  it('timeout: the 40 second deadline, with a Try Again button', () => {
    expect(failureCopy('timeout')).toEqual({
      message: "The coach took too long on this one. Anthropic's API didn't answer within 40 seconds, so the demo stopped waiting rather than leave you hanging.",
      showRetry: true,
    })
  })

  it('timeout with cold: the sleeping-server wording, with a Try Again button', () => {
    expect(failureCopy('timeout', true)).toEqual({
      message: "The coach's server was asleep and took too long waking up. This demo runs on Vercel, where the server naps when nobody is using it.",
      showRetry: true,
    })
  })

  it('trouble: Anthropic itself is having trouble, with a Try Again button', () => {
    expect(failureCopy('trouble')).toEqual({
      message: "Anthropic's API is having trouble right now, and that's what the coach thinks with. Nothing is broken in the demo itself. Give it a minute.",
      showRetry: true,
    })
  })

  it('unreachable: our own function could not be reached, with a Try Again button', () => {
    expect(failureCopy('unreachable')).toEqual({
      message: "Couldn't reach the coach's server at all. That's either Vercel, where this demo is hosted, or your own connection.",
      showRetry: true,
    })
  })

  it('cold on a non-timeout reason does not switch to the sleeping-server wording', () => {
    // Cold is a modifier on timeout only. A cold, credits-refused instance is
    // still a credits failure, and a cold, trouble-refused instance is still
    // a trouble failure. Only timeout has a second row for it.
    expect(failureCopy('credits', true).message).toBe(failureCopy('credits', false).message)
    expect(failureCopy('trouble', true).message).toBe(failureCopy('trouble', false).message)
    expect(failureCopy('unreachable', true).message).toBe(failureCopy('unreachable', false).message)
  })
})

describe('an unrecognized reason', () => {
  it('falls back to the trouble copy rather than rendering nothing', () => {
    expect(failureCopy('not_a_real_reason')).toEqual(failureCopy('trouble'))
  })

  it('falls back to the trouble copy when no reason is given at all', () => {
    expect(failureCopy(undefined)).toEqual(failureCopy('trouble'))
    expect(failureCopy(null)).toEqual(failureCopy('trouble'))
  })

  // A plain object literal used as a lookup table inherits from
  // Object.prototype, so a reason string that happens to name one of its
  // properties is not actually missing from the table: COPY['constructor']
  // returns the Object constructor function, which is not nullish, so
  // `?? COPY.trouble` never fires. That is the exact blank screen this
  // fallback exists to prevent, just reached through a different door. The
  // server only ever sends one of the four real reasons today, so this is not
  // reachable in practice, but the guarantee this module makes is that no
  // string reaches a blank screen, not "no string we currently send."
  it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'])(
    'does not leak an inherited Object.prototype property through the fallback for %s',
    (reason) => {
      expect(failureCopy(reason)).toEqual(failureCopy('trouble'))
    }
  )
})

describe('the two lines shown while waiting is still normal', () => {
  it('the mid-wait line sets an expectation against the real deadline', () => {
    expect(MID_WAIT_MESSAGE).toBe('Still working. The coach can take up to 40 seconds on a full session.')
  })

  it('the retry line is the neutral true thing, not a claim about why', () => {
    expect(RETRYING_MESSAGE).toBe("That didn't go through. Trying once more.")
  })
})
