import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function walk(dir, matches = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) {
      walk(path, matches);
      continue;
    }
    if (name.isFile() && name.name.endsWith(".record.json")) {
      matches.push(path);
    }
  }
  return matches;
}

function avg(values = []) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 3) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

function sortedEntries(mapLike, valueSorter) {
  return [...mapLike.entries()]
    .sort((a, b) => valueSorter(a, b))
    .map(([key, value]) => ({ key, value }));
}

function list(values = []) {
  return values.length ? values.join(", ") : "none";
}

const runRoot = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("/tmp/stage1-coverage-debug-v2");
const outputDir = process.argv[3]
  ? resolve(process.argv[3])
  : resolve(join(runRoot, "artifacts", "model-training-evidence"));

mkdirSync(outputDir, { recursive: true });

const recordPaths = walk(runRoot).sort((a, b) => a.localeCompare(b));
if (!recordPaths.length) {
  throw new Error(`No .record.json files found under ${runRoot}`);
}

const records = recordPaths.map((path) => {
  const data = loadJson(path);
  return { path, data, sizeBytes: statSync(path).size };
});

const modelMap = new Map();
const overallEffects = new Set();
const overallPalettes = new Set();
const overallPatternFamilies = new Set();
const overallLabels = new Set();

for (const { path, data, sizeBytes } of records) {
  const fixture = data.fixture || {};
  const modelMetadata = data.modelMetadata || {};
  const effectSettings = data.effectSettings || {};
  const sharedSettings = data.sharedSettings || {};
  const observations = data.observations || {};
  const analysis = data.analysis || {};
  const modelName = modelMetadata.modelName || fixture.modelName || "unknown_model";
  const geometryProfile = modelMetadata.resolvedGeometryProfile || fixture.geometryProfile || analysis.geometryProfile || "unknown_geometry";
  const modelType = modelMetadata.resolvedModelType || fixture.modelType || analysis.modelType || "unknown_type";
  const paletteProfile = sharedSettings.paletteProfile || "unknown_palette";
  const effectName = data.effectName || analysis.effectName || "unknown_effect";
  const patternFamily = analysis.patternFamily || "unknown_pattern_family";
  const labels = Array.isArray(observations.labels) ? observations.labels : [];
  const sampleId = data.sampleId || path;

  overallEffects.add(effectName);
  overallPalettes.add(paletteProfile);
  overallPatternFamilies.add(patternFamily);
  labels.forEach((label) => overallLabels.add(label));

  if (!modelMap.has(modelName)) {
    modelMap.set(modelName, {
      modelName,
      geometryProfile,
      modelType,
      analyzerFamily: modelMetadata.analyzerFamily || analysis.analyzerFamily || "unknown",
      displayAs: modelMetadata.displayAs || null,
      nodeCount: modelMetadata.nodeCount ?? null,
      channelCount: modelMetadata.channelCount ?? null,
      channelsPerNode: modelMetadata.channelsPerNode ?? null,
      geometryTraits: new Set(modelMetadata.geometryTraits || []),
      sampleCount: 0,
      totalRecordBytes: 0,
      effectNames: new Set(),
      paletteProfiles: new Set(),
      patternFamilies: new Set(),
      labels: new Map(),
      scores: {
        readability: [],
        restraint: [],
        patternClarity: [],
        propSuitability: [],
        usefulness: []
      },
      effects: new Map()
    });
  }

  const modelRow = modelMap.get(modelName);
  modelRow.sampleCount += 1;
  modelRow.totalRecordBytes += sizeBytes;
  modelRow.effectNames.add(effectName);
  modelRow.paletteProfiles.add(paletteProfile);
  modelRow.patternFamilies.add(patternFamily);
  labels.forEach((label) => modelRow.labels.set(label, (modelRow.labels.get(label) || 0) + 1));

  for (const [scoreName, scoreValue] of Object.entries(observations.scores || {})) {
    if (scoreName in modelRow.scores && typeof scoreValue === "number") {
      modelRow.scores[scoreName].push(scoreValue);
    }
  }

  if (!modelRow.effects.has(effectName)) {
    modelRow.effects.set(effectName, {
      effectName,
      sampleCount: 0,
      sampleIds: [],
      paletteProfiles: new Set(),
      patternFamilies: new Set(),
      parameterNames: new Set(),
      parameterValues: new Map(),
      sharedSettingKeys: new Set(),
      labels: new Map()
    });
  }

  const effectRow = modelRow.effects.get(effectName);
  effectRow.sampleCount += 1;
  effectRow.sampleIds.push(sampleId);
  effectRow.paletteProfiles.add(paletteProfile);
  effectRow.patternFamilies.add(patternFamily);
  Object.keys(sharedSettings).forEach((key) => effectRow.sharedSettingKeys.add(key));
  labels.forEach((label) => effectRow.labels.set(label, (effectRow.labels.get(label) || 0) + 1));

  for (const [parameterName, parameterValue] of Object.entries(effectSettings)) {
    effectRow.parameterNames.add(parameterName);
    if (!effectRow.parameterValues.has(parameterName)) {
      effectRow.parameterValues.set(parameterName, new Set());
    }
    effectRow.parameterValues.get(parameterName).add(String(parameterValue));
  }
}

