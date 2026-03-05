const DEFAULT_ENDPOINT = "/xlDoAutomation";

function normalizeBody(raw) {
  const idx = raw.indexOf("{");
  return idx >= 0 ? raw.slice(idx) : raw;
}

function sanitizeEndpoint(endpoint) {
  let e = String(endpoint || "").trim();
  if (!e) return e;
  // Repair bad endpoint forms introduced by prior client normalization bugs.
  e = e.replace(/\/xlDoAutomation\/xlDoAutomation\b/g, "/xlDoAutomation");
  e = e.replace(/\/xlDoAutomation\/+$/g, "/xlDoAutomation");
  return e;
}

export function getDefaultEndpoint() {
  return DEFAULT_ENDPOINT;
}

export async function postCommand(endpoint, cmd, params = {}, options = {}) {
  const payload = {
    apiVersion: 2,
    cmd,
    params,
    options
  };
  const targetEndpoint = sanitizeEndpoint(endpoint);

  const response = await fetch(targetEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  const normalized = normalizeBody(text);
  let json;
  try {
    json = JSON.parse(normalized);
  } catch (err) {
    throw new Error(`Invalid JSON from xLights endpoint ${targetEndpoint} (${err.message})`);
  }

  if (json.res !== 200) {
    const code = json?.error?.code || "UNKNOWN";
    const message = json?.error?.message || "Command failed";
    throw new Error(`${cmd} failed (${code}): ${message}`);
  }

  return json;
}

export async function pingCapabilities(endpoint) {
  return postCommand(endpoint, "system.getCapabilities", {});
}

export async function getOpenSequence(endpoint) {
  return postCommand(endpoint, "sequence.getOpen", {});
}

export async function getMediaStatus(endpoint) {
  return postCommand(endpoint, "media.getStatus", {});
}

export async function getRevision(endpoint) {
  return postCommand(endpoint, "sequence.getRevision", {});
}

export async function openSequence(endpoint, file, force = true, promptIssues = false) {
  return postCommand(endpoint, "sequence.open", {
    file,
    force,
    promptIssues
  });
}

export async function createSequence(endpoint, params = {}) {
  return postCommand(endpoint, "sequence.create", params);
}

export async function saveSequence(endpoint, file = null) {
  const params = {};
  if (file) params.file = file;
  return postCommand(endpoint, "sequence.save", params);
}

export async function closeSequence(endpoint, force = true, quiet = false) {
  return postCommand(endpoint, "sequence.close", {
    force,
    quiet
  });
}

export async function getModels(endpoint) {
  return postCommand(endpoint, "layout.getModels", {});
}

export async function getTimingTracks(endpoint) {
  return postCommand(endpoint, "timing.getTracks", {});
}

export async function getTimingMarks(endpoint, trackName) {
  return postCommand(endpoint, "timing.getMarks", {
    trackName
  });
}

export async function validateCommands(endpoint, commands) {
  return postCommand(endpoint, "system.validateCommands", {
    commands
  });
}

export async function executePlan(endpoint, commands, atomic = true) {
  return postCommand(endpoint, "system.executePlan", {
    atomic,
    commands
  });
}

export async function getJob(endpoint, jobId) {
  return postCommand(endpoint, "jobs.get", {
    jobId
  });
}

export async function cancelJob(endpoint, jobId) {
  return postCommand(endpoint, "jobs.cancel", {
    jobId
  });
}
