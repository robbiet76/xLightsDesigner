import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

function classifyArea(file) {
  if (file.startsWith('apps/xlightsdesigner-ui/agent/')) return 'ui-agent';
  if (file.startsWith('apps/xlightsdesigner-ui/runtime/')) return 'ui-runtime';
  if (file.startsWith('apps/xlightsdesigner-ui/app-ui/')) return 'ui-app-ui';
  if (file.startsWith('apps/xlightsdesigner-ui/tests/')) return 'ui-tests';
  if (file.startsWith('apps/xlightsdesigner-ui/eval/archive/')) return 'ui-eval-archive';
  if (file.startsWith('apps/xlightsdesigner-ui/eval/')) return 'ui-eval';
  if (file === 'apps/xlightsdesigner-ui/app.js') return 'ui-shell';
  if (file.startsWith('apps/xlightsdesigner-ui/')) return 'ui-root';
  if (file.startsWith('apps/xlightsdesigner-desktop/tests/')) return 'desktop-tests';
  if (file.startsWith('apps/xlightsdesigner-desktop/')) return 'desktop';
  if (file.startsWith('apps/xlightsdesigner-analysis-service/eval/')) return 'analysis-eval';
  if (file.startsWith('apps/xlightsdesigner-analysis-service/')) return 'analysis-service';
  if (file.startsWith('scripts/sequencer-render-training/')) return 'scripts-render-training';
  if (file.startsWith('scripts/xlights-control/')) return 'scripts-xlights-control';
  if (file.startsWith('scripts/desktop/')) return 'scripts-desktop';
  if (file.startsWith('scripts/sequence-metadata/')) return 'scripts-sequence-metadata';
  if (file.startsWith('scripts/designer-training/')) return 'scripts-designer-training';
  if (file.startsWith('scripts/xlights/')) return 'scripts-xlights';
  if (file.startsWith('scripts/repo-audit/')) return 'scripts-repo-audit';
  if (file.startsWith('scripts/')) return 'scripts-other';
  if (file.startsWith('training-packages/')) return 'training-packages';
  if (file.startsWith('specs/archive/')) return 'specs-archive';
  if (file.startsWith('specs/')) return 'specs';
  if (file.startsWith('docs/architecture/')) return 'docs-architecture';
  if (file.startsWith('docs/operations/')) return 'docs-operations';
  if (file.startsWith('docs/')) return 'docs';
  if (file.startsWith('.github/')) return 'github';
  return 'root';
}

function classifyKind(file) {
  const ext = path.extname(file).toLowerCase();
  if (file.includes('/tests/')) return 'test';
  if (file.includes('/eval/')) return 'eval';
  if (file.includes('/archive/')) return 'archive';
  if (file.includes('/generated/')) return 'generated';
  if (file.startsWith('specs/')) return 'spec';
  if (file.startsWith('docs/')) return 'doc';
  if (file.startsWith('training-packages/')) return 'training-data';
  if (file.startsWith('scripts/')) return 'script';
  if (['.js', '.mjs', '.py'].includes(ext)) return 'source';
  if (ext === '.json') return 'data';
  if (ext === '.md') return 'doc';
  return 'other';
}

function classifyLifecycle(file) {
  if (file.startsWith('apps/xlightsdesigner-ui/eval/archive/') || file.startsWith('specs/archive/')) return 'archive';
  if (file.includes('/tests/')) return 'active-test';
  if (file.startsWith('apps/')) return 'active-runtime';
  if (file.startsWith('scripts/')) return 'active-script';
  if (file.startsWith('training-packages/')) return 'active-training-data';
  if (file.startsWith('specs/')) return 'reference-spec';
  if (file.startsWith('docs/')) return 'reference-doc';
  return 'active-other';
}

function recommendAction(file, area, kind, lifecycle) {
  if (lifecycle === 'archive') return 'keep-archived';
  if (area === 'ui-shell') return 'stabilize-and-trim';
  if (area === 'ui-eval') return 'consolidate-entrypoints';
  if (area === 'analysis-eval') return 'classify-keep-vs-archive';
  if (area === 'scripts-render-training') return 'group-by-pipeline-phase';
  if (area === 'scripts-repo-audit') return 'retain-audit-tooling';
  if (area === 'specs') return 'retain-active-spec';
  if (area === 'specs-archive') return 'keep-archived';
  if (area === 'training-packages') return 'retain-training-corpus';
  if (kind === 'test') return 'retain-test';
  if (kind === 'source') return 'retain-runtime';
  if (kind === 'script') return 'audit-entrypoint';
  return 'review';
}

const inventory = files.map((file) => {
  const area = classifyArea(file);
  const kind = classifyKind(file);
  const lifecycle = classifyLifecycle(file);
  return {
    path: file,
    area,
    kind,
    lifecycle,
    recommendedAction: recommendAction(file, area, kind, lifecycle)
  };
});

const counts = { byArea: {}, byKind: {}, byLifecycle: {}, byAction: {} };
for (const row of inventory) {
  counts.byArea[row.area] = (counts.byArea[row.area] || 0) + 1;
  counts.byKind[row.kind] = (counts.byKind[row.kind] || 0) + 1;
  counts.byLifecycle[row.lifecycle] = (counts.byLifecycle[row.lifecycle] || 0) + 1;
  counts.byAction[row.recommendedAction] = (counts.byAction[row.recommendedAction] || 0) + 1;
}

mkdirSync(path.join(root, 'var/repo-audit'), { recursive: true });
const jsonPath = path.join(root, 'var/repo-audit', 'tracked-file-inventory-2026-04-05.json');
writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), fileCount: inventory.length, counts, inventory }, null, 2));

console.log(JSON.stringify({ jsonPath, fileCount: inventory.length, counts }, null, 2));
