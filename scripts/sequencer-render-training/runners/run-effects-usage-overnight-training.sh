#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/../.." && pwd)"

MODE="plan"
PROMOTE="0"
BENCHMARK_REPORT=""
RUN_ROOT=""
MAX_PACKS="${MAX_PACKS:-12}"
ALLOW_NONTRAINING_FIXTURES="0"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/sequencer-render-training/runners/run-effects-usage-overnight-training.sh [options]

Options:
  --benchmark-report <path>  Use a specific full-sequence benchmark report.
  --out-dir <path>           Write run artifacts to this directory.
  --max-packs <count>        Limit selected render-sweep manifests. Default: 12.
  --execute                  Run selected xLights render sweeps after writing the plan.
  --promote                  After execution, rebuild and export selector bundles to repo paths.
  --allow-nontraining-fixtures
                             Include legacy/dev-show manifests. Default excludes them.
  --help                     Show this help.

Default mode is planning only. It writes training-plan.json and command-list.sh without
running xLights or modifying generated selector bundles.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --benchmark-report)
      BENCHMARK_REPORT="$2"
      shift 2
      ;;
    --out-dir)
      RUN_ROOT="$2"
      shift 2
      ;;
    --max-packs)
      MAX_PACKS="$2"
      shift 2
      ;;
    --execute)
      MODE="execute"
      shift
      ;;
    --promote)
      PROMOTE="1"
      MODE="execute"
      shift
      ;;
    --allow-nontraining-fixtures)
      ALLOW_NONTRAINING_FIXTURES="1"
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${RUN_ROOT}" ]]; then
  RUN_ROOT="${REPO_ROOT}/var/logs/sequencer-effects-usage-training-runs/${STAMP}"
fi
mkdir -p "${RUN_ROOT}"

LOG_PATH="${RUN_ROOT}/overnight-training.log"
PLAN_PATH="${RUN_ROOT}/training-plan.json"
COMMAND_LIST="${RUN_ROOT}/command-list.sh"
SUMMARY_PATH="${RUN_ROOT}/summary.json"
: > "${LOG_PATH}"

log() {
  printf '[effects-usage-training] %s\n' "$*" | tee -a "${LOG_PATH}" >/dev/null
}

if [[ -z "${BENCHMARK_REPORT}" ]]; then
  BENCHMARK_REPORT="$(
    find "${REPO_ROOT}/var/benchmarks/full-sequence-creation" -name benchmark-run.json -type f 2>/dev/null \
      | sort \
      | tail -n 1
  )"
fi

if [[ -z "${BENCHMARK_REPORT}" || ! -f "${BENCHMARK_REPORT}" ]]; then
  echo "No benchmark report found. Run a full-sequence benchmark or pass --benchmark-report." >&2
  exit 1
fi

node --input-type=module - "${REPO_ROOT}" "${BENCHMARK_REPORT}" "${PLAN_PATH}" "${COMMAND_LIST}" "${MAX_PACKS}" "${ALLOW_NONTRAINING_FIXTURES}" <<'NODE'
import fs from "node:fs";
import path from "node:path";

const [repoRoot, benchmarkPath, planPath, commandListPath, maxPacksRaw, allowNontrainingFixturesRaw] = process.argv.slice(2);
const maxPacks = Math.max(1, Number(maxPacksRaw || 12));
const allowNontrainingFixtures = allowNontrainingFixturesRaw === "1";

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function str(value = "") {
  return String(value || "").trim();
}

