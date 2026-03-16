import test from "node:test";
import assert from "node:assert/strict";

import { buildProjectDashboardState } from "../../../app-ui/page-state/project-dashboard-state.js";

test("project dashboard reports blocked when no project is open", () => {
  const dashboard = buildProjectDashboardState({
    state: {
      projectFilePath: "",
      sequenceCatalog: [],
      sequencePathInput: "",
      flags: {}
    }
  });

  assert.equal(dashboard.page, "project");
  assert.equal(dashboard.status, "idle");
  assert.equal(dashboard.readiness.ok, false);
  assert.match(dashboard.validationIssues.map((issue) => issue.code).join(","), /no_saved_project/);
});

test("project dashboard summarizes active project and sequence context", () => {
  const dashboard = buildProjectDashboardState({
    state: {
      projectFilePath: "/tmp/project.xldp",
      projectName: "HolidayRoad",
      projectConcept: "Warm and magical.",
      showFolder: "/shows/holiday",
      mediaPath: "/media",
      showDirectoryStats: { xsqCount: 4, xdmetaCount: 2 },
      projectCreatedAt: "2026-03-16T12:00:00.000Z",
      projectUpdatedAt: "2026-03-16T12:30:00.000Z",
      activeSequence: "Validation-Clean-Phase1.xsq",
      sequencePathInput: "/shows/holiday/Validation-Clean-Phase1.xsq",
      sequenceCatalog: [
        {
          path: "/shows/holiday/Validation-Clean-Phase1.xsq",
          relativePath: "Validation-Clean-Phase1.xsq",
          name: "Validation-Clean-Phase1"
        }
      ],
      sequenceMediaFile: "Song.mp3",
      currentSequenceRevision: "rev-12",
      flags: { activeSequenceLoaded: true }
    }
  });

  assert.equal(dashboard.status, "active");
  assert.equal(dashboard.data.lifecycle.projectName, "HolidayRoad");
  assert.equal(dashboard.data.sequenceContext.options.length, 1);
  assert.equal(dashboard.data.sequenceContext.activeSequence, "Validation-Clean-Phase1.xsq");
});
