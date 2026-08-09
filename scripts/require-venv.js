#!/usr/bin/env node
/**
 * Preflight for `npm run dev:backend`.
 *
 * Without this, a missing virtualenv surfaces as `.venv/bin/python: No such file
 * or directory` from inside a concurrently-wrapped shell, which reads like the
 * dev server is broken rather than not yet set up.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const isWindows = process.platform === "win32";
const python = isWindows
  ? path.join(root, "backend", ".venv", "Scripts", "python.exe")
  : path.join(root, "backend", ".venv", "bin", "python");

if (!fs.existsSync(python)) {
  console.error(
    [
      "",
      "  The backend virtualenv is missing.",
      "",
      `  Expected: ${path.relative(root, python)}`,
      "",
      "  Create it and install dependencies with:",
      "",
      "      npm run setup",
      "",
    ].join("\n")
  );
  process.exit(1);
}

if (isWindows) {
  console.error(
    [
      "",
      "  On Windows the backend script needs the Scripts/ path. Run the two",
      "  sides in separate terminals instead:",
      "",
      "      backend\\.venv\\Scripts\\python -m uvicorn app.main:app --reload --port 8000",
      "      npm run dev:frontend",
      "",
    ].join("\n")
  );
  process.exit(1);
}
