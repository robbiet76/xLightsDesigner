#!/usr/bin/env node
import path from 'node:path';

import { defaultOwnedBootstrapShowFolder, ensureOwnedBootstrapShowFolder } from './owned-bootstrap-show-folder.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    output: process.env.XLIGHTS_BOOTSTRAP_SHOW_DIR || defaultOwnedBootstrapShowFolder()
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    if (token === '--output' || token === '--show-dir') {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      args.output = argv[index];
    } else if (token === '--help') {
      console.log([
        'Usage:',
        '  node scripts/xlights/create-owned-bootstrap-show-folder.mjs [--output <path>]',
        '',
        'Creates a minimal xLights show folder used only for owned API startup bootstrap.',
        `Default: ${defaultOwnedBootstrapShowFolder()}`
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

try {
  const args = parseArgs();
  const result = ensureOwnedBootstrapShowFolder(path.resolve(args.output));
  console.log(JSON.stringify({
    ok: true,
    ...result
  }, null, 2));
} catch (error) {
  console.error(error?.stack || String(error));
  process.exit(1);
}
