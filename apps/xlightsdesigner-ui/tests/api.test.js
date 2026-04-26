import test from "node:test";
import assert from "node:assert/strict";

import {
  closeSequence,
  getDefaultEndpoint,
  getOpenSequence,
  getMediaStatus,
  getEffectDefinitions,
  pingCapabilities,
  renderCurrentSequence,
  getRenderedSequenceSamples,
  openSequence,
  getLayoutScene,
  getTimingMarks,
  listEffects
} from "../api.js";

function jsonResponse(payload) {
  return {
    text: async () => JSON.stringify(payload)
  };
}

test("default endpoint prefers owned xlightsdesigner api", () => {
  assert.equal(getDefaultEndpoint(), "http://127.0.0.1:49915/xlightsdesigner/api");
});

test("getOpenSequence uses owned route and preserves legacy-shaped data", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    calls.push(String(url));
    return jsonResponse({
      ok: true,
      statusCode: 200,
      data: {
        isOpen: true,
        sequence: {
          path: "/show/Test.xsq",
          revisionToken: "rev-1"
        }
      }
    });
  };
  try {
    const body = await getOpenSequence("http://127.0.0.1:49915/xlightsdesigner/api");
    assert.equal(calls[0], "http://127.0.0.1:49915/xlightsdesigner/api/sequence/open");
    assert.equal(body.res, 200);
    assert.equal(body.data.isOpen, true);
    assert.equal(body.data.sequence.path, "/show/Test.xsq");
  } finally {
    global.fetch = originalFetch;
  }
});

test("getMediaStatus uses owned route and returns media status shape", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => jsonResponse({
    ok: true,
    statusCode: 200,
    data: {
      sequenceOpen: true,
      sequencePath: "/show/Test.xsq",
      mediaFile: "/show/Audio/Test.mp3",
      showDirectory: "/show"
    }
  });
  try {
    const body = await getMediaStatus("http://127.0.0.1:49915/xlightsdesigner/api");
    assert.equal(body.data.sequenceOpen, true);
    assert.equal(body.data.sequencePath, "/show/Test.xsq");
    assert.equal(body.data.mediaFile, "/show/Audio/Test.mp3");
    assert.equal(body.data.showDirectory, "/show");
  } finally {
    global.fetch = originalFetch;
  }
});

