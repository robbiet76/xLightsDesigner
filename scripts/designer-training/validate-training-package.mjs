#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCombinedTargetContextTrainingFixture } from '../sequencer-render-training/tooling/validate-combined-target-context-training-fixture.mjs';
import { validateDisplayModelIndexTrainingFixture } from '../sequencer-render-training/tooling/validate-display-model-index-training-fixture.mjs';
import { validateTargetBehaviorTrainingFixture } from '../sequencer-render-training/tooling/validate-target-behavior-training-fixture.mjs';

const DEFAULT_PACKAGE_DIR = 'training-packages/training-package-v1';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = '') {
  return String(value || '').trim();
}

function packageRootFor(filePath) {
  const parts = path.normalize(filePath).split(path.sep);
  const index = parts.indexOf('training-packages');
  if (index < 0 || parts.length < index + 2) return '';
  return parts.slice(0, index + 2).join(path.sep);
}

function moduleRootFor(filePath) {
  const parts = path.normalize(filePath).split(path.sep);
  const index = parts.indexOf('modules');
  if (index < 0 || parts.length < index + 2) return '';
  return parts.slice(0, index + 2).join(path.sep);
}

function resolveReference(referencePath, fromFile) {
  const value = str(referencePath);
  if (!value) return null;
  const candidates = [];
  if (path.isAbsolute(value)) candidates.push(value);
  candidates.push(path.resolve(value));
  candidates.push(path.resolve(path.dirname(fromFile), value));
  const packageRoot = packageRootFor(fromFile);
  if (packageRoot) candidates.push(path.resolve(packageRoot, value));
  const moduleRoot = moduleRootFor(fromFile);
  if (moduleRoot) candidates.push(path.resolve(moduleRoot, value));
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function walkFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(filePath));
    else files.push(filePath);
  }
  return files.sort();
}

function collectPathReferences(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPathReferences(item, output));
  } else if (value && typeof value === 'object') {
    if (typeof value.path === 'string') output.push(value.path);
    if (Array.isArray(value.paths)) value.paths.forEach((entry) => output.push(entry));
    Object.values(value).forEach((item) => collectPathReferences(item, output));
  }
  return output;
}

function validateManifest(packageDir, errors) {
  const manifestPath = path.join(packageDir, 'manifest.json');
  const manifest = readJson(manifestPath);
  for (const module of arr(manifest.modules)) {
    const moduleManifestPath = resolveReference(module.path, manifestPath);
    if (!moduleManifestPath) {
      errors.push(`manifest module path not found: ${module.path}`);
      continue;
    }
    const moduleManifest = readJson(moduleManifestPath);
    if (str(moduleManifest.moduleId) !== str(module.id)) {
      errors.push(`module id mismatch for ${module.path}: expected ${module.id}, got ${moduleManifest.moduleId}`);
    }
    const moduleRoot = path.dirname(moduleManifestPath);
    for (const assetPaths of Object.values(moduleManifest.assets || {})) {
      for (const assetPath of arr(assetPaths)) {
        if (!fs.existsSync(path.resolve(moduleRoot, assetPath))) {
          errors.push(`module asset path not found: ${module.moduleId || module.id}: ${assetPath}`);
        }
      }
    }
  }
}

function validatePathReferences(packageDir, errors) {
  const files = walkFiles(packageDir).filter((filePath) => /\.(json|md)$/.test(filePath));
  let referenceCount = 0;
  for (const filePath of files) {
    if (!filePath.endsWith('.json')) continue;
    let document = null;
    try {
      document = readJson(filePath);
    } catch {
      errors.push(`invalid JSON: ${filePath}`);
      continue;
    }
    for (const referencePath of collectPathReferences(document)) {
      referenceCount += 1;
      if (!resolveReference(referencePath, filePath)) {
        errors.push(`referenced path not found from ${filePath}: ${referencePath}`);
      }
    }
  }
  return { files: files.length, referenceCount };
}

function validateFixture(result, errors) {
  if (result.ok !== true) {
    errors.push(...arr(result.errors).map((error) => `${result.fixturePath || result.contractPath}: ${error}`));
  }
  return result;
}

export function validateTrainingPackage({ packageDir = DEFAULT_PACKAGE_DIR } = {}) {
  const resolvedPackageDir = path.resolve(packageDir);
  const errors = [];
  if (!fs.existsSync(resolvedPackageDir)) {
    return { ok: false, packageDir: resolvedPackageDir, errors: [`package dir not found: ${resolvedPackageDir}`] };
  }

  validateManifest(resolvedPackageDir, errors);
  const references = validatePathReferences(resolvedPackageDir, errors);
  const fixtures = [
    validateFixture(validateDisplayModelIndexTrainingFixture(), errors),
    validateFixture(validateTargetBehaviorTrainingFixture(), errors),
    validateFixture(validateCombinedTargetContextTrainingFixture(), errors)
  ];

  return {
    ok: errors.length === 0,
    packageDir: resolvedPackageDir,
    checkedFiles: references.files,
    checkedPathReferences: references.referenceCount,
    fixtures: fixtures.map((fixture) => ({
      ok: fixture.ok,
      fixturePath: fixture.fixturePath,
      exampleCount: fixture.exampleCount,
      errors: fixture.errors
    })),
    errors
  };
}

function parseArgs(argv) {
  const args = { packageDir: DEFAULT_PACKAGE_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--package-dir') args.packageDir = argv[++index];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/validate-training-package.mjs [--package-dir training-packages/training-package-v1]
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = validateTrainingPackage(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exit(1);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
