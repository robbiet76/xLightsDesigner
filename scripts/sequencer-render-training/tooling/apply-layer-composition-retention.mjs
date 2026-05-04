import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ALWAYS_KEEP = new Set([
  "training_plan",
  "checkpoint",
  "run_summary",
  "composition_stack_observation",
  "layer_delta_observation",
  "order_permutation_observation",
  "render_setting_delta_observation",
  "prior_bundle",
  "failure_summary"
]);

const DEFAULT_PURGE_WHEN_SUMMARIZED = new Set([
  "raw_fseq",
  "full_gif",
  "decoded_frame_dump",
  "temporary_sequence_copy",
  "intermediate_render_export"
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value) {
  return path.resolve(String(value || ""));
}

function isInsideRoot(filePath, runRoot) {
  const relative = path.relative(runRoot, filePath);
  return Boolean(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function isInsideAnyRoot(filePath, roots = []) {
  return roots.some((root) => root && isInsideRoot(filePath, root));
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function retentionSets(policy = {}) {
  return {
    alwaysKeep: new Set([...DEFAULT_ALWAYS_KEEP, ...arr(policy.alwaysKeep)]),
    purgeWhenSummarized: new Set([...DEFAULT_PURGE_WHEN_SUMMARIZED, ...arr(policy.purgeWhenSummarized)])
  };
}

function externalDeleteRoots(policy = {}, ledger = {}) {
  return [...arr(policy.externalDeleteRoots), ...arr(ledger.externalDeleteRoots)]
    .map(normalizePath)
    .filter(Boolean);
}

function normalizeArtifact(row = {}, runRoot = "", allowedExternalRoots = []) {
  const artifactPath = normalizePath(row.path || row.artifactPath || row.filePath);
  const artifactClass = String(row.artifactClass || row.kind || row.type || "").trim();
  const allowExternalDelete = Boolean(row.allowExternalDelete);
  const insideRunRoot = runRoot ? isInsideRoot(artifactPath, runRoot) : false;
  const insideAllowedExternalRoot = allowExternalDelete && isInsideAnyRoot(artifactPath, allowedExternalRoots);
  return {
    ...row,
    path: artifactPath,
    artifactClass,
    sizeBytes: Number(row.sizeBytes ?? fileSize(artifactPath)),
    summarized: Boolean(row.summarized || row.summaryRef || row.observationRef || row.deltaRef),
    retain: Boolean(row.retain || row.keep),
    proofCritical: Boolean(row.proofCritical),
    failureUnreviewed: Boolean(row.failureUnreviewed),
    exists: fs.existsSync(artifactPath),
    insideRunRoot,
    allowExternalDelete,
    insideAllowedExternalRoot,
    deletionScope: insideRunRoot ? "run_root" : insideAllowedExternalRoot ? "allowed_external_root" : "outside_allowed_roots"
  };
}

function classifyArtifact(row, sets) {
  if (!row.path) return { action: "keep", reason: "missing_path" };
  if (!row.insideRunRoot && !row.insideAllowedExternalRoot) return { action: "keep", reason: "outside_allowed_roots" };
  if (!row.exists) return { action: "keep", reason: "already_absent" };
  if (sets.alwaysKeep.has(row.artifactClass)) return { action: "keep", reason: "always_keep_class" };
  if (row.retain) return { action: "keep", reason: "retained_by_ledger" };
  if (row.proofCritical) return { action: "keep", reason: "proof_critical" };
  if (row.failureUnreviewed) return { action: "keep", reason: "failure_unreviewed" };
  if (!row.summarized) return { action: "keep", reason: "not_summarized" };
  if (row.purgeEligible || sets.purgeWhenSummarized.has(row.artifactClass)) {
    return { action: "delete", reason: "summarized_purge_eligible" };
  }
  return { action: "keep", reason: "not_purge_class" };
}

export function planLayerCompositionRetentionCleanup({
  runRoot,
  ledger,
  retentionPolicy = {}
} = {}) {
  const resolvedRunRoot = normalizePath(runRoot || ledger?.runRoot || "");
  if (!resolvedRunRoot) {
    throw new Error("runRoot is required");
  }
  const sets = retentionSets(retentionPolicy || ledger?.retentionPolicy || {});
  const allowedExternalRoots = externalDeleteRoots(retentionPolicy || ledger?.retentionPolicy || {}, ledger || {});
  const artifacts = arr(ledger?.artifacts).map((row) => normalizeArtifact(row, resolvedRunRoot, allowedExternalRoots));
  const decisions = artifacts.map((artifact) => ({
    ...artifact,
    ...classifyArtifact(artifact, sets)
  }));
  const deletions = decisions.filter((row) => row.action === "delete");
  const kept = decisions.filter((row) => row.action !== "delete");
  return {
    artifactType: "layer_composition_retention_cleanup_plan_v1",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    runRoot: resolvedRunRoot,
    dryRun: true,
    artifactCount: artifacts.length,
    externalDeleteRoots: allowedExternalRoots,
    deletionCount: deletions.length,
    deletionBytes: deletions.reduce((total, row) => total + Number(row.sizeBytes || 0), 0),
    keptCount: kept.length,
    decisions,
    deletions,
    kept
  };
}

export function applyLayerCompositionRetentionCleanup(plan) {
  const deleted = [];
  for (const row of arr(plan?.deletions)) {
    if (!row.path || (!row.insideRunRoot && !row.insideAllowedExternalRoot)) continue;
    if (!fs.existsSync(row.path)) continue;
    fs.rmSync(row.path, { force: true, recursive: true });
    deleted.push(row);
  }
  return {
    ...plan,
    dryRun: false,
    appliedAt: new Date().toISOString(),
    deletedCount: deleted.length,
    deletedBytes: deleted.reduce((total, row) => total + Number(row.sizeBytes || 0), 0),
    deleted
  };
}

function parseArgs(argv) {
  const args = {
    runRoot: "",
    ledgerPath: "",
    outPath: "",
    apply: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run-root") {
      args.runRoot = argv[++index];
    } else if (arg === "--ledger") {
      args.ledgerPath = argv[++index];
    } else if (arg === "--out") {
      args.outPath = argv[++index];
    } else if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/apply-layer-composition-retention.mjs --run-root <path> --ledger <path> [options]

Options:
  --out <path>     Write cleanup plan/result JSON.
  --apply          Delete summarized purge-eligible artifacts.
  --help           Show this help.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.runRoot) throw new Error("--run-root is required");
  if (!args.ledgerPath) throw new Error("--ledger is required");
  const ledger = readJson(args.ledgerPath);
  const plan = planLayerCompositionRetentionCleanup({
    runRoot: args.runRoot,
    ledger,
    retentionPolicy: ledger.retentionPolicy
  });
  const result = args.apply ? applyLayerCompositionRetentionCleanup(plan) : plan;
  if (args.outPath) {
    writeJson(args.outPath, result);
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
