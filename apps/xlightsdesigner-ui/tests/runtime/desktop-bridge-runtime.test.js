import test from "node:test";
import assert from "node:assert/strict";

import {
  getDesktopBridge,
  getDesktopStateBridge,
  getDesktopBridgeHealth,
  getDesktopFileDialogBridge,
  normalizeDialogPathSelection
} from "../../runtime/desktop-bridge-runtime.js";

test("desktop bridge runtime resolves the active desktop bridge", () => {
  const prevWindow = globalThis.window;
  globalThis.window = {
    xlightsDesignerDesktop: {
      readAppState() {},
      writeAppState() {},
      openFileDialog() {}
    }
  };
  try {
    assert.ok(getDesktopBridge());
    assert.ok(getDesktopStateBridge());
    assert.deepEqual(getDesktopBridgeHealth(), {
      runtimeReady: true,
      desktopFileDialogReady: true,
      desktopBridgeApiCount: 3
    });
  } finally {
    globalThis.window = prevWindow;
  }
});

test("desktop bridge runtime normalizes dialog selections", () => {
  assert.equal(normalizeDialogPathSelection("/tmp/file.xsq"), "/tmp/file.xsq");
  assert.equal(normalizeDialogPathSelection(["", "/tmp/file2.xsq"]), "/tmp/file2.xsq");
  assert.equal(normalizeDialogPathSelection({ absolutePath: "/tmp/file3.xsq" }), "/tmp/file3.xsq");
  assert.equal(normalizeDialogPathSelection(null), "");
});

test("desktop bridge runtime exposes file dialog bridge when available", async () => {
  const prevWindow = globalThis.window;
  globalThis.window = {
    xlightsDesignerDesktop: {
      openFileDialog: async (opts) => ({ path: `/picked/${opts.title}` })
    }
  };
  try {
    const dialog = getDesktopFileDialogBridge();
    assert.equal(typeof dialog, "function");
    const res = await dialog({ title: "Sequence" });
    assert.deepEqual(res, { path: "/picked/Sequence" });
  } finally {
    globalThis.window = prevWindow;
  }
});
