#!/usr/bin/env node
// PostToolUse hook: run the test suite after file edits, skipping pure
// documentation edits. A .md edit cannot change runtime behavior, so running the
// suite on every docs touch is cost without signal.
//
// Reads the tool call as JSON on stdin (same contract as protect-paths.mjs),
// checks the target file path, and either exits 0 (docs, skip) or runs the
// project's own test script and propagates its exit code so a failing suite
// surfaces as hook feedback.
//
// Adapted from ~/.claude/templates/project-safety-nets/. The template runs
// `npx vitest run` directly; this runs `npm test` instead so the hook and the
// command a human would type can never drift apart.

import { spawnSync } from "node:child_process";
import { resolveProjectRoot } from "./project-root.mjs";

function defaultSpawn(cwd) {
  return spawnSync("npm", ["test", "--silent"], { stdio: "inherit", cwd }).status;
}

/**
 * The whole decision an edit triggers, with the child process injectable so the
 * tests do not have to run a test suite from inside a test suite. Returns the
 * exit code the hook should use.
 */
export function runEdit({ filePath, shellCwd, spawn = defaultSpawn }) {
  const path = String(filePath || "");

  if (path.toLowerCase().endsWith(".md")) return 0; // docs edit: skip the suite

  // The runner runs from the project root, never from wherever the session's
  // shell is standing. Rooted somewhere else, npm answers about somewhere else:
  // in another project it runs that project's suite and reports it green here.
  // See project-root.mjs for the measured cases.
  const root = resolveProjectRoot(shellCwd);

  // Exit 2 specifically, not the suite's own exit code. Claude Code only feeds a
  // hook's output back to the agent on exit 2; every other non-zero code is
  // reported to the human and the agent carries on none the wiser. Propagating
  // vitest's exit 1, which is what the template does, means a broken suite is
  // silently invisible to the thing that broke it.
  return spawn(root) === 0 ? 0 : 2;
}

function main() {
  let input = "";
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    let data = {};
    try {
      data = JSON.parse(input);
    } catch {
      // If we cannot parse the input, fall through to running the tests:
      // the conservative default is to run rather than to skip.
    }

    const code = runEdit({
      filePath: (data && data.tool_input && data.tool_input.file_path) || "",
      shellCwd: data && data.cwd,
    });

    if (code !== 0) {
      console.error(
        "The test suite did not come back clean after this edit. Run `npm test` " +
          "and fix it before continuing. If nothing looks broken, check that the " +
          "runner started at all: this same message covers npm failing to run."
      );
    }

    process.exit(code);
  });
}

// Only listen on stdin when the harness runs this file directly. Importing it
// (as the test file does) must not attach a listener that never resolves.
if (process.argv[1] && process.argv[1].endsWith("run-tests-unless-docs.mjs")) {
  main();
}
