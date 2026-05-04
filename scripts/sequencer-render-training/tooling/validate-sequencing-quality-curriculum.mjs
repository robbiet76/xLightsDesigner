#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_CURRICULUM = "scripts/sequencer-render-training/catalog/sequencing-quality-curriculum-v1.json";
const VALID_STATUSES = new Set(["not_started", "in_progress", "blocked", "covered", "retired"]);

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value = "") {
  return String(value || "").trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolvePath(value = "") {
  const normalized = str(value);
  return path.isAbsolute(normalized) ? normalized : path.resolve(REPO_ROOT, normalized);
}

export function validateSequencingQualityCurriculum(curriculum = {}) {
  const errors = [];
  if (curriculum.artifactType !== "sequencing_quality_curriculum_v1") {
    errors.push("artifactType must be sequencing_quality_curriculum_v1");
  }
  if (str(curriculum.curriculumId) !== "sequencing-quality-v1") {
    errors.push("curriculumId must be sequencing-quality-v1");
  }
  const areas = arr(curriculum.areas);
  const goals = arr(curriculum.goals);
  if (!areas.length) errors.push("areas must not be empty");
  if (!goals.length) errors.push("goals must not be empty");
  const areaIds = new Set();
  for (const area of areas) {
    const areaId = str(area.areaId);
    if (!areaId) errors.push("area.areaId is required");
    if (areaIds.has(areaId)) errors.push(`duplicate areaId: ${areaId}`);
    areaIds.add(areaId);
    if (!Number.isFinite(Number(area.priority))) errors.push(`area ${areaId} priority must be numeric`);
  }
  const goalIds = new Set();
  for (const goal of goals) {
    const goalId = str(goal.goalId);
    if (!goalId) errors.push("goal.goalId is required");
    if (goalIds.has(goalId)) errors.push(`duplicate goalId: ${goalId}`);
    goalIds.add(goalId);
    if (!areaIds.has(str(goal.areaId))) errors.push(`goal ${goalId} references unknown areaId: ${str(goal.areaId)}`);
    if (!VALID_STATUSES.has(str(goal.status))) errors.push(`goal ${goalId} has invalid status: ${str(goal.status)}`);
    if (!Number.isFinite(Number(goal.priority))) errors.push(`goal ${goalId} priority must be numeric`);
    if (!Number.isFinite(Number(goal.requiredStableSamples)) || Number(goal.requiredStableSamples) < 1) {
      errors.push(`goal ${goalId} requiredStableSamples must be >= 1`);
    }
    if (!goal.coverage || typeof goal.coverage !== "object") errors.push(`goal ${goalId} coverage is required`);
  }
  const promotion = curriculum.selectionPolicy?.promotionRequires || {};
  if (!Number.isFinite(Number(promotion.minimumStableSamples)) || Number(promotion.minimumStableSamples) < 1) {
    errors.push("selectionPolicy.promotionRequires.minimumStableSamples must be >= 1");
  }
  if (!Number.isFinite(Number(promotion.minimumOverallQuality)) || Number(promotion.minimumOverallQuality) <= 0) {
    errors.push("selectionPolicy.promotionRequires.minimumOverallQuality must be > 0");
  }
  if (!arr(promotion.acceptedTrendStatuses).includes("stable")) {
    errors.push("selectionPolicy.promotionRequires.acceptedTrendStatuses must include stable");
  }
  if (curriculum.selectionPolicy?.cleanupRequiredAfterEveryLoop !== true) {
    errors.push("selectionPolicy.cleanupRequiredAfterEveryLoop must be true");
  }
  const statusCounts = Object.fromEntries([...VALID_STATUSES].map((status) => [status, 0]));
  for (const goal of goals) statusCounts[str(goal.status)] = (statusCounts[str(goal.status)] || 0) + 1;
  return {
    ok: errors.length === 0,
    errors,
    summary: {
      curriculumId: str(curriculum.curriculumId),
      areaCount: areas.length,
      goalCount: goals.length,
      statusCounts,
      activeGoalIds: goals
        .filter((goal) => ["not_started", "in_progress", "blocked"].includes(str(goal.status)))
        .sort((a, b) => Number(a.priority) - Number(b.priority) || str(a.goalId).localeCompare(str(b.goalId)))
        .map((goal) => str(goal.goalId))
    }
  };
}

function parseArgs(argv = []) {
  const args = { curriculumPath: DEFAULT_CURRICULUM };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--curriculum") args.curriculumPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/validate-sequencing-quality-curriculum.mjs [--curriculum path]
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const result = validateSequencingQualityCurriculum(readJson(resolvePath(args.curriculumPath)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(1);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
