import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function resolveRepoRoot() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
}

function parseArgs(argv = []) {
  const options = {
    channel: "dev",
    outDir: "/tmp/live-practical-benchmark-phase2",
    pretty: true
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    if (token === "--channel") {
      options.channel = str(argv[index + 1] || "dev") || "dev";
      index += 1;
    } else if (token === "--out-dir") {
      options.outDir = str(argv[index + 1] || options.outDir) || options.outDir;
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

function runCommand(cmd, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
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

function buildSuiteCatalog(repoRoot) {
  const evalDir = path.join(repoRoot, "apps", "xlightsdesigner-ui", "eval");
  return [
    {
      key: "section",
      action: "run-live-section-practical-sequence-validation-suite",
      suitePath: path.join(evalDir, "live-section-practical-sequence-validation-suite-v2.json"),
      resultFileName: "live-section-suite.json"
    },
    {
      key: "multisection",
      action: "run-live-section-practical-sequence-validation-suite",
      suitePath: path.join(evalDir, "live-multisection-practical-sequence-validation-suite-v2.json"),
      resultFileName: "live-multisection-suite.json"
    },
    {
      key: "wholesequence",
      action: "run-live-wholesequence-practical-validation-suite",
      suitePath: path.join(evalDir, "live-wholesequence-practical-validation-suite-v2.json"),
      resultFileName: "live-wholesequence-suite.json"
    },
    {
      key: "revision",
      action: "run-live-revision-practical-sequence-validation-suite",
      suitePath: path.join(evalDir, "live-revision-practical-sequence-validation-suite-v1.json"),
      resultFileName: "live-revision-suite.json"
    }
  ];
}

function buildPreflightSuite(repoRoot) {
  const evalDir = path.join(repoRoot, "apps", "xlightsdesigner-ui", "eval");
  return {
    key: "section_canary",
    action: "run-live-section-practical-sequence-validation-suite",
    suitePath: path.join(evalDir, "live-section-practical-sequence-validation-canary-v1.json"),
    resultFileName: "section-canary-suite.json"
  };
}

async function runAutomationAction({
  repoRoot,
  automationScript,
  channel,
  action,
  payloadFile = "",
  resultPath
}) {
  const args = [
    automationScript,
    "--channel", channel,
    "--result-file", resultPath,
    action
  ];
  if (payloadFile) {
    args.push("--payload-file", payloadFile);
  }
  await runCommand("node", args, { cwd: repoRoot });
  return readJson(resultPath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function summarizeSuiteResult(key, payload = {}, artifactPath = "") {
  const result = payload?.result && typeof payload.result === "object" ? payload.result : {};
  const gapReport = result?.gapReport && typeof result.gapReport === "object" ? result.gapReport : null;
  return {
    key,
    ok: payload?.ok === true && result?.ok === true,
    summary: str(result?.summary || ""),
    scenarioCount: Number(result?.scenarioCount || 0),
    failedScenarioCount: Number(result?.failedScenarioCount || 0),
    failedScenarioNames: arr(result?.failedScenarioNames).map((row) => str(row)).filter(Boolean),
    gapReport,
    artifactPath: str(artifactPath)
  };
}

function isHealthyRefreshResult(payload = {}) {
  const result = payload?.result && typeof payload.result === "object" ? payload.result : {};
  const level = str(result?.status?.level || "").toLowerCase();
  const text = str(result?.status?.text || "");
  if (payload?.ok !== true) return false;
  if (level === "warning" || level === "error") return false;
  if (/refresh failed/i.test(text)) return false;
  return true;
}

function aggregateGapReports(suites = []) {
  const counts = {
    designer_gap: 0,
    sequencer_gap: 0,
    apply_gap: 0,
    validation_gap: 0
  };
  const issues = [];
  for (const suite of suites) {
    const gapReport = suite?.gapReport || null;
    if (!gapReport) continue;
    for (const [key, value] of Object.entries(gapReport?.issueCounts || {})) {
      if (counts[key] != null) counts[key] += Number(value || 0);
    }
    for (const issue of arr(gapReport?.issues)) {
      issues.push({
        suiteKey: str(suite?.key),
        ...issue
      });
    }
  }
  return {
    artifactType: "sequencer_gap_report_v1",
    artifactVersion: "1.0",
    issueCount: issues.length,
    issueCounts: counts,
    issues
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const automationScript = path.join(repoRoot, "scripts", "desktop", "automation.mjs");
  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const startedAt = Date.now();
  const suiteCatalog = buildSuiteCatalog(repoRoot);
  const preflightSuite = buildPreflightSuite(repoRoot);
  const suiteResults = [];

  await runAutomationAction({
    repoRoot,
    automationScript,
    channel: options.channel,
    action: "reset-automation-state",
    resultPath: path.join(outDir, "reset-automation-state.json")
  });

  const postResetRefreshResult = await runAutomationAction({
    repoRoot,
    automationScript,
    channel: options.channel,
    action: "refresh-from-xlights",
    resultPath: path.join(outDir, "refresh-from-xlights.json")
  });
  if (!isHealthyRefreshResult(postResetRefreshResult)) {
    throw new Error(
      `refresh-from-xlights not healthy: ${str(postResetRefreshResult?.result?.status?.text || postResetRefreshResult?.error || postResetRefreshResult?.result?.error || "")}`
    );
  }

  const canaryResult = await runAutomationAction({
    repoRoot,
    automationScript,
    channel: options.channel,
    action: preflightSuite.action,
    payloadFile: preflightSuite.suitePath,
    resultPath: path.join(outDir, preflightSuite.resultFileName)
  });
  const canarySummary = summarizeSuiteResult(preflightSuite.key, canaryResult);
  if (!canarySummary.ok) {
    throw new Error(`section canary failed: ${canarySummary.summary}`);
  }

  for (const suite of suiteCatalog) {
    const resultPath = path.join(outDir, suite.resultFileName);
    const payload = await runAutomationAction({
      repoRoot,
      automationScript,
      channel: options.channel,
      action: suite.action,
      payloadFile: suite.suitePath,
      resultPath
    });
    suiteResults.push(summarizeSuiteResult(suite.key, payload, resultPath));
  }

  const failedSuites = suiteResults.filter((row) => row.ok !== true);
  const report = {
    artifactType: "live_practical_benchmark_run_v1",
    artifactVersion: "1.0",
    createdAt: nowIso(),
    channel: options.channel,
    outDir,
    totalDurationMs: Date.now() - startedAt,
    preflight: {
      refreshFromXLights: {
        ok: isHealthyRefreshResult(postResetRefreshResult),
        status: postResetRefreshResult?.result?.status || null
      },
      sectionCanary: canarySummary
    },
    suiteCount: suiteResults.length,
    failedSuiteCount: failedSuites.length,
    failedSuiteKeys: failedSuites.map((row) => row.key),
    ok: failedSuites.length === 0,
    suites: suiteResults,
    gapReport: aggregateGapReports(suiteResults)
  };

  const reportPath = path.join(outDir, "live-practical-benchmark-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  process.stdout.write(`${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`);
  if (!report.ok) process.exitCode = 1;
}

await main();
