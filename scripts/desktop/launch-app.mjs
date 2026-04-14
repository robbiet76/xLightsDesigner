#!/usr/bin/env node

console.error([
  '[desktop-launch] The Electron launch queue has been retired.',
  'Use the native macOS app at `apps/xlightsdesigner-macos`.',
  'Supported automation now goes through the native HTTP server on `http://127.0.0.1:49916`.',
  'If the native app is already running, verify it with `node scripts/native/automation.mjs get-health-snapshot`.'
].join('\n'));

process.exit(1);
