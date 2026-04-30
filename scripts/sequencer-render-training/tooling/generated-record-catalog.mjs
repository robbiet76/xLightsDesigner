import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function listFiles(rootPath = "") {
  if (!rootPath || !existsSync(rootPath)) return [];
  const stats = statSync(rootPath);
  if (stats.isFile()) return [rootPath];
  const out = [];
  for (const name of readdirSync(rootPath)) {
    const fullPath = join(rootPath, name);
    const rowStats = statSync(fullPath);
    if (rowStats.isDirectory()) out.push(...listFiles(fullPath));
    else if (rowStats.isFile()) out.push(fullPath);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function readJsonl(filePath = "") {
  return readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function listGeneratedRecordSources(sourcePath = "") {
  return listFiles(sourcePath)
    .filter((filePath) => {
      const name = basename(filePath);
      return (name.endsWith(".json") && name !== "index.json") || name.endsWith(".records.jsonl");
    });
}

export function loadGeneratedRecordCatalog(sourcePath = "", { artifactType = "" } = {}) {
  const records = [];
  for (const filePath of listGeneratedRecordSources(sourcePath)) {
    const name = basename(filePath);
    const rows = name.endsWith(".records.jsonl")
      ? readJsonl(filePath)
      : [readJson(filePath, null)].filter(Boolean);
    for (const row of rows) {
      if (row?.recordId && (!artifactType || row.artifactType === artifactType)) records.push(row);
    }
  }
  return records;
}

export function writeGeneratedRecordOutput({ outputPath = "", records = [], indexArtifactType = "" } = {}) {
  if (outputPath.endsWith(".records.jsonl")) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
    return { outputPath, recordCount: records.length, packed: true };
  }

  mkdirSync(outputPath, { recursive: true });
  for (const record of records) {
    writeFileSync(join(outputPath, `${record.recordId}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  }
  writeFileSync(join(outputPath, "index.json"), `${JSON.stringify({
    artifactType: indexArtifactType,
    artifactVersion: "1.0",
    generatedAt: new Date().toISOString(),
    recordCount: records.length
  }, null, 2)}\n`, "utf8");
  return { outputPath, recordCount: records.length, packed: false };
}
