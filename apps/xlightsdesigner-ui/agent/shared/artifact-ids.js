function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeForHash(value) {
  if (Array.isArray(value)) return value.map((row) => normalizeForHash(row));
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (key === "artifactId" || key === "createdAt") continue;
    const next = normalizeForHash(value[key]);
    if (next !== undefined) out[key] = next;
  }
  return out;
}

export function canonicalizeArtifactForHash(value) {
  return JSON.stringify(normalizeForHash(value));
}

export function hashArtifactContent(value) {
  const text = canonicalizeArtifactForHash(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildArtifactId(artifactType = "", payload = {}) {
  const type = String(artifactType || "").trim() || "artifact";
  return `${type}-${hashArtifactContent(payload)}`;
}

export function finalizeArtifact({
  artifactType = "",
  artifactVersion = "1.0",
  createdAt = "",
  ...payload
} = {}) {
  const artifact = {
    artifactType: String(artifactType || "").trim(),
    artifactVersion: String(artifactVersion || "1.0").trim() || "1.0",
    createdAt: String(createdAt || "").trim() || new Date().toISOString(),
    ...payload
  };
  artifact.artifactId = buildArtifactId(artifact.artifactType, artifact);
  return artifact;
}
