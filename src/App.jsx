import { useState, useEffect, useMemo, useRef } from 'react'
import LiveSessionScreen from './LiveSessionScreen'
import DebriefScreen from './DebriefScreen'
import { generateDebrief, CoachError } from './coachApi'
import { computeStats, topExitVelocity } from './sessionStats'
import { launchAngleRangeLabel } from './goalTargets'
import { failureCopy, MID_WAIT_MESSAGE, RETRYING_MESSAGE } from './failureCopy'
import { generateSwings } from './swingGenerator'
import { SESSION_ONE_SWINGS as mockSwings } from './sessionOneSwings'

// ── Goal definitions ───────────────────────────────────────────────────────
// These are the app's predefined coaching focus options.
// Labels, subtitles, and tags are app content — not from an external API.
//
// The launch angle ranges in the tags are read from goalTargets.js rather than
// written out here. They used to be a fifth copy of numbers that lived in four
// other places, and they had drifted: the cards promised 20-35 and 10-15 while
// the coach was telling the player 25-35 and 8-18 and the charts coloured their
// swings against a third set again.
const ACCENT = '#FF6B1A'
const DASHBOARD_COLOR = '#7B9EB8'

export const GOALS = [
  {
    id: 'power',
    label: 'Power & Distance',
    subtitle: 'Exit velocity · Launch angle · Distance',
    type: 'power',
    tag: `Launch Angle ${launchAngleRangeLabel('power')}`,
    color: ACCENT,
    dashboard: false,
  },
  {
    id: 'contact',
    label: 'Line Drives & Contact',
    subtitle: 'Exit velocity · Launch angle · Spray chart',
    type: 'contact',
    tag: `LA ${launchAngleRangeLabel('contact')} · Hard Hit %`,
    color: ACCENT,
    dashboard: false,
  },
  {
    id: 'allfields',
    label: 'Hit to All Fields',
    subtitle: 'Pull% · Center% · Opposite field%',
    type: 'allfields',
    tag: 'Spray distribution',
    color: ACCENT,
    dashboard: false,
  },
  {
    id: 'popup',
    label: 'Reduce Pop-Ups',
    subtitle: 'Launch angle · Direction · Exit velocity',
    type: 'popup',
    tag: `LA ${launchAngleRangeLabel('popup')} · Level it out`,
    color: ACCENT,
    dashboard: false,
  },
  {
    id: 'open',
    label: 'Open Session',
    subtitle: 'Free practice · No target metrics',
    type: 'open',
    tag: 'All metrics tracked',
    color: ACCENT,
    dashboard: false,
  },
  {
    id: 'dashboard',
    label: 'Full Dashboard',
    subtitle: 'All metrics & raw session data',
    type: 'dashboard',
    tag: 'Advanced · All charts',
    color: DASHBOARD_COLOR,
    dashboard: true,
  },
]

