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
    outDir: "/tmp/live-reviewed-timing-wholesequence-baseline",
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

function extractPracticalValidation(resultRow = {}) {
  const direct = resultRow?.practicalValidation;
  if (direct && typeof direct === "object" && str(direct?.artifactType) === "practical_sequence_validation_v1") return direct;
  const validation = resultRow?.validation;
  if (validation && typeof validation === "object") {
    if (str(validation?.artifactType) === "practical_sequence_validation_v1") return validation;
    if (validation?.practicalValidation && typeof validation.practicalValidation === "object" && str(validation.practicalValidation?.artifactType) === "practical_sequence_validation_v1") {
      return validation.practicalValidation;
    }
  }
  return null;
}

function summarizeTimingBaseline(results = []) {
  const rows = arr(results)
    .map((row) => ({
      name: str(row?.name),
      practicalValidation: extractPracticalValidation(row)
    }))
    .filter((row) => row.practicalValidation);
  const timingRows = rows.map((row) => ({
    name: row.name,
    timingFidelity: row.practicalValidation?.summary?.timingFidelity && typeof row.practicalValidation.summary.timingFidelity === "object"
      ? row.practicalValidation.summary.timingFidelity
      : {},
    timingFailures: arr(row.practicalValidation?.failures?.timing),
    overallOk: row.practicalValidation?.overallOk === true
  }));
  return {
    scenarioCount: results.length,
    scenarioCountWithPracticalValidation: rows.length,
    scenarioCountWithTimingData: timingRows.filter((row) => Object.keys(row.timingFidelity).length > 0).length,
    reviewedStructureScenarioCount: timingRows.filter((row) => row.timingFidelity?.structureTrackPresent === true).length,
    reviewedPhraseScenarioCount: timingRows.filter((row) => row.timingFidelity?.phraseTrackPresent === true).length,
    timingAwareScenarioCount: timingRows.filter((row) => Number(row.timingFidelity?.timingAwareEffectCount || 0) > 0).length,
    crossingStructureScenarioCount: timingRows.filter((row) => Number(row.timingFidelity?.crossingStructureCount || 0) > 0).length,
    timingFailureScenarioCount: timingRows.filter((row) => row.timingFailures.length > 0).length,
    practicalFailureScenarioCount: timingRows.filter((row) => row.overallOk !== true).length,
    rows: timingRows
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const suitePath = options.suitePath
    ? path.resolve(repoRoot, options.suitePath)
    : path.join(repoRoot, "apps", "xlightsdesigner-ui", "eval", "live-reviewed-timing-wholesequence-baseline-suite-v1.json");
  const suite = readJson(suitePath);
  const scenarios = arr(suite?.scenarios);
  if (!scenarios.length) {
    throw new Error("Live reviewed timing whole-sequence baseline suite requires at least one scenario.");
  }

  const outDir = path.resolve(options.outDir);
  const baselinesDir = path.join(outDir, "baselines");
  fs.mkdirSync(baselinesDir, { recursive: true });

  const runtimeSuite = {
    ...suite,
    scenarios: scenarios.map((scenario, index) => {
      const sequencePath = str(scenario?.sequencePath);
      const ext = path.extname(sequencePath) || ".xsq";
      const baseName = path.basename(sequencePath, ext);
      const baselineSequencePath = path.join(baselinesDir, `${String(index + 1).padStart(2, "0")}-${baseName}-baseline${ext}`);
      fs.copyFileSync(sequencePath, baselineSequencePath);
      return {
        ...scenario,
        baselineSequencePath
      };
    })
  };

  fs.mkdirSync(outDir, { recursive: true });
  const runtimeSuitePath = path.join(outDir, "live-reviewed-timing-wholesequence-runtime-suite.json");
  fs.writeFileSync(runtimeSuitePath, `${JSON.stringify(runtimeSuite, null, 2)}\n`, "utf8");

  const automationResultPath = path.join(outDir, "live-reviewed-timing-wholesequence-automation-result.json");
  const automationPayload = await runAutomation(
    repoRoot,
    options.channel,
    automationResultPath,
    "run-live-wholesequence-practical-validation-suite",
    ["--payload-file", runtimeSuitePath]
  );
  const result = automationPayload?.result && typeof automationPayload.result === "object" ? automationPayload.result : {};
  const timingSummary = summarizeTimingBaseline(arr(result?.results));

  const report = {
    contract: "live_reviewed_timing_wholesequence_baseline_run_v1",
    version: "1.0",
    channel: options.channel,
    suitePath,
    runtimeSuitePath,
    outDir,
    ok: automationPayload?.ok === true && result?.ok === true,
    scenarioCount: Number(result?.scenarioCount || scenarios.length),
    failedScenarioCount: Number(result?.failedScenarioCount || 0),
    failedScenarioNames: arr(result?.failedScenarioNames).map((row) => str(row)).filter(Boolean),
    summary: str(result?.summary),
    timingSummary,
    result
  };

  const reportPath = path.join(outDir, "live-reviewed-timing-wholesequence-baseline-report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`);
  if (report.ok !== true) process.exitCode = 1;
}

await main();
