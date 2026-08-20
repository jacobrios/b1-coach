# Slice 8c Implementation Plan: finish the counting rule, and fix the tool measuring it

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-count the strike-zone thresholds the coach still derives for itself, fix the fly-ball wording gap and the "1 swings" grammar, fix the grading tool's fact sheet so it stops calling true statements false, and measure all of it before and after, separating for the first time the claims the coach was handed from the claims it derived.

**Architecture:** Zone logic joins the existing bounds copy in `src/sessionStats.js`; per-goal counts move to `src/goalCountSpecs.js` as a shared `goalCountValues` so the prompt and the grader's fact sheet read one computation; handed-vs-derived classification is a pure function of goal id and prompt era, threaded through `verdictForClaim`'s existing `context` parameter.

**Tech Stack:** Plain ESM JavaScript, vitest 4, hand-run Node scripts for the bench and grader (deliberately outside the test runner).

## Front section (for the product manager, ~200 words)

**Settled, do not relitigate:** the five pieces and their order are recorded in `docs/queued-slices.md` under "Slice 8c" (fact-sheet fix before any measurement; the three prompt changes ship together; fly-ball 18 approved 18 Aug 2026). Budget approved 18 Aug 2026: ~$1.55 expected, $3 ceiling, flag if projected spend approaches $5. The before side reuses Slice 8b's committed after-round records, re-graded with the fixed tool.

**Not in this slice:** zone count lines for the *chat* prompt (debrief only; chat gets them if a chat miscount is ever measured); the app writing the coach's numbers itself (parked, trigger recorded with Slice 8c in queued-slices); consolidating the six strike-zone bound copies (existing trigger stands); the session-1 swing rewrite; a full false-positive-rate measurement for the grader (this slice hand-checks flagged claims instead).

**Verification:** every code change test-first and seen red; grader and bench dry runs (free) before any live call; the live before/after comparison plus a by-hand check of every flagged after-round debrief; a browser pass on a live session-1 Power debrief. Suite baseline at slice start: **461 tests, 19 files, green**, matching Slice 8b's close.

**Expected debt:** extraction-prompt guidance is model behavior, unverifiable until the live rounds; the slice8b-era handed set is hardcoded knowledge in one script module; zone sub-lines can overlap (a pitch can be both low and wide), mitigated by the union line and the never-count rule, watched in the rounds.

## Global Constraints

