import { buildPageStates } from "../app-ui/page-state/index.js";
import { readCurrentXLightsSequenceState } from "../agent/xlights-state/live-sequence-state-runtime.js";
import { readXLightsEffectOccupancyState } from "../agent/xlights-state/live-effect-occupancy-state.js";
import { validateDirectSequencePromptState } from "../agent/sequence-agent/clean-sequence-validation.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function buildEffectQueriesFromSequenceRows(rows = [], expected = {}) {
  const target = str(expected?.target);
  const effectName = str(expected?.effectName);
  const matchingRows = arr(rows).filter((row) => {
    if (target && str(row?.target) !== target) return false;
    if (str(expected?.section) && str(row?.section) !== str(expected.section)) return false;
    if (effectName && !str(row?.summary).toLowerCase().includes(effectName.toLowerCase())) return false;
    return true;
  });
  return matchingRows.map((row) => ({
    modelName: str(row?.target),
    effectName,
    layerIndex: 0,
    startMs: null,
    endMs: null
  })).filter((row) => row.modelName && row.effectName);
}

export async function runDirectSequenceValidation({
  endpoint = "",
  state = {},
  handoffs = {},
  helpers = {},
  expected = {},
  deps = {}
} = {}) {
  const pageStates = buildPageStates({ state, handoffs, helpers });
  const readSequenceState = deps.readSequenceState || readCurrentXLightsSequenceState;
  const readEffectOccupancy = deps.readEffectOccupancy || readXLightsEffectOccupancyState;
  const xlightsSequenceState = await readSequenceState(endpoint, { includeTimingMarks: false });
  const effectQueries = buildEffectQueriesFromSequenceRows(pageStates?.sequence?.data?.rows || [], expected);
  const xlightsEffectOccupancyState = effectQueries.length
    ? await readEffectOccupancy(endpoint, effectQueries, deps)
    : null;
  const validation = validateDirectSequencePromptState({
    expected,
    pageStates,
    xlightsSequenceState,
    xlightsEffectOccupancyState,
    handoffs
  });
  return {
    contract: "direct_sequence_validation_run_v1",
    version: "1.0",
    pageStates,
    xlightsSequenceState,
    xlightsEffectOccupancyState,
    validation
  };
}
