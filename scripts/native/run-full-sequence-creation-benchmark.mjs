#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ownedModalBlockedMessage } from '../../apps/xlightsdesigner-ui/runtime/owned-xlights-health.js';
import { loadProjectDisplayMetadataAssignments } from '../sequencing/native/project-display-metadata.mjs';

const DEFAULT_NATIVE_URL = process.env.XLD_NATIVE_AUTOMATION_URL || 'http://127.0.0.1:49916';
const DEFAULT_XLIGHTS_URL = process.env.XLD_XLIGHTS_API_URL || 'http://127.0.0.1:49915/xlightsdesigner/api';
const DEFAULT_PROJECT_FILE = '/Users/robterry/Documents/Lights/xLightsDesigner/projects/Christmas 2026/Christmas 2026.xdproj';
const DEFAULT_SHOW_DIR = '/Users/robterry/Desktop/Show';
const DEFAULT_OUTPUT_DIR = 'var/benchmarks/full-sequence-creation';

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function splitList(value = '') {
  return str(value)
    .split(',')
    .map((row) => str(row))
    .filter(Boolean);
}

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function usage() {
  console.error('usage: run-full-sequence-creation-benchmark.mjs [--project-file path] [--show-dir path] [--sequence-path path] [--duration-ms audio-derived] [--frame-ms 50] [--selected-tags csv] [--goal text] [--mood text] [--no-apply] [--no-render] [--timeout-ms 180000] [--output-dir path]');
  process.exit(2);
}

function parseArgs(argv = []) {
  const out = {
    nativeUrl: DEFAULT_NATIVE_URL,
    xlightsUrl: DEFAULT_XLIGHTS_URL,
    projectFile: DEFAULT_PROJECT_FILE,
    showDir: DEFAULT_SHOW_DIR,
    sequencePath: '',
    durationMs: null,
    durationProvided: false,
    frameMs: 50,
    selectedTags: '',
    goal: 'Create a complete first-pass full-display sequence for the active song. Use the whole display with clear section progression, coordinated layers, and lighting-safe color choices.',
    mood: 'polished Christmas show energy with a warm opening, rhythmic development, bigger chorus moments, and a resolved ending',
    apply: true,
    render: true,
    timeoutMs: 180000,
    outputDir: DEFAULT_OUTPUT_DIR
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--native-url') out.nativeUrl = str(argv[++i]);
    else if (token === '--xlights-url') out.xlightsUrl = str(argv[++i]);
    else if (token === '--project-file') out.projectFile = str(argv[++i]);
    else if (token === '--show-dir') out.showDir = str(argv[++i]);
    else if (token === '--sequence-path') out.sequencePath = str(argv[++i]);
    else if (token === '--duration-ms') {
      out.durationMs = Number(argv[++i]);
      out.durationProvided = true;
    }
    else if (token === '--frame-ms') out.frameMs = Number(argv[++i]);
    else if (token === '--selected-tags') out.selectedTags = str(argv[++i]);
    else if (token === '--goal') out.goal = str(argv[++i]);
    else if (token === '--mood') out.mood = str(argv[++i]);
    else if (token === '--no-apply') out.apply = false;
    else if (token === '--no-render') out.render = false;
    else if (token === '--timeout-ms') out.timeoutMs = Number(argv[++i]);
    else if (token === '--output-dir') out.outputDir = str(argv[++i]);
    else usage();
  }
  if (!Number.isFinite(out.frameMs) || out.frameMs <= 0) out.frameMs = 50;
  if (!Number.isFinite(out.timeoutMs) || out.timeoutMs < 10000) out.timeoutMs = 180000;
  return out;
}

