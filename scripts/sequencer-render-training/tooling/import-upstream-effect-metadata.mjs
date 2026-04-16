import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKey(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function stable(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stable(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => [key, stable(value[key])])
    );
  }
  return value;
}

const EFFECT_ALIASES = new Map([
  ["on", "On"],
  ["singlestrand", "SingleStrand"],
  ["shimmer", "Shimmer"],
  ["bars", "Bars"],
  ["spirals", "Spirals"],
  ["marquee", "Marquee"],
  ["pinwheel", "Pinwheel"],
  ["shockwave", "Shockwave"],
  ["twinkle", "Twinkle"],
  ["colorwash", "Color Wash"]
]);

const PARAMETER_ALIASES = {
  On: {
    startLevel: ["Eff_On_Start"],
    endLevel: ["Eff_On_End"],
    cycles: ["On_Cycles"],
    shimmer: ["On_Shimmer"]
  },
  SingleStrand: {
    mode: ["SingleStrand_Colors", "SingleStrand_FX"],
    numberChases: ["Number_Chases"],
    chaseSize: ["Color_Mix1"],
    cycles: ["Chase_Rotations"],
    skipSize: ["Skips_SkipSize"],
    bandSize: ["Skips_BandSize"],
    advances: ["Skips_Advance"],
    intensity: ["FX_Intensity"],
    chaseType: ["Chase_Type1"],
    fadeType: ["Fade_Type"]
  },
  Shimmer: {
    dutyFactor: ["Shimmer_Duty_Factor"],
    cycles: ["Shimmer_Cycles"],
    useAllColors: ["Shimmer_Use_All_Colors"]
  },
  Bars: {
    barCount: ["Bars_BarCount"],
    cycles: ["Bars_Cycles"],
    direction: ["Bars_Direction"],
    highlight: ["Bars_Highlight"],
    "3D": ["Bars_3D"],
    gradient: ["Bars_Gradient"]
  },
  Spirals: {
    count: ["Spirals_Count"],
    rotation: ["Spirals_Rotation"],
    thickness: ["Spirals_Thickness"],
    movement: ["Spirals_Movement"],
    blend: ["Spirals_Blend"],
    "3D": ["Spirals_3D"],
    grow: ["Spirals_Grow"],
    shrink: ["Spirals_Shrink"]
  },
  Marquee: {
    bandSize: ["Marquee_Band_Size"],
    skipSize: ["Marquee_Skip_Size"],
    thickness: ["Marquee_Thickness"],
    stagger: ["Marquee_Stagger"],
    speed: ["Marquee_Speed"],
    reverse: ["Marquee_Reverse"]
  },
  Pinwheel: {
    arms: ["Pinwheel_Arms"],
    armSize: ["Pinwheel_ArmSize"],
    twist: ["Pinwheel_Twist"],
    thickness: ["Pinwheel_Thickness"],
    speed: ["Pinwheel_Speed"],
    style: ["Pinwheel_Style"],
    rotation: ["Pinwheel_Rotation"],
    "3DMode": ["Pinwheel_3D"]
  },
  Shockwave: {
    centerX: ["Shockwave_CenterX"],
    centerY: ["Shockwave_CenterY"],
    startRadius: ["Shockwave_Start_Radius"],
    endRadius: ["Shockwave_End_Radius"],
    startWidth: ["Shockwave_Start_Width"],
    endWidth: ["Shockwave_End_Width"],
    accel: ["Shockwave_Accel"],
    cycles: ["Shockwave_Cycles"],
    blendEdges: ["Shockwave_Blend_Edges"],
    scale: ["Shockwave_Scale"]
  },
  Twinkle: {
    count: ["Twinkle_Count"],
    steps: ["Twinkle_Steps"],
    style: ["Twinkle_Style"],
    strobe: ["Twinkle_Strobe"],
    reRandomize: ["Twinkle_ReRandom"]
  },
  "Color Wash": {
    cycles: ["ColorWash_Cycles"],
    vFade: ["ColorWash_VFade"],
    hFade: ["ColorWash_HFade"],
    reverseFades: ["ColorWash_ReverseFades"],
    shimmer: ["ColorWash_Shimmer"],
    circularPalette: ["ColorWash_CircularPalette"]
  }
};

