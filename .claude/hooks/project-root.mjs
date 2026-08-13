// Where the test hook runs the test runner from.
//
// This is load-bearing rather than tidy-up. The hook used to spawn the runner
// with no working directory, so it rooted itself wherever the session's shell
// happened to be standing. Standing in a source folder, vitest collects only
// the tests under that folder, passes, and the hook reports the suite green
// having run a fraction of it. A gate that reports success without doing its
// job is worse than no gate.
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
