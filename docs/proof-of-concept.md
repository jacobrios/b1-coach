*This project was built independently for demonstration purposes. I am not a TrackMan employee, and this application has no official affiliation with TrackMan.*

---

# B1 Coach: Proof of Concept

## What we built

B1 Coach is an AI coaching layer built on a subset of TrackMan B1 baseball hitting data. After a batting practice session, it reads per-swing metrics and delivers feedback the way a coach would: a few observations grounded in the actual numbers, two concrete tips for next session, and a conversational coach the player can ask follow-up questions.

The [README](../README.md) covers what the app is, the goals a player can pick, the synthetic hitter the data is built around, and how to run it. This document does not repeat any of that. It is about whether the bet paid off and what it took.

## The critical question

Can AI provide a meaningful interpretation layer on top of TrackMan B1 data that genuinely helps high school and college athletes improve?

This is a more fundamental question than "can we build a good hitting app." It asks whether AI can do something that previously required a human expert: take raw performance data and translate it into actionable, personalized coaching at the level a developing athlete actually needs.

## Why this question matters

*The coaching access gap.* TrackMan B1 puts professional-grade data collection in high school and college programs. But collecting the data and interpreting it are two different things. Most high school programs do not have a hitting coach with the expertise to decode exit velocity trends, launch angle patterns and pitch location tendencies, let alone communicate those insights in a way a 16-year-old can act on. The data exists. The interpretation layer does not. AI is a credible candidate to fill that gap.

*TrackMan's downmarket opportunity.* Expanding beyond professional and college programs means serving customers who cannot afford the human coaching infrastructure that currently makes TrackMan data actionable. If TrackMan wants to scale into high schools at volume, the product needs to deliver value without requiring an expert on site to translate it. An AI interpretation layer is the mechanism that makes that scaling possible.

## How we scoped it

The proof of concept was deliberately scoped to answer the core question without building a full product. Four decisions shaped it.

*The player is the primary user, not the coach.* TrackMan's existing tools are built for coaches with data literacy. B1 Coach was designed for the athlete who practices without anyone decoding the numbers afterward. This reframe drove every subsequent decision.

*Progressive disclosure over a full dashboard.* Rather than showing every metric at once, the app surfaces two charts chosen for the player's goal and what the session actually did. The goal selection screen is the first thing the player sees, not the data. Showing the right insight at the right moment beats showing everything.

*Coaching voice, not analyst voice.* The AI is constrained to speak like an experienced high school coach rather than a data system. It is instructed to write at an eighth-grade reading level, which we have never actually measured and so state as an instruction rather than a result. Each tip follows a three-part shape: a specific observation quoting real numbers, what it means in baseball terms, and one physical cue the player can feel. Vague instructions like "focus on driving the ball the other way" are explicitly prohibited in favour of cues about what to do with the body.

*Synthetic data, deliberately modelled.* There is no live TrackMan feed. The mock data matches the shape of the real B1 API, and the values are built around one specific hitter rather than drawn at random. That choice earns its own lesson below, because coaching quality cannot be judged on top of data a knowledgeable reader does not believe.

## The verdict

**Yes, AI can be the interpretation layer. But the accuracy has to be engineered rather than assumed, and that turned out to be most of the work.**

The first version was convincing immediately: specific, grounded, actionable coaching across every goal, quoting session numbers and answering follow-ups accurately. That is the easy 80%, it arrives almost for free, and it is where a demo stops and a product has to keep going.

The remaining 20% is trust, and it is unforgiving. A coach that is right nineteen times and then tells a player they had four swings under 80 mph when they had six has not made a small error. It has told a 16-year-old something false about their own swing, in a domain where the player cannot easily check. One of those undoes twenty good sessions.

**Be careful reading the numbers that follow, including ours.** The first time this was measured, on 96 saved debriefs, the coach was making a factual error in roughly **one debrief in twelve**. That figure is a baseline, not a before-and-after: it was never re-run with the same instrument after the fixes. Later rounds, hand-checked claim by claim with a different tool on different sessions, put **12% to 22% of debriefs carrying at least one genuine error**. Those two numbers are not comparable, and we are not going to pretend they are.

What we can say precisely is this. **Every error class we aimed at got measurably better, and the overall error rate never visibly moved.** Each fix closes one way of being wrong and reveals the next. That is the honest shape of the result, and it is more useful to anyone building this than a tidier one would be.

## What it took: nine things we learned

Every lesson here has an incident behind it. None of it is generic advice.

**1. Never let the model do arithmetic on your data.** Every threshold the coaching prose names is now counted by the app and handed to the model as a fact. Asked to work out "how many of these swings were under 80 mph" itself, the model guesses plausibly and wrongly. Measured before and after across 52 debriefs each way, that error class went from **8 occurrences to zero**, and the coach's overall accuracy did not move. The slice's own title in our log is "the fix worked exactly where it was aimed, and nowhere else." Both halves of that are the lesson.

**2. A handed number is safer, not safe.** The prompt said "Swings with exit velocity 85 mph or higher: 6 swings." The coach wrote "Six of your swings came in under 85 mph." The number was copied perfectly and the sentence inverted around it. The true answer was nine. Pre-counting cannot fix this, because the count was there and it was right.

**3. Pre-counting does not do arithmetic between counts.** Handed two correct per-session numbers and asked for the total, the coach gave both breakdowns correctly and then reported two plus two as five. Every count you hand over is a fact the model can still combine wrongly.

