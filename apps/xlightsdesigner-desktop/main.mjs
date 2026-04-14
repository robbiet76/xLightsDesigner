#!/usr/bin/env node

const message = [
  "The Electron desktop shell has been retired.",
  "Use the native macOS app at `apps/xlightsdesigner-macos`.",
  "The remaining `apps/xlightsdesigner-desktop` directory is legacy cleanup scope only."
].join("\n");

console.error(message);
process.exit(1);
