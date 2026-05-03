import test from "node:test";
import assert from "node:assert/strict";
import { validateCombinedTargetContextTrainingFixture } from "./validate-combined-target-context-training-fixture.mjs";

test("combined target context fixture links model-index fingerprints to behavior evidence", () => {
  const result = validateCombinedTargetContextTrainingFixture();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.exampleCount, 1);
  assert.equal(result.fingerprintMatchCount, 1);
  assert.equal(result.submodelExpectationCount, 1);
});
