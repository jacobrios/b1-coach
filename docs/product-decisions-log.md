# B1 Coach: Product Decisions Log

*A session-by-session record of key product and technical decisions made during the build. Sessions run in reverse chronological order, most recent first.*

**The stack:** React, Tailwind CSS, Vite, and the Anthropic API. Deploying to Vercel with serverless functions to protect the API key.

---

## B1 Coach: Product Decisions Log — Slice 1 (July 30)

*What we built:* The app no longer hands a visitor a results screen with nothing on it. A failed coach request now retries once, explains itself while it retries, and offers a way to try again if it still does not work. The model can also no longer name a chart that does not exist and leave an empty box in its place.

*Key product decisions and the thinking behind them:*

**A failed request is retried once, automatically.** The server that answers the coach request goes to sleep when nobody has used the app for a while, and the request that wakes it up is the one that fails. Every observed failure of this kind has succeeded on a second attempt. One retry is the whole fix. We deliberately stopped at one: a second and third would only make a genuinely dead server take longer to admit it, and the visitor is already waiting.

**Retries are for a server that did not answer, not for an answer we did not like.** If the coach responds but the response cannot be read, we do not ask again. That is a bad answer, and asking twice produces two bad answers more slowly.

**Two honest messages replaced one silent failure.** Before this, a failed debrief sent the visitor to the results screen anyway, where they saw an empty shell that looked like a finished product with nothing to say. For a recruiter clicking this link for the first time, that is the worst possible outcome: it reads as a builder who did not notice. Now, while the retry is running, the loading screen says the demo runs on a server that sleeps when idle and the first request takes a few extra seconds. If the retry also fails, the visitor gets a short explanation and a Try again button rather than a dead end.

**The error copy does not name the hosting provider.** Naming a vendor in an error message reads as blame-shifting, and it tells a non-technical reader nothing. "A server that sleeps when idle" conveys a cold start to any engineer without the finger-point. The purpose of this copy is narrow and specific: stop a visitor concluding the builder is incompetent.

**The coach can no longer point at a chart that does not exist.** The model picks which two charts appear by naming them. Nothing was checking those names against the six charts that actually exist, so an invented name produced a panel labelled "Chart" containing the words "Chart renders here." That failed twice over, silently, and looked exactly like an unfinished feature. Names are now checked against the real list, and anything unrecognized is replaced with a real chart showing real session data. The visitor sees a working screen either way.

**Accepted tradeoff: a retry can cost a second API call for a request that already succeeded upstream.** If the coach's answer was generated but the response never reached the browser, the retry pays for the same answer twice. Spend is capped by a prepaid balance with auto-reload off, so the ceiling on this is a drained demo rather than a bill, and the alternative (no retry) means visitors see a broken app. Worth revisiting only if the balance starts moving faster than expected.

**Known gap, not fixed here: the explanation only appears once the first attempt has failed.** If a cold start shows up as a request that hangs for a long time and then fails, rather than one that fails quickly, the visitor sees the ordinary "your coach is reviewing the session" message for that whole wait before the explanation appears. We chose not to trigger the explanation on a timer instead, because a normal successful debrief already takes around twelve seconds, and a timer would tell every visitor something was wrong when nothing was.

**Em-dashes in the coach's voice are deliberately accepted.** Both system prompts tell the model never to use em-dashes and the model ignores it. That rule governs the product manager's own writing, not B1's character voice, and B1 sounds fine. A fix that stripped them after the fact was considered and rejected: it adds one more place a rewrite can go wrong for no gain a player would ever notice. The ignored prompt line stays as it is. This is not a bug to be found and fixed later.

**Cold starts are handled in two layers, and this slice is only the second one.** A free external uptime monitor pinging the app every five minutes keeps the server awake and prevents most cold starts from ever happening. The retry and the copy above catch the ones that slip through. Neither layer alone is enough.

**Why this slice stopped where it did.** Everything in it can be checked by running the app on a laptop and looking at the screen. The server-side work (pinning the model and length so a caller cannot choose them, pinning the function timeout in the repo, answering the uptime monitor correctly) cannot be, because local development never runs the serverless function at all. Splitting there means "verified" means the same thing for every claim in this pull request. That work is Slice 2.

---

## B1 Coach: Product Decisions Log — Session 10 (May 8)

*What we built:* Final pre-deployment QA pass, prompt engineering refinements, chart and tooltip improvements, data quality fixes, markdown rendering in chat, model switch to Sonnet, and dead code cleanup.

*Key product decisions and the thinking behind them:*

**Model switched from Opus to Sonnet.** Claude Opus was producing noticeable lag during the demo and is significantly more expensive per token. Sonnet handles structured batting practice data analysis reliably with no meaningful quality difference for this use case. The switch is a one-line change in coachApi.js via the MODEL constant.

