import { useState, useEffect } from 'react'
import { meetsTarget } from './goalTargets'

const ACCENT = '#FF6B1A'

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
        }}>
          Powered by
        </div>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800, fontSize: 15, letterSpacing: '0.06em',
          color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase',
        }}>
          TrackMan
        </div>
      </div>
    </div>
  )
}

// ── Goal pill icon — small SVG keyed to goalId ─────────────────────────────
function GoalPillIcon({ goalId, color }) {
  const size = 12
  const s = { width: size, height: size }
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
      <path d="M24 36 L10 22" strokeWidth="3" />
      <path d="M24 36 L24 14" strokeWidth="3" />
      <path d="M24 36 L38 22" strokeWidth="3" />
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
  if (goalId === 'dashboard') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <rect x="6" y="6" width="16" height="16" rx="3" strokeWidth="3" />
      <rect x="26" y="6" width="16" height="16" rx="3" strokeWidth="3" />
      <rect x="6" y="26" width="16" height="16" rx="3" strokeWidth="3" />
      <rect x="26" y="26" width="16" height="16" rx="3" strokeWidth="3" />
    </svg>
  )
  // Generic fallback
  return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <circle cx="24" cy="24" r="16" strokeWidth="3" />
      <circle cx="24" cy="24" r="4" fill={color} />
    </svg>
  )
}

// ── Radar decoration ───────────────────────────────────────────────────────
function RadarDecor() {
  return (
    <svg
      style={{
        position: 'absolute', top: -120, right: -120,
        opacity: 0.03, pointerEvents: 'none',
      }}
      width="480" height="480" viewBox="0 0 480 480" fill="none"
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <circle key={i} cx="420" cy="60" r={i * 65} stroke="white" strokeWidth="1" />
      ))}
      <line x1="420" y1="60" x2="420" y2="460" stroke="white" strokeWidth="1" />
      <line x1="420" y1="60" x2="20" y2="460" stroke="white" strokeWidth="1" />
      <line x1="420" y1="60" x2="220" y2="480" stroke="white" strokeWidth="1" />
    </svg>
  )
}

// ── Live pulsing indicator ─────────────────────────────────────────────────
function LiveIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
      <div style={{
        position: 'relative', width: 20, height: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Expanding ring 1 */}
        <div style={{
          position: 'absolute', width: 20, height: 20, borderRadius: '50%',
          border: `1.5px solid ${ACCENT}`,
          animation: 'ringExpand 1.8s ease-out infinite',
        }} />
        {/* Expanding ring 2, offset by 0.6s */}
        <div style={{
          position: 'absolute', width: 20, height: 20, borderRadius: '50%',
          border: `1.5px solid ${ACCENT}`,
          animation: 'ringExpand 1.8s ease-out 0.6s infinite',
        }} />
        {/* Core dot */}
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: ACCENT,
          animation: 'dotBreathe 1.8s ease-in-out infinite',
          boxShadow: `0 0 12px ${ACCENT}`,
          position: 'relative', zIndex: 2,
        }} />
      </div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 900, fontSize: 22, letterSpacing: '0.18em',
        color: ACCENT, textTransform: 'uppercase',
      }}>
        Live
      </div>
    </div>
  )
}

// ── Hero swing counter ─────────────────────────────────────────────────────
function SwingCount({ count }) {
  return (
    <div style={{ textAlign: 'center', animation: 'countUp 0.6s cubic-bezier(0.22,1,0.36,1) 0.2s both' }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 900, fontSize: 120, lineHeight: 0.9,
        letterSpacing: '-0.02em', color: '#ffffff',
        textShadow: '0 0 80px rgba(255,255,255,0.08)',
      }}>
        {count}
      </div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 28, letterSpacing: '0.2em',
        color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
        marginTop: 4,
      }}>
        Swings Tracked
      </div>
    </div>
  )
}