async function readJsonFile(filePath = '') {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function loadProjectDocument(projectFile = '') {
  try {
    return await readJsonFile(projectFile);
  } catch {
    return {};
  }
}

async function findTrackRecordForMediaPath(appRoot = '', mediaPath = '') {
  const target = str(mediaPath);
  if (!target) return null;
  const tracksDir = path.join(appRoot, 'library', 'tracks');
  let files = [];
  try {
    files = await readdir(tracksDir);
  } catch {
    return null;
  }
  for (const fileName of files.filter((name) => name.endsWith('.json')).sort()) {
    try {
      const record = await readJsonFile(path.join(tracksDir, fileName));
      if (str(record?.track?.sourceMedia?.path) === target) return record;
    } catch {
      // Ignore stale track records during benchmark setup.
    }
  }
  return null;
}

function trackDurationMs(trackRecord = null) {
  const durationMs = Number(
    trackRecord?.track?.sourceMedia?.durationMs
    || trackRecord?.analysis?.durationMs
    || trackRecord?.analyses?.profiles?.deep?.media?.durationMs
    || trackRecord?.analyses?.profiles?.fast?.media?.durationMs
    || 0
  );
  return Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : null;
}

async function resolveAudioContext(args = {}) {
  const projectDoc = await loadProjectDocument(args.projectFile);
  const appRoot = path.dirname(path.dirname(path.dirname(args.projectFile)));
  const mediaFile = str(
    projectDoc?.snapshot?.audioPathInput
    || projectDoc?.snapshot?.mediaPath
    || projectDoc?.mediaPath
  );
  const trackRecord = await findTrackRecordForMediaPath(appRoot, mediaFile);
  const trackDuration = trackDurationMs(trackRecord);
  const resolvedDuration = args.durationProvided ? Number(args.durationMs) : trackDuration;
  return {
    mediaFile,
    trackRecordDisplayName: str(trackRecord?.track?.displayName),
    trackDurationMs: trackDuration,
    durationMs: Number.isFinite(resolvedDuration) && resolvedDuration > 0 ? Math.round(resolvedDuration) : 120000,
    durationSource: args.durationProvided ? 'cli' : (trackDuration ? 'track_record' : 'fallback')
  };
}

async function requestJson(url, { method = 'GET', body = null, timeoutMs = 60000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const init = { method, headers: {}, signal: controller.signal };
    if (body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);
    const text = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { ok: false, error: text };
    }
    if (!response.ok || parsed?.ok === false) {
      throw new Error(`${method} ${url} failed (${response.status}): ${JSON.stringify(parsed).slice(0, 4000)}`);
    }
    return parsed;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`${method} ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function nativeRequest(args, pathName, { method = 'GET', body = null, timeoutMs = 60000 } = {}) {
  return requestJson(`${args.nativeUrl}${pathName}`, { method, body, timeoutMs });
}

async function nativeAction(args, action, body = {}, timeoutMs = 60000) {
  return nativeRequest(args, '/action', {
    method: 'POST',
    body: { action, ...body },
    timeoutMs
  });
}

async function createSequenceWithRecovery(args, sequencePath) {
  try {
    const body = {
      filePath: sequencePath,
      durationMs: args.durationMs,
      frameMs: args.frameMs
    };
    if (str(args.mediaFile)) body.mediaFile = str(args.mediaFile);
    return await nativeAction(args, 'createXLightsSequence', body, 180000);
  } catch (error) {
    await nativeAction(args, 'refreshXLightsSession', {}, 30000).catch(() => null);
    const session = await nativeRequest(args, '/xlights-session', { timeoutMs: 30000 }).catch(() => null);
    if (str(session?.sequencePath) === sequencePath || str(session?.xlights?.sequencePath) === sequencePath) {
      return {
        ok: true,
        recoveredAfterTimeout: true,
        warning: error?.message || String(error)
      };
    }
    throw error;
  }
}

async function xlightsRequest(args, pathName, query = {}, timeoutMs = 60000) {
  const url = new URL(`${args.xlightsUrl}${pathName}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && str(value)) url.searchParams.set(key, str(value));
  }
  return requestJson(url.toString(), { timeoutMs });
}

function modalBlockedMessage(health = {}) {
  return ownedModalBlockedMessage(health);
}

async function assertXlightsReady(args) {
  const health = await xlightsRequest(args, '/health', {}, 30000);
  const blocked = modalBlockedMessage(health);
  if (blocked) throw new Error(blocked);
  return health;
}