**Goal-specific metric targets added to both generateDebrief and sendChatMessage.** Claude was defaulting to power hitting advice regardless of the selected goal. Adding explicit metric targets for each goal (e.g. 8-18 degrees for line drives, 10-25 degrees for popup reduction) made coaching advice goal-appropriate. A TrackMan engineer reviewing the line drives goal would now see correct target ranges rather than home run advice.

**ScatterEVLA chart band made goal-aware.** The horizontal reference band was hardcoded at 25-35 degrees (power zone) regardless of goal. The band now shifts to 8-18 degrees for contact and 10-25 degrees for popup reduction. Dot highlighting follows the same goal-specific band. goalId is passed as a prop from both DebriefScreen and ConversationScreen.

**Exit velocity threshold standardized to 88mph across the entire app.** Previously the TOP EXIT VELO footer tile highlighted at 95mph and the Raw Data table highlighted based on in-zone logic rather than exit velocity. Both now use 88mph as the universal threshold, consistent with the scatter chart reference line. 88mph represents home run distance territory for high school field dimensions.

**Raw Data Exit Velocity column decoupled from in-zone logic.** Exit velocity cells were previously highlighting orange when the pitch was in the strike zone, not when exit velocity was high. This was confusing and would immediately look wrong to a TrackMan engineer. Now highlights at 88mph or above regardless of pitch location.

**Swing number tooltips added to ScatterEVLA and PitchLocation charts.** Claude frequently references specific swing numbers in coaching advice ("swing 5 at 91 mph"). Players had no way to identify which dot on the chart corresponded to which swing. Custom content renderers replaced the formatter-based tooltips since Recharts ScatterChart only surfaces axis-bound fields to formatters. TrendEV was skipped since swing number is already the x-axis. SprayDirection was skipped since it's SVG.

**Textarea height reset after sending a message.** The chat input was accumulating height across multiple messages in a session, growing from one row to three or four rows. Fixed by resetting height to 'auto' immediately after clearing the text on send.

**Session framing clarified in coachApi.js.** Claude was implying the current session was the last one of the day even on session 2 or 3. Added explicit instruction not to imply finality unless it is session 4. Also clarified that all sessions are consecutive rounds of batting practice in a single continuous practice period, not separate sessions spaced throughout the day.

**Positive reinforcement tip added to DEBRIEF_SYSTEM.** The two tips were always improvement-focused. Claude now has permission to use one tip as positive reinforcement when the session data shows a clear pattern worth celebrating, explaining the mechanical reason it worked. The word "may" is intentional — this only happens when the data genuinely supports it, not every session.

**Coaching summary and whatThisMeans passed to sendChatMessage.** Claude had no memory of what it wrote in the session summary when the player asked follow-up questions in chat. It was re-deriving observations from raw data, occasionally phrasing things differently or contradicting itself. The previously generated summary text is now included in the chat context so Claude can build on what it already told the player.

**react-markdown installed for chat message rendering.** Plain text rendering was replaced with markdown rendering in chat message bubbles. Claude can now use italics for key metrics, bullet points for multi-session recaps, and paragraph breaks for longer responses. Bold and headers are explicitly prohibited to prevent over-formatting. Paragraph spacing set to 8px margin for breathing room without feeling double-spaced.

**Power zone pre-computed count fixed to require both EV and LA conditions.** The pre-computed power zone swing count was filtering only by launch angle (25-35 degrees) without requiring exit velocity >= 88mph. Claude was being sent an inflated count and reporting it accurately but incorrectly. Fixed by adding the EV condition to the filter, making the count consistent with the scatter chart's dot highlighting logic.

**Dead code removed from codebase.** Claude Code reviewed all files and identified three removable items: an unused prevSwings parameter in generateSwings (leftover from the session chaining architecture we replaced), a sessionComplete={true} prop passed to LiveSessionScreen that the component never read, and stale prop documentation describing the same unused prop. ConversationScreen.jsx was already absent from the codebase — removed in a prior session.

**Session 1 baseline constants made dynamic.** SESSION1_AVG_EV and SESSION1_AVG_LA hardcoded constants were replaced with live calculations from the actual mockSwings array. This eliminates the risk of the baseline drifting out of sync with the hardcoded data if session 1 swings are ever adjusted again.

---

## B1 Coach: Product Decisions Log — Session 9 (May 4)

*What we built:* Prompt engineering refinements, new chart features, conversation screen removal, per-session chart state, data quality improvements, and numerous bug fixes across charts, layout, and coaching voice.

*Key product decisions and the thinking behind them:*

