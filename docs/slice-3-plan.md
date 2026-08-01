# Slice 3 plan: the first safety nets

Written 31 July 2026, scoped with the product manager before any code was
written. This file travels with the work and is never deleted.

---

## What this is, in product terms

Every slice in this repo is checked entirely by hand. Slice 2 showed what that
costs: a long manual verification loop against a deployed preview, and an
independent review that still found four real defects that had already been
reasoned about and dismissed, including one where the request size cap was not
actually capping cost.

This slice builds the machine that catches that class of thing before a person
has to. Nothing a visitor sees changes. What changes is that the next slice, and
every slice after it, gets cheaper and safer to verify.

The reason is engineering-shaped rather than product-shaped, and it was named as
the recommended next slice when Slice 2 landed.

## Baseline, recorded before any code lands

**No test suite exists. Zero tests, zero failures.** There is no `test` script,
no test runner in `package.json`, and no test or spec files anywhere in the repo.
The pull request reports against those numbers.

---

## Settled with the product manager, do not relitigate

1. **Vitest**, matching the owner's other projects and the template.
2. **The suite covers `api/coach.js` as well as the client logic.** That file is
   where hand-verification cost the most in Slice 2 and where all four review
   defects were found. A throwaway 18-case harness was written for it during
   Slice 2 and discarded; this slice makes that permanent. It needs no source
   changes, because the handler is already exported.
3. **The four latent bugs found while scoping are recorded, not fixed here.**
   Two are unreachable today. A slice that both builds the harness and changes
   behavior produces a diff where the product manager cannot tell which is
   which. The tests therefore pin what the code does now, including the parts
   known to be wrong, and each is written with a comment saying so.
4. **No extraction of the duplicated logic** (the strike-zone rule, the distance
   buckets, the goal thresholds). It is a refactor wearing a test costume.
5. **Both hooks, adapted.** The test runner and the `.env` protection. The
   Prisma migration protection is dropped: this project has no database.
6. **Hook config goes in a new committed `.claude/settings.json`.** None exists
   today. It is not merged into `settings.local.json`, which is machine-specific.

## Already-shipped code this slice touches

Flagged because the plan did not originally name it and the product manager
cannot read the diff.

Nothing testable in the client is currently reachable from a test. All three
functions are module-private and two are defined inside React component bodies.
Each change below is a move plus the word `export`, with no behavior change:

- `computeStats` moves from inside the `App` component to module scope in
  `src/App.jsx` and is exported. It captures nothing, so the move is mechanical.
- `callApi` in `src/coachApi.js` gains `export`. One word, no call sites change.
- `normalizeChart`, `CHART_KEYS`, and `FALLBACK_CHART_KEYS` lift out of the
  `DebriefScreen` component body to module scope in the same file, together with
  the two-slot fill loop, as one exported function. One call site changes.

`api/coach.js` is not touched at all.

## Not in this slice

Every exclusion names where it does belong.

- **Fixing the four latent bugs.** They belong in a follow-up correctness slice,
  proposed when this one lands. They are: `computeStats` returning `NaN` on an
  empty swing list, which would reach the coach's prompt as the literal string
  "NaN mph"; a top exit velocity that would display `-Infinity` on an empty
  session; chart slots that do not dedupe, so a model returning the same valid
  key twice renders the same chart twice; and goal thresholds that disagree
  between the coach's prompt and the chart, and between two charts.
- **Extracting the duplicated logic.** Belongs with that same correctness slice,
  because the duplication is the reason the thresholds disagree in the first
  place.
- **Component and rendering tests.** Not now. Belongs to a future slice only if a
  rendering regression actually happens; there is no evidence of one.
- **The timed "waking up" explanation.** Its own slice, already a named
  candidate.
- **Whether `.claude/settings.local.json` should be tracked.** A one-line change
  and a standing open question in `CLAUDE.md`. Belongs in a micro-PR of its own,
  not folded in here just because this slice happens to open `.claude/`.

## How this will be verified

Written before any code.

1. **The baseline is real.** Show `npm test` failing or absent before the change,
   and the test count after.
2. **The suite can fail.** These are characterization tests over existing
   behavior, so they pass on their first run, which makes them worthless as
   evidence until proven otherwise. Deliberately break each function under test,
   one at a time, show the suite going red and which test caught it, then revert.
   Report the results.
3. **The PostToolUse hook actually fires.** Edit a `.js` file and show the suite
   running. Edit a `.md` file and show it skipped. Break a test, attempt an edit,
   and show the failure surfacing as hook feedback.
4. **The `.env` guard actually blocks.** Attempt an edit to `.env.local` and show
   it refused.
5. **The app still works.** Run it and complete a session. The exports and moves
   are supposed to be behavior-preserving; that claim needs a rendered check, not
   an assertion.
6. **Lint does not regress.** The count is 13 pre-existing errors on `main`.

## Debt this slice is expected to open

- The tests pin current behavior including the four known-wrong bits. When the
  correctness slice fixes them, those tests must be updated in the same change,
  and each one carries a comment saying so.
- The PostToolUse hook runs the suite after every non-Markdown edit, so every
  edit gets slower by however long the suite takes. Fine at this size; worth
  revisiting if the suite grows.
- `src/App.jsx` and `src/DebriefScreen.jsx` remain almost entirely uncovered.
  This slice covers extracted logic, not screens.
- Exporting internals widens each module's public surface slightly, which is the
  ordinary cost of making something testable.

---

## Postscript, 31 July 2026: where the build diverged from this plan

Recorded rather than edited into the text above, so the difference between what
was intended and what shipped stays visible.

- **The moved code went to new files, not to module scope in the files it came
  from.** The section above says `computeStats` moves to module scope in
  `src/App.jsx` and the chart logic lifts to module scope in
  `src/DebriefScreen.jsx`. Both went to new files instead, `src/sessionStats.js`
  and `src/chartSlots.js`, because a test that imports either big file also loads
  Recharts and needs a DOM, which would have meant adding a browser environment
  to the test runner for no gain. The logic inside both is character-for-character
  identical to where it came from. Consequently two call sites changed rather than
  the one this plan predicted.
- **Six known-wrong behaviors, not four.** The plan names four bugs found while
  scoping. Writing the tests surfaced two more, both in the markdown-fence
  stripping in `callApi`. Four of the six are pinned by a test; two are not,
  because reaching them needs code this slice left alone.
- **A code review found nine defects in this slice's own work**, all fixed before
  the pull request. The one that mattered: the test-after-every-edit hook exited
  with the suite's own code, and Claude Code only feeds a hook's output back to
  the agent on exit 2, so a broken suite would have been invisible to the thing
  that broke it. The hook's stated purpose did not work, and this plan's
  verification step 3 had been reported as demonstrating that it did. The second:
  the `.env` guard was case-sensitive on a case-insensitive filesystem, so a
  write to `.ENV.local` would have clobbered the real secrets file unchecked.
  Both fixes belong back in
  `~/.claude/templates/project-safety-nets/`, which has the same two faults.