function summarizeProperty(property = {}) {
  return {
    id: property.id || null,
    label: property.label || null,
    description: property.description || property.tooltip || null,
    type: property.type || null,
    controlType: property.controlType || null,
    default: property.default,
    min: property.min ?? null,
    max: property.max ?? null,
    divisor: property.divisor ?? 1,
    valueCurve: Boolean(property.valueCurve),
    vcMin: property.vcMin ?? null,
    vcMax: property.vcMax ?? null,
    lockable: Boolean(property.lockable),
    options: Array.isArray(property.options) ? property.options : [],
    dynamicOptions: property.dynamicOptions || null,
    separator: Boolean(property.separator),
    suppressIfDefault: Boolean(property.suppressIfDefault),
    settingPrefix: property.settingPrefix || null,
    fileFilter: property.fileFilter || null,
    fileMessage: property.fileMessage || null
  };
}

function collectFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
}

const outputDir = process.argv[2]
  ? resolve(process.argv[2])
  : resolve("scripts/sequencer-render-training/catalog/upstream-effectmetadata");
const sourceDir = process.argv[3]
  ? resolve(process.argv[3])
  : resolve("/Users/robterry/xLights-2026.06/resources/effectmetadata");
const registryPath = process.argv[4]
  ? resolve(process.argv[4])
  : resolve("scripts/sequencer-render-training/catalog/effect-parameter-registry.json");
const xlightsVersion = process.argv[5] || "2026.06";

mkdirSync(outputDir, { recursive: true });

const registry = loadJson(registryPath);
const sharedDir = join(sourceDir, "shared");
const schemaPath = join(sourceDir, "_schema.json");

const schema = loadJson(schemaPath);
const effectFiles = collectFiles(sourceDir).filter((name) => name !== "_schema.json");
const sharedFiles = collectFiles(sharedDir);

const effects = [];
const fileFingerprints = [];
for (const fileName of effectFiles) {
  const path = join(sourceDir, fileName);
  const rawText = readFileSync(path, "utf8");
  const raw = JSON.parse(rawText);
  fileFingerprints.push({
    kind: "effect",
    fileName,
    sha256: sha256(rawText)
  });
  effects.push({
    effectName: raw.effectName,
    sourceFile: fileName,
    sourcePath: path,
    jsonSha256: sha256(rawText),
    canvasMode: Boolean(raw.canvasMode),
    propertyCount: Array.isArray(raw.properties) ? raw.properties.length : 0,
    groupCount: Array.isArray(raw.groups) ? raw.groups.length : 0,
    visibilityRuleCount: Array.isArray(raw.visibilityRules) ? raw.visibilityRules.length : 0,
    properties: (Array.isArray(raw.properties) ? raw.properties : []).map((property) => summarizeProperty(property)),
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    visibilityRules: Array.isArray(raw.visibilityRules) ? raw.visibilityRules : []
  });
}

const shared = {};
for (const fileName of sharedFiles) {
  const path = join(sharedDir, fileName);
  const rawText = readFileSync(path, "utf8");
  const raw = JSON.parse(rawText);
  fileFingerprints.push({
    kind: "shared",
    fileName: `shared/${fileName}`,
    sha256: sha256(rawText)
  });
  shared[basename(fileName, ".json")] = {
    sourceFile: fileName,
    jsonSha256: sha256(rawText),
    propertyCount: Array.isArray(raw.properties) ? raw.properties.length : 0,
    properties: (Array.isArray(raw.properties) ? raw.properties : []).map((property) => summarizeProperty(property)),
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    visibilityRules: Array.isArray(raw.visibilityRules) ? raw.visibilityRules : []
  };
}

const normalizedBundle = {
  artifactType: "xlights_effect_metadata_bundle_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  source: {
    xlightsVersion,
    sourceDir,
    schemaPath,
    schemaSha256: sha256(readFileSync(schemaPath, "utf8"))
  },
  schema,
  effectCount: effects.length,
  sharedCount: Object.keys(shared).length,
  effects: effects.sort((a, b) => a.effectName.localeCompare(b.effectName)),
  shared
};

const effectiveRegistry = {
  ...registry,
  version: registry.version || "1.0",
  metadataSource: {
    type: "xlights_effectmetadata_overlay",
    xlightsVersion,
    generatedAt: normalizedBundle.generatedAt,
    bundlePath: join(outputDir, `xlights-effectmetadata-bundle-${xlightsVersion}.json`)
  },
  effects: {}
};

const fingerprint = {
  artifactType: "xlights_effect_metadata_fingerprint_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  xlightsVersion,
  sourceDir,
  schemaSha256: normalizedBundle.source.schemaSha256,
  effectCount: effects.length,
  sharedCount: Object.keys(shared).length,
  fileFingerprints: fileFingerprints.sort((a, b) => a.fileName.localeCompare(b.fileName)),
  bundleSha256: sha256(JSON.stringify(stable(normalizedBundle)))
};

