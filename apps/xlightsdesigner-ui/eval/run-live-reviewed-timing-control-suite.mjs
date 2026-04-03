import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv = []) {
  const options = {
    channel: "dev",
    outDir: "/tmp/live-reviewed-timing-control-suite",
    suitePath: "",
    pretty: true
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    if (token === "--channel") {
      options.channel = str(argv[index + 1] || options.channel) || options.channel;
      index += 1;
    } else if (token === "--out-dir") {
      options.outDir = str(argv[index + 1] || options.outDir) || options.outDir;
      index += 1;
    } else if (token === "--suite") {
      options.suitePath = str(argv[index + 1] || "");
      index += 1;
    } else if (token === "--compact") {
      options.pretty = false;
    } else if (token === "--pretty") {
      options.pretty = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (!["dev", "packaged"].includes(options.channel)) {
    throw new Error(`Unsupported channel: ${options.channel}`);
  }
  return options;
}

function resolveRepoRoot() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
}

function runCommand(cmd, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk || ""); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk || ""); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `${cmd} exited with code ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function runAutomation(repoRoot, channel, resultPath, command, args = []) {
  const script = path.join(repoRoot, "scripts", "desktop", "automation.mjs");
  const commandArgs = [script, "--channel", channel, "--result-file", resultPath, command, ...args];
  await runCommand("node", commandArgs, { cwd: repoRoot });
  return readJson(resultPath);
}

function summarizeTimingTracks(sequencePageState = {}) {
  const data = sequencePageState?.data && typeof sequencePageState.data === "object" ? sequencePageState.data : {};
  const timingReview = data?.timingReview && typeof data.timingReview === "object" ? data.timingReview : {};
  const timingRows = arr(data?.timingTrackStatus).map((row) => ({
    trackName: str(row?.trackName),
    status: str(row?.status),
    canReconcile: row?.canReconcile === true,
    diffCount: Number(row?.diffCount || 0)
  }));
  return {
    timingReview: {
      status: str(timingReview?.status),
      summaryText: str(timingReview?.summaryText),
      trackCount: Number(timingReview?.trackCount || 0),
      unchangedCount: Number(timingReview?.unchangedCount || 0),
      userEditedCount: Number(timingReview?.userEditedCount || 0),
      staleCount: Number(timingReview?.staleCount || 0),
      reconcilableCount: Number(timingReview?.reconcilableCount || 0)
    },
    timingTrackStatus: timingRows
  };
}

function buildScenarioSummary({ scenario, openResult, refreshResult, analyzeResult, pageStatesSnapshot, sequencerSnapshot }) {
  const pageStates = pageStatesSnapshot?.result && typeof pageStatesSnapshot.result === "object"
    ? {
        review: pageStatesSnapshot.result.review || null,
        design: pageStatesSnapshot.result.design || null,
        sequence: pageStatesSnapshot.result.sequence || null
      }
    : {};
  const sequencePage = pageStates?.sequence && typeof pageStates.sequence === "object" ? pageStates.sequence : {};
  const timing = summarizeTimingTracks(sequencePage);
  const latestValidation = sequencerSnapshot?.result?.latestPracticalValidation && typeof sequencerSnapshot.result.latestPracticalValidation === "object"
    ? sequencerSnapshot.result.latestPracticalValidation
    : null;
  const timingTrackNames = timing.timingTrackStatus.map((row) => row.trackName).filter(Boolean);
  const expectedTimingTracks = arr(scenario?.expectedTimingTracks).map((row) => str(row)).filter(Boolean);
  const missingExpectedTimingTracks = expectedTimingTracks.filter((trackName) => !timingTrackNames.includes(trackName));
  return {
    name: str(scenario?.name),
    trackClass: str(scenario?.trackClass),
    trackTitle: str(scenario?.trackTitle),
    sequencePath: str(scenario?.sequencePath),
    activeSequence: str(openResult?.result?.activeSequence || refreshResult?.result?.activeSequence || analyzeResult?.result?.activeSequence),
    analysisReady: Boolean(analyzeResult?.result?.analysisReady),
    timingReview: timing.timingReview,
    timingTrackStatus: timing.timingTrackStatus,
    expectedTimingTracks,
    missingExpectedTimingTracks,
    latestPracticalValidation: latestValidation
      ? {
          overallOk: latestValidation.overallOk === true,
          artifactType: str(latestValidation?.artifactType),
          timingFidelity: latestValidation?.summary?.timingFidelity && typeof latestValidation.summary.timingFidelity === "object"
            ? latestValidation.summary.timingFidelity
            : null
        }
      : null,
    ok: Boolean(analyzeResult?.result?.analysisReady) && missingExpectedTimingTracks.length === 0
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const suitePath = options.suitePath
    ? path.resolve(repoRoot, options.suitePath)
    : path.join(repoRoot, "apps", "xlightsdesigner-ui", "eval", "live-reviewed-timing-control-suite-v1.json");
  const suite = readJson(suitePath);
  const scenarios = arr(suite?.scenarios);
  if (!scenarios.length) {
    throw new Error("Live reviewed timing control suite requires at least one scenario.");
  }
  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    const prefix = `${String(index + 1).padStart(2, "0")}-${str(scenario?.name) || `scenario-${index + 1}`}`;
    await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-reset.json`), "reset-automation-state");
    const openResult = await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-open.json`), "open-sequence", [str(scenario?.sequencePath)]);
    const refreshResult = await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-refresh.json`), "refresh-from-xlights");
    const analyzePrompt = str(scenario?.analyzePrompt);
    const analyzeArgs = [];
    if (scenario?.analyzeProfile && typeof scenario.analyzeProfile === "object") {
      if (str(scenario.analyzeProfile.mode).toLowerCase() === "deep") {
        analyzeArgs.push("--deep");
      }
    }
    if (analyzePrompt) analyzeArgs.push(analyzePrompt);
    const analyzeResult = await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-analyze.json`), "analyze-audio", analyzeArgs);
    await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-seed-timing.json`), "seed-timing-tracks-from-analysis");
    const pageStatesSnapshot = await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-page-states.json`), "get-page-states-snapshot");
    const sequencerSnapshot = await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-sequencer-validation.json`), "get-sequencer-validation-snapshot");
    results.push(buildScenarioSummary({
      scenario,
      openResult,
      refreshResult,
      analyzeResult,
      pageStatesSnapshot,
      sequencerSnapshot
    }));
  }
  const failed = results.filter((row) => row.ok !== true);
  const report = {
    contract: "live_reviewed_timing_control_snapshot_run_v1",
    version: "1.0",
    suitePath,
    outDir,
    channel: options.channel,
    scenarioCount: results.length,
    passedScenarioCount: results.length - failed.length,
    failedScenarioCount: failed.length,
    failedScenarioNames: failed.map((row) => row.name),
    ok: failed.length === 0,
    results
  };
  const reportPath = path.join(outDir, "live-reviewed-timing-control-report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`);
  if (!report.ok) process.exitCode = 1;
}

await main();
