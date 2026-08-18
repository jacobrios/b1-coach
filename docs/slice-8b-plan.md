# Slice 8b: count every threshold the prompt names

Written 18 August 2026, on branch `slice-8b-coach-counts`. Scope agreed in
`docs/queued-slices.md` under the same heading; this document is the build
plan. Test-suite baseline at slice start: **429 tests across 17 files, all
passing**, matching Slice 8's recorded finish exactly, so there are no
pre-existing failures to carry.

---

## Front section, for the product manager

**Settled, do not relitigate.** The coach repeats counts it is handed and
miscounts anything it derives itself; that is the one rule behind the fixture's
errors. The fix: every threshold a goal's prompt names in prose gets pre-counted
in the data block, per the goal table in `docs/queued-slices.md`. The two prompt
sentences were approved verbatim on 18 August 2026 (quoted in Task 6 below).
Budget: **$6 ceiling**, expected spend about $2.60; measurement scored as
accuracy per attempt at a named threshold, not a global error rate.

**Not in this slice.** The coach never seeing its own tips (a chat-context
slice); the two model fields that can blank the screen (belongs beside Slice
5's failure vocabulary); the three disagreeing hard-contact numbers (its own
queued item); the 50-word tip budget (its own open question).

**How it is verified.** Deterministic count code lands test-first and is seen
failing. The bench gains `allfields-s4` and `popup-s4` cells, then a baseline
round runs against the unchanged prompt, the fix lands, and an after round runs;
both rounds are graded by the Slice 8 validated grader. If the approved wording
does not hold, that comes back as a question, not a silent retune.

**Debt this slice expects to open.** The two new bench cells hand-copy their
goal labels (existing, known cost of the bench's no-JSX limit, now at six
copies). The grader gains an input-directory flag, one more hand-run surface to
keep honest.

---

## Sequencing constraint the whole plan hangs on

The bench imports the real prompt from `src/coachApi.js`. **The baseline round
(Task 5) must run after the instrument tasks (1 to 4) and before the fix tasks
(6 and 7).** A baseline run after the prompt changes would measure the fix
against itself and the comparison would be worthless. Tasks 3 and 4 touch
`src/coachApi.js` before the baseline, which is safe only because Task 3's
refactor is asserted byte-identical: the prompt the baseline measures is
unchanged. Task order below is the required order.

## Task 1: two new bench cells

`scripts/bench-coach-brevity.mjs`, `CELLS` array. Add:

- `{ key: 'allfields-s4', goal: { id: 'allfields', label: 'Hit to All Fields' }, session: 4, weight: 1, why: 'never measured by anything; judged on spray direction, which no other cell exercises' }`
- `{ key: 'popup-s4', goal: { id: 'popup', label: 'Reduce Pop-Ups' }, session: 4, weight: 1, why: 'never measured by anything; the only goal judged on launch angle alone, with no exit velocity ask' }`

Labels must match `GOALS` in `src/App.jsx` character for character; the bench's
own comment explains why they are hand-copied and must be extended to say the
count is now six. Session 4 for both: largest sessions, three priors, and the
two goals nothing has ever measured. At `--runs 8` a full condition becomes
12+8+8+8+8+8 = 52 calls. Verify allocation with `--dry-run` before any live
call. Check the bench's cost guard still passes at 52 calls, and update its
comment if it names 36.

## Task 2: grader reads a directory of fresh records

`scripts/grade-coach-accuracy.mjs` is pinned to
`docs/eval-fixtures/slice7-debriefs`. Add an `--input <dir>` flag that grades a
directory of bench output records instead. **Do not touch `verdictForClaim` or
the claim-extraction prompt**: the grader's judgment passed its validation gate
in Slice 8 and this slice must not reopen it. The flag is plumbing. The
`--validate` path stays exactly as it is, per the methodological note at the
top of that file. Dry-run mode must show the planned call count for the new
input before spending.

## Task 3: one table of the thresholds each goal's prose names

`src/coachApi.js`. Build one exported table (working name `GOAL_COUNT_SPECS`)
mapping goal id to the thresholds its prose names. Numbers that exist in
`src/goalTargets.js` are read from there; numbers that today live only inside
`goalContext` prose strings (direction ±15, EV 82, above 35, below 5, above 20)
move into this table and the prose interpolates them from it, so a sentence and
the count that will feed it cannot drift. **The rendered `goalContext` strings
must come out byte-identical after the refactor**; write that assertion first,
against the shipped strings, and keep it green throughout. This task changes no
prompt output at all; it exists so Tasks 4 and 6 read one source.

## Task 4: fact-sheet rows for the new thresholds