**4. Validate any model output that drives the interface, not just the words.** The model chooses which two charts to render by naming them. Twice, an invented name became a valid-looking object and failed silently, leaving an empty box where a chart should be. Names are now checked against the real list, duplicates dropped, and any rejected slot filled with a chart that works on real data. Model output selecting UI is a claim, exactly like model output describing a number.

**5. Tell the model what its numbers mean, and check the answer against the rest of the screen.** Spray direction reaches the coach as a signed number. For most of the project only one goal's instructions explained which sign meant pull, so on every other goal the coach inferred it, and during one review it called an opposite-field ball a pull-side ball. It was not hallucinating. It was reading data nobody had labelled. The first fix then shipped a *third* definition of pull, and manual review caught the coach naming six pull-side swings while the chart beside it coloured three. It was rejected and redone so that the prose and the chart read one shared definition. Labelling the data is half of it; making sure the label agrees with everything else the user can see is the other half.

**6. You cannot fix what you have not measured, and "it reads better" is not measurement.** Two separate attempts to shorten the coach by instruction alone appeared to work and quietly did not hold. Nothing noticed, because nothing was counting. The fix was not a better instruction, it was building something that could tell.

**7. Your measuring instrument is also wrong, and it will be wrong in the direction that flatters you.** We built a grader to check the coach's claims against the real numbers. Across ten measured rounds, between **11% and 64% of the errors it flagged were the grader being wrong**, not the coach. Worse, its most common failure mode fired on sentence shapes the coach only started writing *after* the change being measured, so an unchecked before-and-after would have reported the coach getting roughly 80% worse when hand-checking showed it had not changed at all. We learned this the hard way: one round's headline finding was published straight from the grader's raw flag counts and had to be corrected afterwards, once a hand-check showed a chunk of those flags were the tool misreading sentences the coach had got right. Adjudicating every claim by hand became the standard after that, not before it.

**8. Fake data has to be believable, or the coaching sitting on it is not.** An early distance formula barely used launch angle, so a ground ball topped at 70 mph was credited with 287 feet. The coach read that number out loud, correctly, and sounded ridiculous. Later, where a pitch was thrown turned out to have no effect at all on how well it was struck, measured at a **0.00 mph** difference in exit velocity between swings at strikes and swings at balls across 4.5 million swings, while the coach was being handed which pitches were outside the zone and reasoning about chasing out loud. The coaching was not wrong. The world underneath it was.

**And it is still not finished, which is the part worth copying.** The generated hitter's launch angle still bends the wrong way against pitch height at the top of the zone, and the pop-up rate was chosen because it reads plausibly rather than derived from any published figure. Both are written down rather than smoothed over, because the readers most likely to spot them are exactly the readers whose trust is worth having.

**9. Say what actually failed.** Every failure used to produce one sentence blaming a sleeping server, which was a guess presented as a fact and was often wrong. There are now four distinct messages: a drained API balance, a timeout, trouble at the API end, and an unreachable server. Two caveats we keep in our own notes rather than hiding: one of the four is also the catch-all, so it is not proof the API did anything wrong, and only two of the four have ever been forced against a real failure. On a demo, an honest failure costs far less trust than a confident wrong explanation, and that applies to how honestly you describe the failure handling too.

**The thread running through all nine: model output is a claim, not a fact.** That applies to a number in a sentence, a chart name that selects UI, and the output of the tool you built to check the model.

## What we would tell someone building the same thing

Budget for trust, not for output quality. Getting a language model to produce good coaching prose took a small fraction of this project. Getting it to stop saying things that were not true took nearly all the rest, and none of that work is visible in a demo.

## What we did not solve

*The delivery mechanism.* The honest limitation is still that the experience is too text-heavy for the intended user. A high school athlete is not going to read three paragraphs of feedback. We shortened the coach deliberately and measured what it cost, about 28% of the real numbers it had been quoting, and even then the per-tip word budget is not holding: tips measure 67 to 82 words against a 50-word target. Text is a placeholder for a real coaching interaction, not a replacement for it.

*Accuracy is improved in places, not solved.* Of the three error classes we aimed at, two are gone and one is reduced rather than eliminated: the coach's own groupings of pitch-location data went from six wrong claims to three across 52 debriefs, and the three that remain are all the same narrower failure, intersecting two groups it was handed separately. Lessons 2 and 3 above describe live failures with no fix currently shipped, and there is an open decision about whether the app should write the numbers into the coach's sentences directly, which would make a contradicted count impossible at the cost of making the prose more rigid exactly where it sounds most human.

## What comes next

*Rich media.* Coaching tips should trigger drill videos or mechanical demonstrations rather than describing them in words. The AI insight becomes the pointer to the right content, not the content itself. This is the biggest gap between this prototype and something a player would use twice.

*Real TrackMan API integration.* The mock data already matches the shape of the real B1 API, so this is an integration step rather than a rebuild. Player identity, session history and the full metrics payload would come from TrackMan directly.

*RAG, and why it is the actual moat.* The current implementation is prompt engineering over session-specific data, which is the right level for a proof of concept. The next architectural step is Retrieval Augmented Generation connecting real player history and coaching research to the AI layer. More importantly, it is where TrackMan's proprietary data becomes a genuine competitive advantage. TrackMan holds aggregate performance data across thousands of players and sessions that no outside competitor can replicate. Feeding that into the coaching layer, and asking questions like how this player's launch angle trend compares to similar athletes who improved, turns generic insight into proprietary intelligence. That advantage compounds with every session collected.

---

*The reasoning behind every decision above, session by session, is in [the product decisions log](product-decisions-log.md).*