**Prior session chat history added to Virtual Coach context.** Each session's chat history is now summarized and sent to Claude as background context when chatting in a later session. Claude can reference what was discussed in previous sessions, making the coaching feel continuous rather than isolated. Only real conversation messages are included — the tips sentinel object is filtered out before sending.

**Distance distribution data added to chat context.** The distance distribution bucket counts (160-220ft, 220-260ft, etc.) are now pre-computed and sent to Claude in both generateDebrief and sendChatMessage. Previously Claude could not accurately describe the distance chart because it only had raw per-swing distances, not the bucketed summary the chart displays.

**Full per-swing data added to sendChatMessage.** Previously the chat API call only sent summary stats. Now it sends the complete per-swing data including exit velocity, launch angle, direction, distance, plateLocHeight, and plateLocSide for every swing. This allows Claude to accurately analyze any chart during conversation, including the spray chart which requires direction data.

**Conversation screen removed.** The original justification was real estate — the debrief screen had a small chat panel. After the debrief screen was redesigned with a larger chat panel, that justification disappeared. Removing it eliminated duplicated chart components, a complex state management layer, and timing bugs. Chart signals from chat now replace the second chart slot on the debrief screen inline.

**Per-session chart and debrief state implemented.** Full debrief content including coaching summary, what this means, and charts is now stored per session inside sessionHistory rather than in a shared state object. Chart signals in session 1's chat no longer overwrite session 2's charts and vice versa.

**Physical cue guidance added to both system prompts.** DEBRIEF_SYSTEM and CHAT_SYSTEM now instruct Claude to use specific mechanical cues rather than vague outcome instructions. Bad: "Focus on driving the ball the other way." Good: "Let the ball travel deeper, keep your hands inside, and extend through contact." This was the single most meaningful coaching quality improvement of the session.

**Eighth grade reading level and no em-dash rules added to CHAT_SYSTEM.** These rules already existed in DEBRIEF_SYSTEM but were missing from CHAT_SYSTEM, causing the chat coaching voice to be more formal and analytical than the debrief voice. Adding them made the two voices consistent.

**pitch_location added to CHAT_SYSTEM available chart keys.** The chart key existed in DEBRIEF_SYSTEM but was missing from CHAT_SYSTEM, causing Claude to tell players the chart was unavailable when requested in conversation.

**All sessions treated as same-day practice.** Added an explicit note to the user message clarifying that all sessions happen on the same practice day. Claude was using words like "today" and "yesterday" when comparing sessions.

**Spray chart absolute distance mapping implemented.** Replaced relative scaling with a formula that maps distances to pixel positions based on real field distances. Inner arc represents 300ft, outer arc represents 400ft. Dots now plot accurately relative to the labeled arcs rather than being scaled to the session's data range.

**Session 1 mock data replaced with realistic high school batting practice numbers.** The original hardcoded data averaged 90mph exit velocity which is elite. New data averages 83mph with a range of 70-92mph, representing a solid but typical high school hitter. This affected all downstream session generation since sessions 2-4 anchor to session 1 averages.

**Session generation anchored to session 1 baseline to prevent compounding.** Previously each session built on the previous session's improved average, causing exit velocities to compound to unrealistic levels by session 4. Now all generated sessions anchor to session 1's actual average, preventing runaway improvement while still allowing natural session-to-session variance.

**Exit velocity and launch angle caps tightened.** EV cap lowered from 105 to 97mph and LA cap lowered from 45 to 35 degrees. Values above these are unrealistic for high school batting practice. Combined with the baseline anchoring fix, this keeps all generated data in a defensible range.

**Variance shrinkage slowed across sessions.** The varianceFactor was shrinking too aggressively, making sessions 3 and 4 have nearly identical distances clustered around the average. Changed floor from 0.65 to 0.85 and shrinkage rate from 0.12 to 0.05 per session. Sessions still show slightly improving consistency as intended, but with enough spread to tell an interesting visual story.

**Out-of-zone pitch bounds tightened.** Generated pitches were going as far as 1.7 feet off the side of the plate, which is unrealistic for batting practice. Tightened to a maximum of 1.1 feet off the plate on each side, and high pitches capped at 4.1 feet. Makes the pitch location chart more realistic and prevents the strike zone from looking disproportionately small.

**Direction spread widened for spray chart realism.** Increased direction range from 50 to 70 degrees with a slight pull bias, and introduced a subtle pull tendency realistic for most hitters. Previously almost everything plotted as center field hits. Now pull, center, and opposite field are all meaningfully represented.

**Unified scroll in session summary panel.** The coaching summary and What This Means sections now scroll together as one block rather than the coaching summary scrolling independently. Removes the visual disconnect between the two sections.

