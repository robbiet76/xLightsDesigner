import fs from "node:fs";
import path from "node:path";

import { getModel, getModels, getSubmodels } from "../../apps/xlightsdesigner-ui/api.js";
import { classifyModelDisplayType } from "../../apps/xlightsdesigner-ui/agent/sequence-agent/model-type-catalog.js";
import { buildCustomModelStructureCatalog } from "../../apps/xlightsdesigner-ui/runtime/custom-model-catalog.js";

function norm(value = "") {
  return String(value || "").trim();
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    endpoint: process.env.XLIGHTS_ENDPOINT || "http://127.0.0.1:49915/xlightsdesigner/api",
    output: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--endpoint" || arg === "-e") {
      args.endpoint = argv[++index] || args.endpoint;
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
  const modelBody = await getModels(args.endpoint);
  const models = Array.isArray(modelBody?.data?.models) ? modelBody.data.models : [];
  const customSummaries = models.filter(isCustomModel);
  const detailResults = await Promise.allSettled(customSummaries.map(async (row) => {
    const name = norm(row?.name || row?.id);
    if (!name || hasCustomGrid(row)) return [name, row, false];
    return [name, mergeModelDetail(row, await getModel(args.endpoint, name)), true];
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
        faceInfo: row?.faceInfo || null
      }];
    })
    .filter(([id]) => id));
  const submodelsById = Object.fromEntries(submodels.map((row) => [row.id, row]));
  const catalog = buildCustomModelStructureCatalog({
    sceneGraph: { modelsById, submodelsById, groupsById: {}, stats: {} },
    source: {
      endpoint: args.endpoint,
      modelSource: "layout.getModels + layout.getModel",
      submodelSource: submodelError ? "layout.getSubmodels failed" : "layout.getSubmodels"
    }
  });
  const report = {
    artifactType: "custom_model_api_capture_validation_v1",
    artifactVersion: "1.0",
    createdAt: new Date().toISOString(),
    endpoint: args.endpoint,
    summary: {
      modelCount: models.length,
      customSummaryCount: customSummaries.length,
      customDetailFetchCount: customRows.filter(([, , fetched]) => fetched).length,
      customWithApiGridCount: customRows.filter(([, row]) => hasCustomGrid(row)).length,
      customWithoutApiGridNames: customRows.filter(([, row]) => !hasCustomGrid(row)).map(([name]) => name).sort(),
      submodelCount: submodels.length,
      submodelError,
      catalog: catalog.summary
    },
    customModels: catalog.models
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
