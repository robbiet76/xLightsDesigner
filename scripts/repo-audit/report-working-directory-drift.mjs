#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const targets = [
  'logs',
  'render-training',
  'sequence-validation',
  'sequence-validation-show',
  'var',
];

function walk(dir) {
  let fileCount = 0;
  let dirCount = 0;
  let bytes = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        dirCount += 1;
        stack.push(full);
      } else if (entry.isFile()) {
        fileCount += 1;
        try {
          bytes += fs.statSync(full).size;
        } catch {}
      }
    }
  }
  return { fileCount, dirCount, bytes };
}

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  directories: [],
};

for (const rel of targets) {
  const full = path.join(repoRoot, rel);
  if (!fs.existsSync(full)) continue;
  const stats = walk(full);
  const topLevel = fs.readdirSync(full, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => {
      const child = path.join(full, entry.name);
      const childStats = entry.isDirectory() ? walk(child) : { fileCount: 1, dirCount: 0, bytes: fs.statSync(child).size };
      return {
        name: entry.name,
        kind: entry.isDirectory() ? 'dir' : 'file',
        ...childStats,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  report.directories.push({ rel, ...stats, topLevel });
}

console.log(JSON.stringify(report, null, 2));
