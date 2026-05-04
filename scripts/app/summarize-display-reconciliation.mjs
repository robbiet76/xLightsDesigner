#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

function usage() {
  console.error('usage: summarize-display-reconciliation.mjs <project-dir-or-reconciliation-json>');
  process.exit(2);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function resolveInput(input) {
  const resolved = path.resolve(input);
  return resolved.endsWith('.json')
    ? resolved
    : path.join(resolved, 'display', 'reconciliation.json');
}

function listBy(records, predicate) {
  return records
    .filter(predicate)
    .map((record) => ({
      targetId: record.targetId || '',
      status: record.status || '',
      matchedBy: record.matchedBy || '',
      confidence: record.confidence || '',
      currentTargetId: record.currentTargetId || '',
      candidateTargetIds: Array.isArray(record.candidateTargetIds) ? record.candidateTargetIds : [],
      previousFingerprint: record.previousFingerprint || ''
    }));
}

const input = process.argv[2];
if (!input) usage();

const filePath = resolveInput(input);
const artifact = readJson(filePath);
const records = Array.isArray(artifact.records) ? artifact.records : [];

const result = {
  artifactPath: filePath,
  artifactType: artifact.artifactType || '',
  createdAt: artifact.createdAt || '',
  source: artifact.source || {},
  summary: artifact.summary || {},
  active: listBy(records, (record) => record.status === 'active'),
  fingerprintMatches: listBy(records, (record) => record.matchedBy === 'fingerprint'),
  needsReview: listBy(records, (record) => record.needsReview === true || record.status === 'needs-review'),
  retainedOrphaned: listBy(records, (record) => record.status === 'retained-orphaned')
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
