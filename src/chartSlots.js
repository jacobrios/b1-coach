// Which charts the debrief screen shows, and how a slot gets filled when the
// model names one that does not exist.
//
// This lives in its own file rather than inside DebriefScreen.jsx so it can be
// tested without loading the whole results screen, which drags in Recharts and
// needs a DOM. The logic itself is unchanged from where it used to live.

// The only chart keys this screen can actually render. Kept in sync with the list
// the coach prompt offers the model in coachApi.js.
export const CHART_KEYS = [
  'scatter_ev_la',
  'trend_ev',
  'bar_distance',
  'spray_direction',
  'zone_breakdown',
  'pitch_location',
]

// Stand-ins when the model names a chart that does not exist. Both work for every
// goal, so a slot always shows real session data instead of an empty box.
export const FALLBACK_CHART_KEYS = ['scatter_ev_la', 'trend_ev']

// Whether a single key the coach named is one this screen can actually render.
// A chat reply carries one chart key and it overwrites a chart already on the
// debrief, so an unchecked key costs the visitor a chart they were looking at.
// Returns the key itself so a caller can use the result directly, or null.
// Note the prompt asks the model for "chart_key or null", and the string "null"
// is a real answer it gives, which passes a plain truthiness check.
export function validChartKey(key) {
  return typeof key === 'string' && CHART_KEYS.includes(key) ? key : null
}

// Normalize charts array to exactly 2 slots for the bottom row. The model names
// the charts it wants, so a key it invents is a claim to be rejected, not a
// fact: anything outside CHART_KEYS is dropped and a real chart takes its place
// rather than an empty box.
export function resolveChartSlots(charts = []) {
  const normalizeChart = (c) => {
    const type = c == null ? null : typeof c === 'string' ? c : c.type
    return CHART_KEYS.includes(type) ? { type } : null
  }

  const chartSlots = [normalizeChart(charts[0]), normalizeChart(charts[1])]

  // A key the model names twice is as unusable as one it invents: the same chart
  // drawn side by side is not two charts, and the visitor loses one of the two
  // they were owed. Drop the repeat and let the fallback below fill the slot.
  if (chartSlots[0] && chartSlots[1] && chartSlots[0].type === chartSlots[1].type) {
    chartSlots[1] = null
  }

  chartSlots.forEach((chart, i) => {
    if (chart) return
    const used = chartSlots.filter(Boolean).map((c) => c.type)
    // Preferred fallbacks first, then any remaining real chart, so a slot can
    // never end up with an undefined type and the two slots never collide.
    chartSlots[i] = { type: [...FALLBACK_CHART_KEYS, ...CHART_KEYS].find((k) => !used.includes(k)) }
  })

  return chartSlots
}
