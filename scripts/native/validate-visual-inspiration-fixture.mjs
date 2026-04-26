#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE_URL = process.env.XLD_NATIVE_AUTOMATION_URL || 'http://127.0.0.1:49916';

function str(value = '') {
  return String(value || '').trim();
}

function usage() {
  console.error('usage: validate-visual-inspiration-fixture.mjs [--native-url url] [--project-file path] [--timeout-ms n]');
  process.exit(2);
}

function parseArgs(argv = []) {
  const out = {
    nativeUrl: BASE_URL,
    projectFile: '',
    timeoutMs: 30000
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    if (token === '--native-url') out.nativeUrl = str(argv[++index]);
    else if (token === '--project-file') out.projectFile = str(argv[++index]);
    else if (token === '--timeout-ms') out.timeoutMs = Number(argv[++index]);
    else usage();
  }
  if (!Number.isFinite(out.timeoutMs) || out.timeoutMs < 1000) out.timeoutMs = 30000;
  return out;
}

async function request(baseUrl, method, route, body = null) {
  const init = { method, headers: {} };
  if (body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${route}`, init);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { ok: false, error: text };
  }
  if (!response.ok || parsed?.ok === false) {
    throw new Error(`${method} ${route} failed (${response.status}): ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function waitForNative(baseUrl, timeoutMs) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      last = await request(baseUrl, 'GET', '/health');
      if (last?.ok === true) return last;
    } catch (error) {
      last = { error: error.message };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for native automation. Last response: ${JSON.stringify(last)}`);
}

function ensureDir(dirPath = '') {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFixturePng(filePath = '') {
  // 1x1 transparent PNG. The UI only needs a readable local image fixture.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3Q6wAAAABJRU5ErkJggg==',
    'base64'
  );
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, png);
}

function createFixtureProject(projectFile = '') {
  const root = projectFile
    ? path.dirname(path.dirname(path.resolve(projectFile)))
    : fs.mkdtempSync(path.join(os.tmpdir(), 'xld-visual-fixture-'));
  const projectName = projectFile
    ? path.basename(projectFile, '.xdproj')
    : 'Visual Inspiration Fixture';
  const projectDir = projectFile
    ? path.dirname(path.resolve(projectFile))
    : path.join(root, 'projects', projectName);
  const projectPath = projectFile
    ? path.resolve(projectFile)
    : path.join(projectDir, `${projectName}.xdproj`);
  ensureDir(projectDir);
  const projectDoc = {
    version: 1,
    projectName,
    showFolder: '/tmp/xld-visual-fixture-show',
    mediaPath: '',
    key: `${projectName}::/tmp/xld-visual-fixture-show`,
    id: 'visual-inspiration-fixture',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    snapshot: {
      projectName,
      projectFilePath: projectPath,
      mediaPath: ''
    }
  };
  fs.writeFileSync(projectPath, JSON.stringify(projectDoc, null, 2), 'utf8');

  const visualDir = path.join(projectDir, 'artifacts', 'visual-design', 'visual-fixture-sequence');
  const boardPath = path.join(visualDir, 'inspiration-board.png');
  const revisedPath = path.join(visualDir, 'revisions', 'board-r002.png');
  writeFixturePng(boardPath);
  writeFixturePng(revisedPath);
  const manifest = {
    artifactType: 'visual_design_asset_pack_v1',
    artifactVersion: 1,
    artifactId: 'visual-design-asset-pack-fixture',
    createdAt: new Date().toISOString(),
    sequenceId: 'visual-fixture-sequence',
    trackIdentity: {
      title: 'Visual Fixture',
      artist: 'xLightsDesigner',
      contentFingerprint: 'fixture'
    },
    creativeIntent: {
      themeSummary: 'Original generated warm holiday collage with candle gold and pine green.',
      inspirationPrompt: 'Generated original warm holiday collage. Do not use internet-searched imagery.',
      palette: [
        { name: 'candle gold', hex: '#ffc45c', role: 'warm highlight' },
        { name: 'pine green', hex: '#1f6f4a', role: 'support' }
      ],
      motifs: ['window glow', 'soft garland'],
      avoidances: ['do not depict the literal xLights layout']
    },
    palette: {
      required: true,
      displayMode: 'separate_and_optional_in_image',
      coordinationRule: 'Image colors must reflect or coordinate with the approved palette.',
      colors: [
        { name: 'candle gold', hex: '#ffc45c', role: 'warm highlight' },
        { name: 'pine green', hex: '#1f6f4a', role: 'support' }
      ]
    },
    displayAsset: {
      kind: 'inspiration_board',
      relativePath: 'revisions/board-r002.png',
      mimeType: 'image/png',
      width: 1536,
      height: 1024,
      currentRevisionId: 'board-r002'
    },
    imageRevisions: [
      {
        revisionId: 'board-r001',
        parentRevisionId: '',
        mode: 'generate',
        relativePath: 'inspiration-board.png',
        promptRef: 'prompt-001',
        userRequest: '',
        changeSummary: 'Initial generated inspiration board.',
        paletteLocked: true,
        paletteChangeSummary: ''
      },
      {
        revisionId: 'board-r002',
        parentRevisionId: 'board-r001',
        mode: 'edit',
        relativePath: 'revisions/board-r002.png',
        promptRef: 'prompt-002',
        userRequest: 'Make the board softer while keeping palette coordination.',
        changeSummary: 'Softened the glow and preserved palette coordination.',
        paletteLocked: true,
        paletteChangeSummary: ''
      }
    ],
    sequenceAssets: [],
    prompts: [
      {
        promptId: 'prompt-001',
        model: 'gpt-image-2',
        purpose: 'inspiration_board',
        operation: 'generate',
        inputRevisionId: '',
        prompt: 'Generate an original warm holiday collage with candle gold and pine green.'
      },
      {
        promptId: 'prompt-002',
        model: 'gpt-image-2',
        purpose: 'inspiration_board_revision',
        operation: 'edit',
        inputRevisionId: 'board-r001',
        prompt: 'Edit the existing image to make the glow softer while preserving palette coordination.'
      }
    ],
    handoff: {
      sequencerUse: 'optional',
      requiresMediaEffects: true,
      artifactRefs: []
    }
  };
  fs.writeFileSync(path.join(visualDir, 'visual-design-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return { projectPath, projectDir, visualDir, boardPath: revisedPath };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixture = createFixtureProject(args.projectFile);
  await waitForNative(args.nativeUrl, args.timeoutMs);
  await request(args.nativeUrl, 'POST', '/action', { action: 'openProject', filePath: fixture.projectPath });
  await request(args.nativeUrl, 'POST', '/action', { action: 'selectWorkflow', workflow: 'design' });
  await request(args.nativeUrl, 'POST', '/action', { action: 'refreshCurrentWorkflow' });
  const snapshot = await request(args.nativeUrl, 'GET', '/snapshot');
  const visual = snapshot?.pages?.design?.visualInspiration || {};
  if (!snapshot?.pages?.design || !('visualInspiration' in snapshot.pages.design)) {
    throw new Error(
      'Native Design snapshot does not include visualInspiration. Relaunch the current xLightsDesigner native build before running this validation.'
    );
  }
  assertEqual(visual.available, true, 'visualInspiration.available');
  assertEqual(visual.currentRevisionId, 'board-r002', 'visualInspiration.currentRevisionId');
  assertEqual(visual.palette?.length, 2, 'visualInspiration.palette length');
  assertEqual(visual.palette?.[0]?.hex, '#ffc45c', 'first palette hex');
  if (!str(visual.imagePath).endsWith('revisions/board-r002.png')) {
    throw new Error(`visualInspiration.imagePath did not point to revised board: ${visual.imagePath}`);
  }
  if (!str(visual.revisionSummary).includes('Palette preserved')) {
    throw new Error(`visualInspiration.revisionSummary did not capture palette preservation: ${visual.revisionSummary}`);
  }
  if (!str(visual.paletteCoordinationRule).includes('approved palette')) {
    throw new Error(`visualInspiration.paletteCoordinationRule missing expected text: ${visual.paletteCoordinationRule}`);
  }
  console.log(JSON.stringify({
    ok: true,
    projectFile: fixture.projectPath,
    visualDir: fixture.visualDir,
    currentRevisionId: visual.currentRevisionId,
    imagePath: visual.imagePath,
    palette: visual.palette,
    revisionSummary: visual.revisionSummary
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
