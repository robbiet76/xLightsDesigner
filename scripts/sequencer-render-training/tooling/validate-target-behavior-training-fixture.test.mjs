import test from "node:test";
import assert from "node:assert/strict";
import { validateTargetBehaviorTrainingFixture } from "./validate-target-behavior-training-fixture.mjs";

test("target behavior training fixture satisfies contract coverage", () => {
  const result = validateTargetBehaviorTrainingFixture();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.exampleCount, 1);
  assert.equal(result.recordCount, 1);
  assert.equal(result.submodelRecordCount, 1);
  assert.equal(result.customParentRecordCount, 1);
});
