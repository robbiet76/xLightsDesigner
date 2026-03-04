const DEFAULT_ENDPOINT = "http://127.0.0.1:49914/xlDoAutomation";

function normalizeBody(raw) {
  const idx = raw.indexOf("{");
  return idx >= 0 ? raw.slice(idx) : raw;
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

  const response = await fetch(endpoint, {
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
    throw new Error(`Invalid JSON from xLights endpoint (${err.message})`);
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