// ── Recent swings ticker row ───────────────────────────────────────────────
// Shows the last 8 swings (most recent at the end of the array → displayed right-to-left
// so newest appears first in the scroll view).
function SwingTicker({ swings, goalId }) {
  // Take the last 8, reverse so newest is on the left
  const recent = [...swings].slice(-8).reverse()

  // Highlighting is per goal, and goals with no target highlight nothing.
  // This row used to light up a fixed 25 to 35 degrees for every goal, so an
  // Open Session visitor watched swings glow orange against Power's target for
  // the whole live feed, on the way to a debrief that has no target at all. A
  // contact swing at 12 degrees was grey here and orange on the debrief.

  if (recent.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        fontFamily: "'Barlow', sans-serif",
        fontSize: 13, color: 'rgba(255,255,255,0.2)',
        padding: '12px 0',
      }}>
        Waiting for first swing…
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', gap: 8,
      overflowX: 'auto', paddingBottom: 4,
      justifyContent: 'center',
      // Hide scrollbar visually while keeping scroll behaviour
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    }}>
      {recent.map((swing, i) => {
        const inZone = meetsTarget(goalId, swing)
        return (
          <div
            key={i}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '7px 12px', borderRadius: 10, flexShrink: 0,
              background: inZone ? `${ACCENT}18` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${inZone ? ACCENT + '45' : 'rgba(255,255,255,0.07)'}`,
              animation: `fadeUp 0.4s ease ${0.05 + i * 0.04}s both`,
              minWidth: 64,
            }}
          >
            {/* Exit velocity */}
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800, fontSize: 18, lineHeight: 1,
              color: inZone ? ACCENT : 'rgba(255,255,255,0.6)',
            }}>
              {swing.exitSpeed}
            </div>
            <div style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 9.5, color: 'rgba(255,255,255,0.3)',
              marginTop: 2, letterSpacing: '0.04em',
            }}>
              mph
            </div>

            {/* Divider */}
            <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.08)', margin: '5px 0' }} />

            {/* Launch angle */}
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, fontSize: 14, lineHeight: 1,
              color: inZone ? 'rgba(255,200,100,0.9)' : 'rgba(255,255,255,0.4)',
            }}>
              {swing.angle}°
            </div>
            <div style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1,
            }}>
              LA
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Live Session Screen ────────────────────────────────────────────────────
// Props:
//   player          — { firstName, lastName } from TrackMan API, or null while loading
//   sessionNumber   — integer, e.g. 1
//   goalId          — string key matching a goal, e.g. 'power'
//   goalLabel       — display name, e.g. 'Power & Distance'
//   swings          — array of { ev: number, la: number, dist?: number }
export default function LiveSessionScreen({
  player = null,
  sessionNumber = null,
  goalId = null,
  goalLabel = null,
  swings = [],
  onHome = null,
  onEndSession = null,
}) {
  const [revealed, setRevealed] = useState(false)
  const [visibleCount, setVisibleCount] = useState(0)

  // Stagger-in trigger
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Progressive swing reveal — increments by 1 every 800ms until all swings are shown
  useEffect(() => {
    setVisibleCount(0)
    if (swings.length === 0) return
    const id = setInterval(() => {
      setVisibleCount((c) => {
        if (c >= swings.length) return c
        return c + 1
      })
    }, 800)
    return () => clearInterval(id)
  }, [swings.length])

  // Player display values — empty until TrackMan API provides data
  const firstName = player?.firstName ?? null
  const lastName = player?.lastName ?? null
  const initials =
    player
      ? `${player.firstName?.[0] ?? ''}${player.lastName?.[0] ?? ''}`.toUpperCase()
      : null
  const displayName =
    firstName && lastName ? `${firstName}, ${lastName}` : firstName ?? null

  const sessionDone = visibleCount >= swings.length && swings.length > 0

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(170deg, #111214 0%, #0C0D0F 50%, #0D0C10 100%)',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <RadarDecor />

      {/* Ambient scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,107,26,0.06), transparent)',
        animation: 'scanLine 6s linear infinite',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Header: logo | divider | avatar + name/session | spacer | goal pill */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '11px 24px 9px', gap: 14,
        flexShrink: 0, position: 'relative', zIndex: 1,
        animation: revealed ? 'fadeUp 0.45s ease both' : 'none',
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

        {/* Avatar + player info */}
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
              {sessionNumber != null ? `Session ${sessionNumber}` : <span style={{ opacity: 0 }}>—</span>}
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Goal pill — shown when goalId + goalLabel are provided */}
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
      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0, position: 'relative', zIndex: 1 }} />

      {/* ── Main content ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1,
        padding: '0 48px', gap: 0,
      }}>

        {/* Live indicator */}
        <div style={{ animation: 'fadeUp 0.5s ease 0.05s both', marginBottom: 40 }}>
          <LiveIndicator />
        </div>

        {/* Swing count — hero */}
        <div style={{ marginBottom: 32 }}>
          <SwingCount count={visibleCount} />
        </div>

        {/* Tagline */}
        <div style={{
          fontFamily: "'Barlow', sans-serif",
          fontSize: 16, lineHeight: 1.6,
          color: 'rgba(255,255,255,0.32)',
          textAlign: 'center', letterSpacing: '0.01em',
          maxWidth: 520,
          animation: 'fadeUp 0.5s ease 0.35s both',
          marginBottom: 48,
        }}>
          TrackMan B1 is capturing every swing.<br />
          Your coach will be ready when you are.
        </div>

        {/* Recent swings ticker */}
        <div style={{
          width: '100%', maxWidth: 700,
          animation: 'fadeUp 0.5s ease 0.45s both',
          marginBottom: 52,
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700, fontSize: 10,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.22)',
            textAlign: 'center', marginBottom: 12,
          }}>
            Recent swings
          </div>
          <SwingTicker swings={swings.slice(0, visibleCount)} goalId={goalId} />
        </div>

        {/* CTA button */}
        <div style={{
          animation: 'fadeUp 0.5s ease 0.55s both',
          width: '100%', maxWidth: 400,
        }}>
          <button
            disabled={!sessionDone}
            onClick={sessionDone && onEndSession ? onEndSession : undefined}
            style={{
              width: '100%', height: 60, borderRadius: 18,
              border: sessionDone ? 'none' : '1.5px solid rgba(255,255,255,0.08)',
              background: sessionDone
                ? `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT}CC 100%)`
                : 'rgba(255,255,255,0.04)',
              color: sessionDone ? '#fff' : 'rgba(255,255,255,0.2)',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800, fontSize: 20, letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: sessionDone ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: sessionDone ? `0 6px 24px ${ACCENT}40` : 'none',
              transition: 'all 0.3s ease',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Shimmer overlay when active */}
            {sessionDone && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                backgroundSize: '400px 100%',
                animation: 'shimmer 2.2s infinite linear',
              }} />
            )}
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              style={{ position: 'relative' }}
            >
              <rect x="2" y="2" width="12" height="12" rx="2"
                stroke={sessionDone ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)'}
                strokeWidth="1.5" />
              <path d="M5 8h6M8 5v6"
                stroke={sessionDone ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)'}
                strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ position: 'relative' }}>View Session Summary</span>
          </button>

          <div style={{
            textAlign: 'center', marginTop: 8,
            fontFamily: "'Barlow', sans-serif",
            fontSize: 11, color: 'rgba(255,255,255,0.15)',
            letterSpacing: '0.02em',
            opacity: sessionDone ? 0 : 1,
            transition: 'opacity 0.3s ease',
          }}>
            Available when session ends
          </div>
        </div>
      </div>
    </div>
  )
}