**Textarea input replaces single-line input in chat.** The chat input now auto-resizes as the player types, wrapping to multiple lines for longer messages. Enter sends the message, shift-enter creates a new line.

**Raw data modal table layout improved.** Swing number column width reduced, all columns center-aligned, Zone column padding added for breathing room.

---

## B1 Coach: Product Decisions Log — Session 8 (May 1)

*What we built:* Prompt engineering improvements to coaching voice, new Pitch Location vs. Outcome chart, per-swing data expansion, goal card subtext fixes, EV power zone on scatter chart, conversation screen removal, per-session chart state, and numerous bug fixes.

*Key product decisions and the thinking behind them:*

**tipsIntro field added to coaching response.** The hardcoded "Here are your top priorities for next session:" header was replaced with an AI-generated opener. Claude now writes one warm, direct sentence based on how the session actually went. The JSON schema was updated to include a tipsIntro field alongside nextSessionTips.

**Three-sentence tip structure enforced.** Each tip now follows a strict structure: sentence one is a data observation with a specific number, sentence two translates what that means in baseball terms, sentence three is one concrete action. This replaced a vague "short enough to remember" instruction that Claude was ignoring.

**Eighth-grade reading level added as a global rule.** Applied to all content Claude writes including session summary and what this means, not just tips. This also compressed the session summary text, which opened up real estate in the top panel.

**Em-dashes banned from all coaching content.** Added as an explicit rule to DEBRIEF_SYSTEM. Em-dashes were making the coaching voice sound written rather than spoken.

**Pre-computed swing summaries added to debrief data.** Rather than asking Claude to count flat swings from raw data (which it was doing incorrectly), the app now sends pre-computed values: number of swings below 15 degrees with their swing numbers, number of swings in the power zone, and top three exit velocities. This eliminated the hallucination where Claude was miscounting swings.

**Per-swing data expanded significantly.** The data sent to Claude previously included only exit velocity and launch angle. It now includes direction, distance, plateLocHeight, and plateLocSide for every swing. This allowed Claude to make observations connecting pitch location to swing outcomes, which was the most meaningful coaching quality improvement of the session.

**Pitch Location vs. Outcome chart added.** A new chart built with Recharts ScatterChart showing where each pitch crossed the plate relative to the strike zone. Shapes indicate outcome based on goal: diamond in orange for good outcomes, gray circle for other, across power, contact, and popup goals. For hit to all fields, shapes match the spray chart (circle for pull, diamond for center, triangle for oppo). Suppressed for open session goal. After multiple failed attempts with a hand-drawn SVG approach, rebuilt using Recharts for reliable sizing.

**Hand-drawn SVG abandoned for pitch location chart.** Three attempts to build the pitch location chart as a custom SVG produced persistent sizing and proportion issues. Switched to Recharts ScatterChart with ResponsiveContainer, which solved all sizing problems automatically. Lesson reinforced: only use hand-drawn SVG when Recharts cannot support the chart type, as with the spray chart field shape.

**Pitch location chart domains changed to auto-adjusting.** Fixed domains of [-1.5, 1.5] and [0.5, 4.5] were clipping outlier pitches and creating empty space. Changed to auto-adjusting with 0.15ft padding on each side, matching the approach used on the scatter chart.

**Goal card subtext corrected.** Line Drives and Contact previously said "Barrel rate, Sweet spot, Spray chart" and Reduce Pop-Ups said "Attack angle, Swing path, Tee work." Neither matched the data actually available in the app. Updated to reflect real tracked metrics: exit velocity, launch angle, and spray chart for contact; launch angle, direction, and exit velocity for popup.

**EV threshold added to scatter chart.** A vertical dashed reference line at 88 mph exit velocity was added to the Launch Angle vs Exit Velocity chart. Combined with the existing horizontal band at 25-35 degrees, this makes the power zone quadrant visually obvious. Dot highlighting updated to require both conditions simultaneously: exit velocity above 88 AND launch angle between 25 and 35. Previously highlighted on launch angle alone.

**Conversation screen removed.** The original justification was real estate: the debrief screen had a small chat panel, so an expanded conversation screen was built to give more room. After the debrief screen was redesigned with a larger chat panel, that justification disappeared. Removing it eliminated duplicated chart components across two files, a complex state management layer in App.jsx, and timing bugs that required workarounds. Chart signals from chat now replace the second chart slot on the debrief screen inline.

**Per-session chart state implemented.** Debrief content (coaching summary, what this means, and charts) is now stored per session inside sessionHistory rather than in a shared debriefContent state object. This means chart signals in session 1's chat no longer overwrite session 2's charts and vice versa. Follows the same pattern already used for per-session chat messages.

