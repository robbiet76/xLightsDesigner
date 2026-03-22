import fs from "node:fs";
import path from "node:path";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function suiteByKey(suites = []) {
  return new Map(arr(suites).map((row) => [str(row?.key), row]));
}

function buildComparison({ baseline = {}, report = {} } = {}) {
  const issues = [];
  const expected = baseline?.expected && typeof baseline.expected === "object" ? baseline.expected : {};
  const preflight = report?.preflight && typeof report.preflight === "object" ? report.preflight : {};

  if (str(report?.artifactType) !== str(expected?.artifactType)) {
    issues.push(`artifactType mismatch: expected ${str(expected?.artifactType)} saw ${str(report?.artifactType)}`);
  }
  if (str(report?.artifactVersion) !== str(expected?.artifactVersion)) {
    issues.push(`artifactVersion mismatch: expected ${str(expected?.artifactVersion)} saw ${str(report?.artifactVersion)}`);
  }
  if (Boolean(report?.ok) !== Boolean(expected?.ok)) {
    issues.push(`overall ok mismatch: expected ${Boolean(expected?.ok)} saw ${Boolean(report?.ok)}`);
  }
  if (Number(report?.failedSuiteCount || 0) !== Number(expected?.failedSuiteCount || 0)) {
    issues.push(`failedSuiteCount mismatch: expected ${Number(expected?.failedSuiteCount || 0)} saw ${Number(report?.failedSuiteCount || 0)}`);
  }
  if (Boolean(preflight?.refreshFromXLights?.ok) !== Boolean(expected?.preflight?.refreshFromXLights)) {
    issues.push(`refresh preflight mismatch: expected ${Boolean(expected?.preflight?.refreshFromXLights)} saw ${Boolean(preflight?.refreshFromXLights?.ok)}`);
  }
  if (Boolean(preflight?.sectionCanary?.ok) !== Boolean(expected?.preflight?.sectionCanaryOk)) {
    issues.push(`section canary mismatch: expected ${Boolean(expected?.preflight?.sectionCanaryOk)} saw ${Boolean(preflight?.sectionCanary?.ok)}`);
  }

  const actualSuites = suiteByKey(report?.suites);
  for (const expectedSuite of arr(expected?.suites)) {
    const key = str(expectedSuite?.key);
    const actualSuite = actualSuites.get(key);
    if (!actualSuite) {
      issues.push(`missing suite: ${key}`);
      continue;
    }
    if (Boolean(actualSuite?.ok) !== Boolean(expectedSuite?.ok)) {
      issues.push(`suite ${key} ok mismatch: expected ${Boolean(expectedSuite?.ok)} saw ${Boolean(actualSuite?.ok)}`);
    }
    if (Number(actualSuite?.scenarioCount || 0) !== Number(expectedSuite?.scenarioCount || 0)) {
      issues.push(`suite ${key} scenarioCount mismatch: expected ${Number(expectedSuite?.scenarioCount || 0)} saw ${Number(actualSuite?.scenarioCount || 0)}`);
    }
    if (Number(actualSuite?.failedScenarioCount || 0) !== Number(expectedSuite?.failedScenarioCount || 0)) {
      issues.push(`suite ${key} failedScenarioCount mismatch: expected ${Number(expectedSuite?.failedScenarioCount || 0)} saw ${Number(actualSuite?.failedScenarioCount || 0)}`);
    }
  }

  const expectedGap = expected?.gapReport || {};
  const actualGap = report?.gapReport || {};
  if (Number(actualGap?.issueCount || 0) !== Number(expectedGap?.issueCount || 0)) {
    issues.push(`gap issueCount mismatch: expected ${Number(expectedGap?.issueCount || 0)} saw ${Number(actualGap?.issueCount || 0)}`);
  }
  for (const [key, value] of Object.entries(expectedGap?.issueCounts || {})) {
    if (Number(actualGap?.issueCounts?.[key] || 0) !== Number(value || 0)) {
      issues.push(`gap ${key} mismatch: expected ${Number(value || 0)} saw ${Number(actualGap?.issueCounts?.[key] || 0)}`);
    }
  }

  return {
    artifactType: "live_practical_benchmark_comparison_v1",
    artifactVersion: "1.0",
    baselineLabel: str(baseline?.label),
    baselinePath: str(baseline?.sourceReport || ""),
    ok: issues.length === 0,
    issueCount: issues.length,
    issues
  };
}

async function main() {
  const cwd = process.cwd();
  const reportPath = process.argv[2]
    ? path.resolve(cwd, process.argv[2])
    : path.join(cwd, "apps/xlightsdesigner-ui/eval/live-practical-benchmark-baseline.v1.json");
  const baselinePath = process.argv[3]
    ? path.resolve(cwd, process.argv[3])
    : path.join(cwd, "apps/xlightsdesigner-ui/eval/live-practical-benchmark-baseline.v1.json");

  const report = readJson(reportPath);
  const baseline = readJson(baselinePath);
  const comparison = buildComparison({ baseline, report });
  process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
  if (!comparison.ok) process.exitCode = 1;
}

await main();
