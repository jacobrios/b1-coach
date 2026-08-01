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

  const path = (data && data.tool_input && data.tool_input.file_path) || "";

  if (path.toLowerCase().endsWith(".md")) {
    process.exit(0); // docs edit: skip the suite
  }

  const result = spawnSync("npm", ["test", "--silent"], { stdio: "inherit" });

  // Exit 2 specifically, not the suite's own exit code. Claude Code only feeds a
  // hook's output back to the agent on exit 2; every other non-zero code is
  // reported to the human and the agent carries on none the wiser. Propagating
  // vitest's exit 1, which is what the template does, means a broken suite is
  // silently invisible to the thing that broke it.
  if (result.status !== 0) {
    console.error(
      "The test suite failed after this edit. Run `npm test` to see which tests " +
        "broke, and fix them before continuing."
    );
    process.exit(2);
  }

  process.exit(0);
});