**pitch_location added to CHAT_SYSTEM prompt.** The chart key was in DEBRIEF_SYSTEM but missing from CHAT_SYSTEM, causing Claude to tell players the chart was unavailable when requested in conversation. Added to the available chart keys list in CHAT_SYSTEM.

**All sessions treated as same-day practice.** Added an explicit note to the user message sent to Claude clarifying that all sessions in a run happen on the same practice day. Claude was using words like "today" and "yesterday" when comparing sessions, implying they happened on different days.

---

## B1 Coach: Product Decisions Log — Session 7 (April 30)

*What we built:* All five charts implemented on both Debrief and ConversationScreen, pitch location data added, in-zone metric redefined, conversation chart slot wiring completed, and numerous bug fixes across navigation, tooltips, and data persistence.

*Key product decisions and the thinking behind them:*

**All five charts built and rendering.** ScatterEVLA, TrendEV, BarDistance, SprayDirection, and ZoneBreakdown all render on both DebriefScreen and ConversationScreen. Charts are defined in each file separately rather than a shared module, a deliberate prototype tradeoff. The right production architecture would be a shared `src/charts.jsx` file imported by both screens.

**Chart components duplicated across screens intentionally.** Moving charts to a shared file is a 30-minute Claude Code refactor. Deferred for prototype speed. Noted as technical debt.

**Spray chart uses shapes instead of colors for colorblind accessibility.** Circles for pull, diamonds for center, triangles for opposite field. Shapes work at small sizes where color patterns would be unreadable.

**Mock data direction spread widened.** Original mock swings had direction values clustered between -12 and +15 degrees, causing everything to plot as center hits on the spray chart. Updated to include pulls and opposite field hits for a realistic spread.

**Session data variability redesigned.** Previous approach nudged each individual swing by 1-3 mph from the session average, causing all dots to cluster tightly in sessions 2-4. New approach: first decide the session-level average (65/35 improvement bias), then scatter individual swings around that average with wide variance. Variance shrinks 12% per session to simulate improving consistency. Session 1 always uses hardcoded deterministic data.

**Pitch location data added to all swings.** Each swing now includes plateLocHeight and plateLocSide fields representing where the pitch crossed the plate. In-zone is defined as height 1.5-3.5 ft and side -0.7 to +0.7 ft, matching actual strike zone dimensions. Session 1 has 9/15 pitches in zone (realistic for batting practice). Sessions 2-4 generate pitch locations with 70% in-zone probability.

**"In Zone" metric redefined as pitch location, not launch angle.** Previous implementation measured whether launch angle fell in the 25-35 degree power window, which is an outcome metric, not a plate discipline metric. Replaced with actual strike zone contact based on pitch location data. Chart renamed to "Pitches In Zone," bar labels are "In Strike Zone" and "Outside Zone."

**Raw Data modal Zone column added.** Each swing row now shows "In" in orange or "Out" in gray based on pitch location. TrackMan reviewers can verify the pitch zone logic directly.

**Human-readable chart labels throughout.** All chart keys now display as plain English: "Launch Angle vs Exit Velocity," "Exit Velocity Trend," "Distance Distribution," "Spray Chart," "Pitches In Zone."

**Third chart slot wiring completed.** When the Virtual Coach suggests a chart in conversation, it populates the third slot on ConversationScreen. Asking for a second chart replaces the first conversation chart. Debrief's two default charts are always preserved. Chart signals from the Debrief chat open ConversationScreen with the signaled chart in the third slot.

**Anti-hallucination rule added to system prompt.** Claude was referencing launch angles in the 30s and 40s that didn't exist in the session data. Added explicit rule: "Only reference specific numbers that appear in the session data. Never invent or estimate metrics that were not provided."

**Chart code duplication flagged as technical debt.** Noted for future refactor into shared `src/charts.jsx` file. Low priority for prototype, important before production.

---

## B1 Coach: Product Decisions Log — Session 6 (April 29)

*What we built:* Full debrief screen redesign, Raw Data modal, ConversationScreen layout swap, tips seeded into Virtual Coach chat, session history navigation polish, and numerous UI refinements across all four screens.

*Key product decisions and the thinking behind them:*

**Debrief layout rebuilt as two columns.** The previous layout had four separate panels competing for attention. The new layout puts Session Summary and What This Means together in one left panel, with the Virtual Coach spanning the full right column height. This collapses the artificial separation between coaching analysis and coaching conversation, making the screen feel like one coherent coaching session rather than a dashboard.

**Try This Next Session merged into Virtual Coach.** Rather than a separate panel, the two tips now appear as the coach's opening message in the chat thread. This reinforces the product concept: the AI coach is talking to you, not displaying a report. The numbered orange circle indicators were preserved for visual clarity. Tips are seeded into the messages array so they persist when the player continues the conversation.

