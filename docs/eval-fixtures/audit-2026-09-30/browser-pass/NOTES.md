# Browser pass notes (production, 30 Sep 2026, bundle index-BvV7lmZm.js, desktop 1440x900)

Standard: stricter than HAND-CHECK.md. Zone characterisations ("middle of the zone at 3.2") and placeholder-as-boundary wording count here as GENUINE; under HAND-CHECK's standard the count below is 3 of 10 screens, not 4.
## Power s1 (debrief ~10s)
- All numbers correct vs sessionOneSwings (92/89/89, swings 2,9,12 below zone, swing 12 2deg 78mph, swing 5 346ft 92mph 27deg pitch 2.6).
- Judgment slip: summary "chasing low pitches and getting under the ball" vs What This Means "too flat". Getting under = too high. Contradiction a baseball person catches.
- Axis ticks odd: EV 69/76/83/90/95, LA top 38, pitch height 0.6/1.6/2.5/3.5/4.4 (zone bottom is 1.5, labelled 1.6).
## Power s4
- 15/15 in zone (1 in ~500 draw locally: 0.2%). Sessions 2,3 = 11,10. Legit rare draw, not a bug.
- GENUINE: "pitch was right in the middle of the zone at 3.2 feet" (zone 1.5-3.5; 3.2 is top of zone).
- Rest checks: avg LA 28, 4 in power zone, softest 7/15/13 (79 tie with 6), all pulled (-24,-41,-38).
## Contact s1-s4 (debriefs 10.0, 11.0, 10.8, 11.2 s)
- s1 GENUINE: "three below 1.2 feet like swing 2 and swing 9" (swing 9 pitch 1.4; only swing 12 at 0.8 is below 1.2; zone bottom 1.5). Other s1 numbers correct (6 at 85+, 9 above 18deg, swing 7 89/15, 6 outside zone).
- s4 clean: avg LA 17 = s1's 17 (best), 7 in window up from 5/5, zone 11->10, swing 8 259/89/17, swings 7,13 at 1.05/1.23 shown 1.1/1.2 (slot rounding).
## Hit to All Fields s1-s4 (9.4, 9.0, 10.9, ~10 s)
- s1 numbers all correct (3/8/4, 7 at 82+, swings 2,9,12 below 1.5 at 72/74/78, swing 5 346/92 oppo). Minor: calls 82 mph "your target" on a goal with no EV target (prompt hands an 82 threshold line).
- s4 numbers all correct (7 pull/5 oppo, 8 at 82+, top 93, swing 10 4.2ft 70mph 43deg, swing 9 93/23/325 oppo 3.2ft).
- Judgment slip: "spray chart is the best it's looked all practice" when s4 is the MOST pull-heavy (7/3/5) and s3 was 5/5/5. Debatable.
- Minor: "pitch middle-in at 3.2 feet" (side 0.10, i.e. middle); "in" presumes handedness and plate-side sign. Also odd coaching: middle-in pitch driven oppo.
- Loading screen: "Your coach is reviewing the session..." ~10s, fine.
## Reduce Pop-Ups s1-s4 at iPad 1024x768 (9.7, 9.6, 11.2, 10.4 s). No horizontal overflow.
- s1 numbers correct (0 pop-ups, 11 in 10-25, top 92, swing 7 89/15 at 2.1, swings 2,9,12 below 1.5 weak).
  Minor: "low pitches pulled your launch angle down" (swing 9 was 24deg). Coaching: "on anything below the belt ... drive up through the ball" on a Reduce Pop-Ups goal, contradicts lay-off advice elsewhere. Judgment.
- s4 GENUINE x2 (one mechanism): swing 15 pitch at exactly 3.5 ft (zone top inclusive; not in handed outside list). Coach: "that's above the top of the zone" and "The pop-up and your weakest contact both came on pitches you shouldn't have swung at" (weakest = swing 15 at 72, in zone). Near-boundary case already on What's Next as unresolved. Screenshot popups-s4-ipad-boundary-pitch.jpg
- Other s4 numbers correct (16 avg = s3, 9 in target, 0 grounders, 7 outside, swing 11 90/19/279 at 2.1).
- Summary box at 1024x768 truncates with fade into scroll (known design).
## Open Session s1-s4 at iPad portrait 820x1180 (10.9, 10.4, 11.3, 10.5 s). No horizontal overflow.
- Goal picker at portrait: six cards stretched ~500px tall, mostly empty. Cosmetic. goal-picker-ipad-portrait.jpg
- Debrief at portrait: summary panel ~60% empty, two charts squeezed small at bottom. open-s1-ipad-portrait.jpg
- s1 clean (swings 5/13 346/311, six chased, 2/9/12 at 72/74/78, swing 5 at 2.6).
- s4 GENUINE: "swings 5 and 11 ... produced weaker contact" (swing 5 = 85 mph, above the 83 session avg; swing 11 = 83, at avg). Same over-generalisation class already recorded. Also "under 0.9 and 1.4 feet" (0.90 is not under 0.9).
- s4 rest correct (3 chased vs 6/6/6, top 94/93 = s3's 94/93, swing 14 353/94/2.4/pull/30deg). "middle-in" again presumes handedness.
- EV trend chart draws a smoothed spline through 15 discrete swings (overshoots between points). Minor.
## Full Dashboard: modal only, "similar to the current app experience" (characterises TrackMan's app). full-dashboard-modal.jpg
## Chat (Power s1, desktop): "Which pitches did I chase, and which went pull side?" 3.2s. Fully correct (2,4,6,9,12,14 with directions; pull 3,7,15). Swapped chart 2 to pitch_location (known design).
## Totals: 22 debriefs + 1 chat on production, all 200, 9.0-11.3 s each. 10 goal-screens read in full (5 goals x s1,s4); 4 carried a genuine coach error (Power s4, Contact s1, Pop-Ups s4, Open s4); 2 more carried a judgment slip (Power s1, All Fields s4).
