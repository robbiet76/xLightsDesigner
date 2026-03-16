import {
  getOpenSequence,
  getRevision,
  getSequenceSettings,
  getMediaStatus,
  getModels,
  getSubmodels,
  getDisplayElements,
  getTimingTracks,
  getTimingMarks
} from "../../api.js";
import { readXLightsSequenceState } from "./live-sequence-state.js";

export const defaultXLightsSequenceStateDeps = {
  getOpenSequence,
  getRevision,
  getSequenceSettings,
  getMediaStatus,
  getModels,
  getSubmodels,
  getDisplayElements,
  getTimingTracks,
  getTimingMarks
};

export async function readCurrentXLightsSequenceState(endpoint, options = {}, deps = defaultXLightsSequenceStateDeps) {
  return readXLightsSequenceState(endpoint, deps, options);
}
