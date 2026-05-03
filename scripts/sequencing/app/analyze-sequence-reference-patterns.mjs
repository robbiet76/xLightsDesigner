#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { finalizeArtifact } from '../../../apps/xlightsdesigner-ui/agent/shared/artifact-ids.js';
import { writeProjectArtifact } from '../../../apps/xlightsdesigner-ui/storage/project-artifact-store.mjs';

const DEFAULT_PROJECT_FILE = process.env.XLD_PROJECT_FILE || path.join(process.env.HOME || '', 'Documents', 'Lights', 'xLightsDesigner', 'projects', 'Christmas 2026', 'Christmas 2026.xdproj');
const DEFAULT_SOURCE_ROOT = process.env.XLIGHTS_SEQUENCE_SOURCE_ROOT || path.join(process.env.HOME || '', 'Documents', 'Lights', 'Current');

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function usage() {
  console.error('usage: analyze-sequence-reference-patterns.mjs [--project-file path] [--source-root path] [--max-files n] [--include-backups]');
  process.exit(2);
}

function parseArgs(argv = []) {
  const out = {
    projectFile: DEFAULT_PROJECT_FILE,
    sourceRoot: DEFAULT_SOURCE_ROOT,
    maxFiles: 120,
    includeBackups: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--project-file') out.projectFile = str(argv[++i]);
    else if (token === '--source-root') out.sourceRoot = str(argv[++i]);
    else if (token === '--max-files') out.maxFiles = Number(argv[++i]);
    else if (token === '--include-backups') out.includeBackups = true;
    else usage();
  }
  if (!Number.isFinite(out.maxFiles) || out.maxFiles <= 0) out.maxFiles = 120;
  return out;
}

function decodeXml(value = '') {
  return str(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function attrsOf(tag = '') {
  const out = {};
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
  let match = null;
  while ((match = re.exec(tag))) {
    out[match[1]] = decodeXml(match[2]);
  }
  return out;
}

function walkSequenceFiles(root = '', { includeBackups = false, maxFiles = 120 } = {}) {
  const out = [];
  const visit = (dir) => {
    if (out.length >= maxFiles) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (out.length >= maxFiles) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!includeBackups && /(^|[/\\])backup(s)?($|[/\\])/i.test(fullPath)) continue;
        visit(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xsq')) {
        out.push(fullPath);
      }
    }
  };
  visit(root);
  return out;
}

function inferTargetRole(targetId = '') {
  const text = str(targetId).toLowerCase();
  if (!text) return 'unknown';
  if (/allmodels|whole|frontprops|fronthouse/.test(text)) return 'full_display';
  if (/flood|wash|house|tree/.test(text)) return 'foundation';
  if (/snow|cane|present|wreath|spinner|spiral|star|sign|ornament|gumdrop|bulb/.test(text)) return 'accent';
  if (/gutter|border|eave|icicle|outline|garland/.test(text)) return 'outline';
  if (/matrix|text|train|snowman|pumpkin|face/.test(text)) return 'feature';
  return 'support';
}

function bucketFor(startMs = 0, durationMs = 0) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 'unknown';
  const ratio = Math.max(0, Math.min(0.9999, Number(startMs || 0) / durationMs));
  if (ratio < 0.18) return 'opening';
  if (ratio < 0.42) return 'early_body';
  if (ratio < 0.7) return 'middle';
  if (ratio < 0.9) return 'late_body';
  return 'ending';
}

function increment(map, key, by = 1) {
  const k = str(key) || 'unknown';
  map.set(k, (map.get(k) || 0) + by);
}

