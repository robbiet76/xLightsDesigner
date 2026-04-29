import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function str(value = "") {
  return String(value || "").trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function listPassDirs(runRoot) {
  const passesRoot = path.join(runRoot, "passes");
  if (!fs.existsSync(passesRoot)) return [];
  return fs.readdirSync(passesRoot)
    .map((name) => path.join(passesRoot, name))
    .filter((candidate) => fs.statSync(candidate).isDirectory())
    .sort();
}

export function refreshLayerCompositionRenderObservations({
  runRoot,
  extractor = "scripts/sequencer-render-training/tooling/extract-render-observation.py"
} = {}) {
  const root = path.resolve(str(runRoot));
  if (!root) throw new Error("runRoot is required");
  const passDirs = listPassDirs(root);
  const refreshed = [];
  const skipped = [];

  for (const passDir of passDirs) {
    const previewWindowRef = path.join(passDir, "preview-window.json");
    const renderObservationRef = path.join(passDir, "render-observation.json");
    const compositionObservationRef = path.join(passDir, "composition-stack-observation.json");
    if (!fs.existsSync(previewWindowRef) || !fs.existsSync(compositionObservationRef)) {
      skipped.push({ passDir, reason: "missing_preview_or_composition_observation" });
      continue;
    }

    execFileSync("python3", [extractor, "--window", previewWindowRef, "--out", renderObservationRef], {
      cwd: process.cwd(),
      stdio: "pipe"
    });

    const renderObservation = readJson(renderObservationRef);
    const compositionObservation = readJson(compositionObservationRef);
    compositionObservation.generatedAt = new Date().toISOString();
    compositionObservation.renderObservation = renderObservation;
    compositionObservation.renderArtifact = {
      ...(compositionObservation.renderArtifact || {}),
      previewWindowRef,
      renderObservationRef
    };
    writeJson(compositionObservationRef, compositionObservation);
    refreshed.push({
      passId: str(compositionObservation.passId) || path.basename(passDir),
      previewWindowRef,
      renderObservationRef,
      compositionObservationRef
    });
  }

  return {
    artifactType: "layer_composition_render_observation_refresh_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runRoot: root,
    refreshedCount: refreshed.length,
    skippedCount: skipped.length,
    refreshed,
    skipped
  };
}

function parseArgs(argv) {
  const args = { runRoot: "", outPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run-root") args.runRoot = argv[++index];
    else if (arg === "--out") args.outPath = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/refresh-layer-composition-render-observations.mjs --run-root <run-dir> --out <refresh-summary.json>
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.runRoot) throw new Error("--run-root is required");
  if (!args.outPath) throw new Error("--out is required");
  const summary = refreshLayerCompositionRenderObservations({ runRoot: args.runRoot });
  writeJson(args.outPath, summary);
  process.stdout.write(`${args.outPath}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