// ── Icons ──────────────────────────────────────────────────────────────────
function GoalIcon({ type, color, size = 30 }) {
  const s = { width: size, height: size }
  const p = { fill: 'none', stroke: color, strokeLinecap: 'round', strokeLinejoin: 'round' }

  if (type === 'power') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <path d="M24 6L28 18H40L30 26L34 38L24 30L14 38L18 26L8 18H20L24 6Z"
        stroke={color} strokeWidth="2.2" fill={color} fillOpacity="0.12" />
      <line x1="38" y1="8" x2="44" y2="4" stroke={color} strokeWidth="2" opacity="0.5" />
      <line x1="40" y1="13" x2="47" y2="11" stroke={color} strokeWidth="2" opacity="0.35" />
    </svg>
  )

  if (type === 'contact') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <circle cx="14" cy="24" r="8" strokeWidth="2" fill={color} fillOpacity="0.12" />
      <rect x="26" y="20" width="6" height="20" rx="3" fill={color} fillOpacity="0.12"
        strokeWidth="2" transform="rotate(-30 29 30)" />
      <circle cx="25" cy="20" r="2.5" fill={color} />
      <line x1="25" y1="14" x2="25" y2="17" strokeWidth="1.5" />
      <line x1="29" y1="15" x2="27" y2="17.5" strokeWidth="1.5" />
    </svg>
  )

  if (type === 'allfields') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <path d="M24 40 L8 40 L8 16 Q24 4 40 16 L40 40 Z" strokeWidth="2" fill={color} fillOpacity="0.08" />
      <path d="M24 36 L10 22" strokeWidth="2" />
      <path d="M24 36 L24 14" strokeWidth="2.5" />
      <path d="M24 36 L38 22" strokeWidth="2" />
      <polyline points="7,24 10,22 12,25" strokeWidth="1.5" fill="none" />
      <polyline points="22,16 24,14 26,16" strokeWidth="1.5" fill="none" />
      <polyline points="36,25 38,22 41,24" strokeWidth="1.5" fill="none" />
    </svg>
  )

  if (type === 'popup') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <path d="M10 38 Q12 10 24 8 Q36 6 38 38" strokeWidth="2" fill="none"
        opacity="0.3" strokeDasharray="3 3" />
      <line x1="28" y1="12" x2="36" y2="20" strokeWidth="2.5" />
      <line x1="36" y1="12" x2="28" y2="20" strokeWidth="2.5" />
      <path d="M10 38 Q18 30 38 32" strokeWidth="2.5" />
      <circle cx="38" cy="32" r="3" fill={color} fillOpacity="0.5" strokeWidth="1.5" />
    </svg>
  )

  if (type === 'open') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <circle cx="24" cy="24" r="16" strokeWidth="2" fill={color} fillOpacity="0.1" />
      <path d="M18 10 Q12 24 18 38" strokeWidth="2" />
      <path d="M30 10 Q36 24 30 38" strokeWidth="2" />
      <line x1="16" y1="18" x2="12" y2="20" strokeWidth="1.5" />
      <line x1="15" y1="23" x2="11" y2="24" strokeWidth="1.5" />
      <line x1="32" y1="18" x2="36" y2="20" strokeWidth="1.5" />
      <line x1="33" y1="23" x2="37" y2="24" strokeWidth="1.5" />
    </svg>
  )

  if (type === 'dashboard') return (
    <svg {...s} viewBox="0 0 48 48" {...p}>
      <rect x="6" y="6" width="16" height="16" rx="3" strokeWidth="1.8" fill={color} fillOpacity="0.08" />
      <rect x="26" y="6" width="16" height="16" rx="3" strokeWidth="1.8" fill={color} fillOpacity="0.08" />
      <rect x="6" y="26" width="16" height="16" rx="3" strokeWidth="1.8" fill={color} fillOpacity="0.08" />
      <rect x="26" y="26" width="16" height="16" rx="3" strokeWidth="1.8" fill={color} fillOpacity="0.08" />
      <rect x="9" y="16" width="3" height="4" rx="1" fill={color} opacity="0.7" />
      <rect x="13" y="12" width="3" height="8" rx="1" fill={color} opacity="0.7" />
      <rect x="17" y="9" width="3" height="11" rx="1" fill={color} opacity="0.7" />
      <polyline points="29,18 33,13 37,15 41,10" strokeWidth="2" fill="none" opacity="0.8" />
      <circle cx="12" cy="36" r="1.5" fill={color} opacity="0.6" />
      <circle cx="17" cy="32" r="1.5" fill={color} opacity="0.6" />
      <circle cx="14" cy="38" r="1.5" fill={color} opacity="0.6" />
      <path d="M31 38 A7 7 0 0 1 41 38" strokeWidth="2" fill="none" opacity="0.5" />
      <path d="M31 38 A7 7 0 0 1 37 31" strokeWidth="2.5" fill="none" opacity="0.9" />
      <circle cx="36" cy="38" r="1.5" fill={color} />
    </svg>
  )

  return null
}