**Reduced tips from three to two.** Three tips is too much for a high school or college player to hold in their head. Two is more memorable and fits the space better. This is a product judgment about attention span, not a technical constraint.

**Footer stat bar added to both Debrief and ConversationScreen.** Four tiles: Avg EV, Avg LA, In Zone, Top EV. Consistent across both screens. Top EV replaces Session in the footer because it's more motivating and not shown elsewhere. Session number is already visible in the header.

**Raw Data modal added.** TrackMan employees reviewing the prototype need to verify the AI is analyzing real numbers, not making things up. A Raw Data button in the header opens a modal showing all 15 swings with exit velocity, launch angle, direction, and distance. In-zone swings are highlighted orange. Footer note reads "Data generated by TrackMan B1 · Session simulation" to be transparent about prototype scope.

**Status bar removed from all screens.** The time, signal, and battery icons were carryovers from the iPad design mockup phase. They added no value in a browser-based app and cluttered the header. Removed from all four screens.

**ConversationScreen layout swapped.** Charts moved to the left column, Virtual Coach chat moved to the right. This creates visual consistency with the Debrief screen where the coach is always on the right. The chat panel is wider in this view, giving more room for longer conversations.

**Chart signal timing bug fixed.** When Claude returned a chart key in a chat response, the app was navigating to ConversationScreen before React had finished updating state with Claude's reply. Fixed by passing the complete messages array directly at the moment of the chart signal, bypassing React's asynchronous state update cycle.

**New Session and Raw Data buttons removed from ConversationScreen.** Both would require lifting modal and session state up to App.jsx, which adds complexity not justified for a prototype. The natural flow is to return to Debrief before starting a new session. Showing buttons that don't work is worse than not showing them.

**Git version control used consistently.** Commits made before every major prompt and after every working milestone. Commit history now tells a clear story of the build progression and provides a reliable recovery path.

---

## B1 Coach: Product Decisions Log — Session 5 (April 28)

*What we built:* Anthropic API integration for debrief generation and Virtual Coach chat, Vite proxy configuration for local development, loading screen between Live Session and Debrief, JSON parsing robustness fix, and session overflow layout fixes.

*Key product decisions and the thinking behind them:*

**Serverless function architecture for API key protection.** The Anthropic API key lives in a Vercel serverless function (`api/coach.js`) rather than in client-side code. In production, the browser calls `/api/coach` which forwards to Anthropic server-side. In development, a Vite proxy intercepts `/api/coach` calls and injects the key from `.env.local`. This keeps the key out of the browser in all environments and follows standard production security practice.

**Loading screen as a transition state, not a skeleton.** Rather than showing empty panels with placeholder shimmer effects, the app shows a full-screen loading state between Live Session and Debrief while the API call is in flight. The player sees the TrackMan logo and a subtle animated indicator with "Your coach is reviewing the session." They arrive at Debrief to a fully populated screen, never a blank one.

**Coaching voice defined in the system prompt.** The AI speaks like an experienced high school or college hitting coach, not a data analyst. Rules enforced in the system prompt: lead with positives, reference specific numbers, keep observations to two or three insights, never use phrases like "statistically speaking," speak to a high school or college-aged player. This is where the product voice lives and is the key differentiator from a raw data dashboard.

**Try This Next Session tips must reference specific data.** Each tip is required by the system prompt to cite an actual number or pattern from the session. Generic advice like "work on your launch angle" is explicitly prohibited. This makes the coaching feel earned and credible.

**Chart selection delegated to Claude.** The system prompt defines a menu of five chart keys and instructs Claude to pick the two most relevant based on goal and session data. Goal-based defaults are defined but Claude can deviate if the data tells a more interesting story. This keeps chart selection intelligent without being unpredictable.

**JSON parsing made robust against markdown fences.** Claude occasionally wraps JSON responses in markdown code fences despite being instructed not to. A two-pass regex strips everything before the opening fence and everything after the closing fence before parsing. This defensive pattern ensures the app works regardless of Claude's formatting habits.

**Open Session goal confirmed working.** When no specific goal is selected, Claude chooses the two most interesting charts from the full menu based on the session data patterns. The coaching voice adjusts naturally to analyze whatever the most compelling story in the numbers is.

**Git version control actively used.** Commits made at each major milestone: navigation complete, session history complete, pre-API integration, API integration working, overflow fixed. This created a recoverable safety net throughout the session and produced a clean commit history for GitHub portfolio purposes.

---

## B1 Coach: Product Decisions Log — Session 4 (April 27)

