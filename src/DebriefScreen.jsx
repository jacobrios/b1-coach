import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { sendChatMessage, CoachError } from './coachApi'
import { resolveChartSlots, validChartKey } from './chartSlots'
import { goalTarget, hasTarget, meetsTarget } from './goalTargets'
import { distanceBucketCounts, sprayRadius, SPRAY_RINGS, SPRAY_FAIR_RADIUS } from './ballFlight'
import { failureCopy } from './failureCopy'
import { shouldShowScrollFade } from './scrollFade'
import {
  ScatterChart, Scatter, LineChart, Line, BarChart, Bar, LabelList,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Cell,
} from 'recharts'

const ACCENT = '#FF6B1A'

// How a swing is drawn on a goal that has no target. There is no hit or miss to
// show, so every swing looks the same and none of them looks faded out. The
// "missed it" styling is deliberately not reused here: dimming a whole session
// reads as the app telling the player every swing was bad, which is what an Open
// Session visitor used to see.
const NEUTRAL_SWING_FILL = 'rgba(255,255,255,0.55)'
const NEUTRAL_SWING_OPACITY = 0.85

// Axis title and tick text, shared across all six charts below. Before this,
// each chart wrote its own copy: axis titles were nine separate objects at
// 9px and 30% white, faint enough that the size and the faintness were both
// costing legibility, and tick numbers were ten separate objects that had
// quietly drifted to three different sizes (9px, 10px, 11px) with nobody
// deciding the spread. Changing either one now is a single edit here instead
// of hunting down every chart again.
const AXIS_TITLE_STYLE = { fill: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }
const AXIS_TICK_STYLE = { fill: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'Barlow, sans-serif' }

// Category and value labels: short words or a counted number that names or
// states something outright, rather than a number reading a position along a
// numeric scale. That covers the bar-count labels on BarDistance and
// ZoneBreakdown and the "In Strike Zone" / "Outside Zone" row names on
// ZoneBreakdown's Y axis. These carry a little more weight on purpose, so
// they sit at a stronger opacity than AXIS_TICK_STYLE rather than the same
// faint one used for a run of numbers. Added 14 August 2026 after review
// found these three sites had started a second drift right beside the one
// this file just closed: one was 10px where the other two were 11, and one
// used plain Barlow where the other two used Barlow Condensed.
const CATEGORY_LABEL_STYLE = { fill: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Barlow Condensed, sans-serif' }

const PAD = 14
const GAP = 8

// ── TrackMan logo ──────────────────────────────────────────────────────────
function TMLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
        <path d="M16 28C22.627 28 28 22.627 28 16S22.627 4 16 4"
          stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
        <path d="M16 23C19.866 23 23 19.866 23 16S19.866 9 16 9"
          stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        <path d="M16 18C17.105 18 18 17.105 18 16S17.105 14 16 14"
          stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="16" cy="16" r="2" fill={ACCENT} />
        <line x1="4" y1="28" x2="16" y2="16"
          stroke={ACCENT} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </svg>
      <div style={{ lineHeight: 1 }}>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800, fontSize: 9, letterSpacing: '0.25em',
          color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
        }}>Powered by</div>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800, fontSize: 15, letterSpacing: '0.06em',
          color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase',
        }}>TrackMan</div>
      </div>
    </div>
  )
}

// ── Goal pill icon (compact, keyed to goalId) ──────────────────────────────
function GoalPillIcon({ goalId, color }) {
  const s = { width: 12, height: 12 }
  const p = { fill: 'none', stroke: color, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (goalId === 'power') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <path d="M24 6L28 18H40L30 26L34 38L24 30L14 38L18 26L8 18H20L24 6Z"
        strokeWidth="3" fill={color} fillOpacity="0.2" />
    </svg>
  )
  if (goalId === 'contact') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <circle cx="14" cy="24" r="8" strokeWidth="3" fill={color} fillOpacity="0.15" />
      <rect x="26" y="20" width="6" height="20" rx="3" strokeWidth="3"
        fill={color} fillOpacity="0.15" transform="rotate(-30 29 30)" />
    </svg>
  )
  if (goalId === 'allfields') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <path d="M24 36L10 22" strokeWidth="3" />
      <path d="M24 36L24 14" strokeWidth="3" />
      <path d="M24 36L38 22" strokeWidth="3" />
    </svg>
  )
  if (goalId === 'popup') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <line x1="28" y1="12" x2="36" y2="20" strokeWidth="3" />
      <line x1="36" y1="12" x2="28" y2="20" strokeWidth="3" />
      <path d="M10 38 Q18 30 38 32" strokeWidth="3" />
    </svg>
  )
  if (goalId === 'open') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <circle cx="24" cy="24" r="16" strokeWidth="3" />
    </svg>
  )
  return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <rect x="6" y="6" width="16" height="16" rx="3" strokeWidth="3" />
      <rect x="26" y="6" width="16" height="16" rx="3" strokeWidth="3" />
      <rect x="6" y="26" width="16" height="16" rx="3" strokeWidth="3" />
      <rect x="26" y="26" width="16" height="16" rx="3" strokeWidth="3" />
    </svg>
  )
}

// ── Radar decoration ───────────────────────────────────────────────────────
function RadarDecor() {
  return (
    <svg style={{ position: 'absolute', top: -80, right: -80, opacity: 0.028, pointerEvents: 'none' }}
      width="340" height="340" viewBox="0 0 340 340" fill="none">
      {[1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx="300" cy="40" r={i * 55} stroke="white" strokeWidth="1" />
      ))}
      <line x1="300" y1="40" x2="300" y2="300" stroke="white" strokeWidth="1" />
      <line x1="300" y1="40" x2="40" y2="300" stroke="white" strokeWidth="1" />
    </svg>
  )
}

