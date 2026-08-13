#!/usr/bin/env bash
# QA for the "run the test hook's suite from the project root" change (PR #15).
#
# Runs the real hook as a real subprocess in the situation that used to go wrong:
# a session whose shell is standing in some other project. Prints what the old
# behavior did and what the new one does, so the two can be read side by side.
#
# The old behavior is rebuilt here in six lines rather than fetched from a
# commit, so this script still works after the branch is merged and deleted.
#
# Run it from anywhere: bash scripts/qa-test-hook-root.sh

set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STUB="$(mktemp -d)"
trap 'rm -rf "$STUB"' EXIT

# A stand-in for "some other project the shell happens to be standing in".
cat > "$STUB/package.json" <<'JSON'
{ "name": "some-other-project", "scripts": { "test": "echo '  >> SOME OTHER PROJECT SUITE RAN. Zero b1-coach tests.' && exit 0" } }
JSON

# The old hook: spawns npm test with no working directory, so it inherits the
# shell's. This is what shipped before PR #15.
cat > "$STUB/old-hook.mjs" <<'JS'
import { spawnSync } from "node:child_process"
let input = ""
process.stdin.on("data", (c) => (input += c))
process.stdin.on("end", () => {
  const data = JSON.parse(input)
  if ((data.tool_input?.file_path || "").toLowerCase().endsWith(".md")) process.exit(0)
  process.exit(spawnSync("npm", ["test", "--silent"], { stdio: "inherit" }).status === 0 ? 0 : 2)
})
JS

PAYLOAD="{\"tool_input\":{\"file_path\":\"$REPO/src/goalTargets.js\"},\"cwd\":\"$STUB\"}"

echo
echo "=============================================================="
echo "1. OLD hook, shell standing in a different project"
echo "   Expect: another project's suite runs and is reported clean."
echo "=============================================================="
cd "$STUB" || exit 1
echo "$PAYLOAD" | node "$STUB/old-hook.mjs"
echo "   exit code: $?  (0 means it told the agent everything is fine)"

echo
echo "=============================================================="
echo "2. NEW hook, exact same situation"
echo "   Expect: b1-coach's own suite, all 171 tests, from the right root."
echo "=============================================================="
echo "$PAYLOAD" | CLAUDE_PROJECT_DIR="$REPO" node "$REPO/.claude/hooks/run-tests-unless-docs.mjs"
echo "   exit code: $?  (0 here means the real suite passed)"

echo
echo "=============================================================="
echo "3. NEW hook on a markdown edit"
echo "   Expect: no test output at all. Docs edits skip the suite."
echo "=============================================================="
echo "{\"tool_input\":{\"file_path\":\"$REPO/CLAUDE.md\"},\"cwd\":\"$STUB\"}" \
  | CLAUDE_PROJECT_DIR="$REPO" node "$REPO/.claude/hooks/run-tests-unless-docs.mjs"
echo "   exit code: $?  (0, and nothing printed above it, is correct)"
echo