function slug(value = "") {
  return str(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function unique(values = []) {
  return [...new Set(values.map((row) => str(row)).filter(Boolean))];
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function listManifests(manifestDir) {
  return fs.readdirSync(manifestDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const manifestPath = path.join(manifestDir, fileName);
      const manifest = readJson(manifestPath, {});
      const sequencePath = str(manifest?.fixture?.sequencePath || manifest?.context?.sequencePath || manifest?.sequencePath);
      return {
        packId: fileName.replace(/\.json$/, ""),
        fileName,
        path: manifestPath,
        slug: slug(fileName),
        sequencePath
      };
    })
    .sort((a, b) => a.packId.localeCompare(b.packId));
}

function isTrainingFixtureManifest(manifest, trainingShowDir = "") {
  const sequencePath = str(manifest.sequencePath);
  return Boolean(sequencePath && trainingShowDir && path.resolve(sequencePath).startsWith(path.resolve(trainingShowDir) + path.sep));
}

function hasEffectUsageDiagnostics(effectUsage = {}) {
  return Boolean(
    Number.isFinite(Number(effectUsage.score))
    && (
      Object.keys(effectUsage.dimensions || {}).length
      || Number(effectUsage.configuredBehaviorCoverage || 0) > 0
      || Number(effectUsage.parameterPriorCoverage || 0) > 0
      || Array.isArray(effectUsage.topRepeatedConfigurations)
    )
  );
}

function inferNeeds(effectUsage = {}, renderQuality = {}, diagnosticsAvailable = false) {
  if (!diagnosticsAvailable) {
    return ["fresh_full_sequence_benchmark_with_effect_usage_metrics", "behavior_capability_coverage"];
  }
  const dimensions = effectUsage.dimensions || {};
  const renderDimensions = renderQuality.dimensions || {};
  const renderIssues = Array.isArray(renderQuality.issues) ? renderQuality.issues : [];
  const needs = [];
  if (Number(dimensions.configurationRichnessScore || 0) < 0.65 || Number(effectUsage.thinSettingShare || 0) > 0.35) {
    needs.push("configuration_richness");
  }
  if (Number(dimensions.sectionContrastScore || 0) < 0.65 || Number(effectUsage.maxSectionSignatureShare || 0) > 0.4) {
    needs.push("section_contrast");
  }
  if (Number(dimensions.genericEffectControlScore || 0) < 0.65 || Number(effectUsage.bareOnShare || 0) > 0.05) {
    needs.push("generic_effect_control");
  }
  if (Number(dimensions.repetitionControlScore || 0) < 0.7 || Number(effectUsage.exactSignatureDominance || 0) > 0.18) {
    needs.push("repetition_control");
  }
  if (Number(dimensions.effectKnowledgeCoverageScore || 0) < 0.75 || Number(effectUsage.configuredBehaviorCoverage || 0) < 0.75) {
    needs.push("behavior_capability_coverage");
  }
  if (Number(renderDimensions.coverageScore || 0) < 0.35 || renderIssues.includes("large_display_regions_unused")) {
    needs.push("render_coverage_training");
  }
  if (Number(renderDimensions.spatialBalanceScore || 0) < 0.35 || renderIssues.includes("left_right_imbalance") || renderIssues.includes("top_bottom_imbalance")) {
    needs.push("spatial_balance_training");
  }
  if (Number(renderDimensions.compositionScore || 0) < 0.7 || renderIssues.includes("composition_regions_underused")) {
    needs.push("composition_region_training");
  }
  if (Number(renderDimensions.sectionContrastScore || 0) < 0.75 || renderIssues.includes("adjacent_sections_read_too_similarly")) {
    needs.push("render_section_contrast_training");
  }
  if (!needs.length) needs.push("fresh_effect_usage_regression_run");
  return unique(needs);
}

function inferManifestEffect(manifest, effectNames = []) {
  const id = manifest.slug;
  return effectNames
    .slice()
    .sort((a, b) => slug(b).length - slug(a).length)
    .find((effectName) => id.includes(slug(effectName))) || "";
}

function manifestScore(manifest, context) {
  const effectName = context.manifestEffects.get(manifest.packId) || "";
  if (!effectName) return 0;
  let score = 0;
  const id = manifest.slug;
  const auditItems = context.auditQueueByEffect.get(effectName) || [];
  const auditParameterMatch = auditItems.find((item) => item.parameterSlug && id.includes(item.parameterSlug));
  const auditEffectMatch = auditItems.length > 0;
  if (auditParameterMatch) score += 30;
  else if (auditEffectMatch && (id.includes("expanded") || id.includes("range") || id.includes("interaction") || id.includes("anchor"))) score += 10;
  if (context.repeatedEffects.includes(effectName)) score += 8;
  if (context.runnableNowEffects.includes(effectName)) score += 5;
  if (context.weakCoverageEffects.includes(effectName)) score += 3;
  if (!score) return 0;
  if (context.needs.includes("configuration_richness") && (id.includes("range") || id.includes("interaction") || id.includes("expanded"))) score += 3;
  if (context.needs.includes("section_contrast") && (id.includes("cycles") || id.includes("speed") || id.includes("interactions"))) score += 2;
  if (context.needs.includes("render_section_contrast_training") && (id.includes("cycles") || id.includes("speed") || id.includes("range") || id.includes("interactions"))) score += 3;
	  if (context.needs.includes("render_coverage_training") && (id.includes("matrix") || id.includes("tree") || id.includes("archgroup") || id.includes("expanded"))) score += 3;
	  if (context.needs.includes("spatial_balance_training") && (id.includes("arch") || id.includes("tree") || id.includes("spinner") || id.includes("matrix"))) score += 2;
	  if (context.needs.includes("composition_region_training") && (id.includes("expanded") || id.includes("interactions"))) score += 2;
	  if (id.includes("behavior") || id.includes("anchor") || id.includes("palette")) score += 20;
	  if (context.needs.includes("generic_effect_control") && !id.startsWith("on")) score += 2;
  if (context.needs.includes("behavior_capability_coverage") && (id.includes("expanded") || id.includes("interactions"))) score += 2;
  if (id.includes("reduced")) score -= 1;
  return score;
}

function selectDiverseManifests(scoredManifests, maxPacks) {
  const selected = [];
  const countByEffect = new Map();
  const passLimits = [1, 2, 3, maxPacks];
  for (const limit of passLimits) {
    for (const manifest of scoredManifests) {
      if (selected.some((row) => row.packId === manifest.packId)) continue;
      const current = countByEffect.get(manifest.effectName) || 0;
      if (current >= limit) continue;
      selected.push(manifest);
      countByEffect.set(manifest.effectName, current + 1);
      if (selected.length >= maxPacks) return selected;
    }
  }
  return selected;
}

const benchmark = readJson(benchmarkPath);
const automationPlan = readJson(path.join(repoRoot, "scripts/sequencer-render-training/catalog/effect-training-automation-plan-v1.json"), { effects: [] });
const coverage = readJson(path.join(repoRoot, "scripts/sequencer-render-training/catalog/effect-settings-coverage-report-v1.json"), { effects: [] });
const samplingAudit = readJson(path.join(repoRoot, "scripts/sequencer-render-training/catalog/effect-sampling-audit-v1.json"), { summary: {}, nextSamplingQueue: [], currentEffectQueue: [], newEffectExpansionQueue: [] });
const trainingLayout = readJson(path.join(repoRoot, "scripts/sequencer-render-training/catalog/generic-layout-model-catalog.json"), {});
const trainingShowDir = str(trainingLayout.showDir || path.join(repoRoot, "render-training"));
const trainingFixtureSequencePath = str(trainingLayout.fixtureSequencePath || path.join(trainingShowDir, "RenderTraining-AnimationFixture.xsq"));
const manifestDir = path.join(repoRoot, "scripts/sequencer-render-training/manifests");
const allManifests = listManifests(manifestDir);
const excludedNontrainingManifests = allManifests
  .filter((manifest) => !isTrainingFixtureManifest(manifest, trainingShowDir))
  .map((manifest) => ({
    packId: manifest.packId,
    sequencePath: manifest.sequencePath,
    reason: "not_under_training_show_dir"
  }));
const manifests = allowNontrainingFixtures
  ? allManifests
  : allManifests.filter((manifest) => isTrainingFixtureManifest(manifest, trainingShowDir));

const effectUsage =
  benchmark?.metrics?.effectUsageQuality
  || benchmark?.headlineMetrics?.effectUsageQuality
  || benchmark?.validation?.summary?.effectUsageQuality
  || {};
const renderQuality =
  benchmark?.metrics?.renderQuality
  || benchmark?.headlineMetrics?.renderQuality
  || benchmark?.validation?.summary?.renderQuality
  || {};
const diagnosticsAvailable = hasEffectUsageDiagnostics(effectUsage);
const needs = inferNeeds(effectUsage, renderQuality, diagnosticsAvailable);
const repeatedEffects = unique((effectUsage.topRepeatedConfigurations || []).map((row) => row.effectName));
const runnableNowEffects = unique((automationPlan.effects || [])
  .filter((row) => row.priority === "now" || row.readiness === "ready_for_parameter_screening")
  .map((row) => row.effectName));
const weakCoverageEffects = unique((coverage.effects || [])
  .filter((row) => row.coverageStatus === "registry_defined_not_screened" || row.coverageStatus === "screened_parameter_subset")
  .map((row) => row.effectName));
const knownEffects = unique([
  ...repeatedEffects,
  ...runnableNowEffects,
  ...weakCoverageEffects,
  ...arr(samplingAudit.nextSamplingQueue).map((row) => row.effectName),
  ...arr(samplingAudit.currentEffectQueue).map((row) => row.effectName),
  ...arr(samplingAudit.newEffectExpansionQueue).map((row) => row.effectName),
  ...(coverage.effects || []).map((row) => row.effectName)
]);
const manifestEffects = new Map(manifests.map((manifest) => [manifest.packId, inferManifestEffect(manifest, knownEffects)]));
const auditQueue = [
  ...arr(samplingAudit.currentEffectQueue),
  ...arr(samplingAudit.nextSamplingQueue),
  ...arr(samplingAudit.newEffectExpansionQueue)
].map((item) => ({
  ...item,
  effectName: str(item.effectName),
  parameterName: str(item.parameterName),
  parameterSlug: slug(item.parameterName)
})).filter((item) => item.effectName && item.parameterName);
const auditQueueByEffect = new Map();
for (const item of auditQueue) {
  const rows = auditQueueByEffect.get(item.effectName) || [];
  rows.push(item);
  auditQueueByEffect.set(item.effectName, rows);
}

const context = { needs, repeatedEffects, runnableNowEffects, weakCoverageEffects, manifestEffects, auditQueueByEffect };
const selectedManifests = selectDiverseManifests(manifests
  .map((manifest) => ({
    ...manifest,
    effectName: manifestEffects.get(manifest.packId) || "",
    selectionScore: manifestScore(manifest, context)
  }))
  .filter((manifest) => manifest.selectionScore > 0)
  .sort((a, b) => b.selectionScore - a.selectionScore || a.effectName.localeCompare(b.effectName) || a.packId.localeCompare(b.packId)), maxPacks)
  .map((manifest) => ({
    packId: manifest.packId,
    effectName: manifest.effectName,
    manifestPath: path.relative(repoRoot, manifest.path),
    selectionScore: manifest.selectionScore
  }));

const plan = {
  artifactType: "effects_usage_render_training_plan_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  sourceBenchmarkReport: path.relative(repoRoot, benchmarkPath),
  runMode: "plan_or_execute",
  principle: "Improve render-backed effect behavior knowledge. Do not tune scores or add selector heuristics to hide weak output.",
  diagnosticsAvailable,
  prerequisite: diagnosticsAvailable
    ? ""
    : "Run a fresh full-sequence benchmark after the effectUsageQuality metric landed so training needs can be selected from real diagnostics.",
  trainingDisplay: {
    layoutName: str(trainingLayout.layoutName || "RenderTraining"),
    showDir: trainingShowDir,
    fixtureSequencePath: trainingFixtureSequencePath,
    canonicalModelCount: Object.keys(trainingLayout.canonicalModels || {}).length,
    allowNontrainingFixtures,
    availableManifestCount: allManifests.length,
    eligibleManifestCount: manifests.length,
    excludedNontrainingManifestCount: excludedNontrainingManifests.length,
    excludedNontrainingManifests: excludedNontrainingManifests.slice(0, 50)
  },
  paletteProtocol: {
    profiles: ["mono_white", "rgb_primary"],
    defaultPalettePath: process.env.TRAINING_DEFAULT_PALETTE_PATH || "/Users/robterry/xLights-2026.06/resources/palettes/Default.xpalette",
    profileActivation: {
      mono_white: [1],
      rgb_primary: [2, 3, 4]
    },
    executionEnv: "TRAINING_PALETTE_PROTOCOL=mono_white,rgb_primary"
  },
  apiStaging: {
    optionalEnv: "TRAINING_API_STAGING_ROOT",
    purpose: "Stage the canonical render-training show into an xLights-accessible root when macOS sandbox access blocks direct API open.",
    recommendedRoot: process.env.TRAINING_API_STAGING_ROOT || ""
  },
  diagnostics: {
    effectUsageScore: Number(effectUsage.score || 0),
    band: str(effectUsage.band),
    dimensions: effectUsage.dimensions || {},
    configuredBehaviorCoverage: Number(effectUsage.configuredBehaviorCoverage || 0),
    parameterPriorCoverage: Number(effectUsage.parameterPriorCoverage || 0),
    thinSettingShare: Number(effectUsage.thinSettingShare || 0),
    bareOnShare: Number(effectUsage.bareOnShare || 0),
    exactSignatureDominance: Number(effectUsage.exactSignatureDominance || 0),
    maxSectionSignatureShare: Number(effectUsage.maxSectionSignatureShare || 0),
    topRepeatedConfigurations: effectUsage.topRepeatedConfigurations || [],
    renderQuality: {
      overallScore: Number(renderQuality.overallScore || 0),
      band: str(renderQuality.band),
      dimensions: renderQuality.dimensions || {},
      issues: Array.isArray(renderQuality.issues) ? renderQuality.issues : [],
      basis: renderQuality.basis || {}
    }
  },
  selectedTrainingNeeds: needs,
  candidateSignals: {
    repeatedEffects,
    runnableNowEffects,
    weakCoverageEffects,
    effectSamplingAudit: {
      summary: samplingAudit.summary || {},
      currentEffectQueueCount: arr(samplingAudit.currentEffectQueue).length,
      newEffectExpansionQueueCount: arr(samplingAudit.newEffectExpansionQueue).length,
      nextSamplingQueueCount: arr(samplingAudit.nextSamplingQueue).length,
      topCurrentEffectQueue: arr(samplingAudit.currentEffectQueue).slice(0, 20),
      topNewEffectExpansionQueue: arr(samplingAudit.newEffectExpansionQueue).slice(0, 20)
    }
  },
  selectedManifests,
  promotionRequirements: [
    "xLights render sweeps complete without modal or renderer-state failures",
    "behavior capability records increase or improve for selected effect/geometry/setting combinations",
    "derived parameter priors are rebuilt from render evidence",
    "selector-facing bundles are exported only after tests and benchmark validation",
    "quality metric changes are explained by record/prior changes, not scorer weight changes"
  ],
  outputs: {
    commandList: path.relative(repoRoot, commandListPath)
  }
};

fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
	const commands = [
	  "#!/usr/bin/env bash",
	  "set -euo pipefail",
	  ...selectedManifests.map((row) => `TRAINING_PALETTE_PROTOCOL=mono_white,rgb_primary${process.env.TRAINING_API_STAGING_ROOT ? ` TRAINING_API_STAGING_ROOT="${process.env.TRAINING_API_STAGING_ROOT}/${row.packId}"` : ""} bash scripts/sequencer-render-training/runners/run-packed-model-batch.sh --manifest ${row.manifestPath} --out-dir "${path.dirname(planPath)}/${row.packId}"`)
	];
fs.writeFileSync(commandListPath, `${commands.join("\n")}\n`, { mode: 0o755 });
console.log(JSON.stringify({ planPath, selectedManifestCount: selectedManifests.length, needs }, null, 2));
NODE

log "plan-written ${PLAN_PATH}"

if [[ "${MODE}" == "plan" ]]; then
  log "planning-complete command-list=${COMMAND_LIST}"
  exit 0
fi

source "${ROOT_DIR}/tooling/lib.sh"
ensure_xlights_ready >>"${LOG_PATH}" 2>&1

selected_manifest_rows_path="${RUN_ROOT}/selected-manifests.tsv"
node --input-type=module - "${PLAN_PATH}" > "${selected_manifest_rows_path}" <<'NODE'
import fs from "node:fs";
const plan = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const row of plan.selectedManifests || []) console.log(`${row.packId}\t${row.manifestPath}`);
NODE

results='[]'
while IFS= read -r manifest_row; do
  [[ -n "${manifest_row}" ]] || continue
  pack_id="${manifest_row%%$'\t'*}"
  manifest_rel="${manifest_row#*$'\t'}"
  manifest_path="${REPO_ROOT}/${manifest_rel}"
  pack_run_dir="${RUN_ROOT}/${pack_id}"
  mkdir -p "${pack_run_dir}"
  log "pack-begin ${pack_id}"
  status="passed"
  error_message=""

  staging_env=()
  if [[ -n "${TRAINING_API_STAGING_ROOT:-}" ]]; then
    staging_env=(TRAINING_API_STAGING_ROOT="${TRAINING_API_STAGING_ROOT}/${pack_id}")
    rm -rf "${TRAINING_API_STAGING_ROOT:?}/${pack_id}"
  fi
  env_args=(TRAINING_PALETTE_PROTOCOL="${TRAINING_PALETTE_PROTOCOL:-mono_white,rgb_primary}")
  if [[ "${#staging_env[@]}" -gt 0 ]]; then
    env_args+=("${staging_env[@]}")
  fi
  if ! env "${env_args[@]}" bash "${SCRIPT_DIR}/run-packed-model-batch.sh" --manifest "${manifest_path}" --out-dir "${pack_run_dir}" >>"${LOG_PATH}" 2>&1; then
    status="failed"
    error_message="run-packed-model-batch failed"
  fi
  if [[ -n "${TRAINING_API_STAGING_ROOT:-}" ]]; then
    log "pack-staging-preserved ${TRAINING_API_STAGING_ROOT}/${pack_id}"
  fi

  results="$(jq -cn \
    --argjson rows "${results}" \
    --arg packId "${pack_id}" \
    --arg manifest "${manifest_rel}" \
    --arg runDir "${pack_run_dir}" \
    --arg status "${status}" \
    --arg errorMessage "${error_message}" \
    '$rows + [{packId:$packId,manifest:$manifest,runDir:$runDir,status:$status,errorMessage:$errorMessage}]')"
  log "pack-end ${pack_id} status=${status}"
done < "${selected_manifest_rows_path}"

staging_dir="${RUN_ROOT}/staging"
mkdir -p "${staging_dir}/behavior-capability-records"
staging_training_set="${staging_dir}/sequencer-unified-training-set-v1.json"
learning_gate_path="${RUN_ROOT}/learning-gate.json"

if [[ "${PROMOTE}" == "1" ]]; then
  log "promotion-gate-begin"
  node "${ROOT_DIR}/tooling/build-unified-training-set.mjs" \
    "${staging_training_set}" \
    "${ROOT_DIR}/catalog/effect-family-outcomes" \
    "${RUN_ROOT}" >>"${LOG_PATH}" 2>&1
  node "${ROOT_DIR}/tooling/build-effects-usage-learning-gate.mjs" \
    --run-root "${RUN_ROOT}" \
    --training-set "${staging_training_set}" \
    --existing-records-dir "${ROOT_DIR}/catalog/effect-screening-records" \
    --out "${learning_gate_path}" >>"${LOG_PATH}" 2>&1
  if [[ "$(jq -r '.summary.promotionReady // false' "${learning_gate_path}")" != "true" ]]; then
    echo "Promotion gate failed. See ${learning_gate_path}" >&2
    exit 1
  fi
  log "promotion-gate-complete"
  log "promotion-begin"
  promoted_record_count="0"
  refreshed_record_count="0"
  promoted_records_dir="${ROOT_DIR}/catalog/effect-screening-records"
  mkdir -p "${promoted_records_dir}"
  while IFS= read -r record_path; do
    record_name="$(basename "${record_path}")"
    dest_path="${promoted_records_dir}/${record_name}"
    if [[ -f "${dest_path}" ]] && ! cmp -s "${record_path}" "${dest_path}"; then
      node --input-type=module - "${dest_path}" "${record_path}" <<'NODE'
import fs from "node:fs";

const [existingPath, candidatePath] = process.argv.slice(2);
const existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));

