import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runLayerCompositionOwnedPass } from "./run-layer-composition-owned-pass.mjs";

function tempSequence() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xld-owned-pass-"));
  const sequence = path.join(dir, "test.xsq");
  const fseq = path.join(dir, "test.fseq");
  fs.writeFileSync(sequence, "<xsequence />");
  fs.writeFileSync(fseq, "fseq");
  return { dir, sequence, fseq };
}

function response(json, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(json)
  };
}

function makeRequestRecorder({ modalBlocked = false } = {}) {
  const calls = [];
  const request = async (url, options = {}) => {
    const route = new URL(url).pathname.replace("/xlightsdesigner/api", "");
    calls.push({ route, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null });
    if (route === "/health") {
      return response({
        ok: true,
        data: modalBlocked
          ? {
              state: "ready",
              listenerReachable: true,
              appReady: true,
              startupSettled: true,
              modalState: { observed: true, blocked: true, windows: [{ isModal: true, title: "Error" }] }
            }
          : {
              state: "ready",
              listenerReachable: true,
              appReady: true,
              startupSettled: true,
              modalState: { observed: false, blocked: false }
            }
      });
    }
    if (route === "/media/current") {
      return response({ ok: true, data: { sequencePath: calls.sequencePath || "", showDirectory: "" } });
    }
    return response({ ok: true, data: { rendered: route === "/sequence/render-current" } });
  };
  return { calls, request };
}

const passExecution = {
  artifactType: "layer_composition_pass_execution_v1",
  runId: "run-1",
  experimentId: "experiment-1",
  passId: "pass-1",
  learningId: "learning-1",
  ownedBatchPayload: {
    track: "XD: Layer Composition Training",
    replaceExistingMarks: true,
    marks: [{ label: "pass-1", startMs: 1000, endMs: 5000 }],
    effects: [{ element: "ArchGroup", layer: 0, effectName: "Bars", startMs: 1000, endMs: 5000 }]
  },
  directCommands: [
    { cmd: "sequencer.setDisplayElementOrder", params: { orderedIds: ["ArchGroup", "ArchSingle"] } }
  ],
  unsupportedLayerSettings: []
};

test("owned pass executor applies display order before batch plan and render", async () => {
  const { sequence, fseq } = tempSequence();
  const { calls, request } = makeRequestRecorder();
  const result = await runLayerCompositionOwnedPass({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    sequencePath: sequence,
    passExecution,
    deps: { request, pollMs: 1, timeoutMs: 1000 }
  });

  assert.equal(result.ok, true);
  assert.equal(result.fseqPath, fseq);
  const routes = calls.map((row) => row.route).filter((route) => route !== "/health" && route !== "/media/current");
  assert.deepEqual(routes, [
    "/sequence/close",
    "/sequence/open",
    "/elements/display-order",
    "/sequencing/apply-batch-plan",
    "/sequence/save",
    "/sequence/render-current",
    "/sequence/close"
  ]);
  const displayOrderCall = calls.find((row) => row.route === "/elements/display-order");
  assert.deepEqual(JSON.parse(displayOrderCall.body.orderedIds), ["ArchGroup", "ArchSingle"]);
});

test("owned pass executor fails on blocking modal", async () => {
  const { sequence } = tempSequence();
  const { request } = makeRequestRecorder({ modalBlocked: true });

  await assert.rejects(
    () => runLayerCompositionOwnedPass({
      endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
      sequencePath: sequence,
      passExecution,
      deps: { request, pollMs: 1, timeoutMs: 1000 }
    }),
    /blocked by a modal: Error/
  );
});

test("owned pass executor skips batch apply for empty control passes", async () => {
  const { sequence, fseq } = tempSequence();
  const { calls, request } = makeRequestRecorder();
  const result = await runLayerCompositionOwnedPass({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    sequencePath: sequence,
    passExecution: {
      ...passExecution,
      passId: "empty_baseline",
      ownedBatchPayload: {
        ...passExecution.ownedBatchPayload,
        effects: []
      },
      directCommands: []
    },
    deps: { request, pollMs: 1, timeoutMs: 1000 }
  });

  assert.equal(result.ok, true);
  assert.equal(result.fseqPath, fseq);
  assert.equal(calls.some((row) => row.route === "/sequencing/apply-batch-plan"), false);
  assert.equal(result.steps.some((row) => row.step === "apply_batch_plan" && row.skipped), true);
});

test("owned pass executor skips display-order no-op commands with fewer than two ids", async () => {
  const { sequence, fseq } = tempSequence();
  const { calls, request } = makeRequestRecorder();
  const result = await runLayerCompositionOwnedPass({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    sequencePath: sequence,
    passExecution: {
      ...passExecution,
      directCommands: [
        { cmd: "sequencer.setDisplayElementOrder", params: { orderedIds: ["ArchTripleLayer"] } }
      ]
    },
    deps: { request, pollMs: 1, timeoutMs: 1000 }
  });

  assert.equal(result.ok, true);
  assert.equal(result.fseqPath, fseq);
  assert.equal(calls.some((row) => row.route === "/elements/display-order"), false);
});

test("owned pass executor deduplicates display-order ids before transport", async () => {
  const { sequence, fseq } = tempSequence();
  const { calls, request } = makeRequestRecorder();
  const result = await runLayerCompositionOwnedPass({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    sequencePath: sequence,
    passExecution: {
      ...passExecution,
      directCommands: [
        { cmd: "sequencer.setDisplayElementOrder", params: { orderedIds: ["Arches", "Arches", "Spinner"] } }
      ]
    },
    deps: { request, pollMs: 1, timeoutMs: 1000 }
  });

  assert.equal(result.ok, true);
  assert.equal(result.fseqPath, fseq);
  const displayOrderCall = calls.find((row) => row.route === "/elements/display-order");
  assert.deepEqual(JSON.parse(displayOrderCall.body.orderedIds), ["Arches", "Spinner"]);
});
