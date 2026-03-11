const REQUIRED_ROLE_IDS = ["audio_analyst", "designer_dialog", "sequence_agent"];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function validateTrainingAgentRegistry({ registry = {}, profiles = [] } = {}) {
  const errors = [];
  const refs = arr(registry?.agents);
  const refsById = new Map();
  const profilesById = new Map();

  for (const ref of refs) {
    const id = str(ref?.id);
    const path = str(ref?.path);
    if (!id) {
      errors.push("registry agents entry missing id");
      continue;
    }
    if (!path) errors.push(`registry role ${id} missing path`);
    refsById.set(id, { id, path, status: str(ref?.status || "") || "unknown" });
  }

  for (const row of arr(profiles)) {
    const id = str(row?.id);
    const profile = isPlainObject(row?.profile) ? row.profile : null;
    if (!id || !profile) continue;
    profilesById.set(id, row);
    const profileId = str(profile?.id);
    if (!profileId) {
      errors.push(`profile ${id} missing profile.id`);
    } else if (profileId !== id) {
      errors.push(`profile id mismatch for ${id}: profile.id=${profileId}`);
    }
  }

  for (const roleId of REQUIRED_ROLE_IDS) {
    if (!refsById.has(roleId)) {
      errors.push(`required role missing from registry: ${roleId}`);
    }
    if (!profilesById.has(roleId)) {
      errors.push(`required profile missing: ${roleId}`);
    }
  }

  const sequenceProfile = profilesById.get("sequence_agent")?.profile;
  if (isPlainObject(sequenceProfile)) {
    const inputs = new Set(arr(sequenceProfile?.inputs).map((v) => str(v)).filter(Boolean));
    if (!inputs.has("intent_handoff_v1")) {
      errors.push("sequence_agent inputs missing intent_handoff_v1");
    }
    if (!inputs.has("analysis_handoff_v1")) {
      errors.push("sequence_agent inputs missing analysis_handoff_v1");
    }

    const outputs = new Set(arr(sequenceProfile?.outputs).map((v) => str(v)).filter(Boolean));
    if (!outputs.has("plan_handoff_v1")) {
      errors.push("sequence_agent outputs missing plan_handoff_v1");
    }
  }

  const audioTargets = new Set(arr(profilesById.get("audio_analyst")?.profile?.handoff?.to).map((v) => str(v)).filter(Boolean));
  if (audioTargets.size && !audioTargets.has("sequence_agent")) {
    errors.push("audio_analyst handoff.to missing sequence_agent");
  }

  const dialogTargets = new Set(arr(profilesById.get("designer_dialog")?.profile?.handoff?.to).map((v) => str(v)).filter(Boolean));
  if (dialogTargets.size && !dialogTargets.has("sequence_agent")) {
    errors.push("designer_dialog handoff.to missing sequence_agent");
  }

  return {
    ok: errors.length === 0,
    errors,
    requiredRoles: REQUIRED_ROLE_IDS
  };
}