async function waitFor({ label = 'condition', timeoutMs = 60000, intervalMs = 1000, check }) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await check();
    if (last?.done) return last.value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(last?.value || last).slice(0, 4000)}`);
}

async function waitForNativeSnapshot(args, { label = 'native snapshot', timeoutMs = 120000 } = {}) {
  return waitFor({
    label,
    timeoutMs,
    intervalMs: 2000,
    check: async () => {
      const snapshot = await nativeRequest(args, '/snapshot', { timeoutMs: 60000 }).catch((error) => ({
        snapshotError: error?.message || String(error)
      }));
      return { done: !snapshot?.snapshotError, value: snapshot };
    }
  });
}

function extractSemanticTags(appSnapshot = {}) {
  const display = appSnapshot?.pages?.display || {};
  const rows = [...arr(display.metadataRows), ...arr(display.targetIntentMetadataRows)];
  const tags = [];
  const seen = new Set();
  for (const row of rows) {
    if (str(row?.category) !== 'Semantic Tag') continue;
    const subject = str(row?.subject);
    if (!subject || seen.has(subject)) continue;
    seen.add(subject);
    tags.push({
      name: subject,
      linkedTargetCount: Number(row?.linkedTargetCount || 0),
      value: str(row?.value)
    });
  }
  return tags.sort((a, b) => b.linkedTargetCount - a.linkedTargetCount || a.name.localeCompare(b.name));
}

function summarizeLayoutModels(layoutPayload = {}) {
  const models = arr(layoutPayload?.data?.models);
  const isModelGroup = (row) => str(row?.displayAs || row?.type || row?.kind).toLowerCase() === 'modelgroup';
  const modelGroups = models.filter(isModelGroup);
  const concreteModels = models.filter((row) => !isModelGroup(row));
  return {
    totalModelCount: models.length,
    modelGroupCount: modelGroups.length,
    concreteModelCount: concreteModels.length,
    sampleModelGroups: modelGroups.slice(0, 20).map((row) => str(row?.name)).filter(Boolean),
    sampleModels: concreteModels.slice(0, 20).map((row) => str(row?.name)).filter(Boolean)
  };
}

function buildDesignerContext({ args, selectedTags, layoutSummary, displayMetadataSummary = null }) {
  const metadataText = displayMetadataSummary?.assignmentCount
    ? `Loaded ${displayMetadataSummary.assignmentCount} project display metadata assignments from app metadata and display discovery.`
    : 'No project display metadata assignments were available.';
  return {
    goal: args.goal,
    mood: args.mood,
    targetScope: 'Full display via project display metadata and model groups',
    constraints: [
      `Use these display metadata subjects/tags as the display-scope starting point: ${selectedTags.join(', ')}.`,
      'Plan across the full sequence duration, not a single isolated model or effect.',
      'Create any timing tracks needed for the pass before sequencing; timing tracks must be complete, not partial.',
      'Anchor every effect on at least one side to a timing mark or adjacent effect.',
      'Use additive layering, replacement, deletion, and layer reordering when they improve the observed combined effect.',
      'Prefer lighting-friendly colors that RGB props can represent cleanly.',
      'Apply as one batch full-pass plan before render unless a clear validation failure requires iteration.'
    ].join(' '),
    references: [
      `Display inventory: ${layoutSummary.concreteModelCount} concrete models and ${layoutSummary.modelGroupCount} model groups.`,
      metadataText,
      'Use broad display roles: lead, support, accent, background, texture.',
      'Expected timing vocabulary can include song structure, beats, bars, lyrics, phrases, or future track labels as needed.'
    ].join(' '),
    approvalNotes: 'Full sequence creation benchmark. The user is evaluating whether the designer context and sequencer full-pass output are sufficient for a useful first complete sequence.'
  };
}

function idOf(value = {}) {
  return str(value?.artifactId || value?.planId || value?.id);
}

function artifactMentionsSequence(artifact = null, sequencePath = '') {
  const target = str(sequencePath);
  if (!artifact || !target) return false;
  return JSON.stringify(artifact).includes(target);
}

function filterSnapshotToSequence(snapshot = {}, sequencePath = '') {
  if (!sequencePath) return snapshot;
  const out = { ...(snapshot || {}) };
  if (!artifactMentionsSequence(out.latestPlanHandoff, sequencePath)) out.latestPlanHandoff = null;
  if (!artifactMentionsSequence(out.latestApplyResult, sequencePath)) out.latestApplyResult = null;
  if (!artifactMentionsSequence(out.latestProposalBundle, sequencePath)) out.latestProposalBundle = null;
  return out;
}

function blockedReviewBanner(appSnapshot = {}) {
  const banners = arr(appSnapshot?.pages?.review?.banners);
  return banners.find((row) => str(row?.state).toLowerCase() === 'blocked' || /^error:/i.test(str(row?.text))) || null;
}

function getPlanQuality(snapshot = {}) {
  return snapshot?.latestApplyResult?.practicalValidation?.summary?.planQuality
    || snapshot?.latestPlanHandoff?.metadata?.planQuality
    || {};
}

function getTimingFidelity(snapshot = {}) {
  return snapshot?.latestApplyResult?.practicalValidation?.summary?.timingFidelity || {};
}

function getMetadataCoverage(snapshot = {}) {
  return snapshot?.latestApplyResult?.practicalValidation?.metadataCoverage
    || snapshot?.latestApplyResult?.practicalValidation?.summary?.metadataCoverage
    || {};
}

function getRenderQuality(snapshot = {}) {
  const quality = snapshot?.latestRenderCritiqueContext?.quality
    || snapshot?.latestReviewArtifacts?.renderCritiqueContext?.quality
    || {};
  return enrichRenderQualityWithPayloadScores(quality, snapshot?.latestApplyResult?.practicalValidation || null);
}

function getTrainingUsageTrace(snapshot = {}) {
  return snapshot?.latestApplyResult?.practicalValidation?.summary?.trainingUsageTrace
    || snapshot?.latestApplyResult?.practicalValidation?.trainingUsageTrace
    || snapshot?.latestPlanHandoff?.metadata?.planQuality?.trainingUsageTrace
    || {};
}

function scoreBand(score = 0) {
  const value = Number(score || 0);
  return value >= 0.8 ? 'strong' : value >= 0.6 ? 'acceptable' : value >= 0.35 ? 'weak' : 'very_low';
}

function payloadRatio(summary = null, fieldName = '') {
  const ratio = Number(summary?.[`${fieldName}MatchRatio`]);
  if (Number.isFinite(ratio)) return Math.max(0, Math.min(1, ratio));
  const checked = Number(summary?.[`${fieldName}Checked`]);
  const matched = Number(summary?.[`${fieldName}Matched`]);
  return Number.isFinite(checked) && checked > 0 && Number.isFinite(matched)
    ? Math.max(0, Math.min(1, matched / checked))
    : null;
}

function enrichRenderQualityWithPayloadScores(quality = {}, practicalValidation = null) {
  const payloadSummary = practicalValidation?.summary?.effectPayloadChecks || practicalValidation?.effectPayloadChecks || null;
  if (!payloadSummary || typeof payloadSummary !== 'object') return quality || {};
  const effectConfigurationScore = payloadRatio(payloadSummary, 'settings');
  const paletteScore = payloadRatio(payloadSummary, 'palette');
  if (effectConfigurationScore == null && paletteScore == null) return quality || {};
  const dimensions = {
    ...(quality?.dimensions || {}),
    effectConfigurationScore,
    paletteScore
  };
  const dimensionBands = {
    ...(quality?.dimensionBands || {}),
    effectConfigurationScore: effectConfigurationScore == null ? 'unmeasured' : scoreBand(effectConfigurationScore),
    paletteScore: paletteScore == null ? 'unmeasured' : scoreBand(paletteScore)
  };
  const basis = {
    ...(quality?.basis || {}),
    effectPayloadChecks: Number(payloadSummary.effectPayloadChecks || 0),
    settingsChecked: Number(payloadSummary.settingsChecked || 0),
    settingsMatched: Number(payloadSummary.settingsMatched || 0),
    paletteChecked: Number(payloadSummary.paletteChecked || 0),
    paletteMatched: Number(payloadSummary.paletteMatched || 0)
  };
  const value = (row, fallback = 0.65) => {
    const n = Number(row);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  };
  const weightedScore =
    value(dimensions.coverageScore, 0) * 0.16 +
    value(dimensions.designIntentScore, 0) * 0.16 +
    value(dimensions.compositionScore) * 0.18 +
    value(dimensions.spatialBalanceScore, 0) * 0.1 +
    value(dimensions.motionProgressionScore, 0) * 0.12 +
    value(dimensions.sectionContrastScore, 0) * 0.06 +
    value(dimensions.effectConfigurationScore) * 0.09 +
    value(dimensions.paletteScore) * 0.08 +
    value(quality?.legacyIssuePenaltyScore, 0) * 0.05;
  const overallScore = Number(Math.max(0, Math.min(1, weightedScore)).toFixed(3));
  return {
    ...(quality || {}),
    overallScore,
    band: scoreBand(overallScore),
    dimensions,
    dimensionBands,
    basis
  };
}

function addGap(gaps, severity, title, evidence, recommendation) {
  gaps.push({ severity, title, evidence, recommendation });
}

function sampleList(values = [], limit = 8) {
  const rows = arr(values).map((row) => str(row)).filter(Boolean);
  if (rows.length <= limit) return rows.join(', ');
  return `${rows.slice(0, limit).join(', ')} +${rows.length - limit} more`;
}

function logStep(message) {
  process.stderr.write(`[full-sequence-benchmark] ${message}\n`);
}

function reviewReadyForGoal(appSnapshot = {}, goal = '') {
  const review = appSnapshot?.pages?.review || {};
  const pendingSummary = str(review.pendingSummary);
  return review.canApply === true && (!goal || pendingSummary.includes(goal));
}

function sequenceProposalReadyForGoal(appSnapshot = {}, goal = '') {
  const sequence = appSnapshot?.pages?.sequence || {};
  const bannerText = arr(sequence.banners).map((row) => str(row?.text)).join('\n');
  return Number(sequence.commandCount || 0) > 0
    && bannerText.includes('Generated proposal')
    && (!goal || str(appSnapshot?.pages?.review?.pendingSummary).includes(goal));
}

function rankGaps(snapshot = {}, { selectedTags = [], layoutSummary = {}, applied = false, rendered = false } = {}) {
  const gaps = [];
  const plan = snapshot?.latestPlanHandoff || {};
  const apply = snapshot?.latestApplyResult || {};
  const quality = getPlanQuality(snapshot);
  const timing = getTimingFidelity(snapshot);
  const metadata = getMetadataCoverage(snapshot);
  const renderQuality = getRenderQuality(snapshot);
  const commandCount = arr(plan.commands).length || arr(plan.executionLines).length;
  const effectCommandCount = Number(quality.effectCommandCount ?? plan?.metadata?.passExecution?.batchApply?.effectCommandCount ?? 0);
  const timelineCoverageRatio = Number(quality.timelineCoverageRatio ?? 0);
  const activeTargetRatio = Number(quality.activeTargetRatio ?? 0);
  const targetCount = Number(quality.targetCount ?? arr(plan?.metadata?.scope?.targetIds).length ?? 0);
  const distinctEffectCount = Number(quality.distinctEffectCount ?? arr(quality.distinctEffects).length ?? 0);
  const effectCommandsPerMinute = Number(quality.effectCommandsPerMinute ?? 0);
  const dominantEffectShare = Number(quality.dominantEffectShare ?? 0);
  const multiLayerTargetCount = Number(quality.multiLayerTargetCount ?? 0);
  const effectUsageQuality = quality?.effectUsageQuality && typeof quality.effectUsageQuality === 'object'
    ? quality.effectUsageQuality
    : {};
  const effectUsageScore = Number(effectUsageQuality.score);
  const floatingBoundaryCount = Number(quality.floatingBoundaryCount ?? timing.freeFloatingEffectCount ?? 0);
  const crossingSectionTimingCount = Number(timing.crossingSectionTimingCount ?? 0);
  const emptySections = arr(quality.emptySections);
  const missingMetadata = Number(metadata?.counts?.missingMetadata ?? metadata.missingMetadata ?? 0);
  const concreteModelCount = Number(layoutSummary.concreteModelCount || 0);
  const renderScore = Number(renderQuality.overallScore);
  const renderBand = str(renderQuality.band);
  const renderIssues = arr(renderQuality.issues);
  const renderDimensions = renderQuality && typeof renderQuality === 'object' && renderQuality.dimensions && typeof renderQuality.dimensions === 'object'
    ? renderQuality.dimensions
    : {};
  const trainingUsageTrace = getTrainingUsageTrace(snapshot);
  const coverageScore = Number(renderDimensions.coverageScore);
  const spatialBalanceScore = Number(renderDimensions.spatialBalanceScore);
  const compositionScore = Number(renderDimensions.compositionScore);
  const sectionContrastScore = Number(renderDimensions.sectionContrastScore);

  if (!idOf(plan)) {
    addGap(gaps, 'critical', 'No sequencer plan was produced', 'latestPlanHandoff is missing.', 'Fix designer-to-sequencer proposal generation before judging sequence quality.');
  }
  if (effectCommandCount <= 0) {
    addGap(gaps, 'critical', 'No effect creation commands were produced', `effectCommandCount=${effectCommandCount}, commandCount=${commandCount}.`, 'Full sequence creation needs effect-producing commands, not only metadata or edit commands.');
  }
  if (applied && str(apply.status).toLowerCase() !== 'applied') {
    addGap(gaps, 'critical', 'Review apply did not complete as applied', `apply.status=${str(apply.status) || '(missing)'}.`, 'Resolve apply/readback failure before running quality benchmarks.');
  }
  if (!rendered) {
    addGap(gaps, 'high', 'Render evidence was not collected', 'The benchmark did not render after apply.', 'Run with rendering enabled before using the result as a full sequence quality baseline.');
  }
  if (rendered && (!Number.isFinite(renderScore) || !renderBand)) {
    addGap(gaps, 'high', 'Render quality was not scored', 'renderCritiqueContext.quality is missing.', 'Expose a numeric render-quality score so structurally valid but visually weak sequences fail benchmark review.');
  } else if (rendered && renderScore < 0.35) {
    addGap(gaps, 'critical', 'Rendered sequence quality is very low', `renderQuality=${renderScore}, issues=${renderIssues.join(', ') || '(none)'}.`, 'Use render critique and human-made sequence patterns to revise effect choice, density, progression, focus, and coverage before considering the sequence acceptable.');
  } else if (rendered && renderScore < 0.6) {
    addGap(gaps, 'high', 'Rendered sequence quality is below acceptable first-pass level', `renderQuality=${renderScore}, issues=${renderIssues.join(', ') || '(none)'}.`, 'Improve musical/design coherence instead of treating readback success as quality success.');
  }
  if (rendered && Number.isFinite(coverageScore) && coverageScore < 0.2) {
    addGap(gaps, 'high', 'Rendered display coverage is too sparse', `coverageScore=${coverageScore}, activeCoverageRatio=${renderQuality?.basis?.activeCoverageRatio}, coverageGapCount=${renderQuality?.basis?.coverageGapCount}.`, 'Increase observable use of display regions and verify group/member placement actually lights the intended spatial areas.');
  }
  if (rendered && Number.isFinite(spatialBalanceScore) && spatialBalanceScore < 0.25) {
    addGap(gaps, 'high', 'Rendered spatial balance is poor', `spatialBalanceScore=${spatialBalanceScore}, issues=${renderIssues.filter((issue) => issue.includes('imbalance')).join(', ') || '(none)'}.`, 'Rebalance target selection and effect intensity across left/right and top/bottom display regions.');
  }
  if (rendered && Number.isFinite(compositionScore) && compositionScore < 0.6) {
    addGap(gaps, 'high', 'Composition plan is not visible enough in the render', `compositionScore=${compositionScore}, issues=${renderIssues.filter((issue) => issue.startsWith('composition_')).join(', ') || '(none)'}.`, 'Make focal, support, accent, and layer-stack roles observable in rendered output, not only present in the sequence file.');
  }
  if (rendered && Number.isFinite(sectionContrastScore) && sectionContrastScore < 0.7) {
    addGap(gaps, 'medium', 'Adjacent sections read too similarly', `sectionContrastScore=${sectionContrastScore}.`, 'Differentiate adjacent sections with clearer target, density, motion, and effect-configuration changes.');
  }
  if (timelineCoverageRatio < 0.25) {
    addGap(gaps, 'high', 'Timeline coverage is far below full-sequence behavior', `timelineCoverageRatio=${timelineCoverageRatio}.`, 'Sequencer needs explicit full-duration section planning and command synthesis across the whole timeline.');
  } else if (timelineCoverageRatio < 0.65) {
    addGap(gaps, 'medium', 'Timeline coverage is still thin', `timelineCoverageRatio=${timelineCoverageRatio}.`, 'Increase section-by-section placement density and progression coverage.');
  }
  if (concreteModelCount > 0 && activeTargetRatio < 0.2) {
    addGap(gaps, 'high', 'Active target ratio is too narrow for display-scope testing', `activeTargetRatio=${activeTargetRatio}, targetCount=${targetCount}, concreteModelCount=${concreteModelCount}.`, 'Use semantic tags/model groups to distribute roles across the display instead of concentrating on a few targets.');
  } else if (activeTargetRatio < 0.4) {
    addGap(gaps, 'medium', 'Display usage is limited', `activeTargetRatio=${activeTargetRatio}, targetCount=${targetCount}.`, 'Broaden support/accent/background assignments.');
  }
  if (distinctEffectCount > 0 && distinctEffectCount < 4) {
    addGap(gaps, 'high', 'Effect vocabulary is too repetitive', `distinctEffectCount=${distinctEffectCount}, distinctEffects=${arr(quality.distinctEffects).join(', ')}.`, 'Use a broader but still controlled effect family set for full sequence development.');
  }
  if (effectCommandsPerMinute > 0 && effectCommandsPerMinute < 12) {
    addGap(gaps, 'high', 'Command density is too low for full sequence authoring', `effectCommandsPerMinute=${effectCommandsPerMinute}.`, 'Generate enough section and phrase-level placements to create a complete observed sequence, not only a sparse scaffold.');
  }
  if (dominantEffectShare > 0.65) {
    addGap(gaps, 'medium', 'One effect dominates the plan', `dominantEffectShare=${dominantEffectShare}.`, 'Balance motif consistency with section-level variation.');
  }
  if (Number.isFinite(effectUsageScore) && effectUsageScore < 0.65) {
    addGap(
      gaps,
      'high',
      'Effect usage taste is weak',
      `effectUsageScore=${effectUsageScore}, issues=${arr(effectUsageQuality.issueKinds).join(', ') || '(none)'}, configuredBehaviorCoverage=${effectUsageQuality.configuredBehaviorCoverage}, thinSettingShare=${effectUsageQuality.thinSettingShare}.`,
      'Use behavior-capability records and richer parameter priors so effect choices are tastefully configured instead of repeated with generic defaults.'
    );
  }
  if (trainingUsageTrace && Number(trainingUsageTrace.commandCount || 0) > 0 && Number(trainingUsageTrace.configuredBehaviorCoverage || 0) < 0.6) {
    addGap(
      gaps,
      'high',
      'Sequencer is not using enough trained behavior records',
      `configuredBehaviorCoverage=${trainingUsageTrace.configuredBehaviorCoverage}, parameterPriorCoverage=${trainingUsageTrace.parameterPriorCoverage}, sourcedPriorCoverage=${trainingUsageTrace.sourcedPriorCoverage}.`,
      'Fix the sequencer training-consumption path before expanding the training set further.'
    );
  }
  if (multiLayerTargetCount <= 0 && effectCommandCount >= 4) {
    addGap(gaps, 'medium', 'No meaningful additive layering was planned', `multiLayerTargetCount=${multiLayerTargetCount}.`, 'Use additional layers where combined effects improve the rendered output.');
  }
  const emptySectionsAreSyntheticGeneral = emptySections.length === 1
    && emptySections[0] === 'General'
    && timelineCoverageRatio >= 0.9
    && effectCommandCount > 0;
  if (emptySections.length && !emptySectionsAreSyntheticGeneral) {
    addGap(gaps, 'medium', 'Some sections have no placements', `emptySections=${emptySections.join(', ')}.`, 'Create at least a supporting/background treatment for every intended section.');
  }
  if (floatingBoundaryCount > 0) {
    addGap(gaps, 'high', 'Free-floating effect boundaries remain', `floatingBoundaryCount=${floatingBoundaryCount}.`, 'Anchor effect boundaries to timing marks or adjacent effects.');
  }
  if (crossingSectionTimingCount > 0) {
    addGap(gaps, 'medium', 'Effects cross section timing boundaries', `crossingSectionTimingCount=${crossingSectionTimingCount}.`, 'Keep section-scoped effects within the selected timing section unless the designer explicitly asks for a cross-section carry.');
  }
  if (missingMetadata > 0) {
    const missingTargets = arr(metadata.missingMetadataTargetIds);
    const targetEvidence = missingTargets.length ? ` targets=${sampleList(missingTargets)}.` : '';
    addGap(gaps, 'medium', 'Display metadata coverage is incomplete', `missingMetadata=${missingMetadata}.${targetEvidence}`, 'Fill project display metadata for targets or tags that the sequencer needs.');
  }
  if (!arr(plan?.metadata?.designIds).length && !str(plan?.metadata?.sequencingDesignHandoffSummary)) {
    addGap(gaps, 'medium', 'Plan has weak traceability to designer context', 'No designIds or sequencingDesignHandoffSummary were found on latestPlanHandoff.metadata.', 'Promote the richer designer handoff into the sequencer plan metadata.');
  }
  if (!selectedTags.length) {
    addGap(gaps, 'high', 'No display metadata subjects were available for display-scope selection', 'selectedTags is empty.', 'Confirm display metadata generation and selected display metadata flow before full-display benchmarks.');
  }

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const audioContext = await resolveAudioContext(args);
  args.durationMs = audioContext.durationMs;
  args.mediaFile = audioContext.mediaFile;
  const runId = timestampId();
  const outputDir = path.resolve(args.outputDir, runId);
  await mkdir(outputDir, { recursive: true });

  logStep('checking native automation and xLights readiness');
  await nativeRequest(args, '/health', { timeoutMs: 30000 });
  await assertXlightsReady(args);
  logStep(`opening project: ${args.projectFile}`);
  await nativeAction(args, 'openProject', { filePath: args.projectFile }, 60000);
  await nativeAction(args, 'refreshXLightsSession', {}, 90000);

  const sequencePath = args.sequencePath
    ? path.resolve(args.sequencePath)
    : path.join(path.resolve(args.showDir), '_xlightsdesigner_benchmarks', runId, 'full-display-benchmark.xsq');
  await mkdir(path.dirname(sequencePath), { recursive: true });
  logStep(`creating isolated benchmark sequence: ${sequencePath}`);
  await createSequenceWithRecovery(args, sequencePath);
  await nativeAction(args, 'refreshXLightsSession', {}, 90000);

  const appSnapshot = await waitForNativeSnapshot(args, { label: 'post-create app snapshot', timeoutMs: 150000 });
  const semanticTags = extractSemanticTags(appSnapshot);
  const selectedTags = splitList(args.selectedTags);
  const resolvedTags = selectedTags.length
    ? selectedTags
    : semanticTags.map((row) => row.name);
  const layoutPayload = await xlightsRequest(args, '/layout/models', {}, 60000);
  const groupMembershipsPayload = await xlightsRequest(args, '/layout/group-members', {}, 60000).catch(() => ({ data: { groups: [] } }));
  const layoutSummary = summarizeLayoutModels(layoutPayload);
  const displayMetadataAssignments = loadProjectDisplayMetadataAssignments(args.projectFile, {
    layoutRows: arr(layoutPayload?.data?.models),
    groupMemberships: groupMembershipsPayload
  });
  const displayMetadataSummary = {
    assignmentCount: displayMetadataAssignments.length,
    sampleAssignments: displayMetadataAssignments.slice(0, 24).map((row) => ({
      targetId: str(row.targetId),
      rolePreference: str(row.rolePreference),
      tags: arr(row.tags).slice(0, 6),
      source: str(row.source)
    }))
  };
  const designerContext = buildDesignerContext({ args, selectedTags: resolvedTags, layoutSummary, displayMetadataSummary });

  logStep(`saving designer context for ${resolvedTags.length} display metadata subjects/tags and ${displayMetadataSummary.assignmentCount} metadata assignments`);
  await nativeAction(args, 'applyAssistantActionRequest', {
    actionType: 'save_design_intent',
    reason: 'full sequence creation benchmark',
    payload: designerContext
  }, 60000);

  const beforeGeneration = filterSnapshotToSequence(
    await nativeRequest(args, '/sequencer-validation-snapshot', { timeoutMs: 30000 }),
    sequencePath
  );
  const beforeAppSnapshot = await nativeRequest(args, '/snapshot', { timeoutMs: 30000 }).catch(() => null);
  const previousBlockedReviewText = str(blockedReviewBanner(beforeAppSnapshot)?.text);
  const previousPlanId = idOf(beforeGeneration?.latestPlanHandoff);
  const previousApplyId = idOf(beforeGeneration?.latestApplyResult);

  logStep('generating full-display sequence proposal');
  const generation = await nativeAction(args, 'generateSequenceProposal', {
    selectedTagNames: resolvedTags.join(',')
  }, args.timeoutMs);
  const banner = generation?.banner && typeof generation.banner === 'object' ? generation.banner : null;
  if (str(banner?.state).toLowerCase() === 'blocked') {
    throw new Error(`Generation blocked: ${str(banner?.text)}`);
  }

  const proposalSnapshot = await waitFor({
    label: 'new full-sequence proposal',
    timeoutMs: args.timeoutMs,
    intervalMs: 1500,
    check: async () => {
      await assertXlightsReady(args);
      const appSnapshot = await waitForNativeSnapshot(args, { label: 'review-ready app snapshot', timeoutMs: 70000 });
      const blocker = blockedReviewBanner(appSnapshot);
      if (blocker && str(blocker?.text) !== previousBlockedReviewText) return { done: true, value: { appSnapshot, blocked: blocker } };
      if (reviewReadyForGoal(appSnapshot, args.goal) || sequenceProposalReadyForGoal(appSnapshot, args.goal)) {
        const snapshot = filterSnapshotToSequence(
          await nativeRequest(args, '/sequencer-validation-snapshot', { timeoutMs: 30000 }).catch(() => ({})),
          sequencePath
        );
        return { done: true, value: snapshot };
      }
      return { done: false, value: appSnapshot };
    }
  });

  let applyResponse = null;
  let applySnapshot = proposalSnapshot;
  let applyBlocked = proposalSnapshot?.blocked || null;
  if (args.apply && !applyBlocked) {
    logStep('applying pending Review proposal');
    applyResponse = await nativeAction(args, 'applyReview', {}, Math.max(args.timeoutMs, 120000));
    applySnapshot = await waitFor({
      label: 'new apply result',
      timeoutMs: Math.max(args.timeoutMs, 120000),
      intervalMs: 1500,
      check: async () => {
        await assertXlightsReady(args);
        const appSnapshot = await nativeRequest(args, '/snapshot', { timeoutMs: 30000 }).catch(() => null);
        const blocker = blockedReviewBanner(appSnapshot);
        if (blocker && str(blocker?.text) !== previousBlockedReviewText) {
          applyBlocked = blocker;
          return { done: true, value: { blocked: blocker } };
        }
        const rawValidationSnapshot = await nativeRequest(args, '/sequencer-validation-snapshot', { timeoutMs: 90000 }).catch((error) => ({
          snapshotError: error?.message || String(error)
        }));
        if (rawValidationSnapshot?.snapshotError) {
          return { done: false, value: rawValidationSnapshot };
        }
        const snapshot = filterSnapshotToSequence(rawValidationSnapshot, sequencePath);
        const applyId = idOf(snapshot?.latestApplyResult);
        const status = str(snapshot?.latestApplyResult?.status).toLowerCase();
        return {
          done: Boolean(applyId && applyId !== previousApplyId && status === 'applied'),
          value: snapshot
        };
      }
    });
  }

  let renderResponse = null;
  if (args.apply && args.render && !applyBlocked) {
    logStep('rendering xLights sequence after apply');
    renderResponse = await nativeAction(args, 'renderXLightsSequence', {}, Math.max(args.timeoutMs, 120000));
  }
  let saveResponse = null;
  if (args.apply && !applyBlocked) {
    logStep('saving xLights sequence after apply/render');
    saveResponse = await nativeAction(args, 'saveXLightsSequence', {}, Math.max(args.timeoutMs, 120000));
  }

  logStep('collecting final validation snapshot and scoring gaps');
  const finalSnapshot = filterSnapshotToSequence(
    await nativeRequest(args, '/sequencer-validation-snapshot', { timeoutMs: 30000 }),
    sequencePath
  );
  const gaps = rankGaps(finalSnapshot, {
    selectedTags: resolvedTags,
    layoutSummary,
    applied: args.apply && !applyBlocked,
    rendered: Boolean(renderResponse?.ok !== false && args.render && !applyBlocked)
  });
  if (applyBlocked) {
    addGap(
      gaps,
      'critical',
      'Review apply was blocked',
      str(applyBlocked?.text) || 'Review surfaced a blocked apply banner.',
      'Fix the proposal-to-owned-batch apply path before judging sequence quality.'
    );
  }
  const quality = getPlanQuality(finalSnapshot);
  const timing = getTimingFidelity(finalSnapshot);
  const metadata = getMetadataCoverage(finalSnapshot);
  const renderQuality = getRenderQuality(finalSnapshot);
  const trainingUsageTrace = getTrainingUsageTrace(finalSnapshot);
  const effectUsageQuality = quality?.effectUsageQuality && typeof quality.effectUsageQuality === 'object'
    ? quality.effectUsageQuality
    : null;

  const report = {
    artifactType: 'benchmark_run_v1',
    benchmark: 'full_sequence_creation',
    runId,
    createdAt: new Date().toISOString(),
    inputs: {
      projectFile: args.projectFile,
      showDir: args.showDir,
      sequencePath,
      durationMs: args.durationMs,
      durationSource: audioContext.durationSource,
      mediaFile: audioContext.mediaFile,
      trackDisplayName: audioContext.trackRecordDisplayName,
      trackDurationMs: audioContext.trackDurationMs,
      frameMs: args.frameMs,
      selectedTags: resolvedTags,
      goal: args.goal,
      mood: args.mood
    },
    displayContext: {
      semanticTags,
      displayMetadataSummary,
      layoutSummary
    },
    designerContext,
    artifacts: {
      latestIntentArtifactId: idOf(finalSnapshot?.latestIntentHandoff),
      latestProposalArtifactId: idOf(finalSnapshot?.latestProposalBundle),
      latestPlanArtifactId: idOf(finalSnapshot?.latestPlanHandoff),
      latestApplyArtifactId: idOf(finalSnapshot?.latestApplyResult),
      latestPlanId: str(finalSnapshot?.latestPlanHandoff?.planId)
    },
    metrics: {
      planQuality: quality,
      timingFidelity: timing,
      metadataCoverage: metadata,
      renderQuality,
      effectUsageQuality,
      trainingUsageTrace,
      planCommandCount: arr(finalSnapshot?.latestPlanHandoff?.commands).length || arr(finalSnapshot?.latestPlanHandoff?.executionLines).length,
      applyStatus: str(finalSnapshot?.latestApplyResult?.status),
      practicalValidation: finalSnapshot?.latestApplyResult?.practicalValidation?.summary || null
    },
    responses: {
      generationAccepted: generation?.ok === true,
      applyAccepted: applyResponse ? applyResponse?.ok === true : null,
      applyBlocked: applyBlocked ? { text: str(applyBlocked?.text), state: str(applyBlocked?.state) } : null,
      renderAccepted: renderResponse ? renderResponse?.ok === true : null,
      saveAccepted: saveResponse ? saveResponse?.ok === true : null
    },
    rankedGaps: gaps
  };

  const reportPath = path.join(outputDir, 'benchmark-run.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    ok: true,
    runId,
    reportPath,
    sequencePath,
    selectedTags: resolvedTags,
    artifactIds: report.artifacts,
    headlineMetrics: {
      effectCommandCount: quality.effectCommandCount ?? null,
      timelineCoverageRatio: quality.timelineCoverageRatio ?? null,
      activeTargetRatio: quality.activeTargetRatio ?? null,
      targetCount: quality.targetCount ?? null,
      distinctEffectCount: quality.distinctEffectCount ?? null,
      effectUsageScore: effectUsageQuality?.score ?? null,
      effectUsageDimensions: effectUsageQuality?.dimensions ?? null,
      configuredBehaviorCoverage: trainingUsageTrace?.configuredBehaviorCoverage ?? null,
      parameterPriorCoverage: trainingUsageTrace?.parameterPriorCoverage ?? null,
      sourcedPriorCoverage: trainingUsageTrace?.sourcedPriorCoverage ?? null,
      palettePayloadCoverage: trainingUsageTrace?.palettePayloadCoverage ?? null,
      floatingBoundaryCount: quality.floatingBoundaryCount ?? timing.freeFloatingEffectCount ?? null,
      applyStatus: report.metrics.applyStatus
    },
    rankedGaps: gaps.slice(0, 8)
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
