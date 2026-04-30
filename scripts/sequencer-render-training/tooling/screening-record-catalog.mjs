import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

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

export function listScreeningRecordSources(sourcePath = "") {
  return listFiles(sourcePath)
    .filter((filePath) => {
      const name = basename(filePath);
      return name.endsWith(".record.json") || name.endsWith(".records.jsonl");
    });
}

export function loadScreeningRecordCatalog(sourcePath = "", { compactRecord = null } = {}) {
  const records = [];
  for (const filePath of listScreeningRecordSources(sourcePath)) {
    const name = basename(filePath);
    const rows = name.endsWith(".records.jsonl")
      ? readJsonl(filePath)
      : [readJson(filePath, null)].filter(Boolean);
    for (const row of rows) {
      const record = typeof compactRecord === "function" ? compactRecord(row) : row;
      if (record?.recordVersion === "1.0" && String(record?.effectName || "").trim()) {
        records.push(record);
      }
    }
  }
  return records;
}