`scripts/factSheet.js` builds the deterministic count table the grader checks
claims against. It must gain rows for every threshold in `GOAL_COUNT_SPECS`, or
the grader cannot rule on claims at them: contact's above-20-degrees line,
allfields' direction cutoffs (below -15, above +15) and its 82+ mph line,
popup's above-35 and below-5 lines. Direction is a new axis for the fact sheet;
follow the existing row shape. Import the thresholds from the Task 3 table
rather than re-typing them, so the grader and the prompt cannot disagree about
what was counted. `goalExtraThresholds` currently merges Power's targets into
every goal because the shipped prompt shows Power's zone to everyone; leave
that in place for grading the baseline round, and revisit it in Task 7 once
the prompt no longer does that. Test-first in `scripts/factSheet.test.js`, red
before green, per row.

## Task 5: baseline round

Run before Tasks 6 and 7 land, against the byte-identical shipped prompt:
`node --env-file=.env.local scripts/bench-coach-brevity.mjs --condition
shipped --runs 8`, 52 calls, about $0.95. Grade the output with the grader via
`--input`, about $0.35. Record spend in the ledger (Task 8). Keep the raw
records.

## Task 6: per-goal count lines and the approved sentences

`src/coachApi.js`, two halves landing together.

**Count lines.** Replace the two hard-coded lines (`below 15 degrees`,
`power zone`) in `buildDebriefUserMessage` with count lines derived from the
selected goal's `GOAL_COUNT_SPECS` entry:

| Goal | Count lines |
|---|---|
| power | LA 25-35 and EV 88+ together (the existing power-zone line, correct today), LA below 15 with swing numbers (existing line, stays) |
| contact | LA 8-18, EV 85+, LA above 20 |
| allfields | direction below -15, direction above +15, EV 82+ |
| popup | LA above 35, LA below 5, LA 10-25 |
| open | none |

Keep the existing line format: threshold in words, count, and swing numbers
where the current below-15 line prints them. Test-first in
`src/coachApi.test.js`: one test per goal asserting the exact count lines from
a small fixture of hand-checkable swings, each seen red against the shipped
code first. The below-15 line was Power's, so it appears only where a goal's
prose names it.

**The approved sentences, verbatim.** Two changes to `DEBRIEF_SYSTEM_BASE`,
approved by the product manager 18 August 2026, to land exactly as quoted:

- The tips instruction's worked example "You only hit to the opposite field on
  swings 9, 12, and 14, and two of those were your weakest swings at 83 and 86
  mph." becomes: **"You only hit to the opposite field on swings 9, 12, and
  14, and swing 12 left the bat at just 83 mph."**
- New rule added to the Rules list: **"Never count, total, or tally swings
  yourself. Use a count only if it appears in the session data. If no count is
  provided, describe the pattern without a number."**

No other prompt prose changes. This is explicitly not licence to touch the
length budget. Pin both new strings with tests (the suite already pins prompt
structure; extend the same pattern), red first.

## Task 7: after round and the comparison

1. Same bench run and grading as Task 5, on the fixed prompt.
2. Re-derive the fact sheet's Power-merging behavior (see Task 4) to match
   what the new prompt actually hands each goal, so after-round grading
   checks the counts the coach was actually given.
3. Score both rounds as accuracy per attempt at a named threshold, split by
   goal. Success is the after round holding or improving accuracy at every
   named threshold, with the two never-measured goals now measured at all.
   Also watch the brevity metrics the bench already reports: the new rule
   sentence must not crater citation density (the bench's grounded-count
   hedges apply as documented in CLAUDE.md).
4. Commit both rounds' raw records under
   `docs/eval-fixtures/slice8b-threshold-counts/` with a README saying what
   may and may not be concluded, matching the three existing fixture READMEs.
5. If results demand a wording change, that is a product question; the
   approved sentences are not to be iterated on without sign-off.

## Task 8: spend ledger

Log every live run's cost as it happens, in this document as dated appendix
lines. Hard stop and report to the product manager before any spend past $6.

## Task 9: paperwork

Decision-log entry (400 to 600 words, product language) in
`docs/product-decisions-log.md`. CLAUDE.md updates: current-state line counts
if files moved materially, verification-norms test count, What's Next (this
slice's items off; anything surfaced on). `docs/queued-slices.md`: annotate
the Slice 8b heading as shipped. No pre-deploy obligations expected (no new
environment variables, no migrations); if one appears, it goes on the
checklist in the same PR.

## Task 10: review and PR

Independent read-only review per the standing rule, then the PR with the
300-word body (changes, verification with before/after test counts, review
findings, decision-record pointer), and the five-minute QA script in the chat
message per `~/.claude/checklists/pr-handoff.md`. The PR includes the fixture
directory and both bench rounds so the claimed numbers are checkable.