// ── Panel card ─────────────────────────────────────────────────────────────
function Panel({ label, labelColor = 'rgba(255,255,255,0.5)', headerRight, children, style = {}, delay = 0 }) {
  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(34,36,44,0.97) 0%, rgba(24,26,33,0.98) 100%)',
      border: '1.5px solid rgba(255,255,255,0.11)',
      borderRadius: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
      animation: `fadeUp 0.42s ease ${delay}s both`,
      position: 'relative', overflow: 'hidden',
      ...style,
    }}>
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: labelColor, opacity: 0.65, borderRadius: '0 3px 3px 0',
      }} />
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '14px 16px 14px 20px' }}>
        {/* Panel header row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10, flexShrink: 0,
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700, fontSize: 17, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: labelColor,
          }}>
            {label}
          </div>
          {headerRight}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Virtual Coach chat panel ───────────────────────────────────────────────
function ChatPanel({ messages = [], onMessagesChange, delay, sessionContext, onChartSignal = null }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [])

  const send = () => {
    if (!text.trim() || loading) return
    const msg = text.trim()
    setText('')
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }
    const updatedMessages = [...messages, { role: 'user', content: msg }]
    onMessagesChange?.(updatedMessages)
    setLoading(true)
    sendChatMessage({ ...sessionContext, messages: updatedMessages })
      .then((result) => {
        const finalMessages = [...updatedMessages, { role: 'coach', content: result.message }]
        onMessagesChange?.(finalMessages)
        setLoading(false)
        // This chart replaces one of the two already on the debrief, so a key
        // the model invented used to cost the visitor a chart they were looking
        // at, with no way to get it back. Only a renderable key is allowed to
        // overwrite anything.
        const requestedChart = validChartKey(result.chart)
        if (requestedChart) {
          onChartSignal?.(requestedChart, finalMessages)
        }
      })
      .catch((err) => {
        // sendChatMessage always rejects with a CoachError, but this catch must
        // survive one that is not, so an error shape this app has never seen
        // still reaches the visitor as the honest 'trouble' copy rather than a
        // blank or crashed chat bubble.
        const { message } = failureCopy(
          err instanceof CoachError ? err.reason : 'trouble',
          err instanceof CoachError ? err.cold : false,
        )
        onMessagesChange?.([...updatedMessages, { role: 'coach', content: message }])
        setLoading(false)
      })
  }

  return (
    <Panel
      label="Virtual Coach"
      labelColor={ACCENT}
      delay={delay}
      style={{ flex: 1, width: '100%' }}
    >
      {/* Message thread */}
      <div
        className="chat-scroll debrief-scroll"
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}
      >
        {/* Empty state when no messages */}
        {messages.length === 0 && !loading && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8, padding: '12px 0',
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
              <path d="M8 13h12M8 17h8" stroke="rgba(255,255,255,0.18)"
                strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 12, color: 'rgba(255,255,255,0.2)',
              textAlign: 'center', lineHeight: 1.5,
            }}>
              Ask your coach about this session
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.content === '__tips__') {
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700, fontSize: 10, letterSpacing: '0.04em',
                  color: ACCENT, paddingLeft: 2,
                }}>
                  Coach
                </div>
                <div style={{
                  maxWidth: '94%', padding: '8px 11px',
                  borderRadius: '12px 12px 12px 4px',
                  background: `${ACCENT}15`,
                  border: `1px solid ${ACCENT}30`,
                  fontFamily: "'Barlow', sans-serif", fontSize: 16, lineHeight: 1.5,
                  color: 'rgba(255,255,255,0.9)',
                }}>
                  {m.tipsIntro && <div style={{ marginBottom: 8 }}>{m.tipsIntro}</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(m.tips ?? []).map((tip, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%',
                          background: `${ACCENT}25`, border: `1.5px solid ${ACCENT}60`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: 2,
                        }}>
                          <span style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontWeight: 800, fontSize: 9, color: ACCENT,
                          }}>{j + 1}</span>
                        </div>
                        <div style={{
                          fontFamily: "'Barlow', sans-serif",
                          fontSize: 16, lineHeight: 1.5,
                          color: 'rgba(255,255,255,0.85)',
                        }}>{tip}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          }
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, fontSize: 10, letterSpacing: '0.04em',
                color: m.role === 'user' ? 'rgba(255,255,255,0.3)' : ACCENT,
                paddingLeft: 2, paddingRight: 2, whiteSpace: 'nowrap',
              }}>
                {m.role === 'user' ? 'You' : 'Coach'}
              </div>
              <div style={{
                maxWidth: '94%', padding: '7px 10px',
                borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: m.role === 'user' ? 'rgba(255,255,255,0.08)' : `${ACCENT}15`,
                border: m.role === 'user' ? '1px solid rgba(255,255,255,0.1)' : `1px solid ${ACCENT}30`,
                fontFamily: "'Barlow', sans-serif", fontSize: 16, lineHeight: 1.5,
                color: m.role === 'user' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.9)',
              }}>
                <ReactMarkdown components={{ p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p> }}>{m.content}</ReactMarkdown>
              </div>
            </div>
          )
        })}

        {loading && (
          <div style={{ display: 'flex', gap: 4, padding: '4px 2px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%', background: ACCENT,
                animation: `blink 1.2s ease ${i * 0.18}s infinite`,
              }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, marginTop: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'rgba(16,18,24,0.9)',
          border: '1.5px solid rgba(255,255,255,0.1)',
          borderRadius: 11, padding: '0 8px 0 10px', minHeight: 38, paddingBlock: 6,
        }}>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            ref={textareaRef}
            placeholder="Ask your coach…"
            rows={1}
            style={{
              flex: 1, background: 'transparent',
              border: 'none', outline: 'none', resize: 'none',
              fontFamily: "'Barlow', sans-serif",
              fontSize: 16, color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.5, padding: 0, overflow: 'hidden',
            }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || loading}
            style={{
              width: 26, height: 26, borderRadius: 7, border: 'none',
              cursor: text.trim() ? 'pointer' : 'default',
              background: text.trim() ? ACCENT : 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.18s', flexShrink: 0,
            }}
          >
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
              <path d="M1 4.5h9M6 1l4 3.5-4 3.5"
                stroke={text.trim() ? 'white' : 'rgba(255,255,255,0.25)'}
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </Panel>
  )
}