// ── Badge ──────────────────────────────────────────────────────────────────
function Badge({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 9px',
      borderRadius: 100,
      background: `${color}1A`,
      border: `1px solid ${color}45`,
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 600,
      fontSize: 12,
      letterSpacing: '0.06em',
      color: color,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ── Advanced pill (for Full Dashboard card) ────────────────────────────────
function AdvancedPill() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 100,
      background: 'rgba(123,158,184,0.15)',
      border: '1px solid rgba(123,158,184,0.35)',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 700,
      fontSize: 10,
      letterSpacing: '0.1em',
      color: '#7B9EB8',
      textTransform: 'uppercase',
    }}>
      Advanced
    </span>
  )
}

// ── Goal Card ──────────────────────────────────────────────────────────────
function GoalCard({ goal, onNavigate, index, revealed }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  return (
    <div
      onClick={() => onNavigate(goal.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        position: 'relative',
        borderRadius: 18,
        cursor: 'pointer',
        overflow: 'hidden',
        animation: revealed
          ? `cardIn 0.5s cubic-bezier(0.22,1,0.36,1) ${0.06 + index * 0.055}s both`
          : 'none',
        transform: pressed
          ? 'scale(0.974)'
          : hovered
          ? 'scale(1.012)'
          : 'scale(1)',
        transition:
          'transform 0.16s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease, border-color 0.22s ease',
        border: hovered
          ? `1.5px solid ${goal.color}CC`
          : '1.5px solid rgba(255,255,255,0.16)',
        boxShadow: hovered
          ? `0 0 0 1px ${goal.color}30, 0 8px 32px ${goal.color}25, 0 2px 12px rgba(0,0,0,0.55)`
          : '0 2px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
        background: hovered
          ? `linear-gradient(140deg, ${goal.color}12 0%, rgba(30,32,38,0.98) 55%)`
          : 'linear-gradient(160deg, rgba(34,36,43,0.97) 0%, rgba(26,28,34,0.98) 100%)',
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: hovered ? 6 : 5,
          background: goal.color,
          opacity: hovered ? 1 : 0.65,
          transition: 'width 0.2s, opacity 0.2s',
          borderRadius: '0 3px 3px 0',
        }}
      />

      {/* Hover radial glow */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 12% 50%, ${goal.color}12 0%, transparent 60%)`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Card content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '16px 18px 16px 24px',
        }}
      >
        {/* Icon row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 62,
                height: 62,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: hovered ? `${goal.color}22` : `${goal.color}12`,
                borderRadius: 16,
                border: `1px solid ${goal.color}${hovered ? '50' : '28'}`,
                transition: 'background 0.2s, border-color 0.2s',
                flexShrink: 0,
              }}
            >
              <GoalIcon
                type={goal.type}
                color={hovered ? goal.color : `${goal.color}CC`}
                size={38}
              />
            </div>
            {goal.dashboard && <AdvancedPill />}
          </div>
        </div>

        {/* Label */}
        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: 23,
            lineHeight: 1.05,
            letterSpacing: '0.005em',
            color: hovered ? '#fff' : 'rgba(255,255,255,0.9)',
            marginBottom: 6,
            transition: 'color 0.2s',
          }}
        >
          {goal.label}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 13,
            lineHeight: 1.45,
            color: hovered ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)',
            marginBottom: 12,
            flex: 1,
            transition: 'color 0.2s',
          }}
        >
          {goal.subtitle}
        </div>

        {/* Metric badge */}
        <div>
          <Badge
            label={goal.tag}
            color={hovered ? goal.color : `${goal.color}AA`}
          />
        </div>
      </div>
    </div>
  )
}

// ── The app's own radar mark ───────────────────────────────────────────────
// Original artwork for this project, not TrackMan branding.
// public/radar-mark.svg draws the same mark in the browser tab; see that
// file's comment for the five things it changes to survive 16x16.
function RadarMark({ color }) {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <path
        d="M16 28C22.627 28 28 22.627 28 16S22.627 4 16 4"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M16 23C19.866 23 23 19.866 23 16S19.866 9 16 9"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M16 18C17.105 18 18 17.105 18 16S17.105 14 16 14"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2" fill={color} />
      <line
        x1="4"
        y1="28"
        x2="16"
        y2="16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  )
}

// ── The "Powered by TrackMan" badge in the header ──────────────────────────
function PoweredByTrackMan({ color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <RadarMark color={color} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: 10,
            letterSpacing: '0.25em',
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
          }}
        >
          Powered by
        </span>
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.85)',
            textTransform: 'uppercase',
          }}
        >
          TrackMan
        </span>
      </div>
    </div>
  )
}

// ── Decorative radar background ────────────────────────────────────────────
function RadarDecor() {
  return (
    <svg
      style={{
        position: 'absolute',
        top: -80,
        right: -80,
        opacity: 0.035,
        pointerEvents: 'none',
      }}
      width="360"
      height="360"
      viewBox="0 0 360 360"
      fill="none"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx="320" cy="40" r={i * 55} stroke="white" strokeWidth="1" />
      ))}
      <line x1="320" y1="40" x2="320" y2="340" stroke="white" strokeWidth="1" />
      <line x1="320" y1="40" x2="20" y2="340" stroke="white" strokeWidth="1" />
      <line x1="320" y1="40" x2="170" y2="360" stroke="white" strokeWidth="1" />
    </svg>
  )
}

// ── Goal Selection Screen ──────────────────────────────────────────────────
// Props:
//   player   — object from TrackMan API: { firstName, lastName } or null while loading
//   onSelect — callback(goalId) called immediately when a card is clicked
function GoalSelectionScreen({ player = null, onSelect }) {
  const [revealed, setRevealed] = useState(false)

  // Stagger-in animation trigger
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Player display values — empty state until TrackMan API provides data
  const firstName = player?.firstName ?? null
  const initials =
    player
      ? `${player.firstName?.[0] ?? ''}${player.lastName?.[0] ?? ''}`.toUpperCase()
      : null

  const accentColor = ACCENT

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(155deg, #141518 0%, #0C0D0F 55%, #0E0D12 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <RadarDecor />

      {/* Header row: logo | divider | headline | avatar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 28px 10px',
          gap: 24,
          flexShrink: 0,
          animation: revealed ? 'fadeUp 0.45s ease both' : 'none',
        }}
      >
        <PoweredByTrackMan color={accentColor} />

        <div
          style={{
            width: 1,
            height: 36,
            background: 'rgba(255,255,255,0.1)',
            flexShrink: 0,
          }}
        />

        {/* Headline */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900,
              fontSize: 36,
              lineHeight: 1.0,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              color: '#fff',
            }}
          >
            {firstName ? (
              <>
                {firstName},{' '}
                <span style={{ color: accentColor, fontStyle: 'italic' }}>
                  what are you working on
                </span>{' '}
                today?
              </>
            ) : (
              <>
                What are you{' '}
                <span style={{ color: accentColor, fontStyle: 'italic' }}>
                  working on
                </span>{' '}
                today?
              </>
            )}
          </div>
          <div
            style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 13,
              color: 'rgba(255,255,255,0.38)',
              marginTop: 3,
            }}
          >
            TrackMan tracks every swing. You pick the target.
          </div>
        </div>

        {/* Avatar — empty state until player data loads */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            flexShrink: 0,
            background: 'rgba(255,255,255,0.06)',
            border: '1.5px solid rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          {initials ?? ''}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: 'rgba(255,255,255,0.06)',
          margin: '0 28px',
          flexShrink: 0,
        }}
      />

      {/* 3×2 card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 10,
          padding: '12px 28px',
          flex: 1,
          minHeight: 0,
        }}
      >
        {GOALS.map((g, i) => (
          <GoalCard
            key={g.id}
            goal={g}
            onNavigate={onSelect}
            index={i}
            revealed={revealed}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '6px 28px 14px', flexShrink: 0 }}>
        <div
          style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 11,
            color: 'rgba(255,255,255,0.18)',
            letterSpacing: '0.02em',
            textAlign: 'center',
          }}
        >
          Session data synced automatically
        </div>
      </div>
    </div>
  )
}

// ── App root ───────────────────────────────────────────────────────────────
const SESSION_MEMORY_DEPTH = 4

const NICKNAMES = [
  'The Great Bambino',
  'The Sultan of Swat',
  'The Iron Horse',
  'The Say Hey Kid',
  'The Splendid Splinter',
  'Charlie Hustle',
  'The Wizard',
  'Mr. October',
  'The Kid',
  'The Commerce Comet',
]

export default function App() {
  const [screen, setScreen] = useState('goal')
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [dashboardMessage, setDashboardMessage] = useState(false)
  const [sessionNumber, setSessionNumber] = useState(1)
  const [sessions, setSessions] = useState([1])
  const [activeSwings, setActiveSwings] = useState(mockSwings)
  const player = useMemo(() => ({
    firstName: 'Bill',
    lastName: NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)],
  }), [])

  const [sessionHistory, setSessionHistory] = useState([])
  const [viewingSession, setViewingSession] = useState(null)

  // Loading-screen state. `slow` fires once at 25 seconds so the ambient wait
  // sets an expectation against the real deadline instead of staying silent.
  // `retrying` covers the one automatic retry callApi may run on its own.
  // `failure` is the reason (and cold flag) the coachUnavailable screen reads
  // its copy from, from src/failureCopy.js.
  const [slow, setSlow] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [failure, setFailure] = useState(null)
  const slowTimerRef = useRef(null)

  // Belt and suspenders on top of the per-call clears in runDebrief: if the
  // component itself ever unmounts mid-wait, the 25 second timer does not
  // fire into a screen that is no longer there.
  useEffect(() => {
    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
    }
  }, [])

  const handleHome = () => {
    setSelectedGoal(null)
    setSessionNumber(1)
    setSessions([1])
    setActiveSwings(mockSwings)
    setSessionHistory([])
    setViewingSession(null)
    setScreen('goal')
  }

  // Split out of handleEndSession so the error screen's "Try again" can re-run the
  // same request without adding the session to history a second time.
  const runDebrief = (history, forSessionNumber) => {
    setSlow(false)
    setRetrying(false)
    setFailure(null)
    setScreen('loading')

    if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
    const timerId = setTimeout(() => setSlow(true), 25000)
    slowTimerRef.current = timerId

    // Clears this call's own timer by the id it captured, and only clears the
    // shared ref if the ref still points at that same id. The second check is
    // what keeps this safe if an older runDebrief call's promise settles
    // after a newer call has already started its own timer: without it, the
    // older call's cleanup would read the ref, find the newer timer sitting
    // there, and clear that one instead of its own, silently cutting off a
    // wait that was still active. Not reachable today, because both entry
    // points into runDebrief (ending a session, and the Try Again button)
    // only fire from a screen other than 'loading', so two calls cannot be in
    // flight at once. Written defensively anyway, since that is exactly the
    // assumption a later change could break without anyone noticing here.
    const clearSlowTimer = () => {
      clearTimeout(timerId)
      if (slowTimerRef.current === timerId) {
        slowTimerRef.current = null
      }
    }

    const sessionsForDebrief = history.filter((s) => s.sessionNumber <= forSessionNumber)

    generateDebrief({
      goal: selectedGoal,
      player,
      sessions: sessionsForDebrief,
      viewingSessionNumber: forSessionNumber,
      onRetry: () => setRetrying(true),
    })
      .then((result) => {
        clearSlowTimer()
        if (result.nextSessionTips?.length > 0) {
          setSessionHistory((prev) =>
            prev.map((s) =>
              s.sessionNumber === forSessionNumber
                ? { ...s, messages: [{ role: 'coach', content: '__tips__', tipsIntro: result.tipsIntro ?? null, tips: result.nextSessionTips }] }
                : s
            )
          )
        }
        setSessionHistory((prev) =>
          prev.map((s) =>
            s.sessionNumber === forSessionNumber
              ? { ...s, debrief: result }
              : s
          )
        )
        setSlow(false)
        setRetrying(false)
        setScreen('debrief')
      })
      .catch((err) => {
        // Never advance to the debrief without a debrief. An empty results screen
        // reads as a finished product with nothing to say.
        //
        // callApi always throws a CoachError, but this catch must survive one
        // that is not, so an error shape this app has never seen still reaches
        // the visitor as the honest 'trouble' copy rather than a blank screen.
        clearSlowTimer()
        setSlow(false)
        setRetrying(false)
        setFailure({
          reason: err instanceof CoachError ? err.reason : 'trouble',
          cold: err instanceof CoachError ? err.cold : false,
        })
        setScreen('coachUnavailable')
      })
  }

  const handleEndSession = () => {
    const stats = computeStats(activeSwings)
    const newEntry = { sessionNumber, swings: activeSwings, stats, messages: [] }
    const updatedHistory = [...sessionHistory, newEntry]

    setSessionHistory(updatedHistory)
    setViewingSession(sessionNumber)
    runDebrief(updatedHistory, sessionNumber)
  }

  if (screen === 'goal') {
    return (
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <GoalSelectionScreen
          player={player}
          onSelect={(goalId) => {
            if (goalId === 'dashboard') {
              setDashboardMessage(true)
              return
            }
            setSelectedGoal(GOALS.find((g) => g.id === goalId))
            setScreen('live')
          }}
        />
        {dashboardMessage && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}>
            <div style={{
              background: 'linear-gradient(145deg, rgba(30,32,40,0.98) 0%, rgba(20,22,28,0.99) 100%)',
              border: '1.5px solid rgba(255,255,255,0.12)',
              borderRadius: 20,
              padding: '32px 36px',
              maxWidth: 420,
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 800, fontSize: 20, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#fff',
                marginBottom: 14,
              }}>
                Full Dashboard
              </div>
              <div style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 15, lineHeight: 1.65,
                color: 'rgba(255,255,255,0.6)',
                marginBottom: 24,
              }}>
                Full Dashboard is not part of this prototype. This would show all raw TrackMan metrics and advanced charts similar to the current app experience.
              </div>
              <button
                onClick={() => setDashboardMessage(false)}
                style={{
                  height: 42, paddingInline: 24, borderRadius: 12, border: 'none',
                  background: `linear-gradient(135deg, #FF6B1A 0%, #FF6B1ACC 100%)`,
                  color: '#fff',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800, fontSize: 15, letterSpacing: '0.08em',
                  textTransform: 'uppercase', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(255,107,26,0.35)',
                }}
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (screen === 'live') {
    return (
      <div style={{ width: '100vw', height: '100vh' }}>
        <LiveSessionScreen
          player={player}
          sessionNumber={sessionNumber}
          goalId={selectedGoal?.id}
          goalLabel={selectedGoal?.label}
          swings={activeSwings.map((s) => ({
            exitSpeed: s.hit.launch.exitSpeed,
            angle: s.hit.launch.angle,
            dist: s.hit.landing.distance,
          }))}
          onEndSession={handleEndSession}
          onHome={handleHome}
        />
      </div>
    )
  }

  if (screen === 'loading') {
    // Retrying takes priority over the mid-wait line: the two can be true at
    // once (the retry can fire after the 25 second mark), and "trying again"
    // is the more current thing to tell the visitor than "still working."
    const prominent = retrying || slow
    const loadingMessage = retrying ? RETRYING_MESSAGE : slow ? MID_WAIT_MESSAGE : 'Your coach is reviewing the session…'

    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(155deg, #141518 0%, #0C0D0F 55%, #0E0D12 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20,
      }}>
        <PoweredByTrackMan color={ACCENT} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'rgba(255,255,255,0.4)',
              animation: `blink 1.2s ease ${i * 0.18}s infinite`,
            }} />
          ))}
        </div>
        {/* The ordinary waiting line stays quiet and ambient. The mid-wait and
            retrying lines are the ones a visitor has to actually read, so they
            get the larger, brighter treatment shared with the failure screen. */}
        <div style={{
          fontFamily: "'Barlow', sans-serif",
          fontSize: prominent ? 18 : 14,
          color: prominent ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.35)',
          letterSpacing: '0.02em',
          maxWidth: prominent ? 520 : 420, textAlign: 'center', lineHeight: 1.6,
          paddingInline: 24,
        }}>
          {loadingMessage}
        </div>
      </div>
    )
  }

  if (screen === 'coachUnavailable') {
    // failureCopy falls back to the 'trouble' wording on its own for a
    // reason it does not recognize, including no reason at all, so this
    // never renders a blank screen.
    const { message, showRetry } = failureCopy(failure?.reason, failure?.cold)

    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(155deg, #141518 0%, #0C0D0F 55%, #0E0D12 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 24,
      }}>
        <PoweredByTrackMan color={ACCENT} />
        <div style={{
          fontFamily: "'Barlow', sans-serif",
          fontSize: 18, color: 'rgba(255,255,255,0.72)',
          letterSpacing: '0.02em',
          maxWidth: 520, textAlign: 'center', lineHeight: 1.6,
          paddingInline: 24,
        }}>
          {message}
        </div>
        {showRetry && (
          <button
            onClick={() => runDebrief(sessionHistory, viewingSession)}
            style={{
              height: 42, paddingInline: 24, borderRadius: 12, border: 'none',
              background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT}CC 100%)`,
              color: '#fff',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800, fontSize: 15, letterSpacing: '0.08em',
              textTransform: 'uppercase', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(255,107,26,0.35)',
            }}
          >
            Try again
          </button>
        )}
      </div>
    )
  }

  if (screen === 'debrief') {
    const viewed = sessionHistory.find((s) => s.sessionNumber === viewingSession) ?? sessionHistory.at(-1)
    const viewedDebrief = viewed?.debrief ?? null

    const rawSwings = viewed?.swings ?? []
    const topEV = topExitVelocity(rawSwings)

    const sessionContext = {
      goal: selectedGoal,
      player,
      sessions: sessionHistory.filter((s) => s.sessionNumber <= viewingSession),
      viewingSessionNumber: viewingSession,
    }

    return (
      <div style={{ width: '100vw', height: '100vh' }}>
        <DebriefScreen
          player={player}
          sessionNumber={viewed?.sessionNumber ?? sessionNumber}
          goalId={selectedGoal?.id}
          goalLabel={selectedGoal?.label}
          sessionData={viewed?.stats ?? null}
          coachingSummary={viewedDebrief?.coachingSummary ?? null}
          whatThisMeans={viewedDebrief?.whatThisMeans ?? null}
          charts={viewedDebrief?.charts ?? []}
          sessions={sessions}
          onSessionToggle={(num) => setViewingSession(num)}
          onHome={handleHome}
          chatMessages={viewed?.messages ?? []}
          onChatUpdate={(newMessages) =>
            setSessionHistory((prev) =>
              prev.map((s) =>
                s.sessionNumber === viewed?.sessionNumber
                  ? { ...s, messages: newMessages }
                  : s
              )
            )
          }
          sessionCapReached={sessionHistory.length >= SESSION_MEMORY_DEPTH}
          onNewSession={() => {
            if (sessionHistory.length >= SESSION_MEMORY_DEPTH) return
            // The player's chosen goal goes to the generator, so a hitter
            // working on Power actually starts getting the ball in the air and
            // a session that would show an empty target band is re-rolled.
            const newSwings = generateSwings({
              sessionNum: sessionNumber + 1,
              goalId: selectedGoal?.id,
              baselineSwings: mockSwings,
            })
            const newNum = sessionNumber + 1
            setActiveSwings(newSwings)
            setSessionNumber(newNum)
            setSessions((prev) => [...prev, newNum])
            setScreen('live')
          }}
          sessionContext={sessionContext}
          onChartSignal={(chartKey) => {
            if (chartKey) {
              setSessionHistory((prev) =>
                prev.map((s) =>
                  s.sessionNumber === viewed?.sessionNumber
                    ? { ...s, debrief: { ...s.debrief, charts: [s.debrief?.charts?.[0] ?? null, chartKey] } }
                    : s
                )
              )
            }
          }}
          rawSwings={rawSwings}
          topEV={topEV}
        />
      </div>
    )
  }

}