const upstreamEffectsByLocalName = new Map();
for (const effect of effects) {
  const normalized = normalizeKey(effect.effectName);
  const localName = EFFECT_ALIASES.get(normalized) || effect.effectName;
  upstreamEffectsByLocalName.set(localName, effect);
}

const diff = {
  artifactType: "xlights_effect_metadata_diff_v1",
  artifactVersion: "1.0",
  generatedAt: new Date().toISOString(),
  xlightsVersion,
  sourceDir,
  registryPath,
  localRegistryEffectCount: Object.keys(registry.effects || {}).length,
  upstreamEffectCount: effects.length,
  overlapEffects: [],
  registryOnlyEffects: [],
  upstreamOnlyEffects: [],
  breakingChanges: [],
  warnings: []
};

const localEffectNames = Object.keys(registry.effects || {}).sort((a, b) => a.localeCompare(b));
const upstreamEffectNames = new Set(effects.map((effect) => effect.effectName));

for (const effectName of localEffectNames) {
  const localEffect = registry.effects?.[effectName] || {};
  const upstreamEffect = upstreamEffectsByLocalName.get(effectName) || null;
  if (!upstreamEffect) {
    effectiveRegistry.effects[effectName] = localEffect;
    diff.registryOnlyEffects.push(effectName);
    diff.warnings.push({
      type: "registry_only_effect",
      effectName,
      message: `Local registry effect '${effectName}' has no upstream effectmetadata match`
    });
    continue;
  }

  const localParams = localEffect.parameters || {};
  const upstreamById = new Map((upstreamEffect.properties || []).map((property) => [property.id, property]));
  const aliases = PARAMETER_ALIASES[effectName] || {};
  const parameterRows = [];
  const mergedParams = {};

  for (const parameterName of Object.keys(localParams).sort((a, b) => a.localeCompare(b))) {
    const aliasIds = aliases[parameterName] || [];
    const matched = aliasIds.map((id) => upstreamById.get(id)).find(Boolean) || null;
    const localParam = localParams[parameterName];
    const row = {
      localParameter: parameterName,
      upstreamId: matched?.id || null,
      upstreamLabel: matched?.label || null,
      matched: Boolean(matched),
      localType: localParam.type || null,
      upstreamType: matched?.type || null,
      localRange: localParam.range || null,
      upstreamRange: matched ? { min: matched.min, max: matched.max } : null,
      localAnchors: Array.isArray(localParam.anchors) ? localParam.anchors : [],
      upstreamDefault: matched?.default,
      localAppliesWhen: localParam.appliesWhen || null,
      upstreamVisibilityRuleCount: Array.isArray(upstreamEffect.visibilityRules) ? upstreamEffect.visibilityRules.length : 0
    };
    parameterRows.push(row);

    if (!matched) {
      diff.breakingChanges.push({
        type: "missing_upstream_parameter_mapping",
        effectName,
        localParameter: parameterName,
        expectedUpstreamIds: aliasIds
      });
    }
    mergedParams[parameterName] = {
      ...localParam,
      upstream: matched
        ? {
            id: matched.id,
            label: matched.label,
            description: matched.description || null,
            type: matched.type,
            controlType: matched.controlType,
            default: matched.default,
            min: matched.min ?? null,
            max: matched.max ?? null,
            divisor: matched.divisor ?? 1,
            valueCurve: Boolean(matched.valueCurve),
            vcMin: matched.vcMin ?? null,
            vcMax: matched.vcMax ?? null,
            lockable: Boolean(matched.lockable),
            options: Array.isArray(matched.options) ? matched.options : [],
            dynamicOptions: matched.dynamicOptions || null,
            suppressIfDefault: Boolean(matched.suppressIfDefault)
          }
        : null
    };
  }

  const mappedUpstreamIds = new Set(Object.values(aliases).flat());
  const unmappedUpstreamProperties = (upstreamEffect.properties || [])
    .filter((property) => !mappedUpstreamIds.has(property.id))
    .map((property) => ({
      id: property.id,
      label: property.label
    }));

  diff.overlapEffects.push({
    effectName,
    localParameterCount: Object.keys(localParams).length,
    upstreamPropertyCount: upstreamEffect.properties.length,
    upstreamVisibilityRuleCount: upstreamEffect.visibilityRuleCount,
    matchedParameterCount: parameterRows.filter((row) => row.matched).length,
    missingParameterCount: parameterRows.filter((row) => !row.matched).length,
    parameterMappings: parameterRows,
    unmappedUpstreamProperties
  });
  effectiveRegistry.effects[effectName] = {
    ...localEffect,
    upstreamEffectName: upstreamEffect.effectName,
    upstreamSourceFile: upstreamEffect.sourceFile,
    upstreamPropertyCount: upstreamEffect.propertyCount,
    upstreamVisibilityRuleCount: upstreamEffect.visibilityRuleCount,
    upstreamSharedMetadata: ["Buffer", "Color", "Timing"],
    parameters: mergedParams,
    upstreamUnmappedProperties: unmappedUpstreamProperties
  };
}

