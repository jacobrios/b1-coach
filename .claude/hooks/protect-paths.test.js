// Tests for the hook that blocks edits to the secrets file.
//
// This guard is the only thing standing between an agent and the file holding
// the Anthropic key, and it is run by the Claude Code harness rather than
// imported by anything, so until this file existed nobody had ever seen it fire.
// The whole cost story for this project rests on that key being spendable but
// never readable, which makes an unproven guard the wrong kind of unproven.
//
// Adapted on 14 August 2026 from the template's protect-paths.test.ts. The
// template's Prisma migration cases are dropped, as they are in the hook itself,
// because this project has no database. What is kept is every secrets case, both
// directions, plus the malformed-input cases.
//
// It is deliberately a black-box test. It spawns the real hook as a child
// process and pipes it the same JSON shape Claude Code sends on PreToolUse, then
// asserts on the exit code and stderr, because exit 2 plus an explanation on
// stderr IS the guard's contract with the harness. Testing the regexes directly
// would pass while the contract was broken.

import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HOOK = fileURLToPath(new URL('./protect-paths.mjs', import.meta.url))

// Run the hook exactly as the harness does: JSON on stdin, read exit and stderr.
function runHook(stdin) {
  const result = spawnSync(process.execPath, [HOOK], { input: stdin, encoding: 'utf8' })
  return { status: result.status, stderr: result.stderr }
}

function runHookOnPath(filePath) {
  return runHook(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath } }))
}

// One table, both directions. A guard that only over-blocks is not correct
// either: every path here that must stay editable is as load-bearing as every
// path that must be refused. .env.example in particular has to stay editable,
// because an agent adding a new variable needs to keep it in sync.
const CASES = [
  // --- Must be refused ---
  { path: '.env', blocked: true, why: 'the secrets file itself' },
  { path: '.env.local', blocked: true, why: 'a local override of it' },
  {
    path: '/Users/someone/code/b1-coach/.env.production',
    blocked: true,
    why: 'the production one, absolute, as the harness actually sends it',
  },
  {
    path: '.ENV.local',
    blocked: true,
    why: 'the same file shouting, which a Mac cannot tell apart',
  },
  {
    path: 'config/../.env.local',
    blocked: true,
    why: 'a secrets file reached by stepping back a folder',
  },
  {
    path: '.env.example.local',
    blocked: true,
    why: 'a real secrets file whose name merely starts like the example one',
  },

  // --- Must stay editable ---
  {
    path: '.env.example',
    blocked: false,
    why: 'the committed placeholder file, which holds no secrets',
  },
  {
    path: '.ENV.EXAMPLE',
    blocked: false,
    why: 'the placeholder file shouting, still no secrets',
  },
  {
    path: '/Users/someone/code/b1-coach/.env.example',
    blocked: false,
    why: 'the placeholder file, absolute',
  },
  {
    path: 'config/.//.env.example',
    blocked: false,
    why: 'the placeholder file reached by a scruffy path',
  },
  {
    path: '.envrc',
    blocked: false,
    why: 'a direnv config, which merely starts like the secrets file',
  },
  {
    path: 'production.env',
    blocked: false,
    why: 'a config file whose name merely ends in .env, which pins the leading anchor',
  },
  {
    path: 'src/config.env.js',
    blocked: false,
    why: 'ordinary code with .env in the middle of its name',
  },
  { path: 'docs/queued-slices.md', blocked: false, why: 'an ordinary docs file' },
  { path: 'src/coachApi.js', blocked: false, why: 'ordinary product code' },
]

describe('the protect-paths hook', () => {
  for (const testCase of CASES) {
    const verb = testCase.blocked ? 'refuses' : 'allows'
    it(`${verb} ${testCase.path}, ${testCase.why}`, () => {
      expect(runHookOnPath(testCase.path).status).toBe(testCase.blocked ? 2 : 0)
    })
  }

  it('says why it refused, and names the way forward, on stderr', () => {
    // The exit code alone stops the edit; the explanation is what stops the
    // agent from working around it. Both are the contract.
    const { status, stderr } = runHookOnPath('.env.local')
    expect(status).toBe(2)
    expect(stderr).toContain('.env.local')
    expect(stderr).toContain('env/secrets file')
    expect(stderr).toContain('.env.example is editable')
  })

  it('still refuses when the path arrives as something other than a string', () => {
    // A guard may fail open on input it cannot understand, but it must decide
    // to, not crash into it. Anything that reads as a secrets path once
    // stringified is still a secrets path, and this fails closed rather than
    // waving it through.
    const { status } = runHook(JSON.stringify({ tool_input: { file_path: ['.env'] } }))
    expect(status).toBe(2)
  })

  it('stays out of the way when the input is not JSON at all', () => {
    expect(runHook('not json').status).toBe(0)
  })

  it('stays out of the way when the tool call carries no file path', () => {
    expect(runHook(JSON.stringify({ tool_input: {} })).status).toBe(0)
  })

  it('stays out of the way when the file path is empty', () => {
    expect(runHookOnPath('').status).toBe(0)
  })
})