function selectStable(record) {
  const fixture = record.fixture || {};
  const shared = record.sharedSettings || {};
  return {
    sampleId: record.sampleId || "",
    effectName: record.effectName || "",
    placementId: record.placementId || null,
    effectSettings: record.effectSettings || {},
    trainingContext: record.trainingContext || {},
    fixture: {
      modelName: fixture.modelName || "",
      modelType: fixture.modelType || "",
      geometryProfile: fixture.geometryProfile || "",
      expectedModelType: fixture.expectedModelType || "",
      startMs: fixture.startMs ?? null,
      endMs: fixture.endMs ?? null,
      durationMs: fixture.durationMs ?? null,
      durationClass: fixture.durationClass || ""
    },
    sharedSettings: {
      renderStyle: shared.renderStyle || "",
      paletteProfile: shared.paletteProfile || "",
      trainingPaletteStandard: shared.trainingPaletteStandard || "",
      paletteActivationMode: shared.paletteActivationMode || "",
      paletteActiveSlots: shared.paletteActiveSlots || [],
      trainingBrightnessPercent: shared.trainingBrightnessPercent ?? null,
      brightnessPolicy: shared.brightnessPolicy || ""
    }
  };
}

const existingStable = JSON.stringify(selectStable(existing));
const candidateStable = JSON.stringify(selectStable(candidate));
if (existingStable !== candidateStable) {
  console.error(`Promotion would overwrite a screening record with different stable identity: ${existingPath}`);
  process.exit(1);
}
NODE
      cp "${record_path}" "${dest_path}"
      refreshed_record_count="$((refreshed_record_count + 1))"
      continue
    fi
    if [[ ! -f "${dest_path}" ]]; then
      cp "${record_path}" "${dest_path}"
      promoted_record_count="$((promoted_record_count + 1))"
    fi
  done < <(find "${RUN_ROOT}" -path "${staging_dir}" -prune -o -name '*.record.json' -type f -print | sort)
  log "promotion-records-complete promoted=${promoted_record_count} refreshed=${refreshed_record_count}"
  node "${ROOT_DIR}/tooling/build-unified-training-set.mjs" >>"${LOG_PATH}" 2>&1
  node "${ROOT_DIR}/tooling/build-effect-settings-coverage-report.mjs" >>"${LOG_PATH}" 2>&1
  node "${ROOT_DIR}/tooling/build-behavior-capability-records.mjs" >>"${LOG_PATH}" 2>&1
  node "${ROOT_DIR}/tooling/export-behavior-capability-records-bundle.mjs" >>"${LOG_PATH}" 2>&1
  node "${ROOT_DIR}/tooling/export-derived-parameter-priors-bundle.mjs" \
    --input "${ROOT_DIR}/catalog/sequencer-unified-training-set-v1.json" \
    --output "${REPO_ROOT}/apps/xlightsdesigner-ui/agent/sequence-agent/generated/derived-parameter-priors-bundle.js" >>"${LOG_PATH}" 2>&1
  node "${ROOT_DIR}/tooling/export-cross-effect-shared-settings-bundle.mjs" \
    --input "${ROOT_DIR}/catalog/sequencer-unified-training-set-v1.json" \
    --output "${REPO_ROOT}/apps/xlightsdesigner-ui/agent/sequence-agent/generated/cross-effect-shared-settings-bundle.js" >>"${LOG_PATH}" 2>&1
  log "promotion-complete"
