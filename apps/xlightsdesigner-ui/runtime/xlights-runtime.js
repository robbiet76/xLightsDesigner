import { readCurrentXLightsSequenceState } from "../agent/xlights-state/live-sequence-state-runtime.js";
import { pingCapabilities, getSystemVersion } from "../api.js";

function str(value = "") {
  return String(value || "").trim();
}

export async function collectXLightsRuntimeSnapshot(endpoint, deps = {}) {
  const {
    readSequenceState = readCurrentXLightsSequenceState,
    ping = pingCapabilities,
    getVersion = getSystemVersion
  } = deps;

  const [sequenceState, capabilities, version] = await Promise.all([
    readSequenceState(endpoint, { includeTimingMarks: false }),
    ping(endpoint),
    getVersion(endpoint).catch(() => ({ data: { version: "" } }))
  ]);

  return {
    contract: "xlights_runtime_snapshot_v1",
    version: "1.0",
    endpoint: str(endpoint),
    summary: sequenceState?.summary || "No xLights sequence state available.",
    sequenceState,
    capabilities: {
      commandCount: Array.isArray(capabilities?.data?.commands) ? capabilities.data.commands.length : 0,
      commands: Array.isArray(capabilities?.data?.commands) ? capabilities.data.commands : [],
      rawVersion: str(version?.data?.version || capabilities?.data?.version || "")
    }
  };
}
