import test from "node:test";
import assert from "node:assert/strict";

import {
  ensureVisualHintDefinitions,
  getSystemVisualHintDefinitions,
  mergeVisualHintDefinitions,
  toStoredVisualHintDefinitions
} from "../../runtime/visual-hint-definitions.js";

test("system visual hint definitions are present", () => {
  const rows = getSystemVisualHintDefinitions();
  assert.equal(rows.some((row) => row.name === "Beat-Sync" && row.status === "defined"), true);
  assert.equal(rows.some((row) => row.name === "Flood Light" && row.semanticClass === "lighting_capability"), true);
});

test("ensureVisualHintDefinitions adds pending placeholders for custom hints", () => {
  const rows = ensureVisualHintDefinitions([], ["cool", "Beat-Sync"], { timestamp: "2026-03-24T12:00:00.000Z" });
  const custom = rows.find((row) => row.name === "Cool");
  assert.ok(custom);
  assert.equal(custom.status, "pending_definition");
  assert.equal(custom.definedBy, "user");
  assert.equal(custom.provenance.createdAt, "2026-03-24T12:00:00.000Z");
  assert.equal(rows.some((row) => row.name === "Beat-Sync" && row.controlled === true), true);
});

test("merge/toStored preserve custom hint definitions but exclude system hints", () => {
  const merged = mergeVisualHintDefinitions([
    {
      name: "cool",
      description: "Used for cool-toned props.",
      semanticClass: "custom_style",
      behavioralIntent: "Prefer cooler color direction.",
      source: "agent",
      status: "defined",
      definedBy: "agent",
      provenance: {
        source: "agent",
        learnedFrom: "chat_dialog"
      }
    }
  ]);
  assert.equal(merged.some((row) => row.name === "Cool" && row.definedBy === "agent"), true);

  const stored = toStoredVisualHintDefinitions(merged);
  assert.equal(stored.some((row) => row.name === "Beat-Sync"), false);
  assert.equal(stored.some((row) => row.name === "Cool" && row.status === "defined"), true);
});
