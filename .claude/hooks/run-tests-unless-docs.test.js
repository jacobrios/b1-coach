// Tests for the hook that runs the suite after an edit.
//
// The fault these exist to stop is a gate that reports success without doing its
// job. The hook used to spawn `npm test` with no working directory, so it rooted
// itself wherever the session's shell happened to be standing. Standing in
// `src/`, vitest collects only the tests under `src/`, passes, and the hook
// reports the suite green having run a fraction of it.
//
// The child process is injected, so none of this runs a test suite from inside a
// test suite. What is checked is the working directory the hook hands it.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runEdit } from './run-tests-unless-docs.mjs'

const HOOKS_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(HOOKS_DIR, '..', '..')

// Records the working directory it was handed and reports a passing suite.
function spy(status = 0) {
  const calls = []
  const spawn = (cwd) => {
    calls.push(cwd)
    return status
  }
  return { spawn, calls }
}

let savedProjectDir

beforeEach(() => {
  savedProjectDir = process.env.CLAUDE_PROJECT_DIR
})

afterEach(() => {
  if (savedProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR
  else process.env.CLAUDE_PROJECT_DIR = savedProjectDir
})

describe('where the suite runs from', () => {
  it('runs from the project root when the shell is standing in a subfolder', () => {
    delete process.env.CLAUDE_PROJECT_DIR
    const { spawn, calls } = spy()

    runEdit({ filePath: join(PROJECT_ROOT, 'src/goalTargets.js'), shellCwd: join(PROJECT_ROOT, 'src'), spawn })

    expect(calls).toEqual([PROJECT_ROOT])
  })

  it('climbs past several folders to the nearest package.json', () => {
    delete process.env.CLAUDE_PROJECT_DIR
    const { spawn, calls } = spy()

    runEdit({ filePath: 'anything.js', shellCwd: HOOKS_DIR, spawn })

    expect(calls).toEqual([PROJECT_ROOT])
  })

  // The two anchors are pointed at different real directories on purpose. Aimed
  // at the same one, the test passes whichever anchor won, and so pins nothing.
  it('prefers the project the harness names over the climb', () => {
    process.env.CLAUDE_PROJECT_DIR = join(PROJECT_ROOT, 'src')
    const { spawn, calls } = spy()

    runEdit({ filePath: 'anything.js', shellCwd: join(PROJECT_ROOT, 'api'), spawn })

    expect(calls).toEqual([join(PROJECT_ROOT, 'src')])
  })

  // A directory the harness names but that does not exist is worth less than the
  // climb, so it is ignored rather than trusted.
  it('ignores a named project directory that is not there', () => {
    process.env.CLAUDE_PROJECT_DIR = join(PROJECT_ROOT, 'no-such-folder')
    const { spawn, calls } = spy()

    runEdit({ filePath: 'anything.js', shellCwd: join(PROJECT_ROOT, 'src'), spawn })

    expect(calls).toEqual([PROJECT_ROOT])
  })

  // Named for what it actually pins. The climb never runs an iteration here,
  // because there is nowhere above `/` to climb to, so this is the degenerate
  // top-of-the-filesystem case and not the general "no project above" one. It
  // also passes against the unfixed hook, which is recorded rather than hidden:
  // it is here to stop the loop running off the top, not to prove the fix.
  it('stops at the top of the filesystem instead of climbing off it', () => {
    delete process.env.CLAUDE_PROJECT_DIR
    const { spawn, calls } = spy()

    runEdit({ filePath: 'anything.js', shellCwd: '/', spawn })

    expect(calls).toEqual(['/'])
  })
})

describe('what an edit is worth running for', () => {
  it('skips the suite on a markdown edit', () => {
    const { spawn, calls } = spy()

    expect(runEdit({ filePath: join(PROJECT_ROOT, 'CLAUDE.md'), shellCwd: PROJECT_ROOT, spawn })).toBe(0)
    expect(calls).toEqual([])
  })

  it('skips the suite on a markdown edit whatever the case of the extension', () => {
    const { spawn, calls } = spy()

    expect(runEdit({ filePath: 'README.MD', shellCwd: PROJECT_ROOT, spawn })).toBe(0)
    expect(calls).toEqual([])
  })

  it('runs the suite when the payload carried no path at all', () => {
    delete process.env.CLAUDE_PROJECT_DIR
    const { spawn, calls } = spy()

    expect(runEdit({ shellCwd: join(PROJECT_ROOT, 'src'), spawn })).toBe(0)
    expect(calls).toEqual([PROJECT_ROOT])
  })
})

describe('what the hook reports back', () => {
  it('exits 0 when the suite passes', () => {
    expect(runEdit({ filePath: 'a.js', shellCwd: PROJECT_ROOT, spawn: spy(0).spawn })).toBe(0)
  })

  // Exit 2 and not the suite's own 1: Claude Code only feeds a hook's output
  // back to the agent on exit 2, so any other code leaves the agent unaware it
  // broke something.
  it('exits 2 when the suite fails, so the agent hears about it', () => {
    expect(runEdit({ filePath: 'a.js', shellCwd: PROJECT_ROOT, spawn: spy(1).spawn })).toBe(2)
  })

  it('exits 2 when the runner could not be started at all', () => {
    expect(runEdit({ filePath: 'a.js', shellCwd: PROJECT_ROOT, spawn: spy(null).spawn })).toBe(2)
  })
})
