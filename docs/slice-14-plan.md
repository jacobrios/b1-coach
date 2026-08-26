# Slice 14: the proof of concept document says what the bet returned

Branch `slice-14-proof-of-concept`, cut from main at `fbd7e36`, 25 August 2026.

**Declared deviation, same as Slice 13.** The design conversation happened in
chat before any file was touched and the product manager approved the reframe
and the lesson list there. This document was written after the writing. A second
deviation is new: this slice was executed in the same session that planned it,
rather than handed to a fresh context. The product manager proposed it and the
reasoning was accepted: this is prose rather than code, the context being carried
is directly relevant (his voice, the verified generator facts, what he rejected
in Slice 13 and why), and the actual safety net, the independent read-only
review, runs either way.

---

## Settled before work started, do not relitigate

- **The document's job changed.** The README now explains the app, the synthetic
  hitter and the honesty of the record. This document says whether the bet paid
  off and what it took. It does not repeat the README.
- **It is written for a practitioner.** The product manager's instruction: someone
  else building a virtual coach should be able to read it and take away what we
  learned, so they do not learn it the hard way.
- **Every lesson carries its own incident and number from this project.** A
  generic best-practices list is a defect here. It is unfalsifiable, and it is
  the slop failure mode this project's rules name directly.
- **The thesis sections are not touched.** The critical question, the coaching
  access gap, TrackMan's downmarket opportunity and RAG as the moat have not aged
  and need no rework.
- **The five writing rules from Slice 13 apply from the first draft**: do not
  undersell, lead with what was done, cut detail that needs setup, never talk
  down about the user, keep the measured cost attached to a decision.

## Not in this slice

- **Any app code, prompt or approved copy.** Documentation only.
- **The launch-angle bend in the generator.** Declined by the product manager on
  25 August 2026 as diminishing returns after Slice 11's improvements. That
  decline is recorded on the What's Next list as this slice's first task.
- **The remaining Slice 6b surface polish** (unreferenced asset files, the lint
  wall now at 30 errors). Still its own candidate.
- **`docs/queued-slices.md`**, which is a backlog rather than a reader-facing
  document.

## How this will be verified

Written before any file was edited.

1. Test suite unchanged at 695 across 24. Markdown cannot move it.
2. **Every one of the nine lessons is traced to its source in the repo**, not to
   CLAUDE.md's summary of its source. Same discipline as Slice 13.
3. The four coaching-voice claims are checked against the live prompt in
   `src/coachApi.js` rather than assumed to still hold.
4. An independent read-only reviewer reads the whole branch, with an explicit
   instruction to check whether any lesson crosses into claiming engineering
   competence, which this project's rules forbid.
5. Rendered check on GitHub in the pull request.

## Debt this slice is expected to open

- **A second document making checkable claims that nothing tests.** Same class as
  the README's, and the same answer: recorded, not guarded.
- **One claim is now public that was previously only internal**: the coach is
  instructed to write at an eighth-grade reading level and that has never been
  measured. The document says so in those words, which is honest, and it also
  means the gap is now visible to a reader.

---

## Tasks

### Task 1: record the declined generator fix

The product manager declined the launch-angle bend on 25 August 2026, on the
grounds that Slice 11 already delivered the large improvements and this is
chasing diminishing returns. The append-only rule requires a decision not to
build something to be recorded the day it happens. One dated annotation on the
What's Next entry. First task, so it cannot be lost if the rest is interrupted.

### Task 2: audit the document

Read it line by line against the code and the records. What was found:

**Stale.** The hallucination paragraph, which describes pre-computed counts as
the answer and predates four slices that measured what that does and does not
buy. The goal list at line 37, carrying the identical defect the README had.
The delivery-mechanism finding, which predates Slice 7's brevity work. The
"what comes next" section, which predates Slices 8 through 11. Nine em dashes,
against the owner's standing rule.

**Not stale, do not touch.** The critical question and why it matters. And all
four coaching-voice claims, verified against `src/coachApi.js`: eighth-grade
reading level at `:92` and `:172`, the three-part tip shape at `:143`, the ban
on vague instructions at `:175`, and the requirement to cite only numbers that
appear in the session data at `:90` and `:170`.

### Task 3: write it

Structure: what we built (short, pointing at the README), the critical question,
why it matters, how we scoped it, the verdict, the nine lessons, what we would
tell someone building the same thing, what we did not solve, what comes next.

The nine lessons, each with its evidence, are listed in the decision log entry
for this slice. Do not write a tenth without an incident behind it.

### Task 4: point the README at it

The README's Documentation link described this file as "the product thesis, the
findings and what comes next." It now names the lessons, because that is what
changed and what would make a reader click.

### Task 5: review, records, pull request

Independent read-only review before the PR. Decision log entry. What's Next
updated.