- Branch: `slice-8c-strike-zone-counts`. One commit per task. Never commit to main, never merge; the slice ends at an open PR.
- **Budget is a hard number:** ~$1.55 expected across Tasks 9 and 10; stop and surface to the product manager before any call that would push total slice spend past $3.
- Everything on the fact-sheet import path (`src/goalCountSpecs.js`, `src/sessionStats.js`, `src/ballFlight.js`, `src/goalTargets.js`, `src/promptText.js`, everything under `scripts/`) uses **full `.js` extensions on relative imports**. `src/coachApi.js` keeps its extensionless style and must never be imported from that path.
- Test expectations are **hand-derived literals**, never computed from the module under test (standing convention, stated in `src/goalCountSpecs.test.js:3-7`).
- The three coach-prompt changes in this plan (zone count lines, fly-ball 18, count grammar) are the only coach-prompt changes allowed; the grader's own extraction prompt (`GRADER_SYSTEM`) may change as specced in Task 8. No other prompt wording moves.
- New prompt lines match the existing count-line style, including the ` — numbers: ` separator with its em dash; the em-dash ban governs the humans' prose, not the coach prompt's shipped formatting (per CLAUDE.md's deliberate-decisions section). Do not "fix" the dashes in pinned strings.
- Docs are append-only; corrections are dated annotations.
- `npm test` from the repo root; the post-edit hook runs it automatically and it takes about a second.

---

### Task 1: Strike-zone breakdown in `src/sessionStats.js`

**Files:**
- Modify: `src/sessionStats.js`
- Test: `src/sessionStats.test.js`

**Interfaces:**
- Produces: `export const STRIKE_ZONE = { heightMin: 1.5, heightMax: 3.5, sideMin: -0.7, sideMax: 0.7 }`; `export const inStrikeZone = (swing) => boolean`; `export function pitchZoneBreakdown(swings)` returning `{ outside, high, low, wide }`, each `{ count: number, swings: number[] }` with 1-indexed swing numbers. Tasks 5 and 6 consume all three.

- [ ] **Step 1: Write the failing tests** (append to `src/sessionStats.test.js`, matching its import style):

```js
import { computeStats, topExitVelocity, inStrikeZone, pitchZoneBreakdown, STRIKE_ZONE } from './sessionStats.js'
```

```js
// Bounds as literals, not read back from STRIKE_ZONE: asserting the zone
// against itself would pass no matter what the numbers became.
describe('pitchZoneBreakdown', () => {
  const swings = [
    { plateLocHeight: 2.5, plateLocSide: 0.0 },  // in zone
    { plateLocHeight: 3.6, plateLocSide: 0.2 },  // high
    { plateLocHeight: 1.2, plateLocSide: -0.3 }, // low
    { plateLocHeight: 2.8, plateLocSide: 0.9 },  // wide
    { plateLocHeight: 1.4, plateLocSide: -0.8 }, // low AND wide at once
    { plateLocHeight: 3.5, plateLocSide: -0.7 }, // exactly on both bounds: in zone
  ]

  it('classifies high, low, and wide pitches with 1-indexed swing numbers', () => {
    const zone = pitchZoneBreakdown(swings)
    expect(zone.high).toEqual({ count: 1, swings: [2] })
    expect(zone.low).toEqual({ count: 2, swings: [3, 5] })
    expect(zone.wide).toEqual({ count: 2, swings: [4, 5] })
  })

  it('counts the outside union once per swing, even when a pitch is off in two directions', () => {
    const zone = pitchZoneBreakdown(swings)
    expect(zone.outside).toEqual({ count: 4, swings: [2, 3, 4, 5] })
  })

  it('treats the bounds as inclusive, matching computeStats', () => {
    expect(inStrikeZone({ plateLocHeight: 3.5, plateLocSide: -0.7 })).toBe(true)
    expect(inStrikeZone({ plateLocHeight: 1.5, plateLocSide: 0.7 })).toBe(true)
    expect(inStrikeZone({ plateLocHeight: 3.51, plateLocSide: 0 })).toBe(false)
  })

  it('agrees with computeStats about who is in the zone', () => {
    // 4 outside, so 2 in zone: the two numbers must always sum to the total.
    expect(computeStats(swings.map((s) => ({ ...s, hit: { launch: { exitSpeed: 80, angle: 10 } } }))).inZoneCount).toBe(2)
  })
})
```

- [ ] **Step 2: Run and verify failure.** `npm test -- src/sessionStats.test.js` fails with `inStrikeZone` not exported.

- [ ] **Step 3: Implement.** In `src/sessionStats.js`, add above `computeStats`:

```js
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
```

Then change `computeStats`'s inline filter to `swings.filter(inStrikeZone).length` and update the file's header comment (the bounds are still written out separately elsewhere; this change consolidates nothing outside this file).

- [ ] **Step 4: Run and verify pass.** `npm test` fully green.
- [ ] **Step 5: Commit.** `git add src/sessionStats.js src/sessionStats.test.js && git commit` (message about pre-computing the zone breakdown so the coach stops deriving it).

---

### Task 2: `swingCountPhrase` helper, and the distance line's grammar

**Files:**
- Create: `src/promptText.js`
- Modify: `src/ballFlight.js` (`distanceDistributionLine`, lines 224-228)
- Test: `src/ballFlight.test.js`, new `src/promptText.test.js`, and the pinned string at `src/coachApi.test.js:172` (`pinTail`)

**Interfaces:**
- Produces: `export const swingCountPhrase = (count) => string` ("1 swing", "3 swings"). Tasks 3 and 5 consume it.

**Scope note, declared:** `distanceDistributionLine` predates Slice 8b, but it is a generated count line in the same prompt with the identical "1 swings" bug, and this slice's after-round measures the prompt it ships in. Fixing it here rather than leaving one known-wrong plural behind is a deliberate, disclosed widening of piece 3 by one line.

- [ ] **Step 1: Write the failing tests.** New `src/promptText.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { swingCountPhrase } from './promptText.js'

describe('swingCountPhrase', () => {
  it('uses the singular for exactly one', () => {
    expect(swingCountPhrase(1)).toBe('1 swing')
  })
  it('uses the plural for zero and for many', () => {
    expect(swingCountPhrase(0)).toBe('0 swings')
    expect(swingCountPhrase(3)).toBe('3 swings')
  })
})
```

In `src/ballFlight.test.js`, find the assertion pinning `distanceDistributionLine` output and change every `1 swings` to `1 swing` (plural counts unchanged). In `src/coachApi.test.js:172`, update `pinTail`'s distance segment to `- Distance distribution: Under 175ft: 1 swing, 175-225ft: 0 swings, 225-265ft: 0 swings, 265-305ft: 0 swings, 305+ft: 1 swing`.

- [ ] **Step 2: Run and verify failure.** `npm test` fails on the new file (module missing) and on both updated pins.

- [ ] **Step 3: Implement.** Create `src/promptText.js`:

```js
// One tiny rule of prompt grammar: a count of swings reads "1 swing", never
// "1 swings". Shared by the goal count lines in coachApi.js and the distance
// distribution in ballFlight.js, the two places the prompt writes a count
// out in words. Lives in its own module because ballFlight.js sits on the
// grader's .js-extension import path and coachApi.js does not.
export const swingCountPhrase = (count) => `${count} swing${count === 1 ? '' : 's'}`
```

In `src/ballFlight.js`, add `import { swingCountPhrase } from './promptText.js'` and change the map to `` `${label}ft: ${swingCountPhrase(count)}` ``.

- [ ] **Step 4: Run and verify pass.** Note: `src/coachApi.js`'s own eleven `swings` literals still misprint at count 1; that is Task 3's red test, not a failure here. The `pinTail` fix already passes because the distance line comes from `ballFlight.js`.
- [ ] **Step 5: Commit.**

---

### Task 3: `goalCountValues`, one computation for every count the prompt states

**Files:**
- Modify: `src/goalCountSpecs.js` (add `goalCountValues`), `src/coachApi.js` (rewrite `goalCountLines`, lines 453-490)
- Test: `src/goalCountSpecs.test.js`, `src/coachApi.test.js` (the `1 swings` pins)

**Interfaces:**
- Consumes: `swingCountPhrase` from Task 2; `meetsTarget` from `./goalTargets.js`.
- Produces: `export function goalCountValues(goalId, swings)` in `src/goalCountSpecs.js`, returning `{}` for goals with no count lines, else an object keyed by stable line keys, each value `{ count: number, swings: number[] }` (1-indexed). Keys: power `underFifteen`, `powerZone`; contact `contactTargetBand`, `contactHardHit`, `contactFlyBall`; allfields `pullSide`, `oppoField`, `allfieldsHardContact`; popup `popUp`, `weakGrounder`, `popupTargetBand`. Task 6's fact sheet flattens these to `${key}Count` / `${key}Swings`, so power's keys deliberately preserve the legacy stat names.

- [ ] **Step 1: Write the failing tests.** Append to `src/goalCountSpecs.test.js` (expected values are hand-derived literals; the derivation comments are part of the test):

```js
import { GOAL_COUNT_SPECS, countSpecThresholds, goalCountValues } from './goalCountSpecs.js'
```

```js
describe('goalCountValues', () => {
  // Three swings chosen so each predicate has both members and non-members:
  // EV 91/74/85, LA 27/9/18, direction -20/18/-15.
  const swings = [
    { exitSpeed: 91, angle: 27, direction: -20 },
    { exitSpeed: 74, angle: 9, direction: 18 },
    { exitSpeed: 85, angle: 18, direction: -15 },
  ].map((launch) => ({ hit: { launch } }))

  it('computes power: strictly under 15 degrees, and the two-metric power zone', () => {
    expect(goalCountValues('power', swings)).toEqual({
      underFifteen: { count: 1, swings: [2] },   // only 9
      powerZone: { count: 1, swings: [1] },      // 91 mph at 27 degrees
    })
  })

  it('computes contact: inclusive 8-18 band, 85+ hard contact, fly balls strictly above the cutoff', () => {
    expect(goalCountValues('contact', swings)).toEqual({
      contactTargetBand: { count: 2, swings: [2, 3] },  // 9 and 18; 18 is inclusive
      contactHardHit: { count: 2, swings: [1, 3] },     // 91 and exactly 85
      contactFlyBall: { count: 1, swings: [1] },        // only 27 is strictly above
    })
  })

  it('computes allfields: strict direction cutoffs and 82+ hard contact', () => {
    expect(goalCountValues('allfields', swings)).toEqual({
      pullSide: { count: 1, swings: [1] },              // -20; -15 exactly is excluded
      oppoField: { count: 1, swings: [2] },             // 18; +15 exactly would be excluded
      allfieldsHardContact: { count: 2, swings: [1, 3] },
    })
  })

  it('computes popup: strict pop-up and grounder cutoffs, inclusive 10-25 band', () => {
    expect(goalCountValues('popup', swings)).toEqual({
      popUp: { count: 0, swings: [] },
      weakGrounder: { count: 0, swings: [] },
      popupTargetBand: { count: 1, swings: [3] },       // only 18
    })
  })

  it('hands open and unknown goals nothing', () => {
    expect(goalCountValues('open', swings)).toEqual({})
    expect(goalCountValues('dashboard', swings)).toEqual({})
  })
})
```

In `src/coachApi.test.js`, update every `1 swings` in the goal count lines to `1 swing`: the power pin at line 182 (`1 swing — numbers: 2` and `power zone (EV >= 88 mph AND launch angle 25-35 degrees): 1 swing`), the allfields pin at line 194 (`opposite field ...: 1 swing` and `82 mph or higher: 1 swing`; the two `0 swings` stay plural), and the popup assertions at lines 267-268 (`1 swing` twice).

- [ ] **Step 2: Run and verify failure.** `goalCountValues` not exported; three pins red.

- [ ] **Step 3: Implement.** In `src/goalCountSpecs.js`, change the import to `import { goalTarget, meetsTarget } from './goalTargets.js'` and append:

```js
// Every count line the debrief prompt states, computed once. The prompt
// renders these into English in src/coachApi.js and the grader's fact sheet
// (scripts/factSheet.js) flattens them into per-goal stats, so the count the
// coach was handed and the count a claim is graded against are the same
// number by construction, not by parallel arithmetic kept in step by tests.
// Keys are stable: the fact sheet derives stat names from them, and power's
// two keys keep their pre-8c stat names on purpose.
export function goalCountValues(goalId, swings) {
  const spec = GOAL_COUNT_SPECS[goalId]
  if (!spec) return {}
  const select = (pred) => {
    const hit = swings
      .map((sw, i) => ({ n: i + 1, launch: sw.hit.launch }))
      .filter(({ launch }) => pred(launch))
    return { count: hit.length, swings: hit.map((s) => s.n) }
  }
  switch (goalId) {
    case 'power':
      return {
        // Strictly below 15, matching the prompt's own "not including 15".
        // 15 is a prompt literal, not a goal target; the fact sheet's base
        // extras carry the same number.
        underFifteen: select((l) => l.angle < 15),
        powerZone: select((l) => meetsTarget('power', l)),
      }
    case 'contact':
      return {
        contactTargetBand: select((l) => l.angle >= spec.launchAngle.min && l.angle <= spec.launchAngle.max),
        contactHardHit: select((l) => l.exitSpeed >= spec.exitVelocity),
        contactFlyBall: select((l) => l.angle > spec.flyBallAngle),
      }
    case 'allfields':
      return {
        pullSide: select((l) => l.direction < spec.pullDirection),
        oppoField: select((l) => l.direction > spec.oppoDirection),
        allfieldsHardContact: select((l) => l.exitSpeed >= spec.hardContactExitVelocity),
      }
    case 'popup':
      return {
        popUp: select((l) => l.angle > spec.popUpAngle),
        weakGrounder: select((l) => l.angle < spec.grounderAngle),
        popupTargetBand: select((l) => l.angle >= spec.launchAngle.min && l.angle <= spec.launchAngle.max),
      }
    default:
      return {}
  }
}
```

In `src/coachApi.js`, import `goalCountValues` beside the existing `GOAL_COUNT_SPECS` import and `swingCountPhrase` from `./promptText`, then rewrite `goalCountLines` so every template reads its count from `goalCountValues` and renders it through `swingCountPhrase`, keeping every line's English byte-identical apart from the singular fix. Example for power (repeat the pattern for all four goals; the line text is already pinned in the tests):

```js
function goalCountLines(goalId, swings) {
  const spec = GOAL_COUNT_SPECS[goalId]
  if (!spec) return []
  const v = goalCountValues(goalId, swings)
  switch (goalId) {
    case 'power':
      return [
        `- Swings with launch angle strictly below 15 degrees (not including 15): ${swingCountPhrase(v.underFifteen.count)} — numbers: ${v.underFifteen.swings.join(', ')}`,
        `- Swings in power zone (EV >= ${spec.exitVelocity} mph AND launch angle ${spec.launchAngle.min}-${spec.launchAngle.max} degrees): ${swingCountPhrase(v.powerZone.count)}`,
      ]
    // contact, allfields, popup: same rewrite, reading v.contactTargetBand
    // etc.; the parenthetical threshold text in each line is unchanged.
    ...
  }
}
```

- [ ] **Step 4: Run and verify pass.** The whole suite, including every unchanged pin (the refactor must not move a byte other than the plural fix).
- [ ] **Step 5: Commit.**

---

### Task 4: Fly-ball threshold 20 to 18

**Files:**
- Modify: `src/goalCountSpecs.js:43` (the `flyBallAngle` literal and its comment; also dedupe in `countSpecThresholds`)
- Test: `src/goalCountSpecs.test.js` (the `flyBallAngle` pin and the `[8, 18, 20]` array), `src/coachApi.test.js:145` (goalContext pin) and `:251` (the count line)

- [ ] **Step 1: Update the tests to the approved behavior, and see them fail.**
  - `src/goalCountSpecs.test.js`: the spec pin becomes `expect(GOAL_COUNT_SPECS.contact.flyBallAngle).toBe(18)`. The flatten test becomes:

```js
  it('flattens contact to band edges plus the fly-ball line, deduped', () => {
    // 18 is named twice (band edge and fly-ball cutoff) and appears once.
    expect(countSpecThresholds('contact')).toEqual({
      launchAngle: [8, 18],
      exitVelocity: [85],
    })
  })
```

  - Add beside it a regression test for the gap the product manager's QA caught (swing 10 of session 1 sits at exactly 20 degrees):

```js
  it('leaves no angle uncounted between the line-drive band and the fly-ball line', () => {
    // The band ends at 18 inclusive and fly balls start strictly above 18,
    // so every angle is one or the other and 18 itself is a line drive.
    expect(GOAL_COUNT_SPECS.contact.flyBallAngle).toBe(GOAL_COUNT_SPECS.contact.launchAngle.max)
  })
```

  - `src/coachApi.test.js:145`: the contact goalContext pin becomes `'... Angles above 18 degrees are fly balls, not line drives.'`
  - `src/coachApi.test.js:251`: `'- Swings with launch angle strictly above 18 degrees (not including 18): 4 swings'` (fixture angles 27, 9, 18, 20, 4, 36, 35: strictly above 18 is 27, 20, 36, 35, so 4; it was 3 at the 20 cutoff, which is exactly the 18-to-20 gap closing).

- [ ] **Step 2: Run and verify failure** (four red assertions).

- [ ] **Step 3: Implement.** In `src/goalCountSpecs.js` set `flyBallAngle: 18`, replacing the comment with one recording the change:

```js
    // "Angles above 18 degrees are fly balls, not line drives." Was 20 until
    // Slice 8c (approved 18 August 2026): the band ends at 18, so the old 20
    // left 18-to-20 counted by neither number, and swing 10 of session 1
    // sits at exactly 20. One number now governs the goal: the band's own
    // ceiling, read here so it can never drift from goalTargets.js.
    flyBallAngle: CONTACT.launchAngle.max,
```

  In `countSpecThresholds`, make `add` skip duplicates: `if (!out[metric].includes(value)) out[metric].push(value)`.

- [ ] **Step 4: Run and verify pass.**
- [ ] **Step 5: Commit.**

---

### Task 5: The zone count lines the coach is handed

**Files:**
- Modify: `src/coachApi.js` (`buildDebriefUserMessage`, injection at line 508-509)
- Test: `src/coachApi.test.js` (`pinTop`, both full-message pins, the open-goal gap test, plus a new zone-lines describe)

**Interfaces:**
- Consumes: `pitchZoneBreakdown`, `STRIKE_ZONE` from `./sessionStats` (Task 1); `swingCountPhrase` (Task 2).
- Produces: four unconditional lines in the debrief user message, between the strike-zone summary line and the goal count lines, for every goal including open:

```
- Swings on pitches outside the strike zone: 3 swings — numbers: 4, 7, 12
- Swings on pitches high (height above 3.5ft): 1 swing — numbers: 7
- Swings on pitches low (height below 1.5ft): 2 swings — numbers: 4, 12
- Swings on pitches wide (side outside -0.7 to 0.7ft): 0 swings
```

A zero count renders with no ` — numbers: ` suffix. The bound numbers interpolate from `STRIKE_ZONE`, not new literals. The lines are unconditional because the strike-zone summary line they extend is unconditional, and the error they close (the coach naming which swings were on pitches below the zone, wrongly) was observed on Power and Reduce Pop-Ups both.

- [ ] **Step 1: Write the failing tests.**
  - In the pinned-strings describe: set `pinSessions`' `inZoneCount` to `2` (the fixture's own coordinates put both swings in the zone; the hand-typed `1` was internally inconsistent and would sit visibly beside a computed `0 swings outside` in the same pinned text) and update `pinTop`'s zone line to `- Pitches in strike zone: 2/2 (...)`. Append to `pinTop`, after that line's `\n`:

