import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

function parseArgs(argv = []) {
  const out = {
    source: "",
    outDir: resolve("scripts/sequencer-render-training/catalog/effect-screening-records")
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "").trim();
    if (arg === "--source") out.source = resolve(String(argv[i + 1] || "").trim());
    if (arg === "--out-dir") out.outDir = resolve(String(argv[i + 1] || "").trim());
  }
  return out;
}

function listRecordFiles(sourcePath = "") {
  if (!sourcePath || !existsSync(sourcePath)) return [];
  const output = execFileSync(
    "find",
    [sourcePath, "-type", "f", "-name", "*.record.json"],
    { encoding: "utf8" }
  );
  return output
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function slug(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildTargetFilename(filePath = "") {
  try {
    const record = JSON.parse(readFileSync(filePath, "utf8"));
    const effectName = slug(record?.effectName || "effect");
    const geometryProfile = slug(record?.fixture?.geometryProfile || "geometry");
    const sampleId = slug(record?.sampleId || basename(filePath, ".record.json"));
    return `${effectName}-${geometryProfile}-${sampleId}.record.json`;
  } catch {
    return basename(filePath);
  }
}

function sanitizeRecord(record = {}) {
  const next = JSON.parse(JSON.stringify(record || {}));
  if (next.fixture && typeof next.fixture === "object") {
    delete next.fixture.modelName;
    delete next.fixture.sequencePath;
    delete next.fixture.workingSequencePath;
  }
  if (next.artifact && typeof next.artifact === "object") {
    delete next.artifact.path;
  }
  if (next.features && typeof next.features === "object") {
    delete next.features.artifactPath;
    delete next.features.analyzedArtifactPath;
  }
  return next;
}

const args = parseArgs(process.argv.slice(2));
if (!args.source) {
  console.error("usage: node harvest-screening-records.mjs --source <screening-run-dir> [--out-dir <dir>]");
  process.exit(1);
}

const files = listRecordFiles(args.source);
mkdirSync(args.outDir, { recursive: true });
for (const filePath of files) {
  const record = JSON.parse(readFileSync(filePath, "utf8"));
  const targetPath = join(args.outDir, buildTargetFilename(filePath));
  writeFileSync(targetPath, `${JSON.stringify(sanitizeRecord(record))}\n`, "utf8");
}

console.log(JSON.stringify({
  ok: true,
  source: args.source,
  outDir: args.outDir,
  copiedCount: files.length
}, null, 2));
