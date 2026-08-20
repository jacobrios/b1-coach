# What the browser actually sent, 20 August 2026

Task 3 of Slice 10. The claim being evidenced is narrow and worth stating
before the evidence: **the two new prompt lines reach the request the app
really sends.** Not that the coach became more accurate. That claim is not
made anywhere in this slice.

Captured by wrapping `window.fetch` in the page and reading the outgoing
body of every `POST /api/coach`. Local development proxies straight to
Anthropic (see CLAUDE.md, "THE TRAP"), so these are real calls with real
replies, and `api/coach.js` is not involved. That is correct here: this
slice changes neither the serverless function nor anything it touches.

One run, Power & Distance, all four sessions, plus one chat message.

## The direction key reaches both prompts

| capture | kind | bytes | times the line appears |
|---|---|---|---|
| 0 | chat | 2,764 | 1 |
| 1 | debrief, session 2 | 5,582 | 2 |
| 2 | debrief, session 3 | 8,104 | 3 |
| 3 | debrief, session 4 | 10,614 | 4 |

The count rises with the session number because the line is written once per
session block, and a debrief carries every prior session in full. That is the
expected shape, not duplication.

**The chat capture is the one that mattered most.** CLAUDE.md records the
chat prompt as the copy that keeps getting missed: the distance buckets lived
in three copies and the chat one was the one that drifted. Capture 0 is a
real chat request with the line in it.

Verbatim, from capture 1, showing the line sitting immediately above the
swing data it explains:

    ...305+ft: 2 swings
    - Direction key: negative direction is pull side, positive direction is opposite field, near zero is up the middle.
    - Individual swings: Swing 1: 86mph EV, 22° LA, 13° direction, 272ft distance, ...

## The zero-count guard: what was and was not proven live

The non-zero branch is proven live, four times over, including the singular
form:

    - Swings with launch angle strictly below 15 degrees (not including 15): 5 swings — numbers: 2, 4, 11, 12, 15
    - Swings with launch angle strictly below 15 degrees (not including 15): 1 swing — numbers: 1
    - Swings with launch angle strictly below 15 degrees (not including 15): 3 swings — numbers: 1, 9, 15
    - Swings with launch angle strictly below 15 degrees (not including 15): 3 swings — numbers: 3, 8, 9

**No session in this run produced a zero count**, so the branch this slice
actually changed was not exercised by a live request. Rather than replay the
app repeatedly chasing a coin flip, the branch was exercised through the
shipped module itself, imported in the browser from the running dev server
(`await import('/src/coachApi.js')`) and handed fifteen swings all at or
above 15 degrees:

    - Swings with launch angle strictly below 15 degrees (not including 15): 0 swings

Read that for exactly what it is. It is the real shipped code running in a
real browser, and it is **not** a live request. What the four live captures
prove is that this line reaches the request; what the module check and the
unit tests prove is that the line ends cleanly when the count is zero.

## One live observation of the fix working, and one new problem

Asked directly, on session 1: "Which of my swings went to the pull side and
which went the other way?"

The coach answered with the convention stated correctly and unprompted:
"Pull side is negative, opposite field is positive, and near zero is up the
middle." **Every sign it assigned was right.** Swings 3, 7, 15, 4, 6, 10 and
11 are all genuinely negative; swings 5, 8 and 9 are all genuinely positive.
This is the error class the slice targets, and it did not occur.

**Its grouping, however, contradicted itself three times in one answer.**
Swing 15 was listed under pull side and again inside the up-the-middle list
as "15 is pull". Swing 10 was listed under pull side and again under
opposite field as "10 (-6° is slight pull)". Swing 1 at 13 degrees was called
opposite field while swing 2 at 11 degrees was called up the middle.

The slice plan predicted the cause and accepted it: the approved sentence
gives the coach no countable threshold, so it improvises a boundary. What
the plan did not predict is that the improvisation would put the same swing
in two buckets. That is a stronger case than existed before for the
"pre-count pull, centre and opposite field on every goal" expansion the
product manager was tempted by and deferred on 20 August 2026.

**Do not over-read it.** It is one reply, to a question deliberately written
to force spray grouping, on the one topic the measurement says the coach
almost never raises by itself (0 claims about where balls went across 112 of
Slice 9's 128 committed debriefs). It is a lead for that future slice, not a
defect in this one.