```
- Swings on pitches outside the strike zone: 0 swings\n- Swings on pitches high (height above 3.5ft): 0 swings\n- Swings on pitches low (height below 1.5ft): 0 swings\n- Swings on pitches wide (side outside -0.7 to 0.7ft): 0 swings\n
```

  - Update the open-goal gap test (line ~283): the strike-zone summary now runs into the zone lines, and the last zone line runs into Top 3:

```js
    expect(message).toContain('full per-swing pitch coordinates included above)\n- Swings on pitches outside the strike zone:')
    expect(message).toContain('side outside -0.7 to 0.7ft): 0 swings\n- Top 3 exit velocities:')
```

  - New describe, after the count-lines describe, with an out-of-zone fixture (expected values hand-derived: outside is swings 2, 3, 4, 5; high is 2 only, 3.6 above 3.5 while 3.5 exactly is in; low is 3 and 5; wide is 4 and 5; swing 6 sits exactly on both bounds and stays in the zone):

```js
describe('the strike-zone count lines every goal is handed', () => {
  const zoneSwings = [
    { plateLocHeight: 2.5, plateLocSide: 0.0 },
    { plateLocHeight: 3.6, plateLocSide: 0.2 },
    { plateLocHeight: 1.2, plateLocSide: -0.3 },
    { plateLocHeight: 2.8, plateLocSide: 0.9 },
    { plateLocHeight: 1.4, plateLocSide: -0.8 },
    { plateLocHeight: 3.5, plateLocSide: -0.7 },
  ].map((loc, i) => ({
    ...loc,
    hit: { launch: { exitSpeed: 80 + i, angle: 12, direction: 0 }, landing: { distance: 200 + i } },
  }))
  const zoneSessions = [{
    sessionNumber: 1,
    swings: zoneSwings,
    stats: { avgExitVelocity: 82.5, avgLaunchAngle: 12, inZoneCount: 2, totalSwings: 6 },
  }]

  it('names which swings were outside, and which way each pitch was off', () => {
    const message = buildDebriefUserMessage({
      goal: { id: 'open', label: 'Open Session' },
      player: { firstName: 'Jake' },
      sessions: zoneSessions,
      viewingSessionNumber: 1,
    })
    expect(message).toContain('- Swings on pitches outside the strike zone: 4 swings — numbers: 2, 3, 4, 5')
    expect(message).toContain('- Swings on pitches high (height above 3.5ft): 1 swing — numbers: 2')
    expect(message).toContain('- Swings on pitches low (height below 1.5ft): 2 swings — numbers: 3, 5')
    expect(message).toContain('- Swings on pitches wide (side outside -0.7 to 0.7ft): 2 swings — numbers: 4, 5')
  })
})
```

