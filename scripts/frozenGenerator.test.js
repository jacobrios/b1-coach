// The permanent guard on the frozen swing generator.
//
// Five committed rounds of coach debriefs describe swing data that nothing
// stores. Sessions 2, 3 and 4 are generated from session 1 with a seeded
// PRNG, so the only record of what a round was written about is the
// generator that produced it plus the seed it ran at. Slice 11 rewrites
// src/swingGenerator.js, so those five rounds now read a frozen snapshot,
// docs/eval-fixtures/frozen/swing-generator-pre-slice11.mjs, instead of the
// working tree.
//
// DATED CORRECTION, 20 August 2026, from a review pass after everything above
// was written, reviewed and committed. FIVE IS THE WRONG NUMBER. There is a
// sixth exposed directory, docs/eval-fixtures/slice7-debriefs, and it is the
// one with the most riding on it: the 96 debriefs in it are what the grading
// tool's ability to catch a real coach error was established against, and the
// tool forces that builder for every --validate run. It hid because it freezes
// its own session 1 and looked, to five review passes, like a directory that
// had already solved this problem. It had solved half of it. It is repaired
// and covered now, and the digest group that covers it is the third one.
//
// Say "six committed fixture directories" rather than "six rounds" if the
// number is being written down again. The five are rounds of 64 debriefs each;
// this sixth one is a 96-debrief fixture in two files and was never called a
// round.
//
// WHAT THIS TEST IS FOR, IN ONE SENTENCE: the snapshot is only worth
// anything for as long as it keeps producing exactly what it produced on
// 20 August 2026, and nothing else in this repository would notice if it
// stopped.
//
// The failure it exists to catch does not look like a failure. Grading a
// round through a changed generator does not throw, does not warn and does
// not leave a gap. It produces a complete, entirely plausible fact sheet for
// swings the coach never saw, on 40 of every 64 records, and every verdict
// computed from it reads like a result. There is no symptom to notice, which
// is precisely why the check has to be automatic rather than remembered.
//
// It is cheap and offline: no model call, no network, no spend. It runs the
// generator and compares numbers.
//
// WHAT IT WATCHES IS THE DATA, NOT THE FILE, and the difference showed up
// the first time this test was deliberately broken. Standing in for Slice
// 11's pop-up work, the snapshot's launch angle ceiling was raised from 35
// degrees to 55 and every one of these tests stayed green: no swing in any
// cell at either seed reaches that ceiling, so no committed round would have
// been affected. Green was the right answer. Read that as the scope of the
// guard rather than as a hole in it: it fails when the swings five committed
// rounds were written about would change, which is the thing worth
// protecting, and it is silent about a generator edit those rounds cannot
// see. A change to the spray bias, which touches every swing, turns 15 of
// these red immediately.
//
// DATED CORRECTION, 20 August 2026. Two numbers in the paragraph above are
// now stale, and both were re-measured rather than adjusted by arithmetic.
// It is six directories, not five (see the correction at the top of this
// file). And the spray-bias figure was taken when this file held 22 tests and
// the mutation was applied to a scratch COPY of the snapshot, which left the
// hash intact; re-run today by moving this snapshot's own spray bias from 0.45
// to 0.55 in place, it turns 20 of 31 red. Eighteen of those are the per-cell
// data checks (the fifteen it always caught, plus the three cells of the new
// frozen group), one is the seed-honesty test, which is also a data
// comparison, and one is the hash, which the older technique deliberately did
// not disturb. The substantive point is unchanged: a change that touches
// every swing is caught loudly, and a change that touches none of the swings
// any committed round contains is caught only by the hash.
//
// IF THIS TEST GOES RED, the answer is never to regenerate the digest. The
// digest is a record of a day that has passed. Something has changed the
// snapshot, or changed which generator a builder reaches for, and the change
// is what needs undoing.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

