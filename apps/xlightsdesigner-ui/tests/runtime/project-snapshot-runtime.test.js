import test from "node:test";
import assert from "node:assert/strict";

import { createProjectSnapshotRuntime } from "../../runtime/project-snapshot-runtime.js";

function createStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    }
  };
}

test("project snapshot runtime reads and writes keyed snapshots", () => {
  const state = { projectName: "Show A", showFolder: "/show" };
  const storage = createStorage();
  let queued = 0;
  const runtime = createProjectSnapshotRuntime({
    state,
    projectsKey: "projects",
    localStorageRef: storage,
    queueDesktopStatePersist: () => { queued += 1; },
    extractProjectSnapshot: () => ({ saved: true })
  });

  runtime.saveCurrentProjectSnapshot();

  const store = JSON.parse(storage.getItem("projects"));
  assert.deepEqual(store["Show A::/show"], { saved: true });
  assert.equal(queued, 1);
  assert.deepEqual(runtime.parseProjectKey("Show A::/show"), { projectName: "Show A", showFolder: "/show" });
});

test("project snapshot runtime deletes and hydrates snapshots", () => {
  const applied = [];
  const storage = createStorage({
    projects: JSON.stringify({
      "Show A::/show": { route: "sequence" },
      "Other::/else": { route: "audio" }
    })
  });
  const runtime = createProjectSnapshotRuntime({
    state: { projectName: "Show A", showFolder: "/show" },
    projectsKey: "projects",
    localStorageRef: storage,
    applyProjectSnapshot: (snapshot) => applied.push(snapshot)
  });

  assert.equal(runtime.tryLoadProjectSnapshot("Show A", "/show"), true);
  assert.deepEqual(applied, [{ route: "sequence" }]);

  runtime.deleteProjectSnapshot("Show A", "/show");
  const store = JSON.parse(storage.getItem("projects"));
  assert.equal("Show A::/show" in store, false);
  assert.equal("Other::/else" in store, true);
});