- [ ] **Step 2: Run and verify failure.**

- [ ] **Step 3: Implement.** In `src/coachApi.js`, import `pitchZoneBreakdown` and `STRIKE_ZONE` from `./sessionStats`, add beside `goalCountLines`:

```js
// The zone breakdown, pre-counted for every goal. The strike-zone summary
// line above these hands the coach a total and the bounds; before Slice 8c
// nothing handed it WHICH swings were outside, so it derived that for
// itself and was measured getting it wrong in 11 of 11 attempts. Same rule
// as the goal count lines: count every threshold the prompt names.
function zoneCountLines(swings) {
  const zone = pitchZoneBreakdown(swings)
  const line = (label, bucket) =>
    `- ${label}: ${swingCountPhrase(bucket.count)}` +
    (bucket.count ? ` — numbers: ${bucket.swings.join(', ')}` : '')
  return [
    line('Swings on pitches outside the strike zone', zone.outside),
    line(`Swings on pitches high (height above ${STRIKE_ZONE.heightMax}ft)`, zone.high),
    line(`Swings on pitches low (height below ${STRIKE_ZONE.heightMin}ft)`, zone.low),
    line(`Swings on pitches wide (side outside ${STRIKE_ZONE.sideMin} to ${STRIKE_ZONE.sideMax}ft)`, zone.wide),
  ]
}
```

  Inject in `buildDebriefUserMessage` directly after the strike-zone summary line, using the same `.map((line) => `${line}\n`).join('')` shape the goal count lines use.

- [ ] **Step 4: Run and verify pass.**
- [ ] **Step 5: Commit.**

---

### Task 6: The fact sheet learns which goal it is grading

**Files:**
- Modify: `scripts/factSheet.js` (`METRICS`, `sessionStatsExtras`, `buildSessionFactSheet`, `buildFactSheet`, `goalExtraThresholds`), `scripts/grade-coach-accuracy.mjs` (the two `buildFactSheet` call sites, ~lines 995 and 1060, gain `goalId`)
- Test: `scripts/factSheet.test.js`

**Interfaces:**
- Consumes: `goalCountValues` from `../src/goalCountSpecs.js`, `pitchZoneBreakdown` and `STRIKE_ZONE` from `../src/sessionStats.js` (full `.js` extensions).
- Produces: `buildFactSheet({ sessions, viewingSessionNumber, extraThresholds, goalId })` and `buildSessionFactSheet(session, { extraThresholds, goalId })`. `stats` now carries, for every goal: `outsideZoneCount/Swings`, `highPitchCount/Swings`, `lowPitchCount/Swings`, `widePitchCount/Swings`; plus per-goal `${key}Count` / `${key}Swings` for each `goalCountValues` key (power keeps `underFifteenCount` etc.); and no longer carries another goal's counts. `METRICS` grows `pitchHeight` and `pitchSide`, and `goalExtraThresholds` seeds them with the zone bounds so threshold claims like "three pitches above 3.5 feet" become rulable.

