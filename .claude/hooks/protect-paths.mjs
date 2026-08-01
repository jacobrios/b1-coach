#!/usr/bin/env node
// Blocks Claude Code from editing .env files.
// It reads the tool call as JSON on stdin, checks the target file path, and exits
// with code 2 (which tells Claude Code to block the edit) if the path is
// protected.
//
// Adapted from ~/.claude/templates/project-safety-nets/. The template also
// protects Prisma migrations; that half is dropped here because this project has
// no database and a rule that can never fire is just noise for a reader.

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0); // if we cannot parse the input, do not block
  }

  const path = (data && data.tool_input && data.tool_input.file_path) || "";

  // Case-insensitive on purpose. macOS filesystems are case-insensitive by
  // default, so .ENV.local and .env.local are the same file on disk. A
  // case-sensitive pattern would wave through a write that clobbers the real
  // secrets file.
  const protectedPatterns = [
    /(^|\/)\.env(\.|$)/i, // .env, .env.local, .env.production, etc.
  ];

  // .env.example is the one .env-shaped file that holds no secrets: it carries
  // placeholder values only and is meant to be committed, so agents must be able
  // to keep it in sync when a new variable is added. Every other .env file stays
  // protected. Matched case-insensitively for the same reason as above.
  const allowedPatterns = [/(^|\/)\.env\.example$/i];

  const isProtected =
    !allowedPatterns.some((re) => re.test(path)) &&
    protectedPatterns.some((re) => re.test(path));

  if (isProtected) {
    console.error(
      `Blocked: ${path} is an env/secrets file. Do not edit it directly. ` +
        `Ask Jacob to make the change by hand. Note: .env.example is editable, ` +
        `since it holds placeholders rather than secrets.`
    );
    process.exit(2);
  }

  process.exit(0);
});
