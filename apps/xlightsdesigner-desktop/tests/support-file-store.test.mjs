import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  statFileRecord,
  readTrainingPackageAsset,
  appendAgentLogEntry,
  readAgentLogEntries
} from '../renderer/storage/support-file-store.mjs';

function makeTempDir(prefix = 'xld-support-store-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('statFileRecord returns stat metadata for an existing file', () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'sample.txt');
  fs.writeFileSync(filePath, 'hello', 'utf8');

  const result = statFileRecord({ filePath });
  assert.equal(result.ok, true);
  assert.equal(result.exists, true);
  assert.equal(result.filePath, filePath);
  assert.equal(result.size, 5);
  assert.ok(result.mtimeMs > 0);
  assert.ok(result.mtimeIso);
});

test('readTrainingPackageAsset reads text and blocks path traversal', () => {
  const dir = makeTempDir();
  const rootDir = path.join(dir, 'training-package-v1');
  const assetPath = path.join(rootDir, 'agents', 'registry.json');
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  fs.writeFileSync(assetPath, '{"ok":true}\n', 'utf8');

  const ok = readTrainingPackageAsset({ relativePath: '/agents/registry.json', asJson: true }, { rootDir });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.data, { ok: true });

  const blocked = readTrainingPackageAsset({ relativePath: '../secrets.txt' }, { rootDir });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /Invalid relativePath/);
});

test('appendAgentLogEntry and readAgentLogEntries round-trip and filter rows', () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'agent-log.jsonl');

  appendAgentLogEntry({ entry: { projectKey: 'p1', sequencePath: 'a.xsq', status: 'ok' } }, { filePath });
  appendAgentLogEntry({ entry: { projectKey: 'p2', sequencePath: 'b.xsq', status: 'ok' } }, { filePath });
  appendAgentLogEntry({ entry: { projectKey: 'p1', sequencePath: 'c.xsq', status: 'warn' } }, { filePath });

  const filtered = readAgentLogEntries({ projectKey: 'p1', limit: 10 }, { filePath });
  assert.equal(filtered.ok, true);
  assert.equal(filtered.rows.length, 2);
  assert.equal(filtered.rows[0].sequencePath, 'c.xsq');
  assert.equal(filtered.rows[1].sequencePath, 'a.xsq');
});

test('readAgentLogEntries ignores malformed lines', () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'agent-log.jsonl');
  fs.writeFileSync(filePath, '{"ok":true}\nnot-json\n{"ok":false}\n', 'utf8');

  const result = readAgentLogEntries({}, { filePath });
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 2);
});