- [ ] **Step 1: Rewrite the failing tests.** In `scripts/factSheet.test.js`, delete the test at ~lines 205-217 that pins the Power leak as required behavior (its own comment says Task 7 revisits it; this is that revisit) and add, using the existing 5-swing fixture (EVs 80/90/70/95/85, angles 10/20/5/30/15, directions 5/-5/20/0/-20, heights 2.0/2.5/1.0/2.2/3.0, sides 0.0/0.1/-0.5/0.2/0.3; only swing 3 at height 1.0 is out of zone):

```js
describe('per-goal and zone stats (Slice 8c)', () => {
  const session = { sessionNumber: 1, swings, stats: { avgExitVelocity: 84, avgLaunchAngle: 16, inZoneCount: 4, totalSwings: 5 } }

  it('hands every goal the zone breakdown the prompt now hands the coach', () => {
    const sheet = buildSessionFactSheet(session, { goalId: 'open' })
    expect(sheet.stats.outsideZoneCount).toBe(1)
    expect(sheet.stats.outsideZoneSwings).toEqual([3])
    expect(sheet.stats.lowPitchCount).toBe(1)
    expect(sheet.stats.lowPitchSwings).toEqual([3])
    expect(sheet.stats.highPitchCount).toBe(0)
    expect(sheet.stats.widePitchCount).toBe(0)
  })

  it('gives contact its own three counts and no Power stats', () => {
    const sheet = buildSessionFactSheet(session, { goalId: 'contact' })
    // Band 8-18 inclusive: angles 10 and 15. 85+: 90, 95, exactly 85.
    // Fly balls strictly above 18: 20 and 30.
    expect(sheet.stats.contactTargetBandCount).toBe(2)
    expect(sheet.stats.contactTargetBandSwings).toEqual([1, 5])
    expect(sheet.stats.contactHardHitCount).toBe(3)
    expect(sheet.stats.contactFlyBallCount).toBe(2)
    expect(sheet.stats.powerZoneCount).toBeUndefined()
    expect(sheet.stats.underFifteenCount).toBeUndefined()
  })

  it('keeps power stats, under their pre-8c names, for the power goal only', () => {
    const sheet = buildSessionFactSheet(session, { goalId: 'power' })
    // Strictly under 15: angles 10 and 5. Power zone: 95 mph at 30 degrees.
    expect(sheet.stats.underFifteenCount).toBe(2)
    expect(sheet.stats.underFifteenSwings).toEqual([1, 3])
    expect(sheet.stats.powerZoneCount).toBe(1)
    expect(sheet.stats.powerZoneSwings).toEqual([4])
    expect(sheet.stats.contactTargetBandCount).toBeUndefined()
  })

  it('builds pitch-location threshold rows seeded with the zone bounds', () => {
    const sheet = buildSessionFactSheet(session, { goalId: 'open', extraThresholds: goalExtraThresholds('open') })
    const row = sheet.thresholds.pitchHeight.find((r) => r.threshold === 1.5)
    // Heights 2.0, 2.5, 1.0, 2.2, 3.0: only 1.0 is below 1.5.
    expect(row.below).toEqual({ count: 1, swings: [3] })
  })
})
```

  Also update the existing `underFifteenCount` test (~line 127) and any other test reading power stats to pass `{ goalId: 'power' }`, and any assertion on `METRICS` to include `pitchHeight` and `pitchSide`.

- [ ] **Step 2: Run and verify failure.**

- [ ] **Step 3: Implement** in `scripts/factSheet.js`:

```js
import { topExitVelocity, pitchZoneBreakdown, STRIKE_ZONE } from '../src/sessionStats.js'
import { countSpecThresholds, goalCountValues } from '../src/goalCountSpecs.js'

export const METRICS = ['exitVelocity', 'launchAngle', 'direction', 'distance', 'pitchHeight', 'pitchSide']
```

```js
// The whole-session numbers the debrief prompt hands the coach directly,
// computed by the same functions the prompt itself renders from
// (goalCountValues, pitchZoneBreakdown), so a claim repeating one of these
// is checked against the identical number the coach actually saw. Which
// counts exist depends on the goal, exactly as it does in the prompt: the
// pre-8c version emitted Power's two counts for every goal, and grading a
// correct contact count against a Power stat is what produced Slice 8b's
// false positives.
function sessionStatsExtras(swings, goalId) {
  const top3 = [...swings]
    .map((sw) => sw.hit.launch.exitSpeed)
    .sort((a, b) => b - a)
    .slice(0, 3)
  const stats = { topExitVelocity: topExitVelocity(swings), top3ExitVelocities: top3 }
  for (const [key, v] of Object.entries(goalCountValues(goalId, swings))) {
    stats[`${key}Count`] = v.count
    stats[`${key}Swings`] = v.swings
  }
  const zone = pitchZoneBreakdown(swings)
  stats.outsideZoneCount = zone.outside.count
  stats.outsideZoneSwings = zone.outside.swings
  stats.highPitchCount = zone.high.count
  stats.highPitchSwings = zone.high.swings
  stats.lowPitchCount = zone.low.count
  stats.lowPitchSwings = zone.low.swings
  stats.widePitchCount = zone.wide.count
  stats.widePitchSwings = zone.wide.swings
  return stats
}
```

  Thread `goalId` through both builders (`buildSessionFactSheet(session, { extraThresholds = {}, goalId } = {})`, passing it to `sessionStatsExtras`; `buildFactSheet({ sessions, viewingSessionNumber, extraThresholds, goalId } = {})`). In `goalExtraThresholds`, drop the `[target, power]` loop in favor of the goal's own target only, and seed the two new metrics:

```js
export function goalExtraThresholds(goalId) {
  const target = goalTarget(goalId)
  const launchAngle = []
  const exitVelocity = []
  if (target?.launchAngle) launchAngle.push(target.launchAngle.min, target.launchAngle.max)
  if (Number.isFinite(target?.exitVelocity)) exitVelocity.push(target.exitVelocity)
  const merged = {
    launchAngle,
    exitVelocity,
    pitchHeight: [STRIKE_ZONE.heightMin, STRIKE_ZONE.heightMax],
    pitchSide: [STRIKE_ZONE.sideMin, STRIKE_ZONE.sideMax],
  }
  for (const [metric, values] of Object.entries(countSpecThresholds(goalId))) {
    merged[metric] = [...(merged[metric] ?? []), ...values]
  }
  return merged
}
```

  Update its header comment: the Power merge is gone because the prompt has been per-goal since Slice 8b and grading against leaked Power stats is what the 18 August correction documented. In `scripts/grade-coach-accuracy.mjs`, both `buildFactSheet` calls gain `goalId: resolved.goal.id`.

