import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readMediaIdentityFromFile,
  applyMediaIdentityRecommendation
} from '../renderer/storage/media-identity-store.mjs';

function makeTempDir(prefix = 'xld-media-store-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('readMediaIdentityFromFile parses ffprobe-style metadata and caches result', () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'track.mp3');
  fs.writeFileSync(filePath, 'audio-bytes', 'utf8');
  let calls = 0;
  const cache = new Map();
  const spawnSyncCompat = () => {
    calls += 1;
    return {
      stdout: JSON.stringify({
        format: {
          duration: '12.34',
          tags: {
            title: 'Warm Lights',
            artist: 'Mira',
            album: 'Winter',
            date: '2026',
            isrc: 'USABC1234567'
          }
        }
      })
    };
  };

  const first = readMediaIdentityFromFile(filePath, { includeFingerprint: true, cache, spawnSyncCompat, ffprobeBin: 'fakeprobe' });
  const second = readMediaIdentityFromFile(filePath, { includeFingerprint: true, cache, spawnSyncCompat, ffprobeBin: 'fakeprobe' });

  assert.equal(first.title, 'Warm Lights');
  assert.equal(first.artist, 'Mira');
  assert.equal(first.durationMs, 12340);
  assert.match(first.identityKey, /^isrc:/);
  assert.ok(first.contentFingerprint);
  assert.equal(calls, 1);
  assert.deepEqual(second, first);
});

test('applyMediaIdentityRecommendation renames file without retagging', async () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'old name.mp3');
  fs.writeFileSync(filePath, 'audio-bytes', 'utf8');

  const result = await applyMediaIdentityRecommendation({
    filePath,
    rename: true,
    retag: false,
    recommendation: { recommendedFileName: 'Better:Name' }
  });

  assert.equal(result.ok, true);
  assert.equal(result.renamed, true);
  assert.equal(result.retagged, false);
  assert.equal(path.basename(result.filePath), 'Better Name.mp3');
  assert.equal(fs.existsSync(result.filePath), true);
  assert.equal(fs.existsSync(filePath), false);
});

test('applyMediaIdentityRecommendation retags through injected runBinary', async () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'song.mp3');
  fs.writeFileSync(filePath, 'audio-bytes', 'utf8');
  let invoked = null;

  const result = await applyMediaIdentityRecommendation({
    filePath,
    rename: false,
    retag: true,
    metadataRecommendation: {
      recommended: {
        title: 'North Star',
        artist: 'Patch',
        album: 'Season'
      }
    }
  }, {
    ffmpegBin: 'fakeffmpeg',
    runBinary: async (command, args) => {
      invoked = { command, args };
      const tmpPath = args[args.length - 1];
      fs.writeFileSync(tmpPath, 'retagged-audio', 'utf8');
      return { stdout: '', stderr: '' };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.retagged, true);
  assert.equal(result.renamed, false);
  assert.equal(invoked.command, 'fakeffmpeg');
  assert.ok(invoked.args.includes('-metadata'));
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'retagged-audio');
});
