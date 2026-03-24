import test from "node:test";
import assert from "node:assert/strict";

import { parseExplicitVisualHintDefinitionIntent } from "../../runtime/visual-hint-definition-intent.js";

test("parseExplicitVisualHintDefinitionIntent recognizes explicit define syntax", () => {
  const out = parseExplicitVisualHintDefinitionIntent(
    'Define visual hint "cool" as props that should favor cooler color direction and restrained motion.'
  );

  assert.deepEqual(out, {
    name: "cool",
    description: "props that should favor cooler color direction and restrained motion",
    behavioralIntent: "props that should favor cooler color direction and restrained motion"
  });
});

test("parseExplicitVisualHintDefinitionIntent recognizes means syntax", () => {
  const out = parseExplicitVisualHintDefinitionIntent(
    'Visual hint beat-sync means props that are good for visible pulse, hits, and rhythmic support.'
  );

  assert.deepEqual(out, {
    name: "beat-sync",
    description: "props that are good for visible pulse, hits, and rhythmic support",
    behavioralIntent: "props that are good for visible pulse, hits, and rhythmic support"
  });
});

test("parseExplicitVisualHintDefinitionIntent ignores ordinary chat", () => {
  const out = parseExplicitVisualHintDefinitionIntent(
    "Can you make the chorus feel cooler and a little smoother?"
  );

  assert.equal(out, null);
});