- [ ] **Step 4: Run and verify pass**, then `node scripts/grade-coach-accuracy.mjs --dry-run` (free) and confirm it completes.
- [ ] **Step 5: Commit.**

---

### Task 7: Handed versus derived, and the inclusive-phrasing fix

**Files:**
- Create: `scripts/handedCounts.js`, `scripts/handedCounts.test.js`
- Modify: `scripts/claimVerdict.js` (context threading, `handed` flag, sibling-bucket rule, range-guard rework, `STAT_UNIT_WORDS`)
- Test: `scripts/claimVerdict.test.js`

**Interfaces:**
- Produces: `export function handedClaimSpecs(goalId, era = 'current')` returning `{ thresholds: [{ metric, threshold, comparison }], ranges: [{ metric, min, max }], statNames: string[], zoneLines: boolean }`. Era `'slice8b'` describes the prompt Slice 8b shipped (contact fly-ball at 20, no zone lines); era `'current'` reads today's `GOAL_COUNT_SPECS` (fly-ball 18) and adds the zone lines' stats and pitch thresholds for every goal. `verdictForClaim(claim, factSheet, context)` now honors `context.handed` (one of these spec objects): every ruled claim gains `handed: true|false` when the context carries it, and is unchanged when it does not (existing callers and tests unaffected).

**Why era matters (do not simplify this away):** the before side of this slice's comparison grades debriefs generated by the Slice 8b prompt. Classifying those with today's handed set would call zone-derived claims "handed" when nothing handed them, and grade "above 20" claims against a fact sheet with no 20 row. That silent era mismatch is the same mechanism that produced 8b's false positives, hit from the other side.

- [ ] **Step 1: Write the failing tests.** `scripts/handedCounts.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { handedClaimSpecs } from './handedCounts.js'

describe('handedClaimSpecs', () => {
  it('describes what the current prompt hands a contact debrief', () => {
    const handed = handedClaimSpecs('contact', 'current')
    expect(handed.thresholds).toContainEqual({ metric: 'exitVelocity', threshold: 85, comparison: 'atLeast' })
    expect(handed.thresholds).toContainEqual({ metric: 'launchAngle', threshold: 18, comparison: 'above' })
    expect(handed.ranges).toContainEqual({ metric: 'launchAngle', min: 8, max: 18 })
    expect(handed.statNames).toContain('contactTargetBandCount')
    expect(handed.statNames).toContain('outsideZoneCount')
    expect(handed.zoneLines).toBe(true)
  })

  it('describes the slice8b prompt: fly-ball 20 and no zone lines', () => {
    const handed = handedClaimSpecs('contact', 'slice8b')
    expect(handed.thresholds).toContainEqual({ metric: 'launchAngle', threshold: 20, comparison: 'above' })
    expect(handed.thresholds).not.toContainEqual({ metric: 'launchAngle', threshold: 18, comparison: 'above' })
    expect(handed.statNames).not.toContain('outsideZoneCount')
    expect(handed.zoneLines).toBe(false)
  })

  it('hands open goals only the base stats, plus the zone lines in the current era', () => {
    const current = handedClaimSpecs('open', 'current')
    expect(current.thresholds.filter((t) => t.metric !== 'pitchHeight')).toEqual([])
    expect(current.statNames).toContain('avgExitVelocity')
    const old = handedClaimSpecs('open', 'slice8b')
    expect(old.thresholds).toEqual([])
  })
})
```

  In `scripts/claimVerdict.test.js`, add (driving the existing hand-built `FACT_SHEET`, extended only where a case needs a stat or row it lacks):

```js
import { handedClaimSpecs } from './handedCounts.js'
```

```js
describe('handed versus derived (Slice 8c)', () => {
  it('marks a FALSE claim handed when the prompt handed that count', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'launchAngle', threshold: 20, comparison: 'above', statedCount: 6 },
      FACT_SHEET,
      { goalId: 'contact', handed: handedClaimSpecs('contact', 'slice8b') },
    )
    expect(result.verdict).toBe('FALSE')
    expect(result.handed).toBe(true)
  })

  it('marks a claim at an unhanded threshold derived', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'distance', threshold: 305, comparison: 'atLeast', statedCount: 2 },
      FACT_SHEET,
      { goalId: 'contact', handed: handedClaimSpecs('contact', 'slice8b') },
    )
    expect(result.handed).toBe(false)
  })

  it('adds no handed key at all when the context carries no handed set', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'launchAngle', threshold: 20, comparison: 'above', statedCount: 6 },
      FACT_SHEET,
    )
    expect('handed' in result).toBe(false)
  })
})

describe('the inclusive-phrasing fix (Slice 8b false positive, allfields-s4/run7)', () => {
  // "only 3 swings cleared 82 mph": the coach was handed "82 mph or higher"
  // (atLeast), extraction read "cleared" as strictly above, and the strict
  // bucket disagreed with the handed inclusive one. When the handed line
  // used the sibling comparison and the sibling bucket matches the stated
  // count, the claim is TRUE.
  it('accepts the sibling bucket when it is the count the coach was handed', () => {
    // Requires a FACT_SHEET row where above and atLeast differ; extend the
    // fixture with such a row if it lacks one, keeping it hand-checkable.
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'exitVelocity', threshold: 82, comparison: 'above', statedCount: 3 },
      FACT_SHEET,
      { goalId: 'allfields', handed: handedClaimSpecs('allfields', 'slice8b') },
    )
    expect(result.verdict).toBe('TRUE')
    expect(result.reasoning).toContain('handed')
  })

  it('still rules FALSE when neither the claimed bucket nor the handed sibling matches', () => {
    const result = verdictForClaim(
      { kind: 'threshold', sessionNumber: 4, metric: 'exitVelocity', threshold: 82, comparison: 'above', statedCount: 9 },
      FACT_SHEET,
      { goalId: 'allfields', handed: handedClaimSpecs('allfields', 'slice8b') },
    )
    expect(result.verdict).toBe('FALSE')
  })
})

describe('range claims at a handed band (Slice 8b false positives, contact-s4)', () => {
  // "8 swings in the target window" on contact: the prompt hands contact an
  // launch-angle-only band count, so the old two-metric ambiguity guard does
  // not apply; the claim is concrete and rulable.
  it('rules on a goal-band range when the band count was handed', () => {
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 8, max: 18, statedCount: 2 },
      FACT_SHEET,
      { goalId: 'contact', handed: handedClaimSpecs('contact', 'slice8b') },
    )
    expect(result.verdict).not.toBe('UNVERIFIABLE')
  })

  it('keeps the two-metric guard for power, whose handed count is two-metric', () => {
    const result = verdictForClaim(
      { kind: 'range', sessionNumber: 4, metric: 'launchAngle', min: 25, max: 35, statedCount: 2 },
      FACT_SHEET,
      { goalId: 'power', handed: handedClaimSpecs('power', 'current') },
    )
    expect(result.verdict).toBe('UNVERIFIABLE')
  })
})
```

  Expected counts for any fixture rows you extend are hand-derived literals with the derivation in a comment, matching the file's convention.