const models = [...modelMap.values()]
  .sort((a, b) => a.modelName.localeCompare(b.modelName))
  .map((modelRow) => {
    const topLabels = sortedEntries(modelRow.labels, (a, b) => {
      const countDiff = b[1] - a[1];
      return countDiff || a[0].localeCompare(b[0]);
    }).slice(0, 12).map(({ key, value }) => ({ label: key, count: value }));

    const effectRows = [...modelRow.effects.values()]
      .sort((a, b) => a.effectName.localeCompare(b.effectName))
      .map((effectRow) => ({
        effectName: effectRow.effectName,
        sampleCount: effectRow.sampleCount,
        paletteProfiles: [...effectRow.paletteProfiles].sort(),
        patternFamilies: [...effectRow.patternFamilies].sort(),
        parameterNames: [...effectRow.parameterNames].sort(),
        parameterValueCoverage: [...effectRow.parameterValues.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([parameterName, values]) => ({
            parameterName,
            valueCount: values.size,
            values: [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          })),
        sharedSettingKeys: [...effectRow.sharedSettingKeys].sort(),
        topLabels: sortedEntries(effectRow.labels, (a, b) => {
          const countDiff = b[1] - a[1];
          return countDiff || a[0].localeCompare(b[0]);
        }).slice(0, 8).map(({ key, value }) => ({ label: key, count: value }))
      }));

    return {
      modelName: modelRow.modelName,
      geometryProfile: modelRow.geometryProfile,
      modelType: modelRow.modelType,
      analyzerFamily: modelRow.analyzerFamily,
      displayAs: modelRow.displayAs,
      nodeCount: modelRow.nodeCount,
      channelCount: modelRow.channelCount,
      channelsPerNode: modelRow.channelsPerNode,
      geometryTraits: [...modelRow.geometryTraits].sort(),
      sampleCount: modelRow.sampleCount,
      totalRecordBytes: modelRow.totalRecordBytes,
      effectCount: modelRow.effectNames.size,
      paletteProfiles: [...modelRow.paletteProfiles].sort(),
      patternFamilies: [...modelRow.patternFamilies].sort(),
      averageScores: Object.fromEntries(
        Object.entries(modelRow.scores).map(([name, values]) => [name, round(avg(values))])
      ),
      topLabels,
      effects: effectRows
    };
  });

const report = {
  artifactType: "model_training_evidence_report_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  runRoot,
  recordCount: records.length,
  modelCount: models.length,
  effectCount: overallEffects.size,
  paletteProfileCount: overallPalettes.size,
  patternFamilyCount: overallPatternFamilies.size,
  models
};

const jsonPath = join(outputDir, "model-training-evidence-report.json");
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

let md = "# Model Training Evidence Report\n\n";
md += `Generated: ${report.generatedAt}\n\n`;
md += `Run root: \`${runRoot}\`\n\n`;
md += `Records: ${report.recordCount}\n`;
md += `Models: ${report.modelCount}\n`;
md += `Effects: ${report.effectCount}\n`;
md += `Palette profiles: ${report.paletteProfileCount}\n`;
md += `Pattern families: ${report.patternFamilyCount}\n\n`;

for (const model of models) {
  md += `## ${model.modelName}\n\n`;
  md += `- Geometry profile: ${model.geometryProfile}\n`;
  md += `- Model type: ${model.modelType}\n`;
  md += `- Analyzer family: ${model.analyzerFamily}\n`;
  md += `- Display as: ${model.displayAs || "unknown"}\n`;
  md += `- Node count: ${model.nodeCount ?? "unknown"}\n`;
  md += `- Channel count: ${model.channelCount ?? "unknown"}\n`;
  md += `- Channels per node: ${model.channelsPerNode ?? "unknown"}\n`;
  md += `- Samples: ${model.sampleCount}\n`;
  md += `- Effects covered: ${model.effectCount}\n`;
  md += `- Palette profiles: ${list(model.paletteProfiles)}\n`;
  md += `- Pattern families: ${list(model.patternFamilies)}\n`;
  md += `- Average scores: readability=${model.averageScores.readability ?? "n/a"}, restraint=${model.averageScores.restraint ?? "n/a"}, patternClarity=${model.averageScores.patternClarity ?? "n/a"}, propSuitability=${model.averageScores.propSuitability ?? "n/a"}, usefulness=${model.averageScores.usefulness ?? "n/a"}\n`;
  md += `- Top labels: ${list(model.topLabels.map((row) => `${row.label} (${row.count})`))}\n\n`;
  md += `### Effects\n\n`;
  for (const effect of model.effects) {
    md += `- ${effect.effectName}: samples=${effect.sampleCount}; palettes=${list(effect.paletteProfiles)}; patterns=${list(effect.patternFamilies)}; parameters=${list(effect.parameterNames)}\n`;
    for (const parameter of effect.parameterValueCoverage) {
      md += `  - ${parameter.parameterName}: ${parameter.valueCount} values -> ${list(parameter.values)}\n`;
    }
  }
  md += `\n`;
}

const mdPath = join(outputDir, "model-training-evidence-report.md");
writeFileSync(mdPath, md, "utf8");

console.log(JSON.stringify({
  ok: true,
  outputDir,
  jsonPath,
  mdPath,
  recordCount: report.recordCount,
  modelCount: report.modelCount
}, null, 2));
