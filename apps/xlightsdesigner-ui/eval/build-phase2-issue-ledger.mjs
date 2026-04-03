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

function readJsonIfExists(filePath = "") {
  const target = str(filePath);
  if (!target || !fs.existsSync(target)) return null;
  return readJson(target);
}

function optionalNumber(value) {
  if (value == null || value === "") return null;
  const out = Number(value);
  return Number.isFinite(out) ? out : null;
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
  const root = report?.result && typeof report.result === "object" ? report.result : report;
  const suites = arr(root?.suites);
  const gapReport = root?.gapReport && typeof root.gapReport === "object" ? root.gapReport : {};
  const defaultSuiteKey = str(root?.name || root?.suiteName || gapReport?.suiteName || path.basename(reportPath, path.extname(reportPath)));
  const suiteByKey = new Map(suites.map((suite) => [str(suite?.key), suite]));
  const suiteArtifactByKey = new Map(
    suites
      .map((suite) => [str(suite?.key), readJsonIfExists(str(suite?.artifactPath))])
  );
  if (!suiteByKey.size) {
    suiteByKey.set(defaultSuiteKey, {
      key: defaultSuiteKey,
      summary: str(root?.summary || gapReport?.suiteName || ""),
      artifactPath: reportPath
    });
    suiteArtifactByKey.set(defaultSuiteKey, report);
  }
  const issues = arr(gapReport?.issues).map((issue, index) => {
    const suiteKey = str(issue?.suiteKey || defaultSuiteKey);
    const suite = suiteByKey.get(suiteKey);
    const suiteArtifact = suiteArtifactByKey.get(suiteKey);
    const suiteResult = suiteArtifact?.result && typeof suiteArtifact.result === "object"
      ? suiteArtifact.result
      : suiteArtifact;
    const scenarioName = str(issue?.scenarioName);
    const scenario = arr(suiteResult?.results).find((row) => str(row?.name) === scenarioName) || null;
    const validation = scenario?.validation && typeof scenario.validation === "object" ? scenario.validation : null;
    const practicalValidation = scenario?.practicalValidation && typeof scenario.practicalValidation === "object"
      ? scenario.practicalValidation
      : (validation?.practicalValidation && typeof validation.practicalValidation === "object"
          ? validation.practicalValidation
          : (str(validation?.artifactType) === "practical_sequence_validation_v1" ? validation : null));
    const metrics = validation?.metrics && typeof validation.metrics === "object" ? validation.metrics : null;
    const timingFidelity = practicalValidation?.summary?.timingFidelity && typeof practicalValidation.summary.timingFidelity === "object"
      ? practicalValidation.summary.timingFidelity
      : null;
    return {
      issueId: `phase2-${index + 1}`,
      category: str(issue?.category || issue?.kind || "unknown"),
      priority: classifyPriority(issue),
      suiteKey,
      suiteSummary: str(suite?.summary),
      summary: str(issue?.summary || issue?.detail || issue?.message || issue?.target || "Unclassified issue"),
      target: str(issue?.target),
      scenarioName,
      detail: str(issue?.detail),
      sourceReport: reportPath,
      suiteArtifactPath: str(suite?.artifactPath),
      metrics: metrics
        ? {
            strongScore: optionalNumber(metrics?.strongScore),
            weakScore: optionalNumber(metrics?.weakScore),
            strongDominantFamilyShare: optionalNumber(metrics?.strong?.dominantFamilyShare),
            weakDominantFamilyShare: optionalNumber(metrics?.weak?.dominantFamilyShare),
            strongSectionContrastScore: optionalNumber(metrics?.strong?.sectionContrastScore),
            weakSectionContrastScore: optionalNumber(metrics?.weak?.sectionContrastScore),
            strongRepeatedRoleSimilarityScore: optionalNumber(metrics?.strong?.repeatedRoleSimilarityScore),
            weakRepeatedRoleSimilarityScore: optionalNumber(metrics?.weak?.repeatedRoleSimilarityScore),
            strongChorusProgressionScore: optionalNumber(metrics?.strong?.chorusProgressionScore),
            weakChorusProgressionScore: optionalNumber(metrics?.weak?.chorusProgressionScore)
          }
        : null,
      timingFidelity: timingFidelity
        ? {
            structureTrackPresent: Boolean(timingFidelity?.structureTrackPresent),
            phraseTrackPresent: Boolean(timingFidelity?.phraseTrackPresent),
            crossingStructureCount: optionalNumber(timingFidelity?.crossingStructureCount),
            timingAwareEffectCount: optionalNumber(timingFidelity?.timingAwareEffectCount),
            alignedToStructureCount: optionalNumber(timingFidelity?.alignedToStructureCount),
            alignedToPhraseCount: optionalNumber(timingFidelity?.alignedToPhraseCount)
          }
        : null
    };
  });

  return {
    artifactType: "phase2_issue_ledger_v1",
    artifactVersion: "1.0",
    createdAt: nowIso(),
    sourceReport: reportPath,
    benchmarkOk: Boolean(root?.ok),
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
