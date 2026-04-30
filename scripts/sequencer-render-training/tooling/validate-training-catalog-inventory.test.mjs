import test from "node:test";
import assert from "node:assert/strict";

import { validateCatalogInventory } from "./validate-training-catalog-inventory.mjs";

test("training catalog inventory classifies every catalog file exactly once", () => {
  const result = validateCatalogInventory();
  assert.equal(result.ok, true);
  assert.equal(result.unclassified.length, 0);
  assert.equal(result.duplicateClassifications.length, 0);
  assert.ok(result.lifecycleCounts.curated_source >= 1);
  assert.ok(result.lifecycleCounts.promoted_evidence >= 1);
  assert.ok(result.lifecycleCounts.generated_catalog >= 1);
});