*What we built:* Full navigation wiring across all four screens, baseball nickname Easter egg, progressive swing animation on Live Session, Full Dashboard modal, logo-as-home navigation, session history with per-session chat threads, 70/30 improvement bias for new session data generation, hard session cap at 4, and Git version control initialized.

*Key product decisions and the thinking behind them:*

**Navigation flow finalized.** Goal Selection → Live Session → Debrief → Conversation, with Conversation collapsing back to Debrief. The TrackMan logo on Live Session and Debrief screens serves as the single "start over" gesture, resetting all state including session history. This keeps the header clean and the logo in the top left where it belongs, at the cost of some discoverability. Acceptable tradeoff for a prototype.

**Progressive swing animation added to Live Session.** Swings populate one every 800ms via an internal interval, simulating a live data feed. The View Session Summary button stays disabled until all 15 swings complete. This makes the demo feel alive rather than static and reinforces the product concept without explanation.

**Full Dashboard handled with an inline modal, not a separate screen.** When a player selects Full Dashboard on Goal Selection, a centered overlay card appears explaining it is not part of the prototype and describing what it would show. Dismissed with an orange "Got it" button. This avoids a dead-end in the flow while being honest about prototype scope.

**Logo click as home navigation.** Clicking the TrackMan logo from any screen returns to Goal Selection with a full reset: selected goal, session number, session history, and active swings all return to initial state. The previous chevron and "Goals" back button was removed. Subtle and not immediately discoverable, but intentional for a prototype where the primary flow is same-goal repeat sessions.

**New Session button lives in the Debrief header.** Appears on every Debrief screen including Session 1, since a player should always be able to start another round. When clicked, increments the session counter, generates fresh swing data with a 70/30 improvement bias, and navigates directly to Live Session with the same goal. Does not return to Goal Selection, avoiding user error from accidentally switching goals mid-practice.

**70/30 improvement bias for generated sessions.** Each new session's swing data is generated relative to the previous session's averages. 70% of the time exit velocity and launch angle nudge upward by a small random amount, 30% of the time they dip slightly. Reflects realistic practice progression without guaranteeing linear improvement. Makes multi-session AI debrief comparisons more interesting and believable.

**Session history architecture: per-session data with per-session chat threads.** Each completed session stores its swings, computed stats, and its own chat message thread in a sessionHistory array. Toggling between session pills on the Debrief screen switches both the displayed stats and the chat thread. The AI coach always has access to all sessions up to and including the one currently being viewed, so coaching comparisons are contextually accurate. Switching sessions preserves each session's conversation rather than clearing it.

**Hard cap at 4 sessions (SESSION_MEMORY_DEPTH).** When the cap is reached, the New Session button is replaced with a subtle inline message: "Demo limit reached — click the TrackMan logo to start over." Chosen over a rolling window approach because it is simpler, avoids edge cases in the session pill display, and is honest about prototype scope. SESSION_MEMORY_DEPTH stored as a named constant so it is easy to adjust later.

**Git version control initialized.** Project committed to a local Git repository for the first time with two snapshots: one before session history work began and one after. Going forward, commits will be made before every major prompt as a safety net. GitHub publishing deferred until the prototype is complete, at which point it will serve as a public portfolio artifact.

**Debrief stat pill wrapping fixed.** The three stat pills (Avg EV, Avg LA, In Zone) now sit in a single row using flexWrap: nowrap. Previously the third pill was dropping to a second line due to a missing constraint.

**Display name format standardized.** Player name now renders as "Bill, The Great Bambino" with a comma separator across all screens, consistent with the nickname Easter egg intent.

---

## B1 Coach: Product Decisions Log — Session 3 (April 23, afternoon)

*What we built:* LiveSessionScreen component, DebriefScreen component, and ConversationScreen component. All three are visually implemented, data-driven via props, and rendering correctly in the browser.

*Key product decisions and the thinking behind them:*

**Goal-aware in-zone highlighting.** Swing cards on the Live Session screen highlight in orange based on whether the swing meets the threshold for the selected goal, not a universal rule. A 30 degree launch angle is a win for Power, neutral for Line Drives. The highlighting is coaching through color without saying a word.

**Stat pill thresholds are also goal-aware.** For the Power goal: exit velocity turns orange at 88 mph or above, launch angle at 25 degrees or above, in-zone count at 8 or more out of 15. Below threshold stays gray. The three pills together tell a coaching story at a glance.

**Session toggle pill shows conditionally.** Only appears in the debrief header when more than one session exists. Hidden on first session, surfaces naturally as sessions accumulate. No special logic needed from the parent.

**Video drill placeholders removed permanently.** "Try This Next Session" is three numbered text suggestions only. Deliberate scope decision: coaching intelligence is the differentiating feature, not a content library. Production version would integrate with an existing drill video library.