else
  log "staging-build-begin"
  node "${ROOT_DIR}/tooling/build-unified-training-set.mjs" \
    "${staging_training_set}" \
    "${ROOT_DIR}/catalog/effect-family-outcomes" \
    "${RUN_ROOT}" >>"${LOG_PATH}" 2>&1
  node "${ROOT_DIR}/tooling/build-behavior-capability-records.mjs" \
    "${staging_dir}/behavior-capability-records" \
    "${staging_training_set}" >>"${LOG_PATH}" 2>&1
  node "${ROOT_DIR}/tooling/export-behavior-capability-records-bundle.mjs" \
    "${staging_dir}/behavior-capability-records" \
    "${staging_dir}/behavior-capability-records-bundle.js" >>"${LOG_PATH}" 2>&1
  node "${ROOT_DIR}/tooling/export-derived-parameter-priors-bundle.mjs" \
    --input "${staging_training_set}" \
    --output "${staging_dir}/derived-parameter-priors-bundle.js" >>"${LOG_PATH}" 2>&1
  node "${ROOT_DIR}/tooling/build-effects-usage-learning-gate.mjs" \
    --run-root "${RUN_ROOT}" \
    --training-set "${staging_training_set}" \
    --existing-records-dir "${ROOT_DIR}/catalog/effect-screening-records" \
    --out "${learning_gate_path}" >>"${LOG_PATH}" 2>&1
  log "staging-build-complete"