for (const effect of effects) {
  const localName = EFFECT_ALIASES.get(normalizeKey(effect.effectName)) || effect.effectName;
  if (!registry.effects?.[localName]) {
    diff.upstreamOnlyEffects.push(effect.effectName);
  }
}

diff.ok = diff.breakingChanges.length === 0;

const bundlePath = join(outputDir, `xlights-effectmetadata-bundle-${xlightsVersion}.json`);
const fingerprintPath = join(outputDir, `xlights-effectmetadata-fingerprint-${xlightsVersion}.json`);
const diffPath = join(outputDir, `xlights-effectmetadata-diff-${xlightsVersion}.json`);
const mdPath = join(outputDir, `xlights-effectmetadata-diff-${xlightsVersion}.md`);
const effectiveRegistryVersionedPath = join(outputDir, `effective-effect-parameter-registry-${xlightsVersion}.json`);
const effectiveRegistryCanonicalPath = resolve("scripts/sequencer-render-training/catalog/effective-effect-parameter-registry.json");

writeFileSync(bundlePath, `${JSON.stringify(normalizedBundle, null, 2)}\n`, "utf8");
writeFileSync(fingerprintPath, `${JSON.stringify(fingerprint, null, 2)}\n`, "utf8");
writeFileSync(diffPath, `${JSON.stringify(diff, null, 2)}\n`, "utf8");
writeFileSync(effectiveRegistryVersionedPath, `${JSON.stringify(effectiveRegistry, null, 2)}\n`, "utf8");
writeFileSync(effectiveRegistryCanonicalPath, `${JSON.stringify(effectiveRegistry, null, 2)}\n`, "utf8");

let md = "# xLights Effect Metadata Import\n\n";
md += `Generated: ${normalizedBundle.generatedAt}\n\n`;
md += `xLights version: \`${xlightsVersion}\`\n`;
md += `Upstream effects: ${effects.length}\n`;
md += `Shared metadata files: ${Object.keys(shared).length}\n`;
md += `Bundle hash: \`${fingerprint.bundleSha256}\`\n\n`;
md += "## Diff Summary\n\n";
md += `- overlap effects: ${diff.overlapEffects.length}\n`;
md += `- local-only effects: ${diff.registryOnlyEffects.length}\n`;
md += `- upstream-only effects: ${diff.upstreamOnlyEffects.length}\n`;
md += `- breaking changes: ${diff.breakingChanges.length}\n\n`;
md += "## Registry-Only Effects\n\n";
md += diff.registryOnlyEffects.length
  ? diff.registryOnlyEffects.map((effectName) => `- ${effectName}\n`).join("")
  : "- none\n";
md += "\n## Upstream-Only Effects\n\n";
md += diff.upstreamOnlyEffects.length
  ? diff.upstreamOnlyEffects.map((effectName) => `- ${effectName}\n`).join("")
  : "- none\n";
md += "\n## Overlap Effects\n\n";
for (const row of diff.overlapEffects) {
  md += `### ${row.effectName}\n\n`;
  md += `- local parameters: ${row.localParameterCount}\n`;
  md += `- upstream properties: ${row.upstreamPropertyCount}\n`;
  md += `- matched parameters: ${row.matchedParameterCount}\n`;
  md += `- missing mappings: ${row.missingParameterCount}\n`;
  if (row.unmappedUpstreamProperties.length) {
    md += `- unmapped upstream properties: ${row.unmappedUpstreamProperties.map((property) => `${property.id} (${property.label})`).join(", ")}\n`;
  }
  md += "\n";
}
md += "## Breaking Changes\n\n";
md += diff.breakingChanges.length
  ? diff.breakingChanges.map((row) => `- ${row.effectName}.${row.localParameter}: expected ${row.expectedUpstreamIds.join(", ") || "no alias configured"}\n`).join("")
  : "- none\n";

writeFileSync(mdPath, md, "utf8");

console.log(JSON.stringify({
  ok: true,
  diffOk: diff.ok,
  bundlePath,
  fingerprintPath,
  diffPath,
  mdPath,
  effectiveRegistryVersionedPath,
  effectiveRegistryCanonicalPath,
  overlapEffectCount: diff.overlapEffects.length,
  breakingChangeCount: diff.breakingChanges.length
}, null, 2));
