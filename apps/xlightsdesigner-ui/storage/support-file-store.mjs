import fs from "node:fs";
import path from "node:path";

function str(value = "") {
  return String(value || "").trim();
}

export function statFileRecord(payload = {}) {
  const filePath = str(payload?.filePath);
  if (!filePath) return { ok: false, error: "Missing filePath" };
  if (!fs.existsSync(filePath)) return { ok: false, exists: false, error: "File not found" };
  const stat = fs.statSync(filePath);
  return {
    ok: true,
    exists: true,
    filePath,
    size: Number(stat?.size || 0),
    mtimeMs: Number(stat?.mtimeMs || 0),
    mtimeIso: stat?.mtime ? new Date(stat.mtime).toISOString() : ""
  };
}

export function readTrainingPackageAsset(payload = {}, options = {}) {
  const relativePath = str(payload?.relativePath).replace(/^\/+/, "");
  const asJson = payload?.asJson === true;
  const rootDir = str(options?.rootDir);
  if (!relativePath) return { ok: false, error: "Missing relativePath" };
  if (relativePath.includes("..")) return { ok: false, error: "Invalid relativePath" };
  if (!rootDir) return { ok: false, error: "Training package not found" };
  const resolvedRoot = path.resolve(rootDir);
  const filePath = path.resolve(resolvedRoot, relativePath);
  if (!filePath.startsWith(resolvedRoot)) {
    return { ok: false, error: "Resolved path outside training package root" };
  }
  if (!fs.existsSync(filePath)) return { ok: false, error: "Training package asset not found" };
  const text = fs.readFileSync(filePath, "utf8");
  if (!asJson) {
    return { ok: true, rootDir: resolvedRoot, filePath, text };
  }
  try {
    return { ok: true, rootDir: resolvedRoot, filePath, data: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: `Invalid JSON in training package asset: ${String(err?.message || err)}` };
  }
}

export function appendAgentLogEntry(payload = {}, options = {}) {
  const entry = payload?.entry && typeof payload.entry === "object" ? payload.entry : null;
  if (!entry) return { ok: false, error: "Missing entry" };
  const filePath = str(options?.filePath);
  if (!filePath) return { ok: false, error: "Missing filePath" };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const row = {
    ...entry,
    ts: String(entry?.ts || new Date().toISOString())
  };
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
  return { ok: true };
}

export function readAgentLogEntries(payload = {}, options = {}) {
  const filePath = str(options?.filePath);
  if (!filePath) return { ok: false, error: "Missing filePath" };
  const limitRaw = Number.parseInt(String(payload?.limit || "40"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 40;
  const filterProjectKey = str(payload?.projectKey);
  const filterSequencePath = str(payload?.sequencePath);
  if (!fs.existsSync(filePath)) return { ok: true, rows: [] };
  const lines = fs.readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = [];
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line));
    } catch {
      // Skip malformed lines.
    }
  }
  const filtered = rows.filter((row) => {
    if (filterProjectKey && str(row?.projectKey) !== filterProjectKey) return false;
    if (filterSequencePath && str(row?.sequencePath) !== filterSequencePath) return false;
    return true;
  });
  return { ok: true, rows: filtered.slice(-limit).reverse() };
}
