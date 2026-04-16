import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function walkRecords(dir, matches = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkRecords(path, matches);
    else if (entry.isFile() && entry.name.endsWith(".record.json")) matches.push(path);
  }
  return matches;
}

function list(values = []) {
  return values.length ? values.join(", ") : "none";
}

const outputDir = process.argv[2] ? resolve(process.argv[2]) : resolve("/tmp/stage1-validation-report");
const scopePath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve("scripts/sequencer-render-training/catalog/stage1-effect-model-scope.json");
const registryPath = process.argv[4]
  ? resolve(process.argv[4])
  : resolve("scripts/sequencer-render-training/catalog/effective-effect-parameter-registry.json");
const rawArgs = process.argv.slice(5);
const geometryFilters = new Set();
const effectFilters = new Set();
const roots = [];

for (let i = 0; i < rawArgs.length; i += 1) {
  const token = rawArgs[i];
  if (token === "--geometry-profile") {
    geometryFilters.add(rawArgs[++i]);
  } else if (token === "--effect") {
    effectFilters.add(rawArgs[++i]);
  } else {
    roots.push(resolve(token));
  }
}

if (!roots.length) {
  throw new Error("At least one record root is required");
}

mkdirSync(outputDir, { recursive: true });

const scope = loadJson(scopePath).effects;
const registry = loadJson(registryPath).effects;

const records = [];
for (const root of roots) {
  for (const path of walkRecords(root)) {
    const data = loadJson(path);
    const fixture = data.fixture || {};
    const modelMetadata = data.modelMetadata || {};
    const sharedSettings = data.sharedSettings || {};
    const effectSettings = data.effectSettings || {};
    const analysis = data.analysis || {};
    records.push({
      path,
      sizeBytes: statSync(path).size,
      effect: data.effectName,
      geometryProfile: modelMetadata.resolvedGeometryProfile || fixture.geometryProfile || analysis.geometryProfile || null,
      paletteProfile: sharedSettings.paletteProfile || null,
      parameterNames: Object.keys(effectSettings || {}),
      patternFamily: analysis.patternFamily || null
    });
  }
}

const coverage = new Map();
for (const row of records) {
  const key = `${row.effect}::${row.geometryProfile}`;
  if (!coverage.has(key)) {
    coverage.set(key, {
      effect: row.effect,
      geometryProfile: row.geometryProfile,
      palettes: new Set(),
      parameterNames: new Set(),
      sampleCount: 0,
      missingPatternFamilyCount: 0,
      observedPatternFamilies: new Set()
    });
  }
  const target = coverage.get(key);
  if (row.paletteProfile) target.palettes.add(row.paletteProfile);
  row.parameterNames.forEach((name) => target.parameterNames.add(name));
  target.sampleCount += 1;
  if (!row.patternFamily) target.missingPatternFamilyCount += 1;
  else target.observedPatternFamilies.add(row.patternFamily);
}

const missingCoverage = [];
const paletteGaps = [];
const parameterGaps = [];
const patternFamilyGaps = [];
const expectedPalettes = new Set(["mono_white", "rgb_primary"]);

for (const [effect, cfg] of Object.entries(scope)) {
  if (effectFilters.size && !effectFilters.has(effect)) continue;
  const requiredProfiles = [...cfg.primaryProfiles, ...cfg.probeProfiles];
  for (const profile of requiredProfiles) {
    if (geometryFilters.size && !geometryFilters.has(profile)) continue;
    const key = `${effect}::${profile}`;
    const row = coverage.get(key);
    if (!row) {
      missingCoverage.push({ effect, geometryProfile: profile });
      continue;
    }
    const palettes = [...row.palettes].sort();
    if (palettes.length !== expectedPalettes.size || palettes.some((value) => !expectedPalettes.has(value))) {
      paletteGaps.push({ effect, geometryProfile: profile, palettes });
    }
    const registryParams = Object.keys((registry[effect] || {}).parameters || {});
    const missingParams = registryParams.filter((name) => !row.parameterNames.has(name));
    if (missingParams.length) {
      parameterGaps.push({ effect, geometryProfile: profile, missingParameters: missingParams, observedParameters: [...row.parameterNames].sort() });
    }
    if (row.sampleCount > 0 && row.observedPatternFamilies.size === 0) {
      patternFamilyGaps.push({
        effect,
        geometryProfile: profile,
        sampleCount: row.sampleCount,
        missingPatternFamilyCount: row.missingPatternFamilyCount
      });
    }
  }
}

const report = {
  artifactType: "stage1_validation_report_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  roots,
  geometryFilters: [...geometryFilters].sort(),
  effectFilters: [...effectFilters].sort(),
  recordCount: records.length,
  coverageKeyCount: coverage.size,
  ok:
    missingCoverage.length === 0 &&
    paletteGaps.length === 0 &&
    parameterGaps.length === 0 &&
    patternFamilyGaps.length === 0,
  missingCoverage,
  paletteGaps,
  parameterGaps,
  patternFamilyGaps
};

const jsonPath = join(outputDir, "stage1-validation-report.json");
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

let md = "# Stage1 Validation Report\n\n";
md += `Generated: ${report.generatedAt}\n\n`;
md += `Roots: ${roots.map((root) => `\`${root}\``).join(", ")}\n\n`;
md += `Records: ${report.recordCount}\n`;
md += `Coverage keys: ${report.coverageKeyCount}\n`;
md += `Status: ${report.ok ? "PASS" : "FAIL"}\n\n`;
md += `## Missing Coverage\n\n`;
md += report.missingCoverage.length
  ? report.missingCoverage.map((row) => `- ${row.effect} on ${row.geometryProfile}\n`).join("")
  : "- none\n";
md += `\n## Palette Gaps\n\n`;
md += report.paletteGaps.length
  ? report.paletteGaps.map((row) => `- ${row.effect} on ${row.geometryProfile}: ${list(row.palettes)}\n`).join("")
  : "- none\n";
md += `\n## Parameter Gaps\n\n`;
md += report.parameterGaps.length
  ? report.parameterGaps.map((row) => `- ${row.effect} on ${row.geometryProfile}: missing ${list(row.missingParameters)}; observed ${list(row.observedParameters)}\n`).join("")
  : "- none\n";
md += `\n## Pattern Family Gaps\n\n`;
md += report.patternFamilyGaps.length
  ? report.patternFamilyGaps.map((row) => `- ${row.effect} on ${row.geometryProfile}: missing ${row.missingPatternFamilyCount}/${row.sampleCount}\n`).join("")
  : "- none\n";

const mdPath = join(outputDir, "stage1-validation-report.md");
writeFileSync(mdPath, md, "utf8");

console.log(JSON.stringify({
  ok: true,
  reportOk: report.ok,
  jsonPath,
  mdPath,
  missingCoverageCount: missingCoverage.length,
  paletteGapCount: paletteGaps.length,
  parameterGapCount: parameterGaps.length,
  patternFamilyGapCount: patternFamilyGaps.length
}, null, 2));
