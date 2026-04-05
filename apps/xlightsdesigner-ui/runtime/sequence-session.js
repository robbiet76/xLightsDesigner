function str(value = "") {
  return String(value || "").trim();
}

export function readSequencePathFromPayload(sequencePayload = null, fallbackPath = "") {
  return str(
    sequencePayload?.path ||
    sequencePayload?.file ||
    fallbackPath ||
    ""
  );
}

export function isPathWithinShowFolder(candidatePath = "", showFolderPath = "") {
  const normalize = (value) =>
    str(value)
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");
  const candidate = normalize(candidatePath);
  const root = normalize(showFolderPath);
  if (!candidate || !root) return false;
  if (candidate === root) return true;
  return candidate.startsWith(`${root}/`);
}

export function isSequenceAllowedInShowFolder(sequencePayload = null, showFolder = "") {
  const root = str(showFolder);
  if (!root) return true;
  const sequencePath = readSequencePathFromPayload(sequencePayload);
  if (!sequencePath) return true;
  return isPathWithinShowFolder(sequencePath, root);
}

export function buildSequenceSession({ state = {}, liveSequencePayload = null } = {}) {
  const showFolder = str(state?.showFolder);
  const sequencePathInput = str(state?.sequencePathInput);
  const audioPathInput = str(state?.audioPathInput);
  const sequenceMediaFile = str(state?.sequenceMediaFile);
  const activeSequence = str(state?.activeSequence);
  const xlightsConnected = Boolean(state?.flags?.xlightsConnected);
  const activeSequenceLoaded = Boolean(state?.flags?.activeSequenceLoaded);
  const planOnlyMode = Boolean(state?.flags?.planOnlyMode);
  const sequenceOpen = Boolean(state?.health?.sequenceOpen);

  const liveSequencePath = readSequencePathFromPayload(liveSequencePayload);
  const liveSequenceAllowed = isSequenceAllowedInShowFolder(liveSequencePayload, showFolder);
  const liveSequenceOpen = Boolean(liveSequencePayload && liveSequenceAllowed && liveSequencePath);

  const effectiveSequenceLoaded = activeSequenceLoaded || liveSequenceOpen;
  const effectiveSequencePath = liveSequenceOpen ? liveSequencePath : sequencePathInput;
  const effectiveSequenceAllowed = effectiveSequencePath
    ? isPathWithinShowFolder(effectiveSequencePath, showFolder || effectiveSequencePath)
    : true;

  const blockers = [];
  if (!planOnlyMode) {
    if (!xlightsConnected) {
      blockers.push({ code: "xlights_not_connected", message: "Connect to xLights before sequencing." });
    }
    if (!effectiveSequenceLoaded) {
      blockers.push({ code: "no_active_sequence", message: "Open a sequence or enter plan-only mode." });
    } else if (!effectiveSequenceAllowed) {
      blockers.push({ code: "sequence_outside_show_folder", message: "Open a sequence inside the active Show Directory." });
    }
  }

  return {
    showFolder,
    activeSequence,
    sequencePathInput,
    audioPathInput,
    sequenceMediaFile,
    xlightsConnected,
    activeSequenceLoaded,
    planOnlyMode,
    sequenceOpen,
    liveSequencePath,
    liveSequenceOpen,
    liveSequenceAllowed,
    effectiveSequenceLoaded,
    effectiveSequencePath,
    effectiveSequenceAllowed,
    canGenerateSequence: planOnlyMode || blockers.length === 0,
    blockers
  };
}

export function explainSequenceSessionBlockers(session = {}) {
  const blockers = Array.isArray(session?.blockers) ? session.blockers : [];
  const primary = blockers[0] || null;
  return {
    blockers,
    primaryCode: str(primary?.code),
    message: str(primary?.message)
  };
}
