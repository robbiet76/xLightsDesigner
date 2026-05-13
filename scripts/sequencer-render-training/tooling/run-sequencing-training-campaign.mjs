#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  applyJobDefaults,
  notifyTrainingError,
  sendMacNotification,
  runSequencingQualityUnattended
} from "./run-sequencing-quality-unattended.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_CAMPAIGN = "scripts/sequencer-render-training/catalog/training-campaigns/vendor-fixture-human-level-sequencing-v1.json";
const DEFAULT_OUT_ROOT = "var/logs/sequencing-quality-controller/campaigns";

function str(value = "") {
  return String(value || "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function resolvePath(filePath = "") {
  const value = str(filePath);
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function readJson(filePath = "") {
  return JSON.parse(fs.readFileSync(resolvePath(filePath), "utf8"));
}

function writeJson(filePath = "", payload = {}) {
  const resolved = resolvePath(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`);
}

function campaignRunRoot(campaign = {}, outRoot = DEFAULT_OUT_ROOT) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return path.join(resolvePath(outRoot), str(campaign.campaignId) || "campaign", `run-${timestamp}`);
}

function activeCampaignPhases(campaign = {}) {
  return arr(campaign.campaignPhases).filter((phase) => {
    const status = str(phase.status);
    return status === "in_progress" || status === "planned";
  });
}

function jobSlicesForCampaign(campaign = {}, { includePlanned = false } = {}) {
  const phases = includePlanned
    ? activeCampaignPhases(campaign)
    : arr(campaign.campaignPhases).filter((phase) => str(phase.status) === "in_progress");
  return phases.flatMap((phase) => arr(phase.jobRefs).map((jobRef) => ({
    phaseId: str(phase.phaseId),
    phaseStatus: str(phase.status),
    jobSpecPath: str(jobRef)
  })).filter((row) => row.jobSpecPath));
}

function freeGiBForPath(root = "", deps = {}) {
  const execFile = deps.execFileSync || execFileSync;
  const resolved = resolvePath(root || ".");
  const output = execFile("df", ["-Pk", resolved], { encoding: "utf8" });
  const line = output.trim().split(/\r?\n/).at(-1) || "";
  const fields = line.trim().split(/\s+/);
  const availableKb = Number(fields[3]);
  return Number.isFinite(availableKb) ? availableKb / 1024 / 1024 : Infinity;
}

function compactJobSummary(summary = {}) {
  const latest = arr(summary.iterations).at(-1) || {};
  return {
    jobId: str(summary.trainingJob?.jobId),
    chunkId: str(summary.trainingJob?.chunkId),
    status: str(summary.status),
    stopReason: str(summary.stopReason),
    jobSliceStatus: str(summary.majorChunkStatus),
    interventionRecommended: Boolean(summary.interventionRecommended),
    iterationCount: num(summary.iterationCount),
    latestRunRoot: str(summary.latestRunRoot),
    videoComparisonBaselineRunRoot: str(summary.videoComparisonBaselineRunRoot),
    previousStateRef: str(summary.previousStateRef),
    latestGoalId: str(latest.selectedGoalId),
    latestScore: num(latest.overallAestheticScore),
    latestComparisonStatus: str(latest.comparisonStatus || latest.qualityGateStatus),
    selectorReadyPriorCount: arr(summary.iterations).reduce((total, row) => total + num(row.consolidation?.selectorReadyPriorCount), 0),
    deletedPreviewFrameCount: arr(summary.iterations).reduce((total, row) => total + num(row.consolidation?.deletedPreviewFrameCount), 0)
  };
}

function notifyCampaign(summary = {}, options = {}, deps = {}) {
  if (!options.enabled) return { sent: false, reason: "disabled" };
  const title = summary.interventionRecommended
    ? "xLightsDesigner campaign needs attention"
    : summary.status === "complete"
      ? "xLightsDesigner campaign finished"
      : "xLightsDesigner campaign stopped";
  const last = arr(summary.jobSlices).at(-1) || {};
  const message = `${str(summary.campaignId)} ${str(summary.status)} after ${num(summary.completedJobSliceCount)} job slice${num(summary.completedJobSliceCount) === 1 ? "" : "s"}. Last stop: ${str(last.stopReason) || str(summary.stopReason)}.`;
  return sendMacNotification({
    enabled: options.enabled,
    title: options.title || title,
    subtitle: str(summary.activePhaseId || ""),
    message,
    soundName: options.soundName,
    showAlert: Boolean(options.showAlert),
    alertTimeoutSeconds: options.alertTimeoutSeconds
  }, deps);
}

export async function runSequencingTrainingCampaign({
  campaignSpecPath = DEFAULT_CAMPAIGN,
  latestRunRoot = "",
  videoComparisonBaselineRunRoot = "",
  previousStatePath = "",
  outRoot = DEFAULT_OUT_ROOT,
  maxJobSlices = 1,
  maxHours = 0,
  includePlanned = false,
  notify = false,
  notificationSound = "Glass",
  notificationTitle = "",
  notificationAlert = true,
  notificationAlertTimeoutSeconds = 60,
  deps = {}
} = {}) {
  const campaign = readJson(campaignSpecPath);
  const root = campaignRunRoot(campaign, outRoot);
  fs.mkdirSync(root, { recursive: true });
  const summaryPath = path.join(root, "campaign-run-summary.json");
  const startedAt = new Date();
  const minFreeGiB = num(campaign.retentionPolicy?.diskGuardrail?.minimumFreeGiB, 0);
  const jobSlices = jobSlicesForCampaign(campaign, { includePlanned }).slice(0, Math.max(0, num(maxJobSlices, 1)));
  let currentLatestRunRoot = resolvePath(latestRunRoot);
  let currentVideoBaselineRunRoot = resolvePath(videoComparisonBaselineRunRoot) || currentLatestRunRoot;
  let currentPreviousStatePath = resolvePath(previousStatePath);
  const completed = [];
  let stopReason = jobSlices.length ? "max_job_slices_reached" : "no_job_slices_available";
  let interventionRecommended = false;

  const writeSummary = (status = "running") => {
    const elapsedHours = (Date.now() - startedAt.getTime()) / 3600000;
    const summary = {
      artifactType: "sequencing_quality_training_campaign_run_summary_v1",
      artifactVersion: 1,
      generatedAt: new Date().toISOString(),
      campaignId: str(campaign.campaignId),
      campaignSpecRef: resolvePath(campaignSpecPath),
      outRoot: root,
      summaryRef: summaryPath,
      status,
      stopReason: status === "running" ? "" : stopReason,
      interventionRecommended,
      activePhaseId: str(completed.at(-1)?.phaseId || jobSlices[0]?.phaseId || ""),
      startedAt: startedAt.toISOString(),
      elapsedHours: Math.round(elapsedHours * 1000) / 1000,
      maxJobSlices,
      maxHours,
      completedJobSliceCount: completed.length,
      remainingPlannedJobSliceCount: Math.max(0, jobSlices.length - completed.length),
      latestRunRoot: currentLatestRunRoot,
      videoComparisonBaselineRunRoot: currentVideoBaselineRunRoot,
      previousStateRef: currentPreviousStatePath,
      jobSlices: completed,
      nextJobSlice: jobSlices[completed.length] || null,
      retentionPolicy: campaign.retentionPolicy || {}
    };
    writeJson(summaryPath, summary);
    return summary;
  };

  writeSummary("running");

  try {
    for (const slice of jobSlices) {
      if (maxHours > 0 && (Date.now() - startedAt.getTime()) / 3600000 >= maxHours) {
        stopReason = "max_hours_reached";
        break;
      }
      if (minFreeGiB > 0) {
        const freeGiB = (deps.freeGiBForPath || freeGiBForPath)(root, deps.diskDeps || {});
        if (freeGiB < minFreeGiB) {
          stopReason = "disk_guardrail";
          interventionRecommended = true;
          break;
        }
      }
      const runJob = deps.runJob || ((args) => runSequencingQualityUnattended(applyJobDefaults(args)));
      const jobSummary = await runJob({
        jobSpecPath: slice.jobSpecPath,
        latestRunRoot: currentLatestRunRoot,
        videoComparisonBaselineRunRoot: currentVideoBaselineRunRoot,
        previousStatePath: currentPreviousStatePath
      });
      const compact = {
        ...slice,
        summaryRef: str(jobSummary.outRoot) ? path.join(str(jobSummary.outRoot), "unattended-run-summary.json") : "",
        ...compactJobSummary(jobSummary)
      };
      completed.push(compact);
      currentLatestRunRoot = resolvePath(jobSummary.latestRunRoot);
      currentVideoBaselineRunRoot = resolvePath(jobSummary.videoComparisonBaselineRunRoot) || currentLatestRunRoot;
      currentPreviousStatePath = resolvePath(jobSummary.previousStateRef);
      if (jobSummary.interventionRecommended) {
        stopReason = str(jobSummary.stopReason) || "job_slice_intervention_recommended";
        interventionRecommended = true;
        writeSummary("stopped");
        break;
      }
      stopReason = completed.length >= jobSlices.length ? "planned_job_slices_complete" : "max_job_slices_reached";
      writeSummary("running");
    }
  } catch (error) {
    stopReason = "campaign_error";
    interventionRecommended = true;
    const summary = {
      ...writeSummary("error"),
      error: {
        message: str(error?.message),
        stack: str(error?.stack)
      }
    };
    writeJson(summaryPath, summary);
    try {
      notifyTrainingError(error, {
        enabled: notify,
        soundName: notificationSound,
        title: notificationTitle,
        showAlert: notificationAlert,
        alertTimeoutSeconds: notificationAlertTimeoutSeconds
      });
    } catch {
      // Keep the original error visible.
    }
    error.campaignSummary = summary;
    throw error;
  }

  const finalStatus = interventionRecommended ? "stopped" : completed.length >= jobSlices.length ? "complete" : "stopped";
  const finalSummary = writeSummary(finalStatus);
  try {
    const notificationResult = notifyCampaign(finalSummary, {
      enabled: notify,
      soundName: notificationSound,
      title: notificationTitle,
      showAlert: notificationAlert,
      alertTimeoutSeconds: notificationAlertTimeoutSeconds
    });
    finalSummary.notificationResult = notificationResult;
    writeJson(summaryPath, finalSummary);
  } catch (error) {
    finalSummary.notificationError = str(error.message);
    writeJson(summaryPath, finalSummary);
  }
  return finalSummary;
}

function parseArgs(argv = []) {
  const args = {
    campaignSpecPath: DEFAULT_CAMPAIGN,
    latestRunRoot: "",
    videoComparisonBaselineRunRoot: "",
    previousStatePath: "",
    outRoot: DEFAULT_OUT_ROOT,
    maxJobSlices: 1,
    maxHours: 0,
    includePlanned: false,
    notify: true,
    notificationSound: "Glass",
    notificationTitle: "",
    notificationAlert: true,
    notificationAlertTimeoutSeconds: 60,
    help: false
  };
  const take = (field, value) => {
    args[field] = value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = str(argv[index]);
    if (arg === "--campaign-spec") take("campaignSpecPath", argv[++index]);
    else if (arg === "--latest-run-root") take("latestRunRoot", argv[++index]);
    else if (arg === "--video-comparison-baseline-run-root") take("videoComparisonBaselineRunRoot", argv[++index]);
    else if (arg === "--previous-state") take("previousStatePath", argv[++index]);
    else if (arg === "--out-root") take("outRoot", argv[++index]);
    else if (arg === "--max-job-slices") take("maxJobSlices", Number(argv[++index]));
    else if (arg === "--max-hours") take("maxHours", Number(argv[++index]));
    else if (arg === "--include-planned") take("includePlanned", true);
    else if (arg === "--notification-sound") take("notificationSound", argv[++index]);
    else if (arg === "--notification-title") take("notificationTitle", argv[++index]);
    else if (arg === "--notification-alert") take("notificationAlert", true);
    else if (arg === "--no-notification-alert") take("notificationAlert", false);
    else if (arg === "--notification-alert-timeout-seconds") take("notificationAlertTimeoutSeconds", Number(argv[++index]));
    else if (arg === "--no-notify") take("notify", false);
    else if (arg === "--notify") take("notify", true);
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/run-sequencing-training-campaign.mjs \\
    --campaign-spec scripts/sequencer-render-training/catalog/training-campaigns/vendor-fixture-human-level-sequencing-v1.json \\
    --latest-run-root var/logs/sequencing-quality-controller/unattended/synthetic-style-range-expansion-v1/run-20260512T005407Z/loop-000002 \\
    --video-comparison-baseline-run-root var/logs/sequencing-quality-controller/unattended/synthetic-style-range-expansion-v1/run-20260512T005407Z/loop-000002 \\
    --previous-state var/logs/sequencing-quality-controller/unattended/synthetic-style-range-expansion-v1/run-20260512T005407Z/loop-000003/controller-state.json \\
    --max-job-slices 4 \\
    --max-hours 8

Campaign notifications:
  --notify                    Send a macOS notification when the campaign stops (default)
  --no-notify                 Disable campaign notifications
  --notification-sound Glass  macOS notification sound name
  --notification-title "..."  Override the notification title
  --notification-alert        Also show an auto-dismiss macOS dialog at completion (default)
  --no-notification-alert     Disable the completion dialog fallback
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const summary = await runSequencingTrainingCampaign(args);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const summary = error?.campaignSummary;
    if (summary?.summaryRef) {
      console.error(`Campaign failed. Summary: ${summary.summaryRef}`);
    }
    console.error(error);
    process.exit(1);
  });
}