import { resolveSessions, PRE_SLICE11_SNAPSHOT_PATH } from './grade-coach-accuracy.mjs'
import { DIGEST_GROUPS, digestForCell, swingLine } from './sessionDigest.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const DIGEST_PATH = path.join(REPO_ROOT, 'docs/eval-fixtures/frozen/pre-slice11-sessions.digest.json')
const SNAPSHOT_PATH = path.join(REPO_ROOT, 'docs/eval-fixtures/frozen/swing-generator-pre-slice11.mjs')
const REBUILD_PATH = path.join(REPO_ROOT, 'docs/eval-fixtures/slice7-debriefs/rebuild.mjs')

const digest = JSON.parse(readFileSync(DIGEST_PATH, 'utf8'))

// WHERE THE HASHED REGION STARTS, AND THE ONE RULE THAT DECIDES IT.
//
// Everything in the snapshot that a future edit could silently change the
// behaviour of is inside the hash. The only thing outside it is prose that
// carries no behaviour. That is the whole rule, and the boundary line below
// is where it is drawn.
//
// It was drawn in the wrong place first, earlier on this same day, at the
// "recovered file begins here" marker further down the file. That left the
// frozen copies of carryDistance, hasTarget, meetsTarget and GOAL_TARGETS
// outside the hash, because they were recovered from ballFlight.js and
// goalTargets.js rather than from swingGenerator.js and therefore sit above
// that marker. Review proved the hole rather than arguing it: mutating
// carryDistance's high-angle floor from 0.55 to 0.40 left all 23 tests
// green. That constant is the coupling CLAUDE.md says to re-check if the
// pop-up ceiling is raised, and raising the pop-up ceiling is one of the
// three things Slice 11 is about to do.
//
// The prose header stays outside because it has needed correcting twice on
// this branch already (once for imprecision, once for a search pattern that
// matched its own paragraph) and no such correction should be able to force
// a re-pin of the number below. That carve-out is defended from the other
// side inside the boundary-integrity test below, which fails the suite on any
// line above the boundary that is not blank and not a single-line comment, so
// behaviour cannot be moved out of the hashed region. Read that test's own
// comment for what the pattern is fussy about and why.
//
// Held as bare line text, and every check below counts and locates it by
// whole line rather than by substring. That is not tidiness. An earlier draft
// searched for the line wrapped in newlines, which silently under-counts two
// ADJACENT copies of the boundary, because the two occurrences share the
// newline between them and the split consumes it. Found by trying it.
const HASH_BOUNDARY_LINE = '// ==== HASH BOUNDARY. EVERY LINE BELOW IS PINNED BY scripts/frozenGenerator.test.js ===='

// The second marker, kept because the snapshot's header offers a diff command
// anchored to it and because it proves the hashed region spans both halves of
// the file, the frozen imports and the recovered generator.
const RECOVERED_MARKER_LINE = '// The recovered file begins here'

// Pinned 20 August 2026, over every line of code in the snapshot.
// IF THESE AND THE FILE DISAGREE, THE FILE IS WRONG. Re-pinning them to make
// a test pass silently converts the snapshot into a copy of whatever the
// generator has become, which is the exact outcome this whole task exists to
// prevent.
//
// The byte count is pinned beside the hash on purpose. A hash alone says
// "different" in the same breath for a one-character edit and for a region
// that has been emptied or truncated to nothing, and those want different
// reactions from whoever reads the failure. The length is checked first so
// the shrunk-to-nothing case says so in words.
const FROZEN_CODE_BYTES = 14093
const FROZEN_CODE_SHA256 = 'b03a7c19412ecc470c66d94cb4a17d30e4a7eaab1718d906d3a3f285290202be'

