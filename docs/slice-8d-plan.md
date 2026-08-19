# Slice 8d Implementation Plan: the grader stops crying wolf, and gets its false-positive rate measured

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the grading tool's recurring complement-bug false positives (a true "none of them cleared X" sentence graded false), make grading runs self-describing and replayable offline, and then measure the tool's false-positive rate formally, so every future coach measurement reads through a trustworthy instrument.

**Architecture:** A deterministic negated-exceedance guard in `claimVerdict.js`, validated offline against the 8 committed instances by a new replay script that re-runs stored claims through the verdict layer at zero cost; the grader script becomes importable (guarded main, exported cell machinery) and stamps its runs with metadata; one live re-grade of both committed rounds produces the formal rate.

**Tech Stack:** Plain ESM JavaScript, vitest 4, hand-run Node scripts outside the runner.

## Front section (for the product manager, ~200 words)

**Settled, do not relitigate:** scope agreed 19 Aug 2026 in conversation (the recommended next slice, accepted); budget: up to $5 without asking, granted the same day; expected spend ~$0.60 (one live re-grade of both committed 52-debrief rounds). The slice starts from the Slice 8c branch tip rather than main, a declared deviation: PR #28 is approved but the merge click is blocked by a harness permission until the product manager returns.

**Not in this slice:** the fill-in-the-numbers product decision (open, his call); fixing the other two false-positive mechanisms (wrong-basis and value-vs-threshold are extraction behavior; this slice's prompt guidance may help but only the complement bug gets a deterministic fix); any coach-prompt change; Slice 6b surface polish.

**Verification:** the guard is proven against the 8 committed false-positive claims, seen failing first, plus pinned negative cases the exploration identified (a genuinely-false "none above 75" claim that must stay FALSE, and a "none dipped under X" phrasing the guard must not touch); the replay script must show exactly 8 verdicts flip and nothing else move across both committed rounds; then one live re-grade with hand-check of every flag gives the formal rate. Baseline: **489 tests, 21 files, green** at the 8c tip.

**Expected debt:** the formal false-positive rate is still a two-round measurement against particular prompts, not a universal property; extraction-layer mechanisms remain unfixed and are only measured; the grader's output-shape change (metadata wrapper) makes the 8c fixtures the old shape, handled by the replay script reading both.

**At slice close (recorded here so it survives):** the product manager skipped Slice 8c's QA for time; the close-of-slice chat message must carry a combined QA script covering PR #28's checks and this slice's, plus the PR link(s).

## Global Constraints

- Branch: `slice-8d-grader-false-positives` (cut from the 8c tip, `ee73b3d`). One commit per task. Never push to main; the slice ends at an open PR (base = `slice-8c-strike-zone-counts` if PR #28 is still unmerged at close, retargeted to main after it merges).
- Spend: ~$0.60 expected, $5 no-ask ceiling (granted 19 Aug 2026). Live calls only in Task 5.
- Full `.js` extensions on relative imports in `scripts/` and everything they reach.
- Test expectations are hand-derived literals; new behavior seen failing first.
- No em/en dashes in anything newly written (prose, comments, commit messages); quoted coach text and shipped prompt bytes keep theirs.
- The committed fixtures under `docs/eval-fixtures/slice8b-threshold-counts/` and `docs/eval-fixtures/slice8c-strike-zone-counts/` are ground truth: never modified, only read.
- The coach's prompts in `src/coachApi.js` are untouched this slice. The grader's own extraction prompt (`GRADER_SYSTEM`) may change exactly as Task 3 specifies.

---

### Task 1: Make the grader importable and its runs self-describing

**Files:**
- Modify: `scripts/grade-coach-accuracy.mjs`

**Interfaces:**
- Produces: `export { CURRENT_CELLS, resolveSessions }` (shapes unchanged: `CURRENT_CELLS` is the six-entry cell-to-goal table at ~line 197; `resolveSessions({ builder, cellKey, seed })` returns `{ sessions, goal, viewingSessionNumber }`). The module becomes importable without side effects: the trailing `await main()` (~line 1227) runs only when the file is executed directly. `--out` writes `{ meta, results }` instead of a bare array, where `meta = { generatedAt, model, source, builder, seed, handedEra }` (`generatedAt` from `new Date().toISOString()`).

- [ ] **Step 1:** Guard the entrypoint:

```js
import { pathToFileURL } from 'node:url'
// ... at the bottom, replacing the bare `await main()`:
// Run only when executed directly, so the replay script (Task 4) can import
// the cell table and session builders without triggering a CLI run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
```

- [ ] **Step 2:** Add the two exports (`export` keywords on the existing declarations, no logic change).
- [ ] **Step 3:** Wrap the output (the `args.out` block, ~line 1156):

```js
  if (args.out) {
    // A committed grading run must prove from its own contents which flags
    // produced it. Slice 8c's fixtures could not (recorded on What's Next,
    // 19 August 2026); from this change on, the file says so itself.
    const meta = {
      generatedAt: new Date().toISOString(),
      model: args.model,
      source,
      builder,
      seed: args.seed,
      handedEra: args.handedEra,
    }
    writeFileSync(args.out, JSON.stringify({ meta, results }, null, 2))
```

  Update the script's header docs: `--out` now writes `{ meta, results }`; files written before 19 August 2026 are bare arrays.
- [ ] **Step 4:** Verify, all free: `npm test` (489 green); `node scripts/grade-coach-accuracy.mjs --dry-run` completes; `node -e "import('./scripts/grade-coach-accuracy.mjs').then(m => console.log(Object.keys(m)))"` prints the two exports and does NOT print the CLI usage error or exit nonzero.
- [ ] **Step 5:** Commit.

---

### Task 2: The negated-exceedance guard, proven against the committed instances

**Files:**
- Modify: `scripts/claimVerdict.js` (`thresholdVerdict`, `subsetVerdict`)
- Test: `scripts/claimVerdict.test.js`

**The bug, precisely:** the extractor turns a negated exceedance sentence ("nothing got out past 265 feet", "none of them broke 80 mph") into `comparison: below|atMost` with `statedCount: 0`, flipping the comparison to the complement while keeping the literal zero. The claim's real meaning is "the count ABOVE the threshold is zero." The verdict layer then compares 0 against the below/atMost bucket (often the whole session) and rules FALSE on a true sentence. 6 threshold instances and 2 subset instances are committed across the two Slice 8c rounds.

**The guard:** in both rules, when `statedCount === 0`, `comparison` is `below` or `atMost`, and the quote matches a negated-exceedance pattern, re-rule the claim as `above` with statedCount 0, with reasoning that names the correction. The pattern requires BOTH a negation word and an exceedance verb:

```js
// "Nothing got out past 265 feet" reaches this layer as (below|atMost, 0):
// the extractor flips a negated exceedance to the complement comparison but
// keeps the literal zero, and comparing 0 against the below-bucket then
// fails a true sentence. Both words must appear: the negation and the
// exceedance verb. "None of them dipped under 80" has a negation but no
// exceedance verb and must NOT reroute, because there the below-comparison
// is what the coach actually meant. Recurred 8 times across the two Slice
// 8c rounds; see docs/eval-fixtures/slice8c-strike-zone-counts/README.md.
const NEGATED_EXCEEDANCE =
  /\b(?:none|nothing|not one|no ball|never)\b[\s\S]{0,60}?\b(?:above|over|past|beyond|exceed\w*|clear\w*|broke|break\w*|crack\w*|topp\w*)\b/i

function negatedExceedanceReroute(claim) {
  return (
    claim.statedCount === 0 &&
    (claim.comparison === 'below' || claim.comparison === 'atMost') &&
    typeof claim.quote === 'string' &&
    NEGATED_EXCEEDANCE.test(claim.quote)
  )
}
```

  In `thresholdVerdict`, before the count comparison: if `negatedExceedanceReroute(claim)`, look up `row.above`; rule TRUE when `row.above.count === 0`, else FALSE with `actual` from `describeRow(metric, 'above', threshold, row.above)` and reasoning like `the quote negates exceedance, so the claim means "0 above ${threshold}"; the above count is ${row.above.count}` (extraction mislabeled the comparison; the reroute names it). In `subsetVerdict`: same trigger; intersect `ofSwings` with `row.above.swings`; TRUE when the intersection is empty, else FALSE listing the offending swings.

- [ ] **Step 1: Write the failing tests.** New describe in `scripts/claimVerdict.test.js`, fixtures extended minimally and hand-checkable. The committed instances become test literals (quote, kind, metric, threshold, comparison, statedCount copied verbatim from the fixtures; the FACT_SHEET rows extended to reproduce each truth):
  - Threshold face, from `open-s4` ("nothing got out past 265 feet", distance 265, stored as both `atMost` and `below` across runs; truth above-265 count 0, atMost count 15): both stored comparisons must now rule TRUE. Two tests, one per stored comparison.
  - The wording variant "nothing left the bat past 265 feet" also TRUE (pattern robustness).
  - Subset face, from `power-s1/run12`: `{ kind: 'subset', quote: 'none of them broke 80 mph', metric: 'exitVelocity', threshold: 80, comparison: 'below', statedCount: 0, ofSwings: [2, 9, 12] }` with fixture rows making all three below 80: TRUE. And its pair `'none of them got above 14 degrees'` at launchAngle 14 with swing 9 exactly 14 (above-list excludes it): TRUE.
  - **Negative case 1, the genuinely false complement** (from before-round `popup-s4/run3`): `{ kind: 'subset', quote: 'none of them got above 75 mph', comparison: 'above', statedCount: 0, ofSwings: [...] }` where one named swing IS above 75: stays FALSE (comparison is already `above`; the guard only reroutes below/atMost).
  - **Negative case 2, negation without exceedance:** `{ quote: 'none of them dipped under 80 mph', comparison: 'below', statedCount: 0 }` where the below count is nonzero: stays FALSE ruled on the below bucket itself, guard not triggered (assert the reasoning does NOT mention rerouting).
  - **Negative case 3, nonzero stated count:** `'none of them broke 80 mph or 15 degrees'` shape with `statedCount: 4` (before `power-s1/run6`): untouched by the guard (statedCount is not 0).
  - Derivation comments on every fixture row, per the file's convention.
- [ ] **Step 2:** Run, SEE the positive-case tests fail (they currently rule FALSE).
- [ ] **Step 3:** Implement the guard in both rules.
- [ ] **Step 4:** `npm test` fully green, including every pre-existing claimVerdict test unmodified.
- [ ] **Step 5:** Commit.

---

### Task 3: Extraction-prompt guidance for negated exceedance

**Files:**
- Modify: `scripts/grade-coach-accuracy.mjs` (`GRADER_SYSTEM` only)

- [ ] **Step 1:** Two additions, verbatim: (a) to the comparison-mapping block, after the "cleared", "topped" line:

```
- "got past", "got out past", "went past", "beyond" -> "above"
```

  (b) after the comparison-mapping block, a new rule:

```
NEGATED EXCEEDANCE. "None of them broke 80 mph", "nothing got out past 265 feet", "no ball cleared 300" are claims that the count ABOVE the threshold is ZERO: comparison "above", statedCount 0. Never map a negated exceedance onto "below" or "atMost", and never use the size of the named group as statedCount. The same applies inside subset claims: "none of swings 2, 9 and 12 broke 80" is comparison "above", statedCount 0, ofSwings [2, 9, 12].
```

- [ ] **Step 2:** Free verification: `node scripts/grade-coach-accuracy.mjs --dry-run` completes; `npm test` green. (Whether the model obeys is measured in Task 5; the Task 2 guard stands behind it either way, which is the belt-and-suspenders this instrument warrants.)
- [ ] **Step 3:** Commit.

---

### Task 4: The replay script, and the offline proof that only the 8 flip

**Files:**
- Create: `scripts/replay-grading.mjs` (hand-run, outside the runner), `scripts/gradingOutput.js`, `scripts/gradingOutput.test.js`
- Create: `docs/eval-fixtures/slice8d-grader-fp/replay-8c-rounds.txt` (the run's output, committed)

**Interfaces:**
- `scripts/gradingOutput.js`: `export function readGradingOutput(json)` taking a parsed JSON value and returning `{ meta: object|null, results: array }`, accepting both the pre-8d bare-array shape and the new `{ meta, results }` wrapper; throws a plain-language error on anything else. Unit tested (bare array in, wrapper in, garbage in).
- `scripts/replay-grading.mjs`: `node scripts/replay-grading.mjs --input <grading.json> --handed-era slice8b|current [--seed 20260814]`. No network, no spend, no API key. Reads the stored results via `readGradingOutput` (era/seed from the file's meta when present, flags required when absent, flags win on conflict with a printed warning); rebuilds each cell's fact sheet exactly the way the grader does (import `CURRENT_CELLS` and `resolveSessions` from `./grade-coach-accuracy.mjs`, `buildFactSheet`/`eraExtraThresholds`/`handedClaimSpecs` from the tested modules); re-runs `verdictForClaim` on every stored claim; prints per-round totals before and after, and one line per claim whose verdict changed: record id, field, quote, old verdict, new verdict, new reasoning. Ends with a `VERDICT CHANGES: <n>` line.

- [ ] **Step 1:** TDD `gradingOutput.js` (tests first, red, green).
- [ ] **Step 2:** Write the replay script. Keep it thin: all judgment lives in already-tested modules.
- [ ] **Step 3: The acceptance run, free:** replay both committed rounds:

```
node scripts/replay-grading.mjs --input docs/eval-fixtures/slice8c-strike-zone-counts/before-grading.json --handed-era slice8b | tee -a docs/eval-fixtures/slice8d-grader-fp/replay-8c-rounds.txt
node scripts/replay-grading.mjs --input docs/eval-fixtures/slice8c-strike-zone-counts/after-grading.json --handed-era current | tee -a docs/eval-fixtures/slice8d-grader-fp/replay-8c-rounds.txt
```

  Acceptance, checked by hand against the 8 known instances (before: `open-s4/run2` whatThisMeans; after: `open-s4` runs 1, 2, 3, 5, 6 and `power-s1/run12` twice): exactly those 8 claims flip FALSE to TRUE, zero other verdicts change in either direction, and the flagged-debrief counts drop accordingly (before 15 to 14; after 21 to 16, since `open-s4` runs 1, 3, 5, 6 and `power-s1/run12` carried only complement-bug FALSE claims; verify against the transcripts rather than trusting these arithmetic notes). Any other movement is a finding to diagnose, not to accept.
- [ ] **Step 4:** `mkdir -p` the fixture dir before the tee (the bench's $0.96 lesson); commit script, module, tests, and the replay transcript.

---

### Task 5: The live measurement (~$0.60): formal false-positive rate

**Files:**
- Create: `docs/eval-fixtures/slice8d-grader-fp/regrade-8b-after.{txt,json}`, `regrade-8c-after.{txt,json}`, `README.md`

- [ ] **Step 1:** Re-grade both committed record sets with the fully fixed tool, each command once, stop on partial failure:

```
node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice8b-threshold-counts/after --builder current \
  --handed-era slice8b --seed 20260814 \
  --out docs/eval-fixtures/slice8d-grader-fp/regrade-8b-after.json \
  | tee docs/eval-fixtures/slice8d-grader-fp/regrade-8b-after.txt
```

```
node --env-file=.env.local scripts/grade-coach-accuracy.mjs --validate \
  --input docs/eval-fixtures/slice8c-strike-zone-counts/after --builder current \
  --handed-era current --seed 20260814 \
  --out docs/eval-fixtures/slice8d-grader-fp/regrade-8c-after.json \
  | tee docs/eval-fixtures/slice8d-grader-fp/regrade-8c-after.txt
```

- [ ] **Step 2: Hand-check every flagged debrief in both runs** against the record's own fields: genuine, false positive (naming the mechanism), or unclear. This yields the formal number: false positives as a share of flags, per round, with fresh extraction through the improved prompt and the guard behind it.
- [ ] **Step 3:** Write `docs/eval-fixtures/slice8d-grader-fp/README.md`: what each file holds and its exact command; the replay proof (Task 4) and its 8-and-only-8 result; the new FP rates against Slice 8c's hand-counted 2 of 15 and 10 of 21; the corrected coach-error comparison for 8c restated with the fixed tool (the 13-to-11 figure revisited); what is not safe to conclude (two rounds, particular prompts, extraction still stochastic, wrong-basis and value-vs-threshold mechanisms only measured, not fixed); every dollar spent. Record spend in the running ledger.
- [ ] **Step 4:** Commit.

---

### Task 6: Docs and the close

- [ ] **Step 1:** Append the Slice 8d entry to `docs/product-decisions-log.md` (400-600 words, product language): what the slice was, the replay proof, the formal FP rates, what this changes about how much to trust past and future flag counts, spend, and the deviation note (branch cut from the 8c tip because the merge click was blocked; PR #28 approved but unmerged at the time).
- [ ] **Step 2:** Update `CLAUDE.md` append-only: test counts; the What's Next complement-bug sentences annotated fixed with the measured result; the FP-rate item annotated measured (not closed if judgment says the number should keep being watched); the era/seed metadata item closed (grader output now self-describing, old fixtures bare arrays, replay reads both); scripts table rows for the new files; the grader section notes (importable module, metadata wrapper).
- [ ] **Step 3:** Annotate `docs/queued-slices.md` if it carries anything this slice settles.
- [ ] **Step 4:** Pre-deploy checklist: nothing (no env, no migrations); say so in the PR.
- [ ] **Step 5:** PR per `~/.claude/checklists/pr-handoff.md`: base `slice-8c-strike-zone-counts` if PR #28 is still open, with a body line saying it stacks on #28 and will retarget to main after that merge; ~300 words, verification numbers, review findings, decision-record pointer. The chat message carries the COMBINED QA script for PR #28 and this slice (recorded obligation, front section above).

---

## Self-review notes

- The guard's three negative cases come straight from the exploration's warnings: the genuinely false `above/0` claim, the negation-without-exceedance phrasing, and the nonzero-count complement phrasing. The all-below trap (a false "none dipped under X" flipped TRUE by a naive bucket rule) is structurally unreachable because the guard reroutes only quotes with exceedance verbs, and negative case 2 pins it.
- Order: importability (Task 1) precedes the replay script that needs it (Task 4); the guard (Task 2) precedes the replay acceptance that proves it; all deterministic work precedes the live spend (Task 5).
- Spend: ~$0.60 expected against the $5 no-ask grant; the ledger records every dollar.
