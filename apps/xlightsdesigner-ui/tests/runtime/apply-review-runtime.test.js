import test from "node:test";
import assert from "node:assert/strict";

import { createApplyReviewRuntime } from "../../runtime/apply-review-runtime.js";

function buildState() {
  return {
    proposed: [
      "Verse 1 / Tree / add Color Wash",
      "Chorus 1 / Star / add Twinkle",
      "General / House / add Dim"
    ],
    ui: {
      applyApprovalChecked: false,
      proposedSelection: [1]
    },
    flags: {
      proposalStale: false,
      applyInProgress: false
    }
  };
}

test("apply review runtime filters proposed lines by selected sections while keeping General", () => {
  const state = buildState();
  const runtime = createApplyReviewRuntime({
    state,
    hasAllSectionsSelected: () => false,
    getSelectedSections: () => ["Verse 1"],
    getSectionName: (line) => String(line).split("/")[0].trim()
  });

  assert.deepEqual(runtime.filteredProposed(), [
    "Verse 1 / Tree / add Color Wash",
    "General / House / add Dim"
  ]);
});

test("apply review runtime blocks apply when approval is missing", async () => {
  const state = buildState();
  const statuses = [];
  let rendered = 0;
  const runtime = createApplyReviewRuntime({
    state,
    setStatusWithDiagnostics: (level, text) => statuses.push({ level, text }),
    render: () => { rendered += 1; },
    currentSequencePathForSidecar: () => "/show/seq.xsq"
  });

  const result = await runtime.applyProposal(["Verse 1 / Tree / add Color Wash"], "proposal");

  assert.equal(result.ok, false);
  assert.equal(result.reason, "approval_required");
  assert.deepEqual(statuses, [
    {
      level: "warning",
      text: "Review the plan and check approval before apply."
    }
  ]);
  assert.equal(rendered, 1);
});

test("apply review runtime derives selected proposed lines from UI selection", () => {
  const state = buildState();
  const runtime = createApplyReviewRuntime({ state });

  assert.deepEqual(runtime.selectedProposedLinesForApply(), [
    "Chorus 1 / Star / add Twinkle"
  ]);
});