// WHAT COUNTS AS PROSE ABOVE THE HASH BOUNDARY. One definition, called by the
// real check below and fed hand-built strings by its own test, so the rule can
// be exercised directly instead of only through whatever the snapshot happens
// to contain today.
//
// It is hoisted for one reason, and it is the concern the last round left
// open. The real check only sees this pattern reject a line terminator if the
// snapshot happens to carry one, and the snapshot must never carry one. So a
// future edit "simplifying" the character class would reopen the smuggling
// hole with the whole suite still green, which is the precise shape of failure
// this file exists to remove. Hoisting removes the copy rather than creating
// one: there is still exactly one pattern in this repository, and the test
// below now drives it with strings built from character codes.
//
// See the long comment inside the boundary test for why the pattern is what it
// is, and why CR, U+2028 and U+2029 plus the newline it splits on are the
// whole set.
export function isProseOnlyLine(line) {
  return line.trim() === '' || /^\s*\/\/[^\r\u2028\u2029]*$/.test(line)
}

describe('the frozen pre-Slice-11 generator still produces what it produced', () => {
  // THREE DIFFERENT QUESTIONS ARE ASKED IN THIS FILE, AND MIXING THEM UP IS
  // HOW A SNAPSHOT STOPS BEING ONE.
  //
  // DATED CORRECTION, 20 August 2026. This block said TWO questions, and
  // pointed at tests by position: "the first two tests" were said to be the
  // pair asking whether the file had moved. Checked against a real run rather
  // than read off the source order, that was wrong on both halves. The pair is
  // the boundary test and the hash test, which are not adjacent and never were;
  // the second test in the file asks neither question. A third question had
  // also been added by then and this block never mentioned it.
  //
  // Tests are named below rather than numbered, deliberately, and that is the
  // real repair. A positional reference in a file that grows is wrong the next
  // time somebody inserts a test, which is exactly how the sentence above came
  // to be wrong; this same defect has now been recorded four separate times on
  // this branch, always a count or a position written down beside the thing it
  // counts. Search for the quoted name.
  //
  //   HAS THE FILE MOVED?
  //     "every line of frozen code in the snapshot is byte-for-byte what was
  //     recovered" hashes every line of code in the snapshot, the frozen copies
  //     of carryDistance and the goal targets as well as the recovered
  //     generator, and compares it to a pinned number. Any edit to any of it
  //     fails, whether or not it changes a single swing.
  //     "the snapshot carries one unambiguous hash boundary, with only prose
  //     above it" is the other half of the same question: it stops the hashed
  //     region being quietly shrunk instead of edited.
  //
  //   HAS THE DATA MOVED?
  //     Every "<builder> @ seed <n> :: <cell>" test rebuilds the sessions six
  //     committed fixture directories were written about and compares them to
  //     the digest, so they fail when those rounds would be graded against
  //     swings their coaches never saw. "reads a digest covering every builder,
  //     seed and cell it claims to" stops that set silently shrinking.
  //
  //   DOES THE GUARD ITSELF STILL WORK?
  //     "the prose rule accepts prose and refuses every line terminator" drives
  //     the boundary rule with hand-built strings, because the snapshot must
  //     never contain the thing that rule exists to refuse.
  //     "the grading script imports the same snapshot this test hashes" and
  //     "the 96-debrief fixture rebuilds through the frozen snapshot, not the
  //     working tree" ask whether the files being protected are the files
  //     anything actually reads.
  //     "the frozen group's one seed is the seed its fixture actually runs at"
  //     asks whether the digest's own coverage claim is honest.
  //
  // Neither of the first two subsumes the other, which was measured rather than
  // assumed. On
  // 20 August 2026 the reviewer mutated the snapshot five ways, one line
  // each, and rebuilt all 21 cell-and-seed combinations against each:
  //
  //   launch angle ceiling 35 -> 55              0 of 21 red
  //   launch angle floor -5 -> -20               0 of 21 red
  //   exit velocity clamps 65..97 -> 55..105     0 of 21 red
  //   carryDistance high-angle floor .55 -> .40  0 of 21 red
  //   the empty-band re-roll removed entirely    3 of 21 red (contact-s4)
  //
  // So all four clamps and the whole above-28-degrees branch of the carry
  // formula are invisible to the data check, and the re-roll, which this
  // project's CLAUDE.md warns twice about narrowing, rested on one cell.
  // That is fine as an answer to the second question and useless as an
  // answer to the first, and the first is what the snapshot's own header
  // promises. It matters concretely right now: the pop-up ceiling is one of
  // the three things Slice 11 is about to change, and this file is a
  // near-identical copy of the live generator sitting in the same
  // repository, so a repo-wide search and replace would hit both.
  //
  // Read the fourth row of that table against the boundary constants above.
  // The first version of this hash started at the recovered-file marker, so
  // it did not reach carryDistance either, and that row was green under BOTH
  // checks. Widening the region is what closed it.
  it('the snapshot carries one unambiguous hash boundary, with only prose above it', () => {
    const lines = readFileSync(SNAPSHOT_PATH, 'utf8').split('\n')
    // Exactly one of each marker, counted as whole lines. An unanchored
    // substring search would also match the snapshot's own header, which
    // explains both markers in prose.
    expect(
      lines.filter((line) => line === HASH_BOUNDARY_LINE).length,
      'the snapshot must carry exactly one hash boundary line',
    ).toBe(1)
    expect(
      lines.filter((line) => line === RECOVERED_MARKER_LINE).length,
      'the snapshot must carry exactly one recovered-file marker',
    ).toBe(1)
    // The recovered generator must sit INSIDE the hashed region. If this ever
    // reverses, the boundary has been moved down past half the file.
    expect(
      lines.indexOf(RECOVERED_MARKER_LINE),
      'the recovered generator must sit inside the hashed region',
    ).toBeGreaterThan(lines.indexOf(HASH_BOUNDARY_LINE))
    // And the carve-out defended from the other side: nothing above the
    // boundary may carry behaviour. Without this, the boundary could simply
    // be walked downward, or a function pasted above it, and the hash would
    // still pass while covering less and less.
    //
    // THE PATTERN IS FUSSIER THAN IT LOOKS AND EVERY PART OF IT IS PAYING
    // FOR SOMETHING.
    //
    // `\s*` up front: an indented comment is a comment. The first version of
    // this check anchored `//` at column 0, so it would have called an
    // indented line behaviour and failed the suite with a message telling the
    // author their comment was not a comment. The header above this boundary
    // is actively edited (repeatedly on 20 August 2026; see `git log` on that
    // file rather than trusting a count written here), so that was a
    // live false-red trap rather than a hypothetical one.
    //
    // THE EXCLUDED CHARACTERS ARE A CLOSED SET, AND THAT IS THE WHOLE POINT
    // OF WRITING THEM OUT.
    //
    // JavaScript ends a `//` comment at any LineTerminator, and ECMAScript
    // defines exactly four of those: U+000A LINE FEED, U+000D CARRIAGE
    // RETURN, U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR. There is
    // no fifth, so this hole closes exhaustively rather than one character at
    // a time. Each of the four is handled, and here is where:
    //
    //   U+000A LF  is what this code splits the file on, so it can never sit
    //              inside one of the lines being tested.
    //   U+000D CR  excluded by the character class below.
    //   U+2028 LS  excluded by the character class below.
    //   U+2029 PS  excluded by the character class below.
    //
    // All three exclusions are written as escapes rather than pasted in,
    // because the entire point of these characters is that they are
    // invisible in a source file.
    //
    // Without the exclusion, one physical line starting with `//` and
    // carrying any of the three is prose to a newline-based check and a
    // comment followed by a live statement to Node. That was reproduced
    // against this very file, twice, before either fix was trusted: a line
    // reading as a formatting note, then a line terminator, then a statement
    // patching Math.min when not running under vitest. Both times the suite
    // reported 597 tests green while the frozen generator's exit velocity
    // ceiling read 90 instead of 97 when loaded by
    // scripts/grade-coach-accuracy.mjs, which is how it is actually loaded.
    // Review found it with U+2028 on 20 August 2026; CR was closed the same
    // day and measured the same way.
    //
    // THE CR EXCLUSION ALSO REFUSES ANY LINE UP HERE THAT CARRIES A TRAILING
    // CR, which is what a CRLF-converted file looks like. That is correct
    // rather than a cost this check pays. A CRLF conversion of the whole file
    // already fails the byte-count and hash checks below the boundary, so the
    // file has to be LF-only for this guard to be green at all; a red up here
    // is the same fact arriving one check earlier.
    //
    // DATED CORRECTION, 20 August 2026: the paragraph above is right that a
    // CRLF file cannot be green, and wrong about which check says so. Measured
    // both ways rather than reasoned about, because the first version of this
    // passage was written from the pattern rather than from a run.
    //
    // A WHOLE-FILE CRLF conversion never reaches this check at all.
    // HASH_BOUNDARY_LINE itself picks up a trailing CR, so `lines.indexOf`
    // returns -1 and the enclosing `it()` dies on its very first assertion.
    // What actually fires is:
    //
    //   AssertionError: the snapshot must carry exactly one hash boundary
    //     line: expected +0 to be 1
    //   AssertionError: the hashed region changed size ...: expected +0 to be
    //     14093
    //
    // Two failures, neither of which names an offending line, and the CR
    // exclusion contributes nothing to either. So "the same fact arriving one
    // check earlier, in a message that names the line" is not what happens
    // here.
    //
    // A PARTIAL OR MIXED-ENDING file is the case the claim is true of. If the
    // boundary line itself survives as LF, this check does run, and it does
    // name the lines:
    //
    //   AssertionError: every line above the hash boundary must be blank, or a
    //     single-line // comment carrying no embedded line terminator (CR,
    //     U+2028 or U+2029): expected [ '//\r', ...(4) ] to deeply equal []
    //
    // That is the realistic accident, incidentally: a few lines pasted in with
    // Windows endings, not a whole file converted. So the substantive point
    // stands and is worth keeping. What was wrong was the mechanism.
    //
    // CALIBRATE THIS HONESTLY, because the fix is cheap and it is worth being
    // straight about which of the two threats it answers.
    //
    // For U+2028 and U+2029: nobody types either by accident and no search
    // and replace produces one, so closing those was a hole in the
    // TAMPER-EVIDENCE claim, not in the drift protection that is the guard's
    // day job. It was worth closing because three committed documents assert
    // the stronger claim, and a claim this project cannot back is exactly
    // what this whole task exists to stamp out.
    //
    // DATED CORRECTION, 20 August 2026: that calibration does NOT carry over
    // to CR, and the paragraph above used to be written as though it covered
    // the whole class. Ordinary tooling produces a CR without anybody
    // intending one: an editor set to CRLF endings, a checkout on Windows, a
    // `core.autocrlf` setting, a paste that mixes endings. So CR is a real
    // accidental-drift path as well as a tamper path. The accidental risk
    // stays low all the same, for the reason given above: a whole-file CRLF
    // conversion is caught by the byte-count and hash checks below the
    // boundary regardless. What no longer holds is the sweeping claim that
    // this class of hole is tamper-only.
    const above = lines.slice(0, lines.indexOf(HASH_BOUNDARY_LINE))
    const carriesBehaviour = above.filter((line) => !isProseOnlyLine(line))
    expect(
      carriesBehaviour,
      'every line above the hash boundary must be blank, or a single-line // comment ' +
        'carrying no embedded line terminator (CR, U+2028 or U+2029)',
    ).toEqual([])
  })

  // THE GUARD ON THE GUARD, and it exists because the check above cannot fail
  // for the reason that matters.
  //
  // The boundary test only watches the snapshot, and the snapshot must never
  // carry a line terminator inside a comment. So the exclusion that stops the
  // smuggle is never actually exercised by it: drop a character from the class
  // and every test above stays green, because there is nothing up there to
  // catch. That is the same shape as every other silent-green failure in this
  // file, one level up.
  //
  // This test drives the rule directly with strings built from character
  // codes, so nothing here depends on an invisible byte surviving an edit.
  // That is not a hypothetical concern: while this very test was being added,
  // an editor wrote the two separator escapes as two literal SPACE characters,
  // which silently turned the rule into "no line above the boundary may
  // contain a space." The boundary test caught it because 163 real prose lines
  // went red at once. Building the inputs from character codes is what keeps
  // this test honest about the same hazard.
  it('the prose rule accepts prose and refuses every line terminator', () => {
    const CR = String.fromCharCode(13)
    const LS = String.fromCharCode(0x2028)
    const PS = String.fromCharCode(0x2029)

    // Accepted: what this file's header is actually made of.
    expect(isProseOnlyLine('// an ordinary sentence of prose.'), 'plain comment').toBe(true)
    expect(isProseOnlyLine('    // an indented note.'), 'indented comment').toBe(true)
    expect(isProseOnlyLine('//'), 'empty comment').toBe(true)
    expect(isProseOnlyLine(''), 'blank line').toBe(true)
    expect(isProseOnlyLine('   '), 'whitespace-only line').toBe(true)
    expect(
      isProseOnlyLine('// Read it: (this), and `that`; 20 August 2026, 0.55 to 0.40.'),
      'prose carrying punctuation and numbers',
    ).toBe(true)

    // Refused: the three terminators, each smuggling a live statement behind
    // what looks like a note. Newline is the fourth and is not testable here
    // by construction, because the caller has already split the file on it.
    expect(
      isProseOnlyLine('// formatting note.' + CR + 'globalThis.owned = 1'),
      'CR must be refused',
    ).toBe(false)
    expect(
      isProseOnlyLine('// formatting note.' + LS + 'globalThis.owned = 1'),
      'U+2028 must be refused',
    ).toBe(false)
    expect(
      isProseOnlyLine('// formatting note.' + PS + 'globalThis.owned = 1'),
      'U+2029 must be refused',
    ).toBe(false)

    // Refused: a trailing CR on its own, which is what a CRLF-converted line
    // looks like when the boundary line itself survived the conversion.
    expect(isProseOnlyLine('// an ordinary sentence.' + CR), 'trailing CR must be refused').toBe(
      false,
    )

    // Refused: actual behaviour, and a block comment, which is a comment and
    // is still refused because a line-based check cannot know whether the
    // block is still open.
    expect(isProseOnlyLine('const SNEAKY_TUNABLE = 0.40'), 'bare statement').toBe(false)
    expect(isProseOnlyLine('/* a block comment */'), 'block comment').toBe(false)
    expect(isProseOnlyLine(' * inside a block comment'), 'block comment continuation').toBe(false)
  })

  // THE TEST AND THE LOADER MUST BE TALKING ABOUT THE SAME FILE.
  //
  // Everything else in this file hashes and rebuilds a path this test works
  // out for itself. scripts/grade-coach-accuracy.mjs works out its own path to
  // import. Until 20 August 2026 nothing tied the two together, and the gap was
  // measured rather than argued: copying the snapshot, repointing the loader at
  // the copy, and mutating carryDistance's high-angle floor from 0.55 to 0.40
  // in the copy left `npm test` reporting 597 passed across 23 files. The
  // imported file ran 0.40, the hashed file ran 0.55, and the hash was
  // guarding a file nothing read. The only surviving check would have been the
  // 21-cell data comparison, which this file's own header records as blind to
  // all four clamps and the whole above-28-degrees carry branch.
  //
  // The realistic trigger is not tampering. It is a future slice adding a
  // second snapshot beside this one and repointing the loader, while this
  // test's copy of the path stays exactly where it is.
  //
  // Same shape src/sessionStats.test.js already uses to hold
  // src/DebriefScreen.jsx's hardcoded cutoffs to SPRAY_CUTOFFS: two
  // independent definitions, held equal by a test, so a drift is loud.
  it('the grading script imports the same snapshot this test hashes', () => {
    expect(
      PRE_SLICE11_SNAPSHOT_PATH,
      'scripts/grade-coach-accuracy.mjs imports a different file from the one this test ' +
        'hashes, so the hash is guarding a file nothing reads',
    ).toBe(SNAPSHOT_PATH)
  })

  // AND SO MUST THE THIRD READER, WHICH NOBODY KNEW WAS A READER UNTIL
  // 20 AUGUST 2026.
  //
  // docs/eval-fixtures/slice7-debriefs/rebuild.mjs is the "frozen" builder. It
  // froze its own stand-in for session 1 back in August and then generated
  // sessions 2 and later by importing the generator out of the working tree,
  // so it was frozen in its own code and nowhere else. All three of its cells
  // are session 2 or later.
  //
  // That directory matters more than the five this task's predecessor
  // repaired. grade-coach-accuracy.mjs FORCES the frozen builder whenever
  // --validate runs, and --validate against those 96 debriefs is the entire
  // basis on which this project ever established that its grading tool catches
  // a real coach error. A generator rewrite would have re-graded it against a
  // complete, plausible fact sheet no coach in it ever saw.
  //
  // This is a text check rather than a behaviour check, and that is a real
  // limitation rather than a shortcut: nothing rebuild.mjs exposes says which
  // generator it loaded. It is the same tripwire shape src/sessionStats.test.js
  // uses on src/DebriefScreen.jsx's hardcoded cutoffs, and it catches the
  // realistic regression, which is somebody pointing that import back at src/
  // while tidying, or moving the snapshot without following it here.
  //
  // The negative half deliberately looks only at import lines. The file's own
  // header discusses src/swingGenerator.js in prose, and a whole-file search
  // would fail on the sentence that explains why the import is not there.
  it('the 96-debrief fixture rebuilds through the frozen snapshot, not the working tree', () => {
    const source = readFileSync(REBUILD_PATH, 'utf8')
    const relativeSnapshot = path.relative(REPO_ROOT, PRE_SLICE11_SNAPSHOT_PATH)
    expect(
      source,
      'rebuild.mjs no longer names the snapshot the grading script loads; if the snapshot moved, ' +
        'this file has to move with it',
    ).toContain(relativeSnapshot)
    const importLines = source.split('\n').filter((line) => line.includes('await import('))
    expect(
      importLines.filter((line) => line.includes('src/swingGenerator')),
      'rebuild.mjs imports the working-tree generator again, so the 96-debrief fixture would be ' +
        'graded against swings no coach in it ever saw',
    ).toEqual([])
    expect(
      importLines.filter((line) => line.includes('FROZEN_GENERATOR_PATH')).length,
      'rebuild.mjs must load its generator through its own FROZEN_GENERATOR_PATH constant, which is ' +
        'what binds it to the path checked above',
    ).toBe(1)
  })

  // WHY THE "frozen" DIGEST GROUP CARRIES ONE SEED, AND WHY THAT NUMBER IS NOT
  // A HALF-COVERAGE CLAIM.
  //
  // The other two groups pass their seed into the builder, so a group listing
  // one seed genuinely covers one of several possible worlds. This builder does
  // not work that way: resolveSessions hands it a seed and it ignores it, going
  // to rebuild.mjs's own exported SEED instead. Writing 20260814 into the group
  // is therefore a statement about where the data came from, not a choice.
  //
  // A reader has no way to see that from the group definition, and the risk if
  // they assume the shape matches the rows above it is that they add a second
  // seed, watch it produce identical data, and conclude the generator is
  // seed-independent. So the three things that make the single seed honest are
  // pinned here instead of asserted in a comment.
  //
  // One limit, stated rather than glossed: sessionsForCell caches by cell key
  // alone, so the third assertion would still pass if some future change
  // plumbed the seed through without also keying the cache by it. The second
  // assertion is what stops the set being vacuous, by showing the seed is not
  // inert in the underlying builder.
  it('the frozen group\'s one seed is the seed its fixture actually runs at', async () => {
    const { SEED, buildSessions } = await import(pathToFileURL(REBUILD_PATH).href)

    expect(SEED, 'the digest keys the frozen group by this number').toBe(20260814)

    const ownSeed = buildSessions({ goalId: 'power', upTo: 2, seed: SEED })
    const otherSeed = buildSessions({ goalId: 'power', upTo: 2, seed: 20260819 })
    expect(
      otherSeed[1].swings.map(swingLine),
      'the seed is inert in rebuild.mjs, which would make the assertion below meaningless',
    ).not.toEqual(ownSeed[1].swings.map(swingLine))

    const handedAnotherSeed = await resolveSessions({
      builder: 'frozen',
      cellKey: 'power-s2',
      seed: 20260819,
    })
    expect(
      digestForCell(handedAnotherSeed),
      'the frozen builder started honouring the seed it is handed, so the digest now covers one of ' +
        'several worlds rather than the only one',
    ).toEqual(digest.groups.frozen.seeds['20260814']['power-s2'])
  })

  it('every line of frozen code in the snapshot is byte-for-byte what was recovered', () => {
    const lines = readFileSync(SNAPSHOT_PATH, 'utf8').split('\n')
    const frozen = lines.slice(lines.indexOf(HASH_BOUNDARY_LINE)).join('\n')
    // Length first, so a region emptied or truncated to nothing reports that
    // in words rather than as two unequal hex strings.
    expect(
      Buffer.byteLength(frozen, 'utf8'),
      'the hashed region changed size; if it shrank, the boundary was moved or the file was truncated',
    ).toBe(FROZEN_CODE_BYTES)
    expect(createHash('sha256').update(frozen, 'utf8').digest('hex')).toBe(FROZEN_CODE_SHA256)
  })

  // THE COVERAGE TEST, AND IT IS COMPARED IN BOTH DIRECTIONS ON PURPOSE.
  //
  // Every comparison below this one is generated by looping over
  // DIGEST_GROUPS, which lives in code. So deleting a group or a seed from
  // that list does not turn anything red; it silently stops seven tests from
  // existing at all, and the suite reports a smaller green number that
  // nobody reads as a loss. That is the easiest mistake available here and
  // the first one somebody chasing a red test would reach for.
  //
  // The fix is to make the code's list and the committed file check each
  // other rather than one checking the other: the group names must match
  // exactly, and within each group the seed keys must match exactly. Drop a
  // group from the code and this test fails because the file still has it.
  // Drop it from the file and this test fails because the code still has it.
  //
  // The per-cell checks underneath are a second, separate job: they stop a
  // digest that has quietly lost its contents letting every toEqual below
  // pass against nothing.
  it('reads a digest covering every builder, seed and cell it claims to', () => {
    expect(Object.keys(digest.groups).sort()).toEqual(DIGEST_GROUPS.map((g) => g.builder).sort())
    for (const group of DIGEST_GROUPS) {
      const entry = digest.groups[group.builder]
      expect(entry, `digest has no group for ${group.builder}`).toBeTruthy()
      expect(Object.keys(entry.seeds).sort(), `${group.builder} seed coverage`).toEqual(
        group.seeds.map(String).sort(),
      )
      for (const seed of group.seeds) {
        const cells = entry.seeds[String(seed)]
        expect(cells, `${group.builder} has no seed ${seed}`).toBeTruthy()
        expect(Object.keys(cells).sort()).toEqual([...group.cellKeys].sort())
        for (const cellKey of group.cellKeys) {
          expect(cells[cellKey].sessions.length).toBeGreaterThan(0)
          for (const session of cells[cellKey].sessions) {
            expect(session.swings).toHaveLength(15)
          }
        }
      }
    }
  })

  // One test per cell per seed rather than one big loop inside a single test,
  // so a failure names the cell and the seed in its own title instead of
  // making somebody read a diff of several hundred swings to find out which
  // one moved.
  for (const group of DIGEST_GROUPS) {
    for (const seed of group.seeds) {
      for (const cellKey of group.cellKeys) {
        it(`${group.builder} @ seed ${seed} :: ${cellKey}`, async () => {
          const resolved = await resolveSessions({ builder: group.builder, cellKey, seed })
          expect(digestForCell(resolved)).toEqual(digest.groups[group.builder].seeds[String(seed)][cellKey])
        })
      }
    }
  }
})
