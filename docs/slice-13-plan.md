# Slice 13: the README stops describing an app that no longer exists

Branch `slice-13-readme-rewrite`, cut from main at `1ce4115`, 25 August 2026.

**One honest note about this document.** The design conversation happened in
chat before any file was touched, and the product manager approved the scope,
the arc and the two ride-alongs there. This document was written after the
writing rather than before it. That is a declared deviation from the
one-document-per-slice rule, which asks for the document first. Everything in
the "settled before work started" section below was genuinely settled before
work started; only the transcription lagged.

---

## Settled before work started, do not relitigate

- **A full rewrite, not a patch.** The README had not been touched since
  30 July 2026, which is before six slices of work.
- **The README claims judgment, and tells the whole arc.** Chosen by the product
  manager over two alternatives (product-only, and judgment-without-the-arc).
  The arc is: built by feel with no tests or review in April and May, decision
  log kept throughout, discipline retrofitted onto a finished app in July and
  August. Its closing line is what keeps it inside this project's own
  constraint: "I am not an engineer and this is not an engineering showcase."
- **Universal audience.** Written for any reader, whether or not they know
  baseball. Nothing is addressed to a particular company or person. *(Reworded 26 August 2026.)*
- **The early-history paragraph keeps its own heading, near the end.** Its job is
  to name the gap before a reader finds it themselves.
- **The cold-start warning stays**, per Slice 12. Its wording was open.
- **The synthetic data gets explained, not apologised for**, and is never claimed
  to be validated against real baseball.

## Not in this slice

- **`docs/proof-of-concept.md`**, which has aged the same way. Belongs in its own
  slice; it is a longer document with a different job.
- **The Slice 6b surface-polish items** (browser tab favicon, scaffolding files,
  the lint wall). They stay on the What's Next list under Slice 6b.
- **Any change to app code, prompts or copy in `src/failureCopy.js`.** This slice
  is documentation plus one committed template file.
- **The `docs/product-decisions-log.md:5` Tailwind overclaim.** It is a dated
  historical entry the append-only rule protects. Named in CLAUDE.md instead.

## How this will be verified

Written before any file was edited.

1. Test suite unchanged at 695 across 24 files. Markdown cannot move it, so a
   move means something else was touched.
2. **Every number that reaches the README is checked against its source**, not
   against CLAUDE.md's summary of its source. The generator claims are rerun
   through the seeded `scripts/measure-swing-generation.mjs`; session 1's average
   and best are computed from `src/sessionOneSwings.js` directly.
3. `npm run dev` and `npm run build` are both run, because the README now tells a
   stranger to run them.
4. Both documentation links are checked to resolve.
5. An independent read-only reviewer reads the whole branch.
6. Rendered check: the README's headings, table and code fences are read as
   GitHub renders them, in the pull request. This is the one step that cannot be
   done from the terminal, and it is the first item on the manual QA script.

## Debt this slice is expected to open

- **A README that is accurate today and will drift again.** Nothing tests its
  claims. The five generator numbers in it are the seeded script's output on
  25 August 2026, and a future generator change moves them silently. Recorded on
  the What's Next list rather than guarded, because guarding prose is a large
  cost for a proof of concept.
- **`.env.example` becomes a third place the two key names are written**, beside
  `vite.config.js` and `api/coach.js`. It carries no values, so a drift is
  cosmetic rather than dangerous.

---

## Tasks

### Task 1: audit the existing README against the repo as it stands

The product manager supplied five known defects. Treat that as a starting list.
Read the file line by line against the code, `docs/queued-slices.md` items 6 and
7, `docs/pre-deploy-checklist.md`, and the Slice 12 decision-log entry.

Five further defects were found and are fixed in Task 2:

1. **No "not affiliated with TrackMan" disclaimer.** `docs/proof-of-concept.md`
   opens with one. The README, which is what a stranger actually lands on, does
   not. That is the wrong way round, and it matters most for exactly the reader
   this rewrite is aimed at.