fi

jq -cn \
		  --arg runRoot "${RUN_ROOT}" \
		  --arg benchmarkReport "${BENCHMARK_REPORT}" \
		  --arg planPath "${PLAN_PATH}" \
		  --arg mode "${MODE}" \
		  --arg promote "${PROMOTE}" \
		  --arg learningGatePath "${learning_gate_path}" \
		  --slurpfile plan "${PLAN_PATH}" \
		  --slurpfile learningGate "${learning_gate_path}" \
		  --argjson results "${results}" \
		  '($plan[0] // {}) as $trainingPlan
		  | ($learningGate[0] // {}) as $gate
		  | {
	      artifactType:"effects_usage_render_training_summary_v1",
	      generatedAt:now|todate,
	      runRoot:$runRoot,
	      benchmarkReport:$benchmarkReport,
	      planPath:$planPath,
	      mode:$mode,
	      promote:($promote=="1"),
	      trainingDisplay:$trainingPlan.trainingDisplay,
	      selectedTrainingNeeds:($trainingPlan.selectedTrainingNeeds // []),
	      paletteProtocol:$trainingPlan.paletteProtocol,
		      diagnostics:$trainingPlan.diagnostics,
		      learningGatePath:$learningGatePath,
		      learningGate:($gate.summary // {}),
		      promotionBlockers:($gate.blockers // []),
		      packCount:($results|length),
	      passedCount:($results|map(select(.status=="passed"))|length),
	      failedCount:($results|map(select(.status!="passed"))|length),
	      results:$results
	    }' \
	  > "${SUMMARY_PATH}"

log "complete summary=${SUMMARY_PATH}"
