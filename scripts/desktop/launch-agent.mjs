#!/usr/bin/env node

console.error([
  '[desktop-launch-agent] The Electron launch agent has been retired.',
  'The native macOS app no longer uses `/tmp/xld-desktop-launch` or `/tmp/xld-automation`.',
  'Use the native automation server on `http://127.0.0.1:49916` instead.'
].join('\n'));

process.exit(1);
