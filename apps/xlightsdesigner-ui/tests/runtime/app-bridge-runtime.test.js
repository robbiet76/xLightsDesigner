import test from "node:test";
import assert from "node:assert/strict";

import {
  getAppBridge,
  getAppStateBridge,
  getAppBridgeHealth,
  getAppFileDialogBridge,
  normalizeDialogPathSelection
} from "../../runtime/app-bridge-runtime.js";

test("app bridge runtime resolves the active app bridge", () => {
  const prevWindow = globalThis.window;
  globalThis.window = {
    xlightsDesignerApp: {
      readAppState() {},
      writeAppState() {},
      openFileDialog() {}
    }
  };
  try {
    assert.ok(getAppBridge());
    assert.ok(getAppStateBridge());
    assert.deepEqual(getAppBridgeHealth(), {
      runtimeReady: true,
      appFileDialogReady: true,
      appBridgeApiCount: 3
    });
  } finally {
    globalThis.window = prevWindow;
  }
});

test("app bridge runtime normalizes dialog selections", () => {
  assert.equal(normalizeDialogPathSelection("/tmp/file.xsq"), "/tmp/file.xsq");
  assert.equal(normalizeDialogPathSelection(["", "/tmp/file2.xsq"]), "/tmp/file2.xsq");
  assert.equal(normalizeDialogPathSelection({ absolutePath: "/tmp/file3.xsq" }), "/tmp/file3.xsq");
  assert.equal(normalizeDialogPathSelection(null), "");
});

test("app bridge runtime exposes file dialog bridge when available", async () => {
  const prevWindow = globalThis.window;
  globalThis.window = {
    xlightsDesignerApp: {
      openFileDialog: async (opts) => ({ path: `/picked/${opts.title}` })
    }
  };
  try {
    const dialog = getAppFileDialogBridge();
    assert.equal(typeof dialog, "function");
    const res = await dialog({ title: "Sequence" });
    assert.deepEqual(res, { path: "/picked/Sequence" });
  } finally {
    globalThis.window = prevWindow;
  }
});