- [ ] **Step 2: Run and verify failure.**

- [ ] **Step 3: Implement.**
  - `scripts/handedCounts.js`: build the spec objects from `GOAL_COUNT_SPECS` (import from `../src/goalCountSpecs.js`). Base `statNames` every era hands: `['avgExitVelocity', 'avgLaunchAngle', 'inZoneCount', 'totalSwings', 'topExitVelocity']`. Per goal add the `${key}Count` names for that goal's `goalCountValues` keys, and the matching threshold/range entries: power `{launchAngle, 15, below}` plus statName `powerZoneCount` (two-metric, so a stat rather than a threshold); contact `{exitVelocity, 85, atLeast}`, `{launchAngle, flyBall, above}` (era slice8b hardcodes 20 with a comment naming the 18 August 2026 change; era current reads `GOAL_COUNT_SPECS.contact.flyBallAngle`), range `{launchAngle, 8, 18}`; allfields `{direction, -15, below}`, `{direction, 15, above}`, `{exitVelocity, 82, atLeast}`; popup `{launchAngle, 35, above}`, `{launchAngle, 5, below}`, range `{launchAngle, 10, 25}`. Era current additionally hands every goal `zoneLines: true`, the four zone statNames, and thresholds `{pitchHeight, 3.5, above}`, `{pitchHeight, 1.5, below}` (wide has no single-sided threshold; its handed form is the `widePitchCount` stat). Also export `eraExtraThresholds(goalId, era)`: `goalExtraThresholds(goalId)` (import from `./factSheet.js`), with `launchAngle: [...existing, 20]` merged in when era is `slice8b` and the goal is contact, so "above 20" claims from the old prompt keep a row to be graded against.
  - `scripts/claimVerdict.js`:
    - Give every rule the signature `(claim, session, context)`.
    - In `verdictForClaim`, wrap the rule result: `const result = rule(claim, session, context); return context?.handed ? { ...result, handed: claimWasHanded(claim, context.handed) } : result`.
    - `claimWasHanded(claim, handed)`: `swingValue` true (the per-swing table is handed verbatim); `sessionStat` when `handed.statNames.includes(claim.statName)`; `threshold` when any handed threshold matches on metric and threshold value (comparison deliberately ignored: rephrasing a handed count is still the handed count); `range` on exact metric/min/max match; `subset` and anything else false.
    - Sibling rule in `thresholdVerdict`, replacing the plain FALSE on count mismatch:

```js
  if (bucket.count !== statedCount) {
    const SIBLING = { above: 'atLeast', atLeast: 'above', below: 'atMost', atMost: 'below' }
    const sib = SIBLING[comparison]
    const handedComparison = context?.handed?.thresholds
      ?.find((t) => t.metric === metric && t.threshold === threshold)?.comparison
    const sibBucket = sib ? row[sib] : null
    if (handedComparison === sib && Number.isFinite(sibBucket?.count) && sibBucket.count === statedCount) {
      return ruled('TRUE', describeRow(metric, sib, threshold, sibBucket),
        `the stated count matches the ${sib} bucket, which is the count the coach was handed; ` +
        `the phrasing is ambiguous between ${comparison} and ${sib}`)
    }
    return ruled('FALSE', actual, `claimed ${statedCount}, the row says ${bucket.count}`)
  }
```

    - In `rangeVerdict`, before the two-metric goal-window guard: `const handedRange = context?.handed?.ranges?.some((r) => r.metric === metric && r.min === min && r.max === max)`; when true, skip the guard (the prompt handed a one-metric band count at exactly this window, so the ambiguity the guard protects against does not exist). The guard itself stays for everything else.
    - Extend `STAT_UNIT_WORDS`: `contactTargetBandCount: /degree/i`, `contactHardHitCount: /mph/i`, `contactFlyBallCount: /degree/i`, `pullSideCount: /degree/i`, `oppoFieldCount: /degree/i`, `allfieldsHardContactCount: /mph/i`, `popUpCount: /degree/i`, `weakGrounderCount: /degree/i`, `popupTargetBandCount: /degree/i`, `outsideZoneCount: /feet|ft/i`, `highPitchCount: /feet|ft/i`, `lowPitchCount: /feet|ft/i`, `widePitchCount: /feet|ft/i`.

- [ ] **Step 4: Run and verify pass.**
- [ ] **Step 5: Commit.**

---

### Task 8: Wire the grader: `--handed-era`, the era thresholds, and the split report

**Files:**
- Modify: `scripts/grade-coach-accuracy.mjs` (parseArgs, both grading paths, `GRADER_SYSTEM`, `printReport`, header docs)

**Interfaces:**
- Consumes: `handedClaimSpecs`, `eraExtraThresholds` from `./handedCounts.js`.
- Produces: `--handed-era slice8b|current` (default `current`; anything else throws). Both `validate` and `dryRun` build `extraThresholds` via `eraExtraThresholds(goalId, era)` instead of `goalExtraThresholds(goalId)`, and pass `{ goalId, handed: handedClaimSpecs(goalId, era) }` as the grading context (`gradeDebrief` gains a `handed` option it forwards). The report separates the two kinds of wrong claim.

- [ ] **Step 1: Implement** (script file, deliberately outside the runner; its checks are the dry run below plus the unit-tested modules it calls):
  - `parseArgs`: add `handedEra: 'current'` default; accept `--handed-era`; validate the value.
  - Both grading paths: `const handed = handedClaimSpecs(resolved.goal.id, args.handedEra)` cached per cell beside the fact sheet; `extraThresholds: eraExtraThresholds(resolved.goal.id, args.handedEra)`; `gradeParsedResponse(text, factSheet, { goalId: goal?.id, handed })`.
  - `GRADER_SYSTEM`, three additions, none touching the coach's own prompts: (1) the `statName` enumeration grows the thirteen new names from Task 6; (2) after the pitchHeight/pitchSide rule: `The strike zone is about pitch LOCATION (pitchHeight, pitchSide). A goal's "target window", "target zone" or "target band" is about LAUNCH ANGLE. Never label a launch-angle window count as inZoneCount or outsideZoneCount, and never label a pitch-location count with a launch-angle stat. A count of pop-ups is popUpCount, never underFifteenCount.`; (3) the comparison mapping gains `- "cleared", "topped" -> "atLeast"`.
  - `printReport`: after the `Claims found` line, when any claim carries a `handed` key:

```js
  const falseClaims = ok.flatMap((r) => r.claims).filter((c) => c.verdict === 'FALSE')
  const classified = falseClaims.filter((c) => typeof c.handed === 'boolean')
  if (classified.length || falseClaims.length === 0) {
    const handedFalse = classified.filter((c) => c.handed).length
    const derivedFalse = classified.filter((c) => !c.handed).length
    const handedRecords = ok.filter((r) => r.claims.some((c) => c.verdict === 'FALSE' && c.handed === true)).length
    console.log(`FALSE breakdown  ${handedFalse} contradicting a number the prompt handed the coach, ${derivedFalse} self-derived`)
    console.log(`                 debriefs contradicting a handed number: ${handedRecords} of ${ok.length}`)
  }
