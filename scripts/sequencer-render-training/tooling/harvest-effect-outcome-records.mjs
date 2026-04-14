import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function parseArgs(argv = []) {
  const out = {
    source: "",
    outDir: resolve("scripts/sequencer-render-training/catalog/effect-family-outcomes")
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "").trim();
    if (arg === "--source") out.source = resolve(String(argv[i + 1] || "").trim());
    if (arg === "--out-dir") out.outDir = resolve(String(argv[i + 1] || "").trim());
  }
  return out;
}

function listOutcomeFiles(sourcePath = "") {
  if (!sourcePath || !existsSync(sourcePath)) return [];
  const artifactsDir = sourcePath.endsWith(".xdproj")
    ? join(dirname(sourcePath), "artifacts", "effect-outcomes")
    : sourcePath;
  if (!existsSync(artifactsDir)) return [];
  return readdirSync(artifactsDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(artifactsDir, name));
}

function isValidOutcomeFile(filePath = "") {
  try {
    const row = JSON.parse(readFileSync(filePath, "utf8"));
    return row?.artifactType === "effect_family_outcome_record_v1"
      && row?.storageClass === "general_training";
  } catch {
    return false;
  }
}

const args = parseArgs(process.argv.slice(2));
if (!args.source) {
  console.error("usage: node harvest-effect-outcome-records.mjs --source <project.xdproj|effect-outcomes-dir> [--out-dir <dir>]");
  process.exit(1);
}

const files = listOutcomeFiles(args.source).filter(isValidOutcomeFile);
mkdirSync(args.outDir, { recursive: true });
for (const filePath of files) {
  copyFileSync(filePath, join(args.outDir, filePath.split("/").pop()));
}

console.log(JSON.stringify({
  ok: true,
  source: args.source,
  outDir: args.outDir,
  copiedCount: files.length
}, null, 2));
