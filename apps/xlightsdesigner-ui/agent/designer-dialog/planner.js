import { normalizeIntent } from "./intent-normalizer.js";
import { resolveTargetSelection } from "../sequence-agent/target-resolver.js";
import { buildSequencingStrategy } from "../sequence-agent/sequencing-strategy.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function prependUnique(lines = [], additions = []) {
  const normalized = new Set(arr(lines).map((line) => str(line).toLowerCase()).filter(Boolean));
  const merged = [];
  for (const line of arr(additions).map((row) => str(row)).filter(Boolean)) {
    const key = line.toLowerCase();
    if (normalized.has(key)) continue;
    normalized.add(key);
    merged.push(line);
  }
  return [...merged, ...arr(lines).map((row) => str(row)).filter(Boolean)];
}

function readProfileSignal(profile = null, key = "") {
  const signal = profile?.preferences?.[key];
  if (!signal || typeof signal !== "object") return null;
  const weight = Number(signal.weight);
  const confidence = Number(signal.confidence);
  const evidenceCount = Number(signal.evidenceCount);
  if (!Number.isFinite(weight) || !Number.isFinite(confidence) || !Number.isFinite(evidenceCount)) return null;
  if (confidence < 0.35 || evidenceCount < 2 || Math.abs(weight) < 0.2) return null;
  return { weight, confidence, evidenceCount, notes: str(signal.notes) };
}

function buildSceneGuidanceLines({ designSceneContext = null, sections = [] } = {}) {
  const scene = designSceneContext && typeof designSceneContext === "object" ? designSceneContext : {};
  const broad = arr(scene?.coverageDomains?.broad).filter(Boolean);
  const detail = arr(scene?.coverageDomains?.detail).filter(Boolean);
  const focal = arr(scene?.focalCandidates).filter(Boolean);
  const scope = arr(sections).filter(Boolean).join(", ") || "General";
  const lines = [];

  if (broad.length) {
    lines.push(`${scope} / ${broad[0]} / establish broad base coverage before detail refinement`);
  }
  if (focal.length) {
    lines.push(`${scope} / ${focal[0]} / preserve focal clarity as the lead visual anchor`);
  }
  if (detail.length) {
    lines.push(`${scope} / ${detail[0]} / use detail refinement only after the base pass reads cleanly`);
  }
  return lines;
}

function buildMusicGuidanceLines({ musicDesignContext = null, sections = [] } = {}) {
  const music = musicDesignContext && typeof musicDesignContext === "object" ? musicDesignContext : {};
  const sectionArc = arr(music.sectionArc);
  const reveals = arr(music?.designCues?.revealMoments).filter(Boolean);
  const holds = arr(music?.designCues?.holdMoments).filter(Boolean);
  const targetSections = arr(sections).filter(Boolean);
  const lines = [];

  for (const section of sectionArc) {
    const label = str(section?.label);
    if (!label) continue;
    if (targetSections.length && !targetSections.includes(label)) continue;
    const energy = str(section?.energy);
    if (energy === "high") {
      lines.push(`${label} / General / build stronger visual payoff and clearer contrast at this impact section`);
    } else if (energy === "low") {
      lines.push(`${label} / General / keep the pass restrained and readable to preserve space`);
    }
  }

  for (const reveal of reveals.slice(0, 2)) {
    lines.push(`General / General / shape a reveal around ${str(reveal)} with clearer escalation into the moment`);
  }
  for (const hold of holds.slice(0, 2)) {
    lines.push(`General / General / protect ${str(hold)} as a calmer hold section without extra clutter`);
  }

  return lines;
}

function buildPreferenceGuidanceLines({ directorProfile = null, normalizedIntent = null } = {}) {
  const sections = arr(normalizedIntent?.sections).filter(Boolean);
  const scope = sections.join(", ") || "General";
  const lines = [];
  const focusBias = readProfileSignal(directorProfile, "focusBias");
  const changeTolerance = readProfileSignal(directorProfile, "changeTolerance");
  const complexityTolerance = readProfileSignal(directorProfile, "complexityTolerance");

  if (focusBias?.weight > 0) {
    lines.push(`${scope} / General / keep the pass anchored around a clear focal hierarchy before broad expansion`);
  } else if (focusBias?.weight < 0) {
    lines.push(`${scope} / General / allow broader coverage to read before isolating focal accents`);
  }

  if (changeTolerance?.weight < 0) {
    lines.push(`${scope} / General / keep this pass incremental and preserve more of the current look`);
  } else if (changeTolerance?.weight > 0) {
    lines.push(`${scope} / General / allow a bolder revision pass where the design needs a stronger reset`);
  }

  if (complexityTolerance?.weight < 0) {
    lines.push(`${scope} / General / prefer cleaner readable choices over dense layering unless the moment demands it`);
  } else if (complexityTolerance?.weight > 0) {
    lines.push(`${scope} / General / tolerate denser layering when it strengthens the moment without losing clarity`);
  }

  return lines;
}

function applyDesignerContextToProposalLines({
  proposalLines = [],
  normalizedIntent = null,
  designSceneContext = null,
  musicDesignContext = null,
  directorProfile = null
} = {}) {
  const sections = arr(normalizedIntent?.sections).filter(Boolean);
  const sceneLines = buildSceneGuidanceLines({ designSceneContext, sections });
  const musicLines = buildMusicGuidanceLines({ musicDesignContext, sections });
  const preferenceLines = buildPreferenceGuidanceLines({ directorProfile, normalizedIntent });
  return prependUnique(proposalLines, [...sceneLines, ...musicLines, ...preferenceLines]).slice(0, 8);
}

export function buildProposalFromIntent(input = {}) {
  const normalizedIntent = normalizeIntent(input);
  const selection = resolveTargetSelection({
    normalizedIntent,
    models: input.models,
    submodels: input.submodels,
    metadataAssignments: input.metadataAssignments,
    displayElements: input.displayElements
  });
  const targets = selection.targets;
  const proposalLines = applyDesignerContextToProposalLines({
    proposalLines: buildSequencingStrategy(normalizedIntent, targets),
    normalizedIntent,
    designSceneContext: input.designSceneContext,
    musicDesignContext: input.musicDesignContext,
    directorProfile: input.directorProfile
  });

  return {
    normalizedIntent,
    targets,
    proposalLines,
    unresolvedTargets: selection.unresolvedTargets
  };
}
