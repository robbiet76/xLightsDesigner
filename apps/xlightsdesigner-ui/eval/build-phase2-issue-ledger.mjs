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

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv = []) {
  const options = {
    report: "",
    output: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    if (token === "--report") {
      options.report = str(argv[index + 1]);
      index += 1;
    } else if (token === "--output") {
      options.output = str(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (!options.report) throw new Error("--report is required");
  if (!options.output) throw new Error("--output is required");
  return options;
}

function classifyPriority(issue = {}) {
  const category = str(issue?.category || issue?.kind).toLowerCase();
  if (category === "apply_gap" || category === "validation_gap") return "high";
  if (category === "sequencer_gap") return "high";
  if (category === "designer_gap") return "medium";
  return "medium";
}

function buildLedger(report = {}, reportPath = "") {
  const suites = arr(report?.suites);
  const gapReport = report?.gapReport && typeof report.gapReport === "object" ? report.gapReport : {};
  const suiteByKey = new Map(suites.map((suite) => [str(suite?.key), suite]));
  const issues = arr(gapReport?.issues).map((issue, index) => {
    const suiteKey = str(issue?.suiteKey);
    const suite = suiteByKey.get(suiteKey);
    return {
      issueId: `phase2-${index + 1}`,
      category: str(issue?.category || issue?.kind || "unknown"),
      priority: classifyPriority(issue),
      suiteKey,
      suiteSummary: str(suite?.summary),
      summary: str(issue?.summary || issue?.detail || issue?.message || issue?.target || "Unclassified issue"),
      target: str(issue?.target),
      detail: str(issue?.detail),
      sourceReport: reportPath
    };
  });

  return {
    artifactType: "phase2_issue_ledger_v1",
    artifactVersion: "1.0",
    createdAt: nowIso(),
    sourceReport: reportPath,
    benchmarkOk: Boolean(report?.ok),
    issueCount: issues.length,
    issueCounts: gapReport?.issueCounts || {},
    issues
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const reportPath = path.resolve(options.report);
  const outputPath = path.resolve(options.output);
  const report = readJson(reportPath);
  const ledger = buildLedger(report, reportPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(ledger, null, 2)}\n`);
}

await main();
