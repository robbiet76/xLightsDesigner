import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSequenceSession,
  explainSequenceSessionBlockers,
  isPathWithinShowFolder,
  isSequenceAllowedInShowFolder,
  readSequencePathFromPayload
} from "../../runtime/sequence-session.js";

test("readSequencePathFromPayload prefers payload path/file", () => {
  assert.equal(readSequencePathFromPayload({ path: "/show/A.xsq" }), "/show/A.xsq");
  assert.equal(readSequencePathFromPayload({ file: "/show/B.xsq" }), "/show/B.xsq");
  assert.equal(readSequencePathFromPayload(null, "/fallback/C.xsq"), "/fallback/C.xsq");
});

test("isPathWithinShowFolder handles nested paths", () => {
  assert.equal(isPathWithinShowFolder("/show/A/B.xsq", "/show"), true);
  assert.equal(isPathWithinShowFolder("/other/A.xsq", "/show"), false);
});

test("isSequenceAllowedInShowFolder rejects external sequence paths", () => {
  assert.equal(isSequenceAllowedInShowFolder({ path: "/show/A/B.xsq" }, "/show"), true);
  assert.equal(isSequenceAllowedInShowFolder({ path: "/other/A.xsq" }, "/show"), false);
});

test("buildSequenceSession uses live xLights sequence when allowed in show folder", () => {
  const session = buildSequenceSession({
    state: {
      showFolder: "/show",
      sequencePathInput: "",
      flags: {
        xlightsConnected: true,
        activeSequenceLoaded: false,
        planOnlyMode: false
      },
      health: {
        sequenceOpen: true
      }
    },
    liveSequencePayload: {
      path: "/show/Candy/Candy.xsq"
    }
  });

  assert.equal(session.effectiveSequenceLoaded, true);
  assert.equal(session.effectiveSequencePath, "/show/Candy/Candy.xsq");
  assert.equal(session.canGenerateSequence, true);
  assert.equal(session.blockers.length, 0);
});

test("buildSequenceSession blocks external live sequence when show folder mismatches", () => {
  const session = buildSequenceSession({
    state: {
      showFolder: "/show-a",
      sequencePathInput: "",
      flags: {
        xlightsConnected: true,
        activeSequenceLoaded: false,
        planOnlyMode: false
      },
      health: {
        sequenceOpen: true
      }
    },
    liveSequencePayload: {
      path: "/show-b/Candy/Candy.xsq"
    }
  });

  const explanation = explainSequenceSessionBlockers(session);
  assert.equal(session.effectiveSequenceLoaded, false);
  assert.equal(session.canGenerateSequence, false);
  assert.equal(explanation.primaryCode, "no_active_sequence");
});

test("buildSequenceSession allows plan-only mode without active sequence", () => {
  const session = buildSequenceSession({
    state: {
      showFolder: "/show",
      flags: {
        xlightsConnected: false,
        activeSequenceLoaded: false,
        planOnlyMode: true
      },
      health: {
        sequenceOpen: false
      }
    }
  });

  assert.equal(session.canGenerateSequence, true);
  assert.equal(session.blockers.length, 0);
});
