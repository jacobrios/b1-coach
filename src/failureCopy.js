// What the app says when a debrief or a chat reply fails, and the two lines
// shown while waiting is still normal.
//
// This is the single place that copy lives, for the same reason chartSlots.js
// and goalTargets.js are their own files: it can be tested without loading a
// DOM, and both the debrief screen and the chat panel read from one table
// instead of each carrying their own guess.
//
// The strings below were written and approved by the product manager on
// 13 August 2026 and are not to be reworded. Every one of them is a fact
// somebody reported (the server, or this app's own deadline), never an
// inference: this app used to tell every visitor the server had been asleep,
// which was often untrue, including once for a drained API balance that no
// retry could ever fix.

const COPY = {
  credits: {
    message: "The coach runs on prepaid Anthropic API credits, and they've run dry. That's a funding problem on my end, not a bug. They'll be topped back up.",
    // The only reason with no button: a retry here cannot work, and offering
    // one would promise something that cannot happen.
    showRetry: false,
  },
  timeout: {
    message: "The coach took too long on this one. Anthropic's API didn't answer within 40 seconds, so the demo stopped waiting rather than leave you hanging.",
    showRetry: true,
  },
  trouble: {
    message: "Anthropic's API is having trouble right now, and that's what the coach thinks with. Nothing is broken in the demo itself. Give it a minute.",
    showRetry: true,
  },
  unreachable: {
    message: "Couldn't reach the coach's server at all. That's either Vercel, where this demo is hosted, or your own connection.",
    showRetry: true,
  },
}

// Cold start is a modifier on timeout, not a fourth reason of its own: the
// server can only report it was cold if it lived long enough to answer. A
// cold instance that fails for credits or trouble still reads as credits or
// trouble, so this only ever swaps in for the timeout row.
const TIMEOUT_COLD_MESSAGE = "The coach's server was asleep and took too long waking up. This demo runs on Vercel, where the server naps when nobody is using it."

// Shown once the loading screen has been waiting 25 seconds. Debriefs measure
// 20 to 30 seconds on a healthy day, so this sets an expectation against the
// real 40 second deadline instead of claiming something unusual is happening,
// which would be untrue for a large share of the sessions that see it.
export const MID_WAIT_MESSAGE = 'Still working. The coach can take up to 40 seconds on a full session.'

// Shown while the one automatic retry (unreachable or trouble) is in flight.
// Deliberately the same line regardless of which of those two reasons triggered
// it: what the visitor needs to know is that something is happening again, not
// which reason caused the first attempt to fail.
export const RETRYING_MESSAGE = "That didn't go through. Trying once more."

// The copy for a failed debrief or chat reply: the message to show and
// whether a Try Again button belongs next to it. An unrecognized reason
// (including one this app has never seen, or none at all) falls back to the
// 'trouble' copy rather than rendering nothing. A blank failure screen is the
// worst outcome available here, worse than a copy that is slightly too
// general for what actually happened.
export function failureCopy(reason, cold = false) {
  if (reason === 'timeout' && cold) {
    return { message: TIMEOUT_COLD_MESSAGE, showRetry: true }
  }
  // COPY is a plain object, so it inherits from Object.prototype. A lookup of
  // `COPY['constructor']` (or 'toString', 'valueOf', 'hasOwnProperty',
  // '__proto__') finds that inherited property and returns it, and it is not
  // nullish, so `COPY[reason] ?? COPY.trouble` would silently skip the
  // fallback and hand the caller something that is not a copy object at all.
  // That is the exact blank screen this fallback exists to prevent, reached
  // through a different door. hasOwnProperty is checked explicitly so only a
  // reason this table actually defines can bypass the fallback.
  return Object.prototype.hasOwnProperty.call(COPY, reason) ? COPY[reason] : COPY.trouble
}