test("openSequence waits for owned queued job completion", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: String(options?.method || "GET") });
    if (String(url).endsWith("/health")) {
      return jsonResponse({
        ok: true,
        statusCode: 200,
        data: { listenerReachable: true, appReady: true, startupSettled: true, state: "ready" }
      });
    }
    if (String(url).endsWith("/sequence/open")) {
      return jsonResponse({
        ok: true,
        statusCode: 202,
        data: { accepted: true, jobId: "job-123", state: "queued" }
      });
    }
    if (String(url).includes("/jobs/get?jobId=job-123")) {
      return jsonResponse({
        ok: true,
        statusCode: 200,
        data: {
          jobId: "job-123",
          state: "completed",
          result: {
            ok: true,
            statusCode: 200,
            data: {
              opened: true,
              sequence: {
                path: "/show/Test.xsq",
                revisionToken: "rev-9"
              }
            }
          }
        }
      });
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    const body = await openSequence("http://127.0.0.1:49915/xlightsdesigner/api", "/show/Test.xsq", true, false);
    assert.equal(body.res, 200);
    assert.equal(body.data.opened, true);
    assert.equal(body.data.sequence.path, "/show/Test.xsq");
    assert.deepEqual(
      calls.map((row) => row.url),
      [
        "http://127.0.0.1:49915/xlightsdesigner/api/health",
        "http://127.0.0.1:49915/xlightsdesigner/api/sequence/open",
        "http://127.0.0.1:49915/xlightsdesigner/api/health",
        "http://127.0.0.1:49915/xlightsdesigner/api/jobs/get?jobId=job-123"
      ]
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("getTimingMarks uses owned query parameter contract", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    calls.push(String(url));
    return jsonResponse({
      ok: true,
      statusCode: 200,
      data: {
        track: "XD: Song Structure",
        marks: [{ startMs: 0, endMs: 1000, label: "Intro", layerNumber: 0 }]
      }
    });
  };
  try {
    const body = await getTimingMarks("http://127.0.0.1:49915/xlightsdesigner/api", "XD: Song Structure");
    assert.match(calls[0], /\/timing\/marks\?track=XD%3A\+Song\+Structure$/);
    assert.equal(body.data.track, "XD: Song Structure");
    assert.equal(body.data.marks.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("listEffects maps owned effects window rows to legacy effect list shape", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => jsonResponse({
    ok: true,
    statusCode: 200,
    data: {
      element: "MegaTree",
      startMs: 0,
      endMs: 1000,
      effects: [
        { layerNumber: 1, effectName: "On", startMs: 0, endMs: 1000 },
        { layerNumber: 2, effectName: "Bars", startMs: 0, endMs: 1000 }
      ]
    }
  });
  try {
    const body = await listEffects("http://127.0.0.1:49915/xlightsdesigner/api", {
      modelName: "MegaTree",
      layerIndex: 2,
      startMs: 0,
      endMs: 1000
    });
    assert.deepEqual(body.data.effects, [
      { layerNumber: 2, effectName: "Bars", startMs: 0, endMs: 1000, layerIndex: 2 }
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("getEffectDefinitions returns trained definitions for owned endpoints", async () => {
  const body = await getEffectDefinitions("http://127.0.0.1:49915/xlightsdesigner/api");
  assert.equal(body.ok, true);
  assert.equal(body.command, "effects.listDefinitions");
  assert.equal(body.data.source, "stage1_trained_effect_bundle");
  assert.ok(body.data.effects.some((row) => row.effectName === "On"));
  assert.ok(body.data.effects.some((row) => row.effectName === "Color Wash"));
});

test("pingCapabilities advertises owned sequencing edit and layer commands", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => jsonResponse({
    ok: true,
    statusCode: 200,
    data: { listenerReachable: true, appReady: true, startupSettled: true, state: "ready" }
  });
  try {
    const body = await pingCapabilities("http://127.0.0.1:49915/xlightsdesigner/api");
    const commands = body.data.commands;
    assert.equal(commands.includes("effects.clone"), true);
    assert.equal(commands.includes("effects.update"), true);
    assert.equal(commands.includes("effects.delete"), true);
    assert.equal(commands.includes("effects.deleteLayer"), true);
    assert.equal(commands.includes("effects.reorderLayer"), true);
    assert.equal(commands.includes("effects.compactLayers"), true);
    assert.equal(commands.includes("sequencer.setDisplayElementOrder"), true);
  } finally {
    global.fetch = originalFetch;
  }
});

test("getRenderedSequenceSamples uses owned route and preserves sparse sample payload", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: String(options?.method || "GET"), body: String(options?.body || "") });
    if (String(url).endsWith("/health")) {
      return jsonResponse({
        ok: true,
        statusCode: 200,
        data: { listenerReachable: true, appReady: true, startupSettled: true, state: "ready" }
      });
    }
    return jsonResponse({
      ok: true,
      statusCode: 200,
      data: {
        sequencePath: "/show/Test.xsq",
        revisionToken: "rev-2",
        fseqPath: "/show/Test.fseq",
        frameMs: 50,
        totalFrames: 100,
        totalChannels: 1200,
        sampledFrameCount: 2,
        sampledChannelCount: 6,
        sampleEncoding: "base64_packed_channel_ranges_v1",
        channelRanges: [{ startChannel: 10, channelCount: 3 }, { startChannel: 100, channelCount: 3 }],
        samples: [
          { frameIndex: 0, frameTimeMs: 0, dataBase64: "AAAA" },
          { frameIndex: 5, frameTimeMs: 250, dataBase64: "BBBB" }
        ]
      }
    });
  };
  try {
    const body = await getRenderedSequenceSamples("http://127.0.0.1:49915/xlightsdesigner/api", {
      startMs: 0,
      endMs: 250,
      maxFrames: 2,
      channelRanges: [{ startChannel: 10, channelCount: 3 }, { startChannel: 100, channelCount: 3 }]
    });
    assert.equal(calls[0].url, "http://127.0.0.1:49915/xlightsdesigner/api/health");
    assert.equal(calls[1].url, "http://127.0.0.1:49915/xlightsdesigner/api/sequence/render-samples");
    assert.equal(calls[1].method, "POST");
    assert.match(calls[1].body, /\"channelRanges\":\[/);
    assert.equal(body.data.sampleEncoding, "base64_packed_channel_ranges_v1");
    assert.equal(body.data.samples.length, 2);
    assert.equal(body.data.channelRanges[1].startChannel, 100);
  } finally {
    global.fetch = originalFetch;
  }
});

test("getLayoutScene uses owned route and preserves scene payload", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    calls.push(String(url));
    return jsonResponse({
      ok: true,
      statusCode: 200,
      data: {
        models: [
          {
            name: "Snowman",
            type: "Single Line",
            layoutGroup: "Yard",
            transform: {
              position: { x: 1, y: 2, z: 3 },
              rotationDeg: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 }
            },
            dimensions: { width: 4, height: 5, depth: 1 }
          }
        ],
        cameras: [],
        views: [],
        displayElements: []
      }
    });
  };
  try {
    const body = await getLayoutScene("http://127.0.0.1:49915/xlightsdesigner/api", { includeCameras: true });
    assert.match(calls[0], /\/layout\/scene\?includeCameras=true$/);
    assert.equal(body.data.models.length, 1);
    assert.equal(body.data.models[0].name, "Snowman");
    assert.equal(body.data.models[0].transform.position.z, 3);
  } finally {
    global.fetch = originalFetch;
  }
});

test("renderCurrentSequence waits for owned queued job completion", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: String(options?.method || "GET") });
    if (String(url).endsWith("/health")) {
      return jsonResponse({
        ok: true,
        statusCode: 200,
        data: { listenerReachable: true, appReady: true, startupSettled: true, state: "ready" }
      });
    }
    if (String(url).endsWith("/sequence/render-current")) {
      return jsonResponse({
        ok: true,
        statusCode: 202,
        data: { accepted: true, jobId: "job-render-1", state: "queued" }
      });
    }
    if (String(url).includes("/jobs/get?jobId=job-render-1")) {
      return jsonResponse({
        ok: true,
        statusCode: 200,
        data: {
          jobId: "job-render-1",
          state: "completed",
          result: {
            ok: true,
            statusCode: 200,
            data: { rendered: true, revisionToken: "rev-4", fseqPath: "/show/Test.fseq" }
          }
        }
      });
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    const body = await renderCurrentSequence("http://127.0.0.1:49915/xlightsdesigner/api");
    assert.equal(body.res, 200);
    assert.equal(body.data.rendered, true);
    assert.equal(body.data.fseqPath, "/show/Test.fseq");
    assert.deepEqual(
      calls.map((row) => row.url),
      [
        "http://127.0.0.1:49915/xlightsdesigner/api/health",
        "http://127.0.0.1:49915/xlightsdesigner/api/sequence/render-current",
        "http://127.0.0.1:49915/xlightsdesigner/api/health",
        "http://127.0.0.1:49915/xlightsdesigner/api/jobs/get?jobId=job-render-1"
      ]
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("closeSequence uses owned close route and waits for queued completion", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: String(options?.method || "GET"), body: String(options?.body || "") });
    if (String(url).endsWith("/health")) {
      return jsonResponse({
        ok: true,
        statusCode: 200,
        data: { listenerReachable: true, appReady: true, startupSettled: true, state: "ready" }
      });
    }
    if (String(url).endsWith("/sequence/close")) {
      return jsonResponse({
        ok: true,
        statusCode: 202,
        data: { accepted: true, jobId: "job-close-1", state: "queued" }
      });
    }
    if (String(url).includes("/jobs/get?jobId=job-close-1")) {
      return jsonResponse({
        ok: true,
        statusCode: 200,
        data: {
          jobId: "job-close-1",
          state: "completed",
          result: {
            ok: true,
            statusCode: 200,
            data: { closed: true }
          }
        }
      });
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    const body = await closeSequence("http://127.0.0.1:49915/xlightsdesigner/api", true, true);
    assert.equal(body.res, 200);
    assert.equal(body.data.closed, true);
    assert.deepEqual(
      calls.map((row) => row.url),
      [
        "http://127.0.0.1:49915/xlightsdesigner/api/health",
        "http://127.0.0.1:49915/xlightsdesigner/api/sequence/close",
        "http://127.0.0.1:49915/xlightsdesigner/api/health",
        "http://127.0.0.1:49915/xlightsdesigner/api/jobs/get?jobId=job-close-1"
      ]
    );
    assert.match(calls[1].body, /"force":true/);
    assert.match(calls[1].body, /"quiet":true/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("owned queued job polling fails closed when a modal appears", async () => {
  const originalFetch = global.fetch;
  let healthCalls = 0;
  global.fetch = async (url) => {
    if (String(url).endsWith("/health")) {
      healthCalls += 1;
      return jsonResponse({
        ok: true,
        statusCode: 200,
        data: healthCalls === 1
          ? { listenerReachable: true, appReady: true, startupSettled: true, state: "ready" }
          : {
              listenerReachable: true,
              appReady: true,
              startupSettled: true,
              state: "ready",
              modalState: {
                observed: true,
                blocked: true,
                modalCount: 1,
                windows: [{ title: "Save changes?" }]
              }
            }
      });
    }
    if (String(url).endsWith("/sequence/render-current")) {
      return jsonResponse({
        ok: true,
        statusCode: 202,
        data: { accepted: true, jobId: "job-modal-1", state: "queued" }
      });
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    await assert.rejects(
      () => renderCurrentSequence("http://127.0.0.1:49915/xlightsdesigner/api"),
      /blocked by xLights modal.*Save changes\?/i
    );
  } finally {
    global.fetch = originalFetch;
  }
});
