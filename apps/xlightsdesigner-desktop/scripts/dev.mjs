#!/usr/bin/env node

const message = [
  "[desktop-dev] The Electron desktop shell has been retired.",
  "[desktop-dev] Launch the native app from `apps/xlightsdesigner-macos` instead."
].join("\n");

console.error(message);
process.exit(1);
