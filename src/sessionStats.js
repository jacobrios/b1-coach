// The per-session numbers the app shows and the coach quotes.
//
// This lives in its own file rather than inside App.jsx so it can be tested
// without loading the whole app. The logic itself is unchanged from where it
// used to live, including the strike-zone bounds, which are also written out
// separately in DebriefScreen.jsx and in the coach prompt. Bringing those three
// copies together is deliberately not part of this change.

// A session with no swings has no average. Null rather than zero, because zero
// is a claim that the player swung and got nothing, and because the results
// screen already draws a dash where a number is missing. This is unreachable
// today, since a session always generates fifteen swings.
export const computeStats = (swings) => {
  const total = swings.length
  const avgExitVelocity = total ? Math.round(swings.reduce((s, w) => s + w.hit.launch.exitSpeed, 0) / total) : null
  const avgLaunchAngle = total ? Math.round(swings.reduce((s, w) => s + w.hit.launch.angle, 0) / total) : null
  const inZoneCount = swings.filter((w) =>
    w.plateLocHeight >= 1.5 && w.plateLocHeight <= 3.5 &&
    w.plateLocSide >= -0.7 && w.plateLocSide <= 0.7
  ).length
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
