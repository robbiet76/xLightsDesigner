import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGlobalXdTrackPolicyKey,
  deriveUserOwnedTrackNameFromXd,
  createTimingTrackRuntime
} from "../../runtime/timing-track-runtime.js";
import { buildTimingTrackProvenanceRecord } from "../../runtime/timing-track-provenance.js";

test("buildGlobalXdTrackPolicyKey normalizes XD track names", () => {
  assert.equal(buildGlobalXdTrackPolicyKey("XD: Song Structure"), "__xd_global__::xd: song structure");
});

test("deriveUserOwnedTrackNameFromXd strips XD prefix", () => {
  assert.equal(deriveUserOwnedTrackNameFromXd("XD: Phrase Cues"), "Phrase Cues");
});

test("timing track runtime exposes manual XD locks from state", () => {
  const state = {
    sequenceAgentRuntime: {
      timingTrackPolicies: {
        "__xd_global__::xd: phrase cues": {
          sourceTrack: "XD: Phrase Cues",
          trackName: "Phrase Cues",
          manual: true,
          lockedAt: "2026-04-05T00:00:00Z",
          updatedAt: "2026-04-05T00:00:00Z"
        }
      },
      timingGeneratedSignatures: {},
      timingTrackProvenance: {}
    },
    ui: {}
  };
  const runtime = createTimingTrackRuntime({
    state,
    fallbackSequenceAgentRuntime: {
      timingTrackPolicies: {},
      timingGeneratedSignatures: {},
      timingTrackProvenance: {}
    }
  });

  const rows = runtime.getManualLockedXdTracks();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceTrack, "XD: Phrase Cues");
});

test("timing track runtime accepts timing review and refreshes sections", async () => {
  const record = buildTimingTrackProvenanceRecord({
    trackType: "structure",
    trackName: "XD: Song Structure",
    sourceMarks: [
      { startMs: 0, endMs: 1000, label: "Intro" },
      { startMs: 1000, endMs: 2000, label: "Verse" }
    ],
    userFinalMarks: [
      { startMs: 0, endMs: 1200, label: "Intro" },
      { startMs: 1200, endMs: 2000, label: "Verse" }
    ],
    coverageMode: "complete",
    durationMs: 2000
  });
  const state = {
    sequenceAgentRuntime: {
      timingTrackPolicies: {},
      timingGeneratedSignatures: {
        "__xd_global__::xd: song structure": "0:1000:Intro|1000:2000:Verse"
      },
      timingTrackProvenance: {
        "__xd_global__::xd: song structure": record
      }
    },
    ui: {
      sectionTrackName: "XD: Song Structure"
    }
  };

  const calls = {
    refresh: [],
    status: []
  };
  const runtime = createTimingTrackRuntime({
    state,
    fallbackSequenceAgentRuntime: {
      timingTrackPolicies: {},
      timingGeneratedSignatures: {},
      timingTrackProvenance: {}
    },
    isXdTimingTrack: (name = "") => /^xd:/i.test(String(name || "").trim()),
    refreshSectionsForTrack: async (trackName) => {
      calls.refresh.push(trackName);
    },
    setStatus: (level, message) => {
      calls.status.push({ level, message });
    },
    setStatusWithDiagnostics: (level, message) => {
      calls.status.push({ level, message });
    }
  });

  const result = await runtime.acceptTimingTrackReview({
    trackName: "XD: Song Structure",
    acceptedAt: "2026-04-05T10:00:00Z",
    reviewer: "rob"
  });

  assert.equal(result.ok, true);
  assert.equal(result.refreshed, true);
  assert.deepEqual(calls.refresh, ["XD: Song Structure"]);
  assert.equal(
    state.sequenceAgentRuntime.timingGeneratedSignatures["__xd_global__::xd: song structure"],
    "0:1200:Intro|1200:2000:Verse"
  );
});
