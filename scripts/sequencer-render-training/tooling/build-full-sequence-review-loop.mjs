#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePath(filePath = "") {
  const value = str(filePath);
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath = "") {
  const resolved = resolvePath(filePath);
  if (!resolved || !fs.existsSync(resolved)) return null;
  return readJson(resolved);
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function passDirFromQualityRef(ref = "") {
  const resolved = resolvePath(ref);
  if (!resolved) return "";
  const marker = `${path.sep}render-review-quality${path.sep}`;
  const index = resolved.indexOf(marker);
  if (index < 0) return "";
  return resolved.slice(0, index);
}

function unique(values = []) {
  return [...new Set(arr(values).map(str).filter(Boolean))];
}

function average(values = []) {
  const rows = arr(values).map((value) => num(value, NaN)).filter(Number.isFinite);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : 0;
}

function round6(value) {
  return Math.round(num(value) * 1_000_000) / 1_000_000;
}

function timingSourcesFromReview(review = {}) {
  const sources = new Set();
  const section = review.section || {};
  const musicRole = review.intent?.musicRole || {};
  const timingContext = musicRole.timingContext || review.intent?.timingContext || {};
  if (Number.isFinite(num(section.startMs, NaN)) && Number.isFinite(num(section.endMs, NaN))) sources.add("section");
  if (musicRole.phrase || timingContext.phrase || timingContext.phraseId) sources.add("phrase");
  if (musicRole.beat || timingContext.beat || timingContext.beatGrid || timingContext.beatId) sources.add("beat");
  if (musicRole.lyric || musicRole.lyrics || timingContext.lyric || timingContext.lyrics || timingContext.lyricTrack) sources.add("lyric");
  if (musicRole.accent || timingContext.accent || timingContext.accentId || timingContext.accentType) sources.add("accent");
  return [...sources];
}

function qualityDimensionsFromProgression(progression = {}) {
  const dimensions = new Set();
  if (progression.energyArc) dimensions.add("energy_progression");
  if (progression.handoff) dimensions.add("timing_alignment");
  if (progression.repetition || progression.development) dimensions.add("repetition_with_variation");
  return [...dimensions];
}

function loadWindowRows(runRoot = "") {
  const root = resolvePath(runRoot);
  const summary = readJsonIfExists(path.join(root, "pass-runner-summary.json")) || {};
  return arr(summary.results)
    .map((result) => {
      const qualityRef = str(result.renderReviewQualityRef);
      const quality = readJsonIfExists(qualityRef) || {};
      const review = readJsonIfExists(quality.renderReviewRef || result.renderReviewRef) || {};
      const passDir = passDirFromQualityRef(qualityRef);
      const observationRef = path.join(passDir, "render-observation.json");
      return {
        experimentId: str(result.experimentId || quality.experimentId),
        passId: str(result.passId || quality.passId),
        status: str(result.status),
        decision: str(result.renderReviewDecision || quality.decision),
        evidenceEligible: Boolean(result.renderReviewEvidenceEligible || quality.evidenceEligible),
        measurementStatus: str(result.renderReviewMeasurementStatus || quality.measurementStatus),
        overallQuality: num(result.renderReviewOverallQuality ?? quality.overallQuality),
        startMs: num(quality.passWindow?.startMs ?? review.section?.startMs),
        endMs: num(quality.passWindow?.endMs ?? review.section?.endMs),
        renderObservationRef: fs.existsSync(observationRef) ? observationRef : "",
        renderReviewRef: str(quality.renderReviewRef || result.renderReviewRef),
        renderReviewQualityRef: qualityRef,
        timingSources: timingSourcesFromReview(review)
      };
    })
    .filter((row) => row.renderObservationRef && row.status === "completed")
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.passId.localeCompare(right.passId));
}

function buildProgression({ rows = [], outDir = "", execFile = execFileSync } = {}) {
  if (rows.length < 2) return null;
  const progressionPath = path.join(outDir, "full-sequence-progression-observation.json");
  const args = [
    "scripts/sequencer-render-training/tooling/extract-progression-observation.py",
    ...rows.flatMap((row) => ["--observation", row.renderObservationRef]),
    "--out",
    progressionPath
  ];
  execFile("python3", args, { cwd: REPO_ROOT, stdio: "pipe" });
  return readJson(progressionPath);
}

export function buildFullSequenceReviewLoop({
  runRoot = "",
  outPath = "",
  execFile = execFileSync
} = {}) {
  const root = resolvePath(runRoot);
  if (!root || !fs.existsSync(root)) throw new Error(`runRoot not found: ${root || "(missing)"}`);
  const resolvedOutPath = resolvePath(outPath || path.join(root, "full-sequence-review-loop.json"));
  const outDir = path.dirname(resolvedOutPath);
  fs.mkdirSync(outDir, { recursive: true });
  const rows = loadWindowRows(root);
  const progression = buildProgression({ rows, outDir, execFile });
  const timingSources = unique(rows.flatMap((row) => row.timingSources));
  const qualityDimensions = progression ? qualityDimensionsFromProgression(progression) : [];
  const eligibleRows = rows.filter((row) => row.evidenceEligible);
  const artifact = {
    artifactType: "full_sequence_review_loop_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runRoot: root,
    status: rows.length >= 2 && progression ? "ready" : "insufficient_windows",
    windowCount: rows.length,
    evidenceEligibleWindowCount: eligibleRows.length,
    meanEligibleQuality: round6(average(eligibleRows.map((row) => row.overallQuality))),
    timingSources,
    qualityDimensions,
    progressionObservationRef: progression ? path.join(outDir, "full-sequence-progression-observation.json") : "",
    progressionSummary: progression ? {
      scopeLevel: str(progression.scope?.scopeLevel),
      windowCount: num(progression.scope?.windowCount),
      handoffClarity: str(progression.handoff?.handoffClarity),
      developmentStrength: str(progression.development?.developmentStrength),
      stagnationRisk: str(progression.development?.stagnationRisk),
      repetitionStalenessRisk: str(progression.repetition?.stalenessRisk),
      energyArcCoherence: str(progression.energyArc?.arcCoherence)
    } : null,
    windows: rows.map((row) => ({
      experimentId: row.experimentId,
      passId: row.passId,
      startMs: row.startMs,
      endMs: row.endMs,
      decision: row.decision,
      evidenceEligible: row.evidenceEligible,
      measurementStatus: row.measurementStatus,
      overallQuality: round6(row.overallQuality),
      timingSources: row.timingSources,
      renderObservationRef: row.renderObservationRef,
      renderReviewRef: row.renderReviewRef,
      renderReviewQualityRef: row.renderReviewQualityRef
    }))
  };
  writeJson(resolvedOutPath, artifact);
  return artifact;
}

function parseArgs(argv = []) {
  const args = { runRoot: "", outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--run-root") args.runRoot = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/build-full-sequence-review-loop.mjs --run-root <completed-run-root> [--out full-sequence-review-loop.json]
`;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.runRoot) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    const artifact = buildFullSequenceReviewLoop(args);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      out: resolvePath(args.outPath || path.join(args.runRoot, "full-sequence-review-loop.json")),
      status: artifact.status,
      windowCount: artifact.windowCount
    }, null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