**On-the-fly session data generation confirmed.** Rather than pre-built mock sessions, each new session will be generated via the Anthropic API when the player starts. Makes the demo feel alive, scales infinitely, and is more technically impressive to explain.

**Baseball nickname Easter egg scoped.** Player last name will be randomly selected from a list of 10 legendary baseball nicknames (The Great Bambino, The Sultan of Swat, etc.). Adds personality, rewards baseball-literate audiences. Implemented during navigation wiring phase.

**ConversationScreen third chart slot treatment.** Two active charts take flex: 1 and fill available height. Third slot is smaller, pinned to the bottom, with a subtle "Keep chatting, more insights may surface" nudge. Orange left accent bar added to make it feel intentional rather than broken. When a real third chart is surfaced it normalizes to equal height with the others.

**Progressive chart disclosure confirmed as core mechanic.** The ConversationScreen layout literally changes as the conversation deepens. The third chart slot filling in during a demo is a visible, satisfying moment that shows the product concept without explanation.

---

## B1 Coach: Product Decisions Log — Session 2 (April 23)

*What we built:* Full React project scaffolded with Vite and Tailwind, Goal Selection screen implemented from Claude Design mockups via Claude Code, three product refinements made.

*Key product decisions and the thinking behind them:*

**Vite over Next.js for this project.** Next.js is the more production-standard choice but has more concepts to learn upfront. Vite with plain React lets the focus stay on fundamentals. Next.js is the target for the next project.

**Cursor as the code editor.** Chosen over VS Code because it's the dominant tool at AI-native companies right now and has AI assistance built directly into the editor. Signals fluency, not just curiosity.

**iPad frame removed.** The device frame was useful for the Bill demo but inappropriate for a real deployed app. A real user on an iPad shouldn't see a fake iPad frame inside their browser. Removed early so the UI develops as a real viewport-filling app from the start.

**Hover triggers highlight, click triggers navigation.** Original implementation highlighted cards on click with no proceed button. Changed so hover shows the selection state and click immediately navigates forward. More intuitive for a tap-first iPad interaction model.

**Orange for all five goal cards, blue-green for Full Dashboard only.** Reinforces the visual hierarchy that Full Dashboard is the odd one out, the advanced option, not the default path.

**Player name left as empty state.** Rather than hard-coding "Bill," the code leaves the name slot empty until the TrackMan API provides it. The headline reads "What are you working on today?" and works cleanly without a name.

**AI memory depth set at four sessions.** Current session plus three prior. Stored as a variable SESSION_MEMORY_DEPTH so it's easy to adjust later.

**Chart selection delegated to Claude.** The Anthropic API system prompt will instruct Claude to choose the two most relevant charts from a defined menu based on the player's goal and session data. Built during API integration phase, not the visual phase.

---

## B1 Coach: Product Decisions Log — Session 1 (April 22)

*What we built:* Six screens in Claude Design covering the full user journey: goal selection, two live session screens, two post-session debrief screens, and a mid-conversation screen showing the AI coach in action.

*Key product decisions and the thinking behind them:*

**Primary user is the player, not the coach.** TrackMan's existing app is built for coaches with deep data literacy. The opportunity is the player who doesn't have a coach decoding numbers for them after practice.

**B1 Coach is the interpretation layer, not the data layer.** TrackMan already does data collection and visualization well. The product thesis is that showing the right insight at the right time is more valuable than showing all the data at once.

**Progressive chart disclosure, not a full dashboard.** Inspired by experience at Civitas, where progressive disclosure of information proved more effective than showing 10-15 charts simultaneously. Charts surface based on the player's goal and the conversation, not all upfront.

**Goal selection is active, not preset.** The player chooses their focus before each session. This makes the AI's post-session analysis feel earned rather than generic. The player set an intention, the app honored it.

**Six goal options, not four.** Power and home runs, line drives and contact quality, hitting to all fields, reducing pop-ups, open session, and a Full Dashboard option for advanced users. The Full Dashboard card is visually subdued to signal it's not the default path.

**AI coach voice, not data analyst voice.** The AI speaks the way a knowledgeable but plain-spoken coach would debrief a player after batting practice. Two or three observations, not twenty metrics.

**Two mock sessions showing measurable improvement.** Session 2 shows better numbers (launch angle up, in-zone contact up) to demonstrate the app works as a development tool over time, not just a one-session novelty.

**Mock data structured like the real TrackMan B1 API.** When real API integration happens, the swap will be clean because the data shape is already correct.

**No player name capture screen.** The player name ("Bill the Great Bambino") was added as a personal touch for the demo but is not a real product requirement. The app handles the empty name state gracefully.