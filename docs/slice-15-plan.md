# Slice 15: the app writes the coach's numbers, or we close the question

## Settled before work started, do not relitigate

- **The problem.** The coach reads a briefing sheet the app builds, then types
  numbers into its sentences itself. It usually copies correctly. Across the
  three most recent measured rounds it got 35 numbers wrong, and roughly a
  third of those were pure transcription: copying 86 where the sheet said 88,
  reciting a pair in the wrong order, contradicting a count it was handed.
- **The approach.** The coach writes a placeholder instead of a digit; the app
  fills the digit in. The coach keeps the briefing sheet and keeps reasoning
  with the numbers. It just stops being the one carrying the digit across.
- **Scope is recitals only.** Per-swing values (exit velocity, launch angle,
  direction, distance, pitch height, pitch side) for a swing the coach names.
  Nothing else. This is where two thirds of the fixable errors live and it is
  the least human sentence the coach writes.
- **Expected win, stated honestly before measuring: about a third of genuine
  coach errors, and under half on every reading.** Reasoning errors happen
  upstream of the typing and are untouched. The product manager was told this
  before approving the probe.
- **The bar for shipping, set in advance on 27 August 2026, before anything was
  built.** It ships only if the product manager cannot tell which debriefs are
  the new ones by voice. Not "the tradeoff is worth it." If he can pick them
  out, the branch is abandoned and we publish the close instead. Set early on
  purpose, so it cannot drift once work is sunk into the branch.
- **The fallback is already decided and is not a failure state.** If this does
  not work, we close the fill-in question deliberately and say so in
  `README.md` and `docs/proof-of-concept.md`, on the precedent of the
  launch-angle bend declined in Slice 14. A measured defect, priced and
  declined on the record, is a good exhibit.

## Not in this slice

- **Coach-chosen thresholds and groupings** ("three of those four came in under
  84 mph"). The coach invents the question; no table prepared in advance can
  answer it. This is the largest single error shape on the current app and it
  stays open, recorded on What's Next.
- **Cross-session arithmetic** (2 plus 2 reported as 5). Belongs with the same
  open item.
- **Fixing the grading tool.** Priced during the 27 August discussion and
  declined: its expensive half needs paid live rounds to validate, changing it
  breaks comparability with every committed round, and this slice does not need
  it. The free half is worth an hour only if this slice ships.

## How this will be verified

Written before any code, per the standing rule.

- **Task 0, the probe, and it is a kill switch.** Does the coach cooperate with
  placeholders at all? Our own record says prompt instructions do not reliably
  hold: "be brief" failed twice, and the 50-word tip ceiling is still not
  obeyed. Measured as an adoption rate over live calls, plus parse failures.
  Roughly $0.30, 16 calls. **If adoption is poor, the slice stops here** and we
  go to the fallback having spent almost nothing.
- **Correctness, if we build.** A test proving a filled figure equals the real
  session value, and that a contradiction is impossible rather than unlikely.
  This half needs no live spend and no grading tool.
- **Voice, if we build.** Six to ten before-and-after debriefs, side by side,
  read by the product manager against the bar above. No score. The grading tool
  cannot measure voice and is not used for this.
- **The failure path is forced, not reasoned about.** A malformed placeholder
  must be seen failing on the debrief screen before this is called done.

## Debt this slice is expected to open

- **A placeholder vocabulary the coach must learn**, which is one more thing a
  prompt change can break, on the screen a stranger sees first.
- **A new way to be wrong, named during the 27 August discussion.** Filling a
  correct number into a sentence built on a wrong idea can read worse than the
  original error, and now carries the app's authority. How the placeholder is
  labelled decides whether that gets better or worse; it is a design decision
  and gets written down when it is taken.
- **Partial adoption.** If the coach uses placeholders most of the time rather
  than every time, some digits are app-owned and some are not, and no test can
  tell a visitor which is which.
