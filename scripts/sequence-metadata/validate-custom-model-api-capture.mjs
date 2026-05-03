import fs from "node:fs";
import path from "node:path";

import { getMediaStatus, getModel, getModelNodes, getModels, getSubmodels, setShowDirectory } from "../../apps/xlightsdesigner-ui/api.js";
import { classifyModelDisplayType } from "../../apps/xlightsdesigner-ui/agent/sequence-agent/model-type-catalog.js";
import { buildNormalizedTargetMetadataRecords } from "../../apps/xlightsdesigner-ui/runtime/target-metadata-runtime.js";

function norm(value = "") {
  return String(value || "").trim();
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    endpoint: process.env.XLIGHTS_ENDPOINT || "http://127.0.0.1:49915/xlightsdesigner/api",
    showDir: "",
    forceShowDir: false,
    permanentShowDir: false,
    output: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--endpoint" || arg === "-e") {
      args.endpoint = argv[++index] || args.endpoint;
    } else if (arg === "--show-dir") {
      args.showDir = argv[++index] || "";
    } else if (arg === "--force-show-dir") {
      args.forceShowDir = true;
    } else if (arg === "--permanent-show-dir") {
      args.permanentShowDir = true;
    } else if (arg === "--output" || arg === "-o") {
      args.output = argv[++index] || "";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function isCustomModel(row = {}) {
  return classifyModelDisplayType(row?.displayAs || row?.type || row?.displayType || row?.DisplayAs || "")?.canonicalType === "custom";
}

function customAttributesFrom(row = {}) {
  return {
    ...(row?.attributes && typeof row.attributes === "object" && !Array.isArray(row.attributes) ? row.attributes : {}),
    ...Object.fromEntries([
      "DisplayAs",
      "CustomModel",
      "CustomModelCompressed",
      "PixelCount",
      "StringType",
      "ModelChain"
    ].filter((key) => norm(row?.[key])).map((key) => [key, String(row[key])]))
  };
}

function hasCustomGrid(row = {}) {
  const attrs = customAttributesFrom(row);
  return Boolean(norm(attrs.CustomModel) || norm(attrs.CustomModelCompressed));
}

function hasNodeLayout(row = {}) {
  const nodeLayout = row?.nodeLayout || row?.attributes?.customNodeLayout;
  return Boolean(
    Array.isArray(nodeLayout?.nodes) && nodeLayout.nodes.length
    || Array.isArray(nodeLayout?.modelNodes) && nodeLayout.modelNodes.length
    || Array.isArray(nodeLayout?.data?.nodes) && nodeLayout.data.nodes.length
  );
}

function countBy(values = []) {
  const counts = {};
  for (const value of values) {
    const key = norm(value) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function summarizeCustomModelStructure(records = []) {
  const profileCounts = {};
  let customModelCount = 0;
  let modelsWithSubmodels = 0;
  for (const row of records) {
    const structure = row?.structure?.customStructure;
    if (row?.targetKind !== "model" || !structure) continue;
    customModelCount += 1;
    if (Number(structure?.submodels?.count || 0) > 0) modelsWithSubmodels += 1;
    const profile = norm(structure?.profile || "unknown") || "unknown";
    profileCounts[profile] = Number(profileCounts[profile] || 0) + 1;
  }
  return { customModelCount, modelsWithSubmodels, profileCounts };
}

function modelDetailPayload(body = {}) {
  const data = body?.data && typeof body.data === "object" ? body.data : body;
  if (data?.model && typeof data.model === "object") return data.model;
  if (Array.isArray(data?.models) && data.models.length) return data.models[0];
  return data && typeof data === "object" ? data : {};
}

function mergeModelDetail(summary = {}, detailBody = {}) {
  const detail = modelDetailPayload(detailBody);
  return {
    ...summary,
    ...detail,
    id: norm(summary?.id || summary?.name || detail?.id || detail?.name),
    name: norm(summary?.name || detail?.name || summary?.id),
    displayAs: norm(summary?.displayAs || detail?.displayAs || detail?.DisplayAs || summary?.type || detail?.type),
    type: norm(summary?.type || detail?.type || detail?.DisplayAs || detail?.displayAs),
    attributes: {
      ...customAttributesFrom(summary),
      ...customAttributesFrom(detail)
    },
    faceInfo: detail?.faceInfo || summary?.faceInfo || null
  };
}

function submodelRowsFrom(body = {}) {
  const rows = Array.isArray(body?.data?.submodels) ? body.data.submodels : [];
  return rows.map((row) => {
    const id = norm(row?.fullName || row?.id || row?.name);
    const parentId = norm(row?.parentName || row?.parentId || (id.includes("/") ? id.split("/")[0] : ""));
    const name = norm(row?.name || (parentId && id.startsWith(`${parentId}/`) ? id.slice(parentId.length + 1) : id));
    return {
      ...row,
      id,
      name,
      parentId,
      type: "submodel",
      attributes: row?.attributes && typeof row.attributes === "object" && !Array.isArray(row.attributes) ? row.attributes : row
    };
  }).filter((row) => row.id);
}

async function main() {
  const args = parseArgs();
  let showDirectorySwitch = null;
  let mediaStatus = null;
  try {
    mediaStatus = await getMediaStatus(args.endpoint);
  } catch {
    mediaStatus = null;
  }
  if (args.showDir) {
    const requestedShowDir = path.resolve(args.showDir);
    const activeShowDir = mediaStatus?.data?.showDirectory ? path.resolve(mediaStatus.data.showDirectory) : "";
    if (activeShowDir === requestedShowDir) {
      showDirectorySwitch = {
        ok: true,
        skipped: true,
        reason: "already-active",
        data: { showDirectory: activeShowDir }
      };
    } else {
      showDirectorySwitch = await setShowDirectory(args.endpoint, requestedShowDir, {
        force: args.forceShowDir,
        permanent: args.permanentShowDir
      });
      try {
        mediaStatus = await getMediaStatus(args.endpoint);
      } catch {
        mediaStatus = null;
      }
    }
  }
  const modelBody = await getModels(args.endpoint);
  const models = Array.isArray(modelBody?.data?.models) ? modelBody.data.models : [];
  const customSummaries = models.filter(isCustomModel);
  const detailResults = await Promise.allSettled(customSummaries.map(async (row) => {
    const name = norm(row?.name || row?.id);
    if (!name || hasCustomGrid(row)) return [name, row, false];
    const [detailResult, nodeResult] = await Promise.allSettled([
      getModel(args.endpoint, name),
      getModelNodes(args.endpoint, {
        name,
        includeBufferCoords: true,
        includeWorldCoords: true,
        includeScreenCoords: false
      })
    ]);
    const detail = detailResult.status === "fulfilled" ? detailResult.value : {};
    const nodeLayout = nodeResult.status === "fulfilled" ? nodeResult.value?.data || null : null;
    return [
      name,
      {
        ...mergeModelDetail(row, detail),
        nodeLayout,
        attributes: {
          ...customAttributesFrom(row),
          ...customAttributesFrom(modelDetailPayload(detail)),
          ...(nodeLayout ? { customNodeLayout: nodeLayout } : {})
        }
      },
      true
    ];
  }));
  const customRows = detailResults
    .filter((row) => row.status === "fulfilled" && Array.isArray(row.value))
    .map((row) => row.value);
  const customByName = new Map(customRows.map(([name, row]) => [name, row]));
  const hydratedModels = models.map((row) => customByName.get(norm(row?.name || row?.id)) || row);

  let submodels = [];
  let submodelError = "";
  try {
    submodels = submodelRowsFrom(await getSubmodels(args.endpoint));
  } catch (err) {
    submodelError = String(err?.message || err);
  }

  const modelsById = Object.fromEntries(hydratedModels
    .map((row) => {
      const id = norm(row?.id || row?.name);
      return [id, {
        id,
        name: norm(row?.name || id),
        displayAs: norm(row?.displayAs || row?.DisplayAs || row?.type),
        type: norm(row?.type || row?.DisplayAs || row?.displayAs),
        attributes: customAttributesFrom(row),
        faceInfo: row?.faceInfo || null,
        nodeLayout: row?.nodeLayout || row?.attributes?.customNodeLayout || null
      }];
    })
    .filter(([id]) => id));
  const submodelsById = Object.fromEntries(submodels.map((row) => [row.id, row]));
  const records = buildNormalizedTargetMetadataRecords({
    sceneGraph: { modelsById, submodelsById, groupsById: {}, stats: {} }
  });
  const customModels = records
    .filter((row) => row?.targetKind === "model" && row?.structure?.customStructure)
    .map((row) => ({
      targetId: row.targetId,
      modelName: norm(row?.identity?.displayName || row?.targetId),
      rawType: norm(row?.identity?.rawType),
      canonicalType: norm(row?.identity?.canonicalType),
      fingerprint: norm(row?.identity?.fingerprint),
      fingerprintVersion: norm(row?.identity?.fingerprintVersion),
      ...row.structure.customStructure
    }));
  const report = {
    artifactType: "custom_model_api_capture_validation_v1",
    artifactVersion: "1.0",
    createdAt: new Date().toISOString(),
    endpoint: args.endpoint,
    requestedShowDir: args.showDir ? path.resolve(args.showDir) : "",
    activeShowDirectory: norm(mediaStatus?.data?.showDirectory),
    showDirectorySwitch,
    summary: {
      modelCount: models.length,
      customSummaryCount: customSummaries.length,
      customDetailFetchCount: customRows.filter(([, , fetched]) => fetched).length,
      customWithApiGridCount: customRows.filter(([, row]) => hasCustomGrid(row)).length,
      customWithApiNodeLayoutCount: customRows.filter(([, row]) => hasNodeLayout(row)).length,
      customWithoutApiGridNames: customRows.filter(([, row]) => !hasCustomGrid(row)).map(([name]) => name).sort(),
      customWithoutApiConstructionNames: customRows
        .filter(([, row]) => !hasCustomGrid(row) && !hasNodeLayout(row))
        .map(([name]) => name)
        .sort(),
      submodelCount: submodels.length,
      submodelError,
      constructionSourceCounts: countBy(customModels.map((row) => row?.construction?.source)),
      modelIndexCustomStructure: summarizeCustomModelStructure(records)
    },
    customModels
  };

  if (args.output) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((err) => {
  const message = String(err?.message || err);
  if (/fetch failed|ECONNREFUSED|Failed to fetch/i.test(message)) {
    console.error("Unable to reach the xLights API endpoint. Start xLightsDesigner/xLights and rerun with --endpoint if needed.");
    console.error(message);
  } else {
    console.error(String(err?.stack || err?.message || err));
  }
  process.exit(1);
});
