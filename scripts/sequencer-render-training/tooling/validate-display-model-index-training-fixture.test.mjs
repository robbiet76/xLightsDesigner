import test from "node:test";
import assert from "node:assert/strict";
import { validateDisplayModelIndexTrainingFixture } from "./validate-display-model-index-training-fixture.mjs";

test("display model index training fixture satisfies contract coverage", () => {
  const result = validateDisplayModelIndexTrainingFixture();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.exampleCount, 1);
  assert.equal(result.recordCount, 2);
  assert.equal(result.customRecordCount, 1);
  assert.equal(result.submodelRecordCount, 1);
});
