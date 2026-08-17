# Eval fixture: the before/after runs behind Slice 7b's parse-failure fix

Copied into the repo on 17 August 2026 from `.superpowers/sdd/slice-7b-plan/`,
which is gitignored scratch space. Every number in the Slice 7b decision log
entry rests on these two files, so leaving them scratch-only was the exact
mistake this project's own `docs/eval-fixtures/slice7-debriefs/README.md`
argues at length against: ground truth that lives only in a directory nobody
promised to keep is one deletion from gone.

## What these are

`before-shipped-records.json` and `after-fix-records.json` are 36 records
each, one per live Anthropic call, from the bench run that found and then
verified the fix for the session-1 JSON parse failure described in the Slice
7b decision log entry.

- **Before**: the coach exactly as it shipped going into Slice 7b. 14 of the
  36 calls failed outright with a JSON parse error, all on session 1.
- **After**: the coach with the slice's two prompt fixes (telling it plainly
  that session 1 has nothing to compare against, and tightening the
  instruction that the whole reply must be the JSON object and nothing else).
  0 of 36 calls failed.

Both runs cover the same four cells: power session 2, power session 1,
contact session 4, and open session 4.

## The before file's failed records carry no raw text

A failed record in `before-shipped-records.json` looks like:

    { "conditionKey": "shipped", "cell": "power-s1", "run": 2, "failed": "Failed to parse coach response as JSON" }

That is all it carries: which call failed and the parse error, nothing else.
The bench that produced this run had not yet been taught to keep the raw
reply, `stop_reason`, or output token count on a failure; that capture was
built later in the same slice (see the What's Next item on its own
undisclosed limit). So there is no way to recover what the model actually
wrote for these 14 calls. `after-fix-records.json` has no failed records to
compare against, because the fix worked.

## The before run's surviving records are a biased sample

Only calls that did not overrun the model's output ceiling survived to be
graded in the before run. That is not a random subset: it is specifically the
calls that happened to stay short enough not to hit the ceiling, which is the
same thing the after run's fix was built to make reliably true. Comparing
citation quality between the two runs on the cells the before run devastated
is therefore not a valid comparison at all:

- **power-s1**: before run n = 4 (8 of 12 calls failed), after run n = 12
- **contact-s4**: before run n = 2 (6 of 8 calls failed), after run n = 8

A "before" score built from the 4 or 2 calls that happened to survive is not
comparable to an "after" score built from all 12 or all 8. Do not read any
citation-quality delta on these two cells as evidence of anything the fix did.

## The two cells with clean samples in both runs are noise, not a verdict

`power-s2` and `open-s4` had no failures in either run (n = 8 both times),
so a before/after comparison on those two is at least apples to apples. It
still is not evidence the fix changed citation quality, because the two
cells moved in opposite directions:

- **power-s2**: mean grounded citations per debrief went from 5.50 to 6.25
- **open-s4**: mean grounded citations per debrief went from 6.25 to 5.13

Two cells, eight runs each, moving opposite ways is what noise looks like at
that sample size, not a signal. The decision log entry states this plainly:
whether the fix changed citation quality is unresolved, not confirmed clean.
