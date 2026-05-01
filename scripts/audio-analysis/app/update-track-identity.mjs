#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { updateTrackLibraryRecordIdentity } from '../../../apps/xlightsdesigner-ui/storage/analysis-artifact-store.mjs';

const DEFAULT_APP_ROOT = path.join(os.homedir(), 'Documents', 'Lights', 'xLightsDesigner');

function str(value = '') {
  return String(value || '').trim();
}

function parseArgs(argv = []) {
  const out = {
    appRoot: DEFAULT_APP_ROOT,
    contentFingerprint: '',
    title: '',
    artist: ''
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--app-root') out.appRoot = path.resolve(str(argv[++i] || out.appRoot));
    else if (token === '--content-fingerprint') out.contentFingerprint = str(argv[++i] || '');
    else if (token === '--title') out.title = str(argv[++i] || '');
    else if (token === '--artist') out.artist = str(argv[++i] || '');
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!out.contentFingerprint) throw new Error('--content-fingerprint is required');
  if (!out.title || !out.artist) throw new Error('--title and --artist are required');
  return out;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const result = updateTrackLibraryRecordIdentity({
    appRootPath: options.appRoot,
    contentFingerprint: options.contentFingerprint,
    title: options.title,
    artist: options.artist
  });
  if (!result?.ok) throw new Error(str(result?.error || 'Track identity update failed'));
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(String(error?.stack || error?.message || error));
  process.exit(1);
}