// ── EV vs Launch Angle scatter chart ──────────────────────────────────────
function ScatterEVLA({ swings, goalId }) {
  // Null for Hit to All Fields and Open Session, which have no launch angle
  // target. They get no band and no hit-or-miss colouring rather than silently
  // borrowing Power's, which is what they used to fall through to.
  const target = goalTarget(goalId)
  const data = swings.map((swing, i) => ({
    ev: swing.hit.launch.exitSpeed,
    la: swing.hit.launch.angle,
    onTarget: meetsTarget(goalId, swing.hit.launch),
    swing: i + 1,
  }))

  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
          {target ? (
            <ReferenceArea
              y1={target.launchAngle.min} y2={target.launchAngle.max}
              fill="#FF6B1A" fillOpacity={0.08}
              stroke="#FF6B1A" strokeOpacity={0.25}
            />
          ) : null}
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="ev"
            type="number"
            domain={[dataMin => dataMin - 3, dataMax => dataMax + 3]}
            tick={AXIS_TICK_STYLE}
            label={{
              value: 'EXIT VELOCITY (MPH)',
              position: 'insideBottom',
              offset: -15,
              style: AXIS_TITLE_STYLE,
            }}
          />
          <YAxis
            dataKey="la"
            type="number"
            domain={[dataMin => Math.min(dataMin - 2, 0), dataMax => Math.max(dataMax + 2, 38)]}
            tick={AXIS_TICK_STYLE}
            label={{
              value: 'LAUNCH ANG.',
              angle: -90,
              position: 'insideLeft',
              offset: 15,
              style: AXIS_TITLE_STYLE,
            }}
          />
          {target ? <ReferenceLine y={target.launchAngle.min} stroke="#FF6B1A" strokeOpacity={0.4} strokeDasharray="4 4" /> : null}
          {target ? <ReferenceLine y={target.launchAngle.max} stroke="#FF6B1A" strokeOpacity={0.4} strokeDasharray="4 4" /> : null}
          {/* Only the goals that actually ask for a minimum exit velocity get the
              line. Reduce Pop-Ups is judged on launch angle alone, and used to be
              shown an 88 mph line it never asked for. */}
          {target?.exitVelocity != null ? <ReferenceLine x={target.exitVelocity} stroke="#FF6B1A" strokeOpacity={0.35} strokeDasharray="4 4" /> : null}
          <Scatter data={data} name="Swings">
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.onTarget ? '#FF6B1A' : target ? 'rgba(255,255,255,0.3)' : NEUTRAL_SWING_FILL}
                fillOpacity={entry.onTarget ? 0.9 : target ? 0.5 : NEUTRAL_SWING_OPACITY}
              />
            ))}
          </Scatter>
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              if (!d) return null
              return (
                <div style={{ background: 'rgba(20,22,28,0.95)', border: '1px solid rgba(255,107,26,0.3)', borderRadius: 8, padding: '8px 12px', fontFamily: "'Barlow', sans-serif", fontSize: 12 }}>
                  <div style={{ color: ACCENT, marginBottom: 4, fontWeight: 700 }}>Swing {d.swing}</div>
                  <div style={{ color: 'rgba(255,255,255,0.85)' }}>{d.ev} mph EV</div>
                  <div style={{ color: 'rgba(255,255,255,0.85)' }}>{d.la}° LA</div>
                </div>
              )
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Exit velocity trend line chart ────────────────────────────────────────
function TrendEV({ swings }) {
  const data = swings.map((swing, i) => ({
    swing: i + 1,
    ev: swing.hit.launch.exitSpeed,
  }))

  const avgEV = Math.round(data.reduce((sum, d) => sum + d.ev, 0) / data.length)

  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="swing"
            type="number"
            domain={[1, 15]}
            ticks={[1, 3, 5, 7, 9, 11, 13, 15]}
            tick={AXIS_TICK_STYLE}
            label={{
              value: 'SWING #',
              position: 'insideBottom',
              offset: -15,
              style: AXIS_TITLE_STYLE,
            }}
          />
          <YAxis
            dataKey="ev"
            type="number"
            domain={[dataMin => dataMin - 3, dataMax => dataMax + 3]}
            tick={AXIS_TICK_STYLE}
            label={{
              value: 'EXIT VELO',
              angle: -90,
              position: 'insideLeft',
              offset: 15,
              style: AXIS_TITLE_STYLE,
            }}
          />
          <ReferenceLine
            y={avgEV}
            stroke="rgba(255,255,255,0.2)"
            strokeDasharray="4 4"
            label={{ value: `avg ${avgEV}`, position: 'right', fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'Barlow' }}
          />
          <Line
            type="monotone"
            dataKey="ev"
            stroke="#FF6B1A"
            strokeWidth={2}
            dot={{ fill: '#FF6B1A', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#FF6B1A' }}
          />
          <Tooltip
            cursor={false}
            contentStyle={{
              background: 'rgba(20,22,28,0.95)',
              border: '1px solid rgba(255,107,26,0.3)',
              borderRadius: 8,
              fontFamily: "'Barlow', sans-serif",
              fontSize: 12,
            }}
            labelStyle={{ color: 'rgba(255,255,255,0.85)', fontFamily: "'Barlow', sans-serif" }}
            itemStyle={{ color: 'rgba(255,255,255,0.85)', fontFamily: "'Barlow', sans-serif" }}
            labelFormatter={(value) => `Swing ${value}`}
            formatter={(value) => [`${value} mph`, 'Exit Velo']}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Distance distribution bar chart ───────────────────────────────────────
function BarDistance({ swings }) {
  // Bucket edges live once, in src/ballFlight.js, and this chart reads them
  // through distanceBucketCounts rather than filtering swings itself. Both
  // coach prompts read the same function, so the chart and what the coach
  // says about it cannot describe different ranges.
  const data = distanceBucketCounts(swings).map(({ label, count }) => ({
    range: label,
    count,
  }))

  const maxCount = Math.max(...data.map((d) => d.count))

  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="range"
            tick={AXIS_TICK_STYLE}
            label={{
              value: 'DISTANCE (FT)',
              position: 'insideBottom',
              offset: -15,
              style: AXIS_TITLE_STYLE,
            }}
          />
          <YAxis
            dataKey="count"
            allowDecimals={false}
            tick={AXIS_TICK_STYLE}
            label={{
              value: 'SWINGS',
              angle: -90,
              position: 'insideLeft',
              offset: 15,
              style: AXIS_TITLE_STYLE,
            }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.count === maxCount ? '#FF6B1A' : 'rgba(255,107,26,0.35)'}
              />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              style={CATEGORY_LABEL_STYLE}
            />
          </Bar>
          <Tooltip
            cursor={false}
            contentStyle={{
              background: 'rgba(20,22,28,0.95)',
              border: '1px solid rgba(255,107,26,0.3)',
              borderRadius: 8,
              fontFamily: "'Barlow', sans-serif",
              fontSize: 12,
            }}
            labelFormatter={(value) => `Distance: ${value} ft`}
            labelStyle={{ color: 'rgba(255,255,255,0.6)', fontFamily: "'Barlow', sans-serif" }}
            itemStyle={{ color: 'rgba(255,255,255,0.85)', fontFamily: "'Barlow', sans-serif" }}
            formatter={(value, name) => [
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{value}</span>,
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{name}</span>,
            ]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Spray direction chart (custom SVG) ────────────────────────────────────
function SprayDirection({ swings }) {
  const cx = 150
  const cy = 200

  // Arc helpers
  const arcPoint = (angleDeg, r) => {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
  }

  const arcPath = (r) => {
    const l = arcPoint(-45, r)
    const rp = arcPoint(45, r)
    return `M ${l.x} ${l.y} A ${r} ${r} 0 0 1 ${rp.x} ${rp.y}`
  }

  // The edge of fair territory is SPRAY_FAIR_RADIUS in src/ballFlight.js, the
  // same constant sprayRadius() clamps every dot to. It used to be typed out as
  // a bare 190 three times here while the constant sat unused next door, which
  // is the same drift this slice consolidated the distance-bucket edges to
  // prevent: move the boundary and the balls would have stopped matching the
  // fence they are meant to land inside.
  const leftLine  = arcPoint(-45, SPRAY_FAIR_RADIUS)
  const rightLine = arcPoint(45, SPRAY_FAIR_RADIUS)

  // Fair territory fill path
  const fairPath = [
    `M ${cx} ${cy}`,
    `L ${leftLine.x} ${leftLine.y}`,
    `A ${SPRAY_FAIR_RADIUS} ${SPRAY_FAIR_RADIUS} 0 0 1 ${rightLine.x} ${rightLine.y}`,
    'Z',
  ].join(' ')

  // The two labelled distance arcs, and the label sitting just above each one.
  // Both the radius and the printed distance come from SPRAY_RINGS in
  // src/ballFlight.js, so an arc can never be drawn at one distance and
  // labelled with another. The arcs used to be at fixed radii of 120 and 185
  // with "300ft" and "400ft+" typed in beside them, which stopped being true
  // the moment the carry distances became honest.
  const rings = SPRAY_RINGS.map((ring) => ({
    ...ring,
    path: arcPath(ring.radius),
    labelPoint: arcPoint(0, ring.radius),
  }))

  // Shape renderers for each hit type
  const renderShape = (x, y, dir, i) => {
    if (dir < -15) {
      return <circle key={i} cx={x} cy={y} r={5} fill="#FF6B1A" fillOpacity={0.8} />
    }
    if (dir > 15) {
      // Triangle pointing up: vertices relative to (x, y)
      const pts = `${x},${y - 6} ${x - 5},${y + 4} ${x + 5},${y + 4}`
      return <polygon key={i} points={pts} fill="rgba(180,180,255,0.8)" fillOpacity={0.8} />
    }
    // Diamond: square rotated 45°
    return (
      <rect
        key={i}
        x={x - 4} y={y - 4}
        width={8} height={8}
        fill="rgba(255,200,100,0.8)"
        fillOpacity={0.8}
        transform={`rotate(45, ${x}, ${y})`}
      />
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
      <svg width="100%" height="100%" viewBox="0 0 300 222" preserveAspectRatio="xMidYMid meet">

        {/* Fair territory fill */}
        <path d={fairPath} fill="rgba(255,255,255,0.03)" />

        {/* Foul lines */}
        <line x1={cx} y1={cy} x2={leftLine.x}  y2={leftLine.y}  stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <line x1={cx} y1={cy} x2={rightLine.x} y2={rightLine.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {/* Distance arcs, and the distance each one marks */}
        {rings.map((ring) => (
          <path key={ring.feet} d={ring.path} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        ))}
        {rings.map((ring) => (
          <text key={ring.feet} x={ring.labelPoint.x} y={ring.labelPoint.y - 5} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="Barlow, sans-serif">{ring.label}</text>
        ))}

        {/* Swing shapes */}
        {swings.map((swing, i) => {
          const dir  = swing.hit.launch.direction
          const dist = swing.hit.landing.distance
          // How far from the plate this ball is drawn. The scale lives in
          // src/ballFlight.js beside the carry formula it is fitted to, and
          // moves if that formula moves.
          const scale = sprayRadius(dist)
          const rad = (dir * Math.PI) / 180
          const x = cx + scale * Math.sin(rad)
          const y = cy - scale * Math.cos(rad)
          return renderShape(x, y, dir, i)
        })}

        {/* Legend — groups centered in viewBox, 16px gap between items, 6px shape-to-label margin */}
        <circle cx={86} cy={217} r={5} fill="#FF6B1A" fillOpacity={0.8} />
        <text x={97} y={221} fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="Barlow, sans-serif">Pull</text>

        <rect x={129} y={213} width={8} height={8} fill="rgba(255,200,100,0.8)" fillOpacity={0.8} transform="rotate(45, 133, 217)" />
        <text x={145} y={221} fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="Barlow, sans-serif">Center</text>

        <polygon points="192,212 187,221 197,221" fill="rgba(180,180,255,0.8)" fillOpacity={0.8} />
        <text x={203} y={221} fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="Barlow, sans-serif">Oppo</text>
      </svg>
    </div>
  )
}

// ── Pitch location scatter (Recharts) ────────────────────────────────────
function PitchLocation({ swings, goalId }) {
  // False for Hit to All Fields and Open Session. Open Session used to draw every
  // single pitch as a grey "you missed it" dot, judged against Power's target,
  // which reads to a visitor as the app being broken.
  const showsOutcome = hasTarget(goalId)
  const data = swings.map((sw, i) => {
    const { exitSpeed, angle } = sw.hit.launch
    return { x: sw.plateLocSide, y: sw.plateLocHeight, exitSpeed, angle, direction: sw.hit.launch.direction, outcome: meetsTarget(goalId, sw.hit.launch), swing: i + 1 }
  })

  const renderShape = ({ cx, cy, payload }) => {
    if (goalId === 'allfields') {
      if (payload.direction < -15)
        return <circle cx={cx} cy={cy} r={5} fill={ACCENT} fillOpacity={0.85} />
      if (payload.direction > 15) {
        const pts = `${cx},${cy - 6} ${cx - 5},${cy + 4} ${cx + 5},${cy + 4}`
        return <polygon points={pts} fill="rgba(180,180,255,0.8)" fillOpacity={0.8} />
      }
      return <rect x={cx - 4} y={cy - 4} width={8} height={8} fill="rgba(255,200,100,0.8)" fillOpacity={0.8} transform={`rotate(45, ${cx}, ${cy})`} />
    }
    if (payload.outcome)
      return <rect x={cx - 5} y={cy - 5} width={10} height={10} fill={ACCENT} fillOpacity={0.9} transform={`rotate(45, ${cx}, ${cy})`} />
    if (!showsOutcome)
      return <circle cx={cx} cy={cy} r={5} fill={NEUTRAL_SWING_FILL} fillOpacity={NEUTRAL_SWING_OPACITY} />
    return <circle cx={cx} cy={cy} r={5} fill="rgba(255,255,255,0.25)" fillOpacity={0.6} />
  }

  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="x" type="number" domain={[dataMin => Math.min(dataMin - 0.15, -0.85), dataMax => Math.max(dataMax + 0.15, 0.85)]}
              tick={AXIS_TICK_STYLE}
              tickFormatter={(v) => v.toFixed(1)}
              label={{ value: 'Side (ft)', position: 'insideBottom', offset: -15, style: AXIS_TITLE_STYLE }}
            />
            <YAxis dataKey="y" type="number" domain={[dataMin => Math.min(dataMin - 0.15, 1.35), dataMax => Math.max(dataMax + 0.15, 3.65)]}
              tick={AXIS_TICK_STYLE}
              tickFormatter={(v) => v.toFixed(1)}
              label={{ value: 'Height (ft)', angle: -90, position: 'insideLeft', offset: 15, style: AXIS_TITLE_STYLE }}
            />
            <ReferenceArea x1={-0.7} x2={0.7} y1={1.5} y2={3.5}
              fill={ACCENT} fillOpacity={0.08}
              stroke={ACCENT} strokeOpacity={0.4} strokeDasharray="4 4"
              label={{ value: 'Strike Zone', position: 'insideTop', fontSize: 9, fill: ACCENT, opacity: 0.6 }}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                if (!d) return null
                return (
                  <div style={{ background: 'rgba(14,15,20,0.95)', border: '1px solid rgba(255,107,26,0.3)', borderRadius: 8, padding: '8px 12px', fontFamily: "'Barlow', sans-serif", fontSize: 12 }}>
                    <div style={{ color: ACCENT, marginBottom: 4, fontWeight: 700 }}>Swing {d.swing}</div>
                    <div style={{ color: 'rgba(255,255,255,0.85)' }}>{Number(d.x).toFixed(2)} ft Side</div>
                    <div style={{ color: 'rgba(255,255,255,0.85)' }}>{Number(d.y).toFixed(2)} ft Height</div>
                  </div>
                )
              }}
            />
            <Scatter data={data} shape={renderShape} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {goalId === 'allfields' && (
        <div style={{
          flexShrink: 0, height: 24,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16,
        }}>
          {[
            { label: 'Pull',   color: ACCENT,                    shape: 'circle'   },
            { label: 'Center', color: 'rgba(255,200,100,0.8)',   shape: 'diamond'  },
            { label: 'Oppo',   color: 'rgba(180,180,255,0.8)',   shape: 'triangle' },
          ].map(({ label, color, shape }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 12 12">
                {shape === 'circle'   && <circle cx="6" cy="6" r="5" fill={color} />}
                {shape === 'diamond'  && <rect x="1" y="1" width="10" height="10" fill={color} transform="rotate(45, 6, 6)" />}
                {shape === 'triangle' && <polygon points="6,1 11,11 1,11" fill={color} />}
              </svg>
              <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Launch angle zone breakdown horizontal bar chart ──────────────────────
function ZoneBreakdown({ swings }) {
  const inZone    = swings.filter((s) =>
    s.plateLocHeight >= 1.5 && s.plateLocHeight <= 3.5 &&
    s.plateLocSide >= -0.7 && s.plateLocSide <= 0.7
  ).length
  const outOfZone = swings.length - inZone

  const data = [
    { label: 'In Strike Zone', count: inZone },
    { label: 'Outside Zone',   count: outOfZone },
  ]

  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={AXIS_TICK_STYLE}
            label={{
              value: 'SWINGS',
              position: 'insideBottom',
              offset: -15,
              style: AXIS_TITLE_STYLE,
            }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={90}
            tick={CATEGORY_LABEL_STYLE}
          />
          <Bar dataKey="count" radius={[0, 3, 3, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.label === 'In Strike Zone' ? '#FF6B1A' : 'rgba(255,107,26,0.3)'}
              />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              style={CATEGORY_LABEL_STYLE}
            />
          </Bar>
          <Tooltip
            labelFormatter={(value) => value}
            labelStyle={{ color: 'rgba(255,255,255,0.6)', fontFamily: "'Barlow', sans-serif" }}
            itemStyle={{ color: 'rgba(255,255,255,0.85)', fontFamily: "'Barlow', sans-serif" }}
            contentStyle={{
              background: 'rgba(14,15,20,0.95)',
              border: '1px solid rgba(255,107,26,0.3)',
              borderRadius: 8,
              fontFamily: "'Barlow', sans-serif",
              fontSize: 12,
            }}
            cursor={false}
            formatter={(value, name) => [
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{value}</span>,
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{name}</span>,
            ]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Debrief Screen ─────────────────────────────────────────────────────────
// Props:
//   player           — { firstName, lastName } from TrackMan API, or null
//   sessionNumber    — integer
//   goalId           — string key, e.g. 'power'
//   goalLabel        — display string, e.g. 'Power & Distance'
//   sessionData      — { avgExitVelocity, avgLaunchAngle, inZoneCount, totalSwings }
//   coachingSummary  — string for the Session Summary body (from Anthropic API)
//   whatThisMeans    — string for the What This Means body (from Anthropic API)
//   charts           — array of up to 2 chart keys (strings) chosen by the model,
//                      each naming one of CHART_KEYS; an unrecognized key is
//                      replaced with a fallback chart
//   sessions         — array of session numbers available, e.g. [1, 2, 3]
//   onSessionToggle  — callback(sessionNumber)
//   rawSwings        — array of swing objects for the Raw Data modal
//   topEV            — number, max exit velocity from the session
export default function DebriefScreen({
  player = null,
  sessionNumber = null,
  goalId = null,
  goalLabel = null,
  sessionData = null,
  coachingSummary = null,
  whatThisMeans = null,
  charts = [],
  sessions = [],
  onSessionToggle,
  onHome = null,
  onNewSession = null,
  chatMessages = [],
  onChatUpdate = null,
  sessionCapReached = false,
  sessionContext = null,
  onChartSignal = null,
  rawSwings = [],
  topEV = null,
}) {
  const [revealed, setRevealed] = useState(false)
  const [showRawData, setShowRawData] = useState(false)
  const [showSummaryFade, setShowSummaryFade] = useState(false)
  const summaryScrollRef = useRef(null)
  const summaryContentRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Whether the Session Summary box has more text below the fold. Re-checked
  // on scroll (so the fade drops once the visitor reaches the bottom), and on
  // resize of two different elements, because one ResizeObserver target is
  // not enough to catch every cause.
  //
  // The scroll box itself (`el` below) sits at `flex: 1` inside a
  // fixed-height panel, so its own border-box height does not change just
  // because the text inside it grows or shrinks: that is the entire point of
  // giving it `overflow-y: auto` in the first place. Observing only `el`
  // would catch the Raw Data toggle and the reveal animation, both of which
  // do resize the box itself, but would miss a late web font swap, which
  // changes how tall the text renders without changing how tall the box is
  // allowed to be. So the content wrapper (`contentEl` below, a plain div
  // with no flex sizing of its own) is observed too: its natural height
  // tracks the text exactly, so a font swap that reflows it is a real size
  // change on that element even though `el` never moves.
  useEffect(() => {
    const el = summaryScrollRef.current
    const contentEl = summaryContentRef.current
    if (!el || !contentEl) return

    const recompute = () => {
      setShowSummaryFade(shouldShowScrollFade({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollTop: el.scrollTop,
      }))
    }

    recompute()
    el.addEventListener('scroll', recompute)
    const resizeObserver = new ResizeObserver(recompute)
    resizeObserver.observe(el)
    resizeObserver.observe(contentEl)
    return () => {
      el.removeEventListener('scroll', recompute)
      resizeObserver.disconnect()
    }
  }, [coachingSummary, whatThisMeans])

  // Player display
  const initials = player
    ? `${player.firstName?.[0] ?? ''}${player.lastName?.[0] ?? ''}`.toUpperCase()
    : null
  const displayName = player
    ? [player.firstName, player.lastName].filter(Boolean).join(', ')
    : null

  // Session data with fallbacks
  const avgEV    = sessionData?.avgExitVelocity ?? null
  const avgLA    = sessionData?.avgLaunchAngle  ?? null
  const inZone   = sessionData?.inZoneCount     ?? null
  const total    = sessionData?.totalSwings     ?? null

  const chartSlots = resolveChartSlots(charts)

  const headerButtonStyle = {
    display: 'flex', alignItems: 'center', gap: 6,
    height: 28, paddingInline: 12, borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700, fontSize: 13, letterSpacing: '0.06em',
    textTransform: 'uppercase', cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  }

  const headerButtonEnter = (e) => {
    e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
    e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
  }

  const headerButtonLeave = (e) => {
    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
    e.currentTarget.style.color = 'rgba(255,255,255,0.45)'
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(155deg, #141518 0%, #0C0D0F 55%, #0E0D12 100%)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      <RadarDecor />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '11px 24px 9px', gap: 14, flexShrink: 0,
        animation: revealed ? 'fadeUp 0.4s ease both' : 'none',
      }}>
        <div
          onClick={onHome ?? undefined}
          style={{ cursor: onHome ? 'pointer' : 'default', opacity: 0.85, transition: 'opacity 0.15s' }}
          onMouseEnter={onHome ? (e) => (e.currentTarget.style.opacity = '1') : undefined}
          onMouseLeave={onHome ? (e) => (e.currentTarget.style.opacity = '0.85') : undefined}
        >
          <TMLogo />
        </div>

        <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: `${ACCENT}20`, border: `1.5px solid ${ACCENT}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800, fontSize: 12, color: ACCENT,
          }}>
            {initials ?? ''}
          </div>
          <div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, fontSize: 15,
              color: 'rgba(255,255,255,0.9)', lineHeight: 1,
            }}>
              {displayName ?? <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}
            </div>
            <div style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1,
            }}>
              {sessionNumber != null ? `Session ${sessionNumber} debrief` : 'Session debrief'}
            </div>
          </div>
        </div>

        {/* Session toggle pills */}
        {sessions.length > 1 && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {sessions.map((s) => {
              const active = s === sessionNumber
              return (
                <button
                  key={s}
                  onClick={() => onSessionToggle?.(s)}
                  style={{
                    height: 24, minWidth: 28, paddingInline: 8,
                    borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: active ? ACCENT : 'rgba(255,255,255,0.07)',
                    color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700, fontSize: 12, letterSpacing: '0.03em',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {s}
                </button>
              )
            })}
          </div>
        )}

        {sessionCapReached ? (
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700, fontSize: 13, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)',
          }}>
            Session limit reached
          </div>
        ) : onNewSession ? (
          <button
            onClick={onNewSession}
            style={headerButtonStyle}
            onMouseEnter={headerButtonEnter}
            onMouseLeave={headerButtonLeave}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New Session
          </button>
        ) : null}

        <div style={{ flex: 1 }} />

        {/* Raw Data button */}
        <button
          onClick={() => setShowRawData(true)}
          style={headerButtonStyle}
          onMouseEnter={headerButtonEnter}
          onMouseLeave={headerButtonLeave}
        >
          Raw Data
        </button>

        {/* Goal pill */}
        {goalId && goalLabel && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 11px', borderRadius: 9,
            background: `${ACCENT}15`, border: `1px solid ${ACCENT}35`,
          }}>
            <GoalPillIcon goalId={goalId} color={ACCENT} />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, fontSize: 12, color: ACCENT,
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              {goalLabel}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

      {/* ── Content grid — two columns ── */}
      <div style={{
        flex: 1, display: 'flex',
        padding: PAD, gap: GAP, minHeight: 0,
      }}>

        {/* LEFT COLUMN — 60% */}
        <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', gap: GAP }}>

          {/* TOP PANEL — Session Summary + What This Means */}
          <Panel
            label="Session Summary"
            labelColor={ACCENT}
            delay={0.08}
            style={{ flex: 1 }}
          >
            <div style={{
              position: 'relative', flex: 1, minHeight: 0,
              display: 'flex', flexDirection: 'column',
            }}>
              <div ref={summaryScrollRef} className="debrief-scroll" style={{
                flex: 1, overflowY: 'auto', minHeight: 0,
                display: 'flex', flexDirection: 'column',
              }}>
                {/* Plain content wrapper, sized by its own text rather than by
                    the flex column around it, so a ResizeObserver on it sees a
                    font-driven reflow that the scroll box above never does. */}
                <div ref={summaryContentRef}>
                  <div style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 18, lineHeight: 1.6,
                    color: 'rgba(255,255,255,0.78)',
                  }}>
                    {coachingSummary ?? (
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
                        Session summary will appear here once generated by your coach.
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700, fontSize: 17, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: ACCENT,
                    marginTop: 10, marginBottom: 6,
                  }}>
                    What This Means
                  </div>
                  <div style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 18, lineHeight: 1.65,
                    color: 'rgba(255,255,255,0.78)',
                  }}>
                    {whatThisMeans ?? (
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
                        Coaching context will appear here once generated.
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {showSummaryFade && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, height: 44,
                  background: 'linear-gradient(to bottom, rgba(20,22,28,0) 0%, rgba(19,21,27,0.95) 80%)',
                  pointerEvents: 'none', borderRadius: '0 0 4px 4px',
                }} />
              )}
            </div>
          </Panel>

          {/* BOTTOM PANELS — the two charts the coach selected */}
          <div style={{ flexShrink: 0, display: 'flex', gap: GAP, height: 340 }}>
            {chartSlots.map((chart, i) => {
              const CHART_LABELS = {
                scatter_ev_la:   'Launch Angle vs Exit Velocity',
                trend_ev:        'Exit Velocity Trend',
                bar_distance:    'Distance Distribution',
                spray_direction:  'Spray Chart',
                zone_breakdown:   'Pitches In Zone',
                pitch_location:   'Pitch Location vs. Outcome',
              }
              const label = CHART_LABELS[chart?.type] ?? 'Chart'

              return (
                <Panel
                  key={i}
                  label={label}
                  labelColor={ACCENT}
                  delay={0.36 + i * 0.04}
                  style={{ flex: 1 }}
                >
                  {chart?.type === 'scatter_ev_la' ? (
                    <ScatterEVLA swings={rawSwings} goalId={goalId} />
                  ) : chart?.type === 'trend_ev' ? (
                    <TrendEV swings={rawSwings} />
                  ) : chart?.type === 'bar_distance' ? (
                    <BarDistance swings={rawSwings} />
                  ) : chart?.type === 'spray_direction' ? (
                    <SprayDirection swings={rawSwings} />
                  ) : chart?.type === 'zone_breakdown' ? (
                    <ZoneBreakdown swings={rawSwings} />
                  ) : chart?.type === 'pitch_location' ? (
                    <PitchLocation swings={rawSwings} goalId={goalId} />
                  ) : (
                    <div style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      position: 'relative', minHeight: 0, gap: 8,
                    }}>
                      <svg
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }}
                        preserveAspectRatio="none"
                        viewBox="0 0 200 120"
                      >
                        {[25, 50, 75, 100].map((y) => (
                          <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="white" strokeWidth="0.8" />
                        ))}
                        {[50, 100, 150].map((x) => (
                          <line key={x} x1={x} y1="0" x2={x} y2="120" stroke="white" strokeWidth="0.8" />
                        ))}
                      </svg>
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.2 }}>
                        <rect x="3" y="3" width="11" height="11" rx="2" stroke="white" strokeWidth="1.5" />
                        <rect x="18" y="3" width="11" height="11" rx="2" stroke="white" strokeWidth="1.5" />
                        <rect x="3" y="18" width="11" height="11" rx="2" stroke="white" strokeWidth="1.5" />
                        <rect x="18" y="18" width="11" height="11" rx="2" stroke="white" strokeWidth="1.5" />
                      </svg>
                      <div style={{
                        fontFamily: "'Barlow', sans-serif",
                        fontSize: 11, color: 'rgba(255,255,255,0.18)',
                        textAlign: 'center', position: 'relative',
                      }}>
                        Chart renders here
                      </div>
                    </div>
                  )}
                </Panel>
              )
            })}
          </div>
        </div>

        {/* RIGHT COLUMN — 40% */}
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column' }}>
          <ChatPanel
            messages={chatMessages}
            onMessagesChange={onChatUpdate}
            delay={0.32}
            sessionContext={sessionContext}
            onChartSignal={onChartSignal}
          />
        </div>
      </div>

      {/* ── Footer stat bar ── */}
      <div style={{ flexShrink: 0, height: 56, display: 'flex', gap: 1 }}>
        {[
          {
            label: 'AVG EXIT VELO',
            value: avgEV != null ? `${avgEV} mph` : '—',
            highlight: avgEV != null && avgEV >= 88,
          },
          {
            label: 'AVG LAUNCH ANG.',
            value: avgLA != null ? `${avgLA}°` : '—',
            highlight: false,
          },
          {
            label: 'PITCHES IN ZONE',
            value: inZone != null && total != null ? `${inZone}/${total}` : '—',
            highlight: false,
          },
          {
            label: 'TOP EXIT VELO',
            value: topEV != null ? `${topEV} mph` : '—',
            highlight: topEV != null && topEV >= 88,
          },
        ].map((tile) => (
          <div
            key={tile.label}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: tile.highlight ? `${ACCENT}18` : 'rgba(255,255,255,0.04)',
            }}
          >
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800, fontSize: 18, lineHeight: 1,
              color: tile.highlight ? ACCENT : 'rgba(255,255,255,0.85)',
            }}>
              {tile.value}
            </div>
            <div style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 10, color: 'rgba(255,255,255,0.35)',
              marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {tile.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Raw Data modal ── */}
      {showRawData && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 680,
            background: 'linear-gradient(160deg, #1c1e27 0%, #141518 60%, #111214 100%)',
            border: '1.5px solid rgba(255,255,255,0.12)',
            borderRadius: 16,
            maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 24px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 800, fontSize: 18, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: ACCENT,
              }}>
                Raw Data · Session {sessionNumber}
              </div>
              <button
                onClick={() => setShowRawData(false)}
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Table */}
            <div className="raw-data-scroll" style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['#', 'Exit Velocity', 'Launch Angle', 'Direction', 'Distance', 'Zone'].map((col, i) => (
                      <th
                        key={col}
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 700, fontSize: 11, letterSpacing: '0.08em',
                          textTransform: 'uppercase', color: ACCENT,
                          padding: '11px 14px 10px',
                          textAlign: 'center',
                          ...(i === 5 ? { paddingRight: 16 } : {}),
                          borderBottom: '1.5px solid rgba(255,107,26,0.35)',
                          ...(i === 0 ? { width: 36 } : {}),
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawSwings.map((swing, i) => {
                    const ev   = swing.hit.launch.exitSpeed
                    const la   = swing.hit.launch.angle
                    const dir  = swing.hit.launch.direction
                    const dist = swing.hit.landing.distance
                    const inZoneRow = swing.plateLocHeight >= 1.5 && swing.plateLocHeight <= 3.5 &&
                      swing.plateLocSide >= -0.7 && swing.plateLocSide <= 0.7
                    const rowBg = i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'
                    const cellStyle = {
                      padding: '9px 14px',
                      textAlign: 'center',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 16, fontWeight: 600,
                      color: 'rgba(255,255,255,0.75)',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }

                    return (
                      <tr key={i} style={{ background: rowBg }}>
                        <td style={{
                          ...cellStyle,
                          textAlign: 'center',
                          fontSize: 12, fontWeight: 700,
                          color: 'rgba(255,255,255,0.28)',
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </td>
                        <td style={{ ...cellStyle, color: ev >= 88 ? ACCENT : 'rgba(255,255,255,0.75)' }}>
                          {ev} mph
                        </td>
                        <td style={cellStyle}>{la}°</td>
                        <td style={cellStyle}>{dir > 0 ? '+' : ''}{dir}°</td>
                        <td style={cellStyle}>{dist} ft</td>
                        <td style={{
                          ...cellStyle,
                          textAlign: 'center',
                          paddingRight: 16,
                          color: inZoneRow ? ACCENT : 'rgba(255,255,255,0.35)',
                          fontWeight: inZoneRow ? 700 : 500,
                        }}>
                          {inZoneRow ? 'In' : 'Out'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal footer */}
            <div style={{
              flexShrink: 0,
              padding: '11px 22px 14px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 11, color: 'rgba(255,255,255,0.2)',
              }}>
                Data generated by TrackMan B1 · Session simulation
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