```

    and tag each printed FALSE claim line with ` (handed)` or ` (self-derived)` when the key is present.
  - Header comment: document `--handed-era` and when to pass `slice8b` (grading records generated by the Slice 8b prompt).

- [ ] **Step 2: Verify with the free dry run.** `node scripts/grade-coach-accuracy.mjs --dry-run` completes; then `node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --dry-run` completes (proves the bench still imports the changed prompt cleanly). Both are free.
- [ ] **Step 3: Run `npm test`** (461-plus tests green; the script's tested modules all pass).
- [ ] **Step 4: Commit.**

---

### Task 9: Live before side: re-grade Slice 8b's after round with the fixed tool (~$0.30)

**Files:**
- Create: `docs/eval-fixtures/slice8c-strike-zone-counts/before-grading.txt`, `.../before-grading.json`

**Steps:**

- [ ] **Step 1:** `mkdir -p docs/eval-fixtures/slice8c-strike-zone-counts` then run:

```
node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice8b-threshold-counts/after --builder current \
  --handed-era slice8b --seed 20260814 \
  --out docs/eval-fixtures/slice8c-strike-zone-counts/before-grading.json \
  | tee docs/eval-fixtures/slice8c-strike-zone-counts/before-grading.txt
```

  (52 records, under the 100-call cap; the input directory holds exactly one JSON file, `shipped-52.json`, verified.)

- [ ] **Step 2: Acceptance, checked by hand against `docs/eval-fixtures/slice8b-threshold-counts/README.md`'s five named false positives** (contact-s4/run1, contact-s4/run3, allfields-s4/run6, allfields-s4/run7, popup-s4/run6): none of the five should still be flagged for the false-positive claim the README names (popup-s4/run1 keeps its genuine error and stays flagged). If any of the five survives, that is a finding to diagnose before Task 10, not to explain away: extraction is stochastic, so first check whether the surviving flag is the same claim or a new one.
- [ ] **Step 3:** Record the run's printed cost in the running spend ledger (a `SPEND.md` scratch note is fine; the final numbers go in the fixture README and decision log). Confirm total slice spend is on track against the ~$1.55 expectation.
- [ ] **Step 4: Commit** the two output files.

---

### Task 10: Live after side: fresh bench round on the changed prompt, graded (~$1.21)

**Files:**
- Create: `docs/eval-fixtures/slice8c-strike-zone-counts/after/shipped-52.json`, `.../after-grading.txt`, `.../after-grading.json`, `.../README.md`

**Steps:**

- [ ] **Step 1:** Bench round (52 calls, roughly $0.91; the bench imports the real prompt, so Tasks 3-5's changes are what it measures):

```
node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition shipped --runs 8 \
  --seed 20260814 --out docs/eval-fixtures/slice8c-strike-zone-counts/after/shipped-52.json
```

- [ ] **Step 2:** Grade it (roughly $0.30):

```
node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice8c-strike-zone-counts/after --builder current \
  --handed-era current --seed 20260814 \
  --out docs/eval-fixtures/slice8c-strike-zone-counts/after-grading.json \
  | tee docs/eval-fixtures/slice8c-strike-zone-counts/after-grading.txt
```

- [ ] **Step 3: Hand-check every after-round flagged debrief** against its own record's fields before believing any number: the standing rule is that a single flagged claim is not proof of a coach error without a by-hand check. Note each flag as genuine, false positive, or unclear, in the README.
- [ ] **Step 4: Write the comparison README** (`docs/eval-fixtures/slice8c-strike-zone-counts/README.md`), following the 8b fixture README's shape: what each directory holds, the before/after numbers (flagged debriefs, FALSE claims, the pitch-location error class specifically, and the new handed-versus-derived split from both rounds), what is and is not safe to conclude (extraction is stochastic; the grader's false-positive rate is still unmeasured; success is a sharply lower pitch-location miscount rate, not zero), and every dollar spent. The piece-5 number gets its own section: how often the coach contradicted a handed count, pooled across both rounds, stated against the decision rule recorded in `docs/queued-slices.md` (roughly one in fifty means build the fill-in-the-numbers approach; closer to one in several hundred means leave it alone and keep measuring).
- [ ] **Step 5: Commit.**

---

### Task 11: Browser pass, docs, and the pull request

- [ ] **Step 1: Browser verification.** Start the dev server (`.claude/launch.json`), load the app, run a session-1 Power debrief live. Verify in the network panel that the outgoing request body carries the four zone lines and the corrected grammar (local dev talks straight to Anthropic, so the payload is inspectable), and read the coach's zone statements against the pitch-location chart. Screenshot the debrief. This spends a few cents of live API. The real-phone rule stays unmet (dev server binds to localhost only; standing recorded limitation, declared again in the PR).
- [ ] **Step 2: Docs.** Append the Slice 8c entry to `docs/product-decisions-log.md` (400-600 words: what was decided, the before/after numbers, the piece-5 number and what it means for the parked fill-in-the-numbers decision, spend against budget). Update `CLAUDE.md`: test counts and file counts, the What's Next items this slice closes (strike-zone counting, fly-ball 18, "1 swings", the fact-sheet leak) and what it adds, the factSheet/grader section notes, the line-count table. Annotate the Slice 8c heading in `docs/queued-slices.md` as shipped, dated, append-only.
- [ ] **Step 3: Pre-deploy checklist.** No new environment variables, no migrations: confirm nothing to append, and say so in the PR.
- [ ] **Step 4: PR.** Follow `~/.claude/checklists/pr-handoff.md`. Body near 300 words: what changed; verification (test counts before 461 and after, dry runs, the live rounds' numbers, what was not verifiable); what review found; pointer to the decision log. Request the independent read-only review before calling it ready; QA script goes in the chat message, not the PR body.

---

## Self-review notes (spec coverage)

- Piece 1 (fly-ball 18): Task 4. Piece 2 (zone counts): Tasks 1, 5. Piece 3 (grammar): Tasks 2, 3 (plus the declared distance-line widening). Piece 4 (fact sheet first, then measure): Tasks 6, 7, 8 land before Tasks 9, 10; the five 8b false positives are Task 9's acceptance check. Piece 5 (handed versus derived): Tasks 7, 8 build it; Tasks 9, 10 report it; the decision rule it feeds is restated in Task 10's README step.
- Order constraint from the scope doc (tool fixed before measurement, never during) is enforced by task order.
- Spend: ~$0.30 + ~$0.91 + ~$0.30 + browser cents = ~$1.55 expected, $3 ceiling, $5 hard flag.