2. **The cold-start sentence describes the wrong thing.** It said "the first load
   after a quiet spell can take a few extra seconds." The static app is served
   from a CDN and is always instant; it is the coaching response that waits on
   the serverless function. Slice 12 settled that the warning stays. It did not
   settle that the warning was pointing at the page load.
3. **Nothing about what happens when the AI call fails.** Slice 5 built four
   distinct failure messages and that work is invisible in the README, on a live
   demo where a stranger's first click is the whole downside risk.
4. **Nothing about the model's chart choices being validated.** An invented or
   duplicated chart key is rejected and replaced with a real chart. That is a
   real product fact about building on a language model.
5. **"Line Drives" and "Contact" listed as two goals.** One card. This is inside
   the product manager's item 1, but the fix has to also say that Full Dashboard
   is deliberately out of scope and says so when tapped, because that honesty is
   worth showing rather than omitting.

### Task 2: write the README

Eight sections. Concise throughout, per the product manager's instruction:
as short as possible without losing intent or meaning.

1. Title, one line, live demo, disclaimer, the interpretation-layer framing,
   the corrected cold-start sentence.
2. **What it does.** The real flow and the real six goals, named as the screen
   names them: Power & Distance, Line Drives & Contact, Hit to All Fields,
   Reduce Pop-Ups, Open Session, Full Dashboard.
3. **The data is synthetic.** Keep the existing "structured to match the real B1
   API" claim, which is true and load-bearing: it says integration is a swap
   rather than a rebuild. Then add what it is silent on, which is the values.
   Name Bill. Five bullets on what the generator does, then the paragraph saying
   what it is not.
4. **Keeping an AI coach honest.** Three mechanisms, then the paragraph naming
   what did not work, with numbers.
5. **Running it locally.** Install, run, test, build. The local-proxy trap. The
   two key names in a table.
6. **Tech stack.** The Tailwind sentence is already accurate; carry it unchanged.
7. **What this repo does and does not show.** The approved arc.
8. **Documentation.**

**Every number is checked against its source before it is written**, not against
CLAUDE.md's summary of it. CLAUDE.md's own generator section carries two dated
corrections warning that figures there were measured along one path and then
written down as properties of the thing itself. Do not inherit that mistake.

Specifically, on the pop-up rate: CLAUDE.md records that 0.40 is the figure for
the four non-Power goals with its qualifier dropped, and 0.43 is the all-goal
figure. Write neither decimal. The seeded script's own phrasing, "about one swing
in every 2 sessions", is unambiguous and survives both.

### Task 3: `.env.example`

What `docs/queued-slices.md` item 6 actually asked for, and the file the README
now tells a stranger to copy. Both names, no values, a comment on each saying
which environment reads it and why they differ. `.gitignore` already carries the
`!.env.example` negation that makes it committable; confirm the file is not
ignored rather than assuming.

### Task 4: two CLAUDE.md corrections

Both were approved in the design conversation.

1. **The Stack section's Tailwind sentence.** It says the README and the
   decisions log both overstate Tailwind. The README half has been stale since
   14 August 2026. Strikethrough plus a dated correction, matching the
   convention the rest of the file already uses.
2. **The engineering-process constraint.** The rule reads "never present this
   repo as an example of engineering process, in its README, in a pull request,
   or anywhere else." The arc this slice ships complies, but sits close enough to
   the line that a future session reading the rule cold would think it was
   broken. Add a dated clarification: the rule bans the claim, not the
   disclosure, and give the test for future wording.

   **This one matters beyond this slice.** The product manager did not remember
   making the rule, and read cold it is broader than what it was written to
   prevent. A rule nobody remembers, applied more widely than intended, works
   against the sessions it was meant to help.

### Task 5: records and review

Decision log entry. What's Next updated: the README audit item comes off, and
what this slice surfaced goes on. Independent read-only review of the whole
branch before the pull request is opened.