function topEntries(map, limit = 12) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function parseSequence(filePath = '') {
  const xml = fs.readFileSync(filePath, 'utf8');
  const headDuration = Number((xml.match(/<sequenceDuration>([^<]+)<\/sequenceDuration>/i) || [])[1]);
  const sequenceType = str((xml.match(/<sequenceType>([^<]+)<\/sequenceType>/i) || [])[1]);
  const mediaFile = decodeXml((xml.match(/<mediaFile>([^<]*)<\/mediaFile>/i) || [])[1]);
  const effects = [];
  const elementRe = /<Element\b([^>]*)>([\s\S]*?)<\/Element>/g;
  let elementMatch = null;
  while ((elementMatch = elementRe.exec(xml))) {
    const elementAttrs = attrsOf(elementMatch[1]);
    if (str(elementAttrs.type) !== 'model') continue;
    const targetId = str(elementAttrs.name);
    if (!targetId) continue;
    const body = elementMatch[2] || '';
    const layerRe = /<EffectLayer\b[^>]*>([\s\S]*?)<\/EffectLayer>/g;
    let layerIndex = -1;
    let layerMatch = null;
    while ((layerMatch = layerRe.exec(body))) {
      layerIndex += 1;
      const layerBody = layerMatch[1] || '';
      const effectRe = /<Effect\b([^/>]*?)(?:\/>|>[\s\S]*?<\/Effect>)/g;
      let effectMatch = null;
      while ((effectMatch = effectRe.exec(layerBody))) {
        const effectAttrs = attrsOf(effectMatch[1]);
        const effectName = str(effectAttrs.name);
        const startMs = Number(effectAttrs.startTime);
        const endMs = Number(effectAttrs.endTime);
        if (!effectName || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
        effects.push({
          targetId,
          targetRole: inferTargetRole(targetId),
          layerIndex,
          effectName,
          startMs,
          endMs,
          durationMs: endMs - startMs
        });
      }
    }
  }
  const maxEndMs = effects.reduce((max, effect) => Math.max(max, effect.endMs), 0);
  const durationMs = Number.isFinite(headDuration) && headDuration > 0
    ? Math.max(maxEndMs, Math.round(headDuration * 1000))
    : maxEndMs;
  return {
    filePath,
    relativeName: path.basename(filePath),
    sequenceType,
    mediaFile,
    durationMs,
    effects
  };
}

function summarizeSequence(parsed = {}) {
  const effects = arr(parsed.effects);
  const effectCounts = new Map();
  const roleCounts = new Map();
  const bucketCounts = new Map();
  const bucketEffectCounts = new Map();
  const targetLayers = new Map();
  for (const effect of effects) {
    increment(effectCounts, effect.effectName);
    increment(roleCounts, effect.targetRole);
    const bucket = bucketFor(effect.startMs, parsed.durationMs);
    increment(bucketCounts, bucket);
    const bucketMap = bucketEffectCounts.get(bucket) || new Map();
    increment(bucketMap, effect.effectName);
    bucketEffectCounts.set(bucket, bucketMap);
    const layers = targetLayers.get(effect.targetId) || new Set();
    layers.add(effect.layerIndex);
    targetLayers.set(effect.targetId, layers);
  }
  const activeTargets = new Set(effects.map((effect) => effect.targetId));
  const layeredTargets = Array.from(targetLayers.values()).filter((layers) => layers.size > 1).length;
  const durationMinutes = parsed.durationMs > 0 ? parsed.durationMs / 60000 : 0;
  return {
    path: parsed.filePath,
    name: parsed.relativeName,
    sequenceType: parsed.sequenceType,
    hasMedia: Boolean(str(parsed.mediaFile)),
    durationMs: parsed.durationMs,
    effectCount: effects.length,
    activeTargetCount: activeTargets.size,
    layeredTargetCount: layeredTargets,
    effectDensityPerMinute: durationMinutes > 0 ? Number((effects.length / durationMinutes).toFixed(2)) : 0,
    topEffects: topEntries(effectCounts, 10),
    targetRoleMix: topEntries(roleCounts, 8),
    timeBucketMix: topEntries(bucketCounts, 8),
    bucketEffectPatterns: Object.fromEntries(
      Array.from(bucketEffectCounts.entries()).map(([bucket, counts]) => [bucket, topEntries(counts, 6)])
    )
  };
}

function aggregateSummaries(sequenceSummaries = []) {
  const effectCounts = new Map();
  const roleCounts = new Map();
  const bucketCounts = new Map();
  const bucketEffectCounts = new Map();
  const densities = [];
  let totalEffects = 0;
  let totalActiveTargets = 0;
  let totalLayeredTargets = 0;
  for (const summary of sequenceSummaries) {
    totalEffects += Number(summary.effectCount || 0);
    totalActiveTargets += Number(summary.activeTargetCount || 0);
    totalLayeredTargets += Number(summary.layeredTargetCount || 0);
    if (Number(summary.effectDensityPerMinute) > 0) densities.push(Number(summary.effectDensityPerMinute));
    for (const row of arr(summary.topEffects)) increment(effectCounts, row.name, row.count);
    for (const row of arr(summary.targetRoleMix)) increment(roleCounts, row.name, row.count);
    for (const row of arr(summary.timeBucketMix)) increment(bucketCounts, row.name, row.count);
    for (const [bucket, rows] of Object.entries(summary.bucketEffectPatterns || {})) {
      const bucketMap = bucketEffectCounts.get(bucket) || new Map();
      for (const row of arr(rows)) increment(bucketMap, row.name, row.count);
      bucketEffectCounts.set(bucket, bucketMap);
    }
  }
  const sortedDensities = densities.sort((a, b) => a - b);
  const percentile = (p) => {
    if (!sortedDensities.length) return 0;
    const idx = Math.min(sortedDensities.length - 1, Math.max(0, Math.round((sortedDensities.length - 1) * p)));
    return Number(sortedDensities[idx].toFixed(2));
  };
  return {
    sequenceCount: sequenceSummaries.length,
    totalEffects,
    averageEffectsPerSequence: sequenceSummaries.length ? Number((totalEffects / sequenceSummaries.length).toFixed(2)) : 0,
    averageActiveTargets: sequenceSummaries.length ? Number((totalActiveTargets / sequenceSummaries.length).toFixed(2)) : 0,
    averageLayeredTargets: sequenceSummaries.length ? Number((totalLayeredTargets / sequenceSummaries.length).toFixed(2)) : 0,
    densityPerMinute: {
      p25: percentile(0.25),
      median: percentile(0.5),
      p75: percentile(0.75)
    },
    commonEffects: topEntries(effectCounts, 20),
    targetRoleMix: topEntries(roleCounts, 10),
    timeBucketMix: topEntries(bucketCounts, 8),
    bucketEffectPatterns: Object.fromEntries(
      Array.from(bucketEffectCounts.entries()).map(([bucket, counts]) => [bucket, topEntries(counts, 10)])
    )
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.projectFile)) throw new Error(`Project file not found: ${args.projectFile}`);
  if (!fs.existsSync(args.sourceRoot)) throw new Error(`Reference source root not found: ${args.sourceRoot}`);
  const files = walkSequenceFiles(args.sourceRoot, args);
  const parsed = [];
  const skipped = [];
  for (const filePath of files) {
    try {
      const sequence = parseSequence(filePath);
      if (!sequence.effects.length) {
        skipped.push({ path: filePath, reason: 'no_effects' });
        continue;
      }
      parsed.push(sequence);
    } catch (error) {
      skipped.push({ path: filePath, reason: str(error?.message || error) });
    }
  }
  const sequenceSummaries = parsed.map(summarizeSequence);
  const artifact = finalizeArtifact({
    artifactType: 'sequence_reference_patterns_v1',
    artifactVersion: '1.0',
    source: {
      mode: 'read_only_reference_patterns',
      sourceRoot: args.sourceRoot,
      includeBackups: args.includeBackups,
      scannedFileCount: files.length,
      analyzedSequenceCount: sequenceSummaries.length,
      skippedCount: skipped.length
    },
    privacy: {
      trainingUse: false,
      storesFullSequencePayloads: false,
      storesGeneralizedPatternSummaries: true,
      note: 'Reference sequences are read only. This artifact stores aggregate sequencing patterns and compact per-sequence summaries, not copied effect payloads.'
    },
    aggregate: aggregateSummaries(sequenceSummaries),
    sequenceSummaries: sequenceSummaries.slice(0, args.maxFiles),
    skipped: skipped.slice(0, 50)
  });
  const writeResult = writeProjectArtifact({
    projectFilePath: args.projectFile,
    artifact
  });
  if (!writeResult.ok) throw new Error(writeResult.error || 'Failed to write reference pattern artifact.');
  process.stdout.write(`${JSON.stringify({
    ok: true,
    artifactId: artifact.artifactId,
    artifactPath: writeResult.artifactPath,
    sourceRoot: args.sourceRoot,
    analyzedSequenceCount: sequenceSummaries.length,
    skippedCount: skipped.length,
    aggregate: artifact.aggregate
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
