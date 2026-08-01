// The per-session numbers the app shows and the coach quotes.
//
// This lives in its own file rather than inside App.jsx so it can be tested
// without loading the whole app. The logic itself is unchanged from where it
// used to live, including the strike-zone bounds, which are also written out
// separately in DebriefScreen.jsx and in the coach prompt. Bringing those three
// copies together is deliberately not part of this change.

export const computeStats = (swings) => {
  const total = swings.length
  const avgExitVelocity = Math.round(swings.reduce((s, w) => s + w.hit.launch.exitSpeed, 0) / total)
  const avgLaunchAngle = Math.round(swings.reduce((s, w) => s + w.hit.launch.angle, 0) / total)
  const inZoneCount = swings.filter((w) =>
    w.plateLocHeight >= 1.5 && w.plateLocHeight <= 3.5 &&
    w.plateLocSide >= -0.7 && w.plateLocSide <= 0.7
  ).length
  return { avgExitVelocity, avgLaunchAngle, inZoneCount, totalSwings: total }
}
