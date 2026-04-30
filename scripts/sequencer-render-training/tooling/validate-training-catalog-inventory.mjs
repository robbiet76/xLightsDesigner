#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_INVENTORY = "scripts/sequencer-render-training/catalog/knowledge-inventory.v1.json";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walkFiles(root, base = root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, base));
    } else if (entry.isFile()) {
      files.push(path.relative(base, fullPath).split(path.sep).join("/"));
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function matchesRule(filePath, rule) {
  const match = rule?.match || {};
  const paths = Array.isArray(match.paths) ? match.paths : [];
  const prefixes = Array.isArray(match.prefixes) ? match.prefixes : [];
  return paths.includes(filePath) || prefixes.some((prefix) => filePath.startsWith(prefix));
}

export function validateCatalogInventory({ inventoryPath = DEFAULT_INVENTORY } = {}) {
  const resolvedInventory = path.resolve(inventoryPath);
  const inventory = readJson(resolvedInventory);
  const root = path.resolve(inventory.root || path.dirname(resolvedInventory));
  const rules = Array.isArray(inventory.rules) ? inventory.rules : [];
  const files = walkFiles(root);
  const unclassified = [];
  const duplicateClassifications = [];
  const invalidRules = [];

  for (const rule of rules) {
    if (!rule?.id || !rule?.lifecycle || !rule?.role) {
      invalidRules.push(rule?.id || "(missing id)");
    }
  }

  for (const filePath of files) {
    const matches = rules.filter((rule) => matchesRule(filePath, rule));
    if (!matches.length) unclassified.push(filePath);
    if (matches.length > 1) {
      duplicateClassifications.push({
        filePath,
        ruleIds: matches.map((rule) => rule.id)
      });
    }
  }

  return {
    ok: !unclassified.length && !duplicateClassifications.length && !invalidRules.length,
    root,
    fileCount: files.length,
    ruleCount: rules.length,
    unclassified,
    duplicateClassifications,
    invalidRules,
    lifecycleCounts: files.reduce((counts, filePath) => {
      const rule = rules.find((candidate) => matchesRule(filePath, candidate));
      const lifecycle = rule?.lifecycle || "unclassified";
      counts[lifecycle] = (counts[lifecycle] || 0) + 1;
      return counts;
    }, {})
  };
}

function parseArgs(argv) {
  const args = { inventoryPath: DEFAULT_INVENTORY };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--inventory") args.inventoryPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/validate-training-catalog-inventory.mjs [--inventory <inventory.json>]
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
    const result = validateCatalogInventory({ inventoryPath: args.inventoryPath });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exit(1);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}

