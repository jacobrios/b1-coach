// Where the test hook runs the test runner from.
//
// The hook used to spawn the runner with no working directory, so it rooted
// itself wherever the session's shell happened to be standing, and what that
// produced depended entirely on where that was. Measured 12 August 2026, all as
// real subprocesses: standing in a clean `src/` it ran the whole suite and was
// fine; standing in `src/` after any `npx` run had left a `node_modules` cache
// there, npm gave up with ENOENT and the hook reported a failure no test had
// caused; standing in a *different* project it ran that project's suite and
// reported the result as this edit's verification, exit 0 and green.
//
// That last one is the reason this file exists. A gate that reports success
// without doing its job is worse than no gate.
//
// Note the template's version of the hook, which runs the runner directly
// rather than through npm, does silently run a partial suite from a subfolder
// (127 of 171 here). This hook cannot, because npm resolves its own root. That
// protection is a side effect of a choice made for another reason, which is why
// the working directory is now stated outright rather than left to luck.
//
// Adapted from ~/.claude/templates/project-safety-nets/project-root.mjs. Kept
// in its own file, as it is there, so the next reader does not have to work out
// which consumer owns it.

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Anchor order: CLAUDE_PROJECT_DIR (the harness sets it to the directory the
 * session was opened in), then the nearest ancestor holding a package.json,
 * then the shell's cwd as a last resort. package.json is the marker rather than
 * .git because it is what a Node test runner actually needs above it.
 */
export function resolveProjectRoot(shellCwd) {
  // Known limit, deliberate for now: the session's directory wins over where
  // the edited file actually lives. A session opened in project A that edits a
  // file in project B (which the user-level rules permit, with a yes) would run
  // A's tests for B's edit. Climbing from the file's own directory first would
  // be strictly more correct and still fix the bug above; not done here because
  // cross-project edits are rare and this is not the change to widen.
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;
  if (fromEnv && existsSync(fromEnv)) return resolve(fromEnv);

  const start = resolve(shellCwd || process.cwd());
  let dir = start;
  while (dirname(dir) !== dir) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = dirname(dir);
  }
  return start;
}
