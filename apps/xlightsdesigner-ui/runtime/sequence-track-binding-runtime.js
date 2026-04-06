function str(value = "") {
  return String(value || "").trim();
}

function basenameWithoutExt(filePath = "") {
  const base = str(filePath).split(/[\\/]/).pop() || "";
  return base.replace(/\.[^.]+$/, "").trim();
}

export function normalizeSequenceTrackBinding(binding = null) {
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) return null;
  const preferredAudioPath = str(binding.preferredAudioPath);
  const contentFingerprint = str(binding.contentFingerprint).toLowerCase();
  const title = str(binding.title);
  const artist = str(binding.artist);
  const displayName = str(binding.displayName) || [title, artist].filter(Boolean).join(" - ") || title;
  if (!preferredAudioPath && !contentFingerprint && !displayName) return null;
  return {
    preferredAudioPath,
    contentFingerprint,
    title,
    artist,
    displayName: displayName || basenameWithoutExt(preferredAudioPath) || "Unknown Track"
  };
}

export function buildSequenceTrackBindingFromArtifact({ artifact = null, audioPath = "" } = {}) {
  const targetAudioPath = str(audioPath);
  const identity = artifact?.identity && typeof artifact.identity === "object" ? artifact.identity : {};
  const sourceMetadata = identity?.sourceMetadata && typeof identity.sourceMetadata === "object"
    ? identity.sourceMetadata
    : {};
  const title = str(identity.title || sourceMetadata.embeddedTitle || basenameWithoutExt(targetAudioPath));
  const artist = str(identity.artist || sourceMetadata.embeddedArtist || "");
  const displayName = [title, artist].filter(Boolean).join(" - ") || title;
  const contentFingerprint = str(identity.contentFingerprint || artifact?.media?.contentFingerprint || "").toLowerCase();
  return normalizeSequenceTrackBinding({
    preferredAudioPath: targetAudioPath,
    contentFingerprint,
    title,
    artist,
    displayName
  });
}
