import fs from "node:fs";
import path from "node:path";

import {
  buildTimingTrackProvenanceRecord,
  normalizeTimingTrackCoverage,
  refreshTimingTrackProvenanceRecord
} from "../runtime/timing-track-provenance.js";
import {
  buildTimingTrackStatusRows,
  reconcileTimingTrackReviewState,
  summarizeTimingTrackStatuses
} from "../runtime/timing-track-status.js";

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildPolicyKey(trackName = "") {
  return `__xd_global__::${str(trackName).toLowerCase()}`;
}

function isCompleteCoverage(marks = [], durationMs = 0) {
  const rows = arr(marks);
  if (!rows.length) return false;
  if (num(rows[0]?.startMs) !== 0) return false;
  if (num(rows[rows.length - 1]?.endMs) !== num(durationMs)) return false;
  for (let idx = 1; idx < rows.length; idx += 1) {
    if (num(rows[idx - 1]?.endMs) !== num(rows[idx]?.startMs)) return false;
    if (num(rows[idx]?.endMs) <= num(rows[idx]?.startMs)) return false;
  }
  return true;
}

function phraseMarksStayWithinStructure(phraseMarks = [], structureMarks = []) {
  const phrases = arr(phraseMarks).filter((row) => str(row?.label));
  const sections = arr(structureMarks);
  return phrases.every((phrase) => sections.some((section) =>
    num(phrase?.startMs) >= num(section?.startMs) &&
    num(phrase?.endMs) <= num(section?.endMs)
  ));
}

function summarizeScenario(scenario = {}) {
  const tracks = arr(scenario?.timingTracks);
  const provenance = {};
  const signatures = {};
  const policies = {};

  let structureMarks = [];
  let phraseMarks = [];

  for (const track of tracks) {
    const trackName = str(track?.trackName);
    const durationMs = num(track?.durationMs, 0);
    const coverageMode = str(track?.coverageMode || "complete");
    const sourceMarks = arr(track?.sourceMarks);
    const userFinalMarks = arr(track?.userFinalMarks).length ? arr(track.userFinalMarks) : sourceMarks;
    const policyKey = buildPolicyKey(trackName);
    const record = buildTimingTrackProvenanceRecord({
      trackType: str(track?.trackType || "timing"),
      trackName,
      sourceMarks,
      userFinalMarks,
      coverageMode,
      durationMs,
      fillerLabel: ""
    });
    provenance[policyKey] = record;
    policies[policyKey] = {
      trackName,
      sourceTrack: trackName,
      manual: false
    };
    signatures[policyKey] = record.source.marks
      .map((row) => `${num(row?.startMs)}:${num(row?.endMs)}:${str(row?.label)}`)
      .join("|");
    if (trackName === "XD: Song Structure") structureMarks = record.source.marks;
    if (trackName === "XD: Phrase Cues") phraseMarks = record.source.marks;
  }

  const rowsBefore = buildTimingTrackStatusRows({
    timingTrackProvenance: provenance,
    timingGeneratedSignatures: signatures,
    timingTrackPolicies: policies
  });
  const summaryBefore = summarizeTimingTrackStatuses(rowsBefore);

  let reconciledProvenance = provenance;
  let reconciledSignatures = signatures;
  for (const row of rowsBefore) {
    if (!row.canReconcile) continue;
    const result = reconcileTimingTrackReviewState({
      policyKey: row.policyKey,
      timingTrackProvenance: reconciledProvenance,
      timingGeneratedSignatures: reconciledSignatures,
      acceptedAt: "2026-04-02T23:59:00Z",
      reviewer: "control-suite"
    });
    reconciledProvenance = result.timingTrackProvenance;
    reconciledSignatures = result.timingGeneratedSignatures;
  }
  const rowsAfter = buildTimingTrackStatusRows({
    timingTrackProvenance: reconciledProvenance,
    timingGeneratedSignatures: reconciledSignatures,
    timingTrackPolicies: policies
  });
  const summaryAfter = summarizeTimingTrackStatuses(rowsAfter);

  const structureTrack = tracks.find((row) => str(row?.trackName) === "XD: Song Structure") || null;
  const phraseTrack = tracks.find((row) => str(row?.trackName) === "XD: Phrase Cues") || null;
  const structureCoverageOk = structureTrack
    ? isCompleteCoverage(normalizeTimingTrackCoverage(arr(structureTrack.sourceMarks), { durationMs: num(structureTrack.durationMs), fillerLabel: "" }), num(structureTrack.durationMs))
    : false;
  const phraseCoverageOk = phraseTrack
    ? isCompleteCoverage(normalizeTimingTrackCoverage(arr(phraseTrack.sourceMarks), { durationMs: num(phraseTrack.durationMs), fillerLabel: "" }), num(phraseTrack.durationMs))
    : true;
  const phraseBoundaryOk = phraseTrack ? phraseMarksStayWithinStructure(phraseMarks, structureMarks) : true;
  const editedTrackCount = rowsBefore.filter((row) => row.status === "user_edited" || row.status === "stale").length;

  return {
    name: str(scenario?.name),
    trackClass: str(scenario?.trackClass),
    trackTitle: str(scenario?.trackTitle),
    ok: structureCoverageOk && phraseCoverageOk && phraseBoundaryOk && summaryAfter.needsReview === false,
    structureCoverageOk,
    phraseCoverageOk,
    phraseBoundaryOk,
    before: {
      rows: rowsBefore,
      summary: summaryBefore
    },
    after: {
      rows: rowsAfter,
      summary: summaryAfter
    },
    editedTrackCount
  };
}

async function main() {
  const cwd = process.cwd();
  const suitePath = process.argv[2]
    ? path.resolve(cwd, process.argv[2])
    : path.join(cwd, "apps/xlightsdesigner-ui/eval/timing-track-control-validation-suite-v1.json");
  const suite = readJson(suitePath);
  const scenarios = arr(suite?.scenarios);
  if (!scenarios.length) {
    throw new Error("Timing track control validation suite requires at least one scenario.");
  }
  const results = scenarios.map(summarizeScenario);
  const failed = results.filter((row) => row.ok !== true);
  const summary = {
    contract: "timing_track_control_validation_run_v1",
    version: "1.0",
    suitePath,
    scenarioCount: results.length,
    passedScenarioCount: results.length - failed.length,
    failedScenarioCount: failed.length,
    failedScenarioNames: failed.map((row) => row.name),
    ok: failed.length === 0,
    results
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length) process.exitCode = 1;
}

await main();
