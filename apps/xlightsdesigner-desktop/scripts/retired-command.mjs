#!/usr/bin/env node

import path from "node:path";

const inferred = String(process.argv[1] || "").trim();
const command = String(process.argv[2] || (inferred ? path.basename(inferred) : "command")).trim() || "command";

console.error([
  `[desktop-retired] ${command} is retired.`,
  "[desktop-retired] The Electron desktop shell is no longer a supported product path.",
  "[desktop-retired] Use the native macOS app in `apps/xlightsdesigner-macos` instead."
].join("\n"));

process.exit(1);
