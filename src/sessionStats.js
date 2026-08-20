// The per-session numbers the app shows and the coach quotes.
//
// This lives in its own file rather than inside App.jsx so it can be tested
// without loading the whole app. The logic itself is unchanged from where it
// used to live, including the strike-zone bounds, which are also written out
// separately in DebriefScreen.jsx and in the coach prompt. Bringing those three
// copies together is deliberately not part of this change.

// The strike-zone bounds, one of the copies CLAUDE.md's consolidation note
// counts. This file's copy backs the inZoneCount the prompt hands the coach,
// and since Slice 8c also the zone count lines and the grader's zone stats,
// so at least those three can no longer disagree with each other.
export const STRIKE_ZONE = { heightMin: 1.5, heightMax: 3.5, sideMin: -0.7, sideMax: 0.7 }

export const inStrikeZone = (w) =>
  w.plateLocHeight >= STRIKE_ZONE.heightMin && w.plateLocHeight <= STRIKE_ZONE.heightMax &&
  w.plateLocSide >= STRIKE_ZONE.sideMin && w.plateLocSide <= STRIKE_ZONE.sideMax

// Which swings were on pitches outside the zone, and which way each one was
// off. `outside` is the union (a pitch can be both low and wide, and must
// count once); high/low/wide are the per-direction sub-lists the coach kept
// working out for itself and getting wrong.
export function pitchZoneBreakdown(swings) {
  const select = (pred) => {
    const hit = swings.map((w, i) => ({ n: i + 1, w })).filter(({ w }) => pred(w))
    return { count: hit.length, swings: hit.map((s) => s.n) }
  }
  return {
    outside: select((w) => !inStrikeZone(w)),
    high: select((w) => w.plateLocHeight > STRIKE_ZONE.heightMax),
    low: select((w) => w.plateLocHeight < STRIKE_ZONE.heightMin),
    wide: select((w) => w.plateLocSide < STRIKE_ZONE.sideMin || w.plateLocSide > STRIKE_ZONE.sideMax),
  }
}

// Where pull side ends and opposite field begins. Added in Slice 10 after the
// browser QA gate caught this app holding two answers to that question at
// once: the coach was told "negative direction is pull side" and duly named
// six pull-side swings, while the spray chart beside it coloured only the
// three below -15 and called the other three Center. Neither was wrong on its
// own terms; the app was wrong to hold two conventions. These are the chart's
// numbers, which are also the ones the Hit to All Fields goal has always
// asked for, so the screen is the winner of the tie.
//
// Same job as STRIKE_ZONE above: a classification several places have to
// agree on, defined once. DebriefScreen.jsx still writes its own -15 and +15
// into the chart; those agree with these and consolidating them is recorded
// as remaining debt rather than done here, to keep this fix out of the screen.
export const SPRAY_CUTOFFS = { pull: -15, oppo: 15 }

// Which swings went where. Every swing lands in exactly one of the three, so
// the counts are a partition of the session and always sum to its length,
// which is what lets all three be handed to the coach as fact. Unlike
// pitchZoneBreakdown above there is no union bucket here: a ball cannot be
// pulled and hit the other way at once.
export function sprayBreakdown(swings) {
  const select = (pred) => {
    const hit = swings
      .map((w, i) => ({ n: i + 1, direction: w.hit.launch.direction }))
      .filter(({ direction }) => pred(direction))
    return { count: hit.length, swings: hit.map((s) => s.n) }
  }
  return {
    pull: select((d) => d < SPRAY_CUTOFFS.pull),
    middle: select((d) => d >= SPRAY_CUTOFFS.pull && d <= SPRAY_CUTOFFS.oppo),
    oppo: select((d) => d > SPRAY_CUTOFFS.oppo),
  }
}

// A session with no swings has no average. Null rather than zero, because zero
// is a claim that the player swung and got nothing, and because the results
// screen already draws a dash where a number is missing. This is unreachable
// today, since a session always generates fifteen swings.
export const computeStats = (swings) => {
  const total = swings.length
  const avgExitVelocity = total ? Math.round(swings.reduce((s, w) => s + w.hit.launch.exitSpeed, 0) / total) : null
  const avgLaunchAngle = total ? Math.round(swings.reduce((s, w) => s + w.hit.launch.angle, 0) / total) : null
  const inZoneCount = swings.filter(inStrikeZone).length
  return { avgExitVelocity, avgLaunchAngle, inZoneCount, totalSwings: total }
}

// The single number the Top Exit Velocity tile shows. It lives here rather than
// inline in App.jsx so it can be tested: the tile is the one place a session's
// hardest swing is quoted back to the player on its own.
// Null on an empty session for the same reason: Math.max of nothing is
// -Infinity, and "-Infinity mph" is what the tile would have shown.
export const topExitVelocity = (swings) => (
  swings.length ? Math.max(...swings.map((w) => w.hit.launch.exitSpeed)) : null
)
