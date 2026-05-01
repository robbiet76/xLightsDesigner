import test from "node:test";
import assert from "node:assert/strict";

import { buildEffectiveMetadataAssignments } from "../../runtime/effective-metadata-assignments.js";

test("effective metadata assignments synthesize prefs-only targets", () => {
  const out = buildEffectiveMetadataAssignments([], {
    Snowman: {
      rolePreference: "Focal",
      semanticHints: ["Character", "Beat-Sync"]
    }
  }, {
    resolveTarget: (targetId) => targetId === "Snowman"
      ? { id: "Snowman", type: "model", parentId: "" }
      : null
  });

  assert.equal(out.length, 1);
  assert.equal(out[0].targetId, "Snowman");
  assert.equal(out[0].targetType, "model");
  assert.equal(out[0].rolePreference, "Focal");
  assert.deepEqual(out[0].semanticHints, ["Character", "Beat-Sync"]);
  assert.deepEqual(out[0].tags, ["Focal", "Character", "Beat-Sync"]);
});

test("effective metadata assignments merge prefs into existing assignments", () => {
  const out = buildEffectiveMetadataAssignments([
    { targetId: "Border-01", targetType: "model", tags: ["existing"] }
  ], {
    "Border-01": {
      rolePreference: "Frame",
      semanticHints: ["Outline", "Linear"]
    }
  });

  assert.equal(out.length, 1);
  assert.deepEqual(out[0].tags, ["Existing", "Frame", "Outline", "Linear"]);
  assert.equal(out[0].rolePreference, "Frame");
  assert.deepEqual(out[0].semanticHints, ["Outline", "Linear"]);
});

test("effective metadata assignments attach only defined visual hint records", () => {
  const out = buildEffectiveMetadataAssignments([], {
    "Flood-01": {
      semanticHints: ["Flood Light", "Cool"]
    }
  }, {
    visualHintDefinitions: [
      {
        name: "Cool",
        status: "pending_definition",
        source: "custom",
        definedBy: "user"
      }
    ],
    resolveTarget: () => ({ id: "Flood-01", type: "model", parentId: "" })
  });

  assert.equal(out.length, 1);
  assert.deepEqual(out[0].visualHintDefinitions.map((row) => row.name), ["Flood Light"]);
});
