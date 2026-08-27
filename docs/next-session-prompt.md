In the b1-coach repo (~/code/b1-coach). Read CLAUDE.md first.

**This is a product decision, not a build task. Do not write any code until I
have given you an explicit go.** Your first job is to put the decision to me
properly, with a recommendation and the reasoning, in plain language. I am the
product manager and I do not read code.

## The decision

Whether to stop letting the model write numeric figures in the coach's prose,
and have the app fill them in instead. The coach would produce the sentence
with a gap in it and the code would supply the digits from the real session
data, so the model keeps the voice, the judgment and the coaching, and the app
owns every number.

The full scoping, including what was already rejected, is in
`docs/queued-slices.md` under Slice 8c, roughly lines 795 to 850. Read it before
proposing anything. The short version:

**The cost, which is why it was parked.** It only covers figures the app knows
to anticipate, and it makes the coach's prose more rigid in exactly the places
it currently sounds most like a person. That voice is a real part of what this
demo exists to show.

**A middle option was already considered and rejected on 19 August 2026: do not
re-propose it.** Checking the finished debrief in code and regenerating when a
stated count disagrees with a handed one. Rejected because matching is brittle
against ordinary English ("once", "a single swing", "just one"), it adds a
second model call to the slowest screen in the app, and this project has
already measured that this style of checking raises false alarms.

## Why it is live now

A rule was agreed in advance so this would not be re-argued from scratch: if
the coach contradicts a count it was handed at around one debrief in fifty,
build it; if closer to one in several hundred, leave it alone and spend the
effort on the pitch-location gap instead. **The trigger fired on 19 August 2026
and the decision has been sitting with me since.**

Three pieces of evidence have accumulated. Verify each against the record
rather than taking this summary on trust:

1. **Slice 8c, 19 August.** Pooled across two 52-debrief rounds, the coach
   contradicted a directly handed number on 4 of 104 debriefs, roughly one in
   26. Caveat recorded at the time: 3 of the 4 are the same failure shape
   (reciting two adjacent prior-session averages in the wrong order), so four
   events is thin evidence for a precise rate.
2. **Slice 10, 20 August.** The prompt said "Swings with exit velocity 85 mph
   or higher: 6 swings." The coach wrote "Six of your swings came in under 85
   mph." The digit is copied correctly and the sentence is inverted around it;
   the true answer was 9. Also: 9 of that round's 13 genuine errors rest on a
   handed number, against 0 of 8 in the round before.
3. **Slice 11, 21 August.** Asked to total chases across two sessions, the
   coach gave both per-session breakdowns correctly and then reported the sum
   of 2 and 2 as 5. No count line spans sessions, so a cross-session sum is
   still something the coach derives.

## The thing I most want your thinking on

Items 2 and 3 above may not actually be fixed by this approach, and if so the
case for it is weaker than the raw rate suggests. Filling the gap guarantees
the app owns the digit. It does not obviously stop the coach writing "under 85
mph" around a correctly supplied 6, or doing wrong arithmetic between two
figures that were each supplied correctly. Work out honestly how much of the
measured error rate this approach would actually remove, and say so, before
recommending it. If the answer is "less than half", tell me that plainly.

Also name what it competes with. The decision rule itself pointed at the
pitch-location gap as the alternative use of the same effort; check whether
that is still the larger source of wrong claims.

## How to proceed

1. Read CLAUDE.md, then the Slice 8c scoping in `docs/queued-slices.md`, then
   the decision log entries for 19, 20 and 21 August 2026.
2. Come back with the decision framed for me: what it would change on screen,
   what it would cost in the coach's voice, how much of the measured error rate
   it would genuinely remove, what it competes with, and your recommendation
   with the reasoning. Flag your confidence level where you are unsure.
3. Only after I say go, slice it and plan it the normal way.

Anything measured with live model calls costs real money and needs a budget
agreed with me first.
