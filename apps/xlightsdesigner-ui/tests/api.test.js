import test from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultEndpoint,
  getOpenSequence,
  getMediaStatus,
  getRenderedSequenceSamples,
  openSequence,
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
        "http://127.0.0.1:49915/xlightsdesigner/api/sequence/open",
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

test("getRenderedSequenceSamples uses owned route and preserves sparse sample payload", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: String(options?.method || "GET"), body: String(options?.body || "") });
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
    assert.equal(calls[0].url, "http://127.0.0.1:49915/xlightsdesigner/api/sequence/render-samples");
    assert.equal(calls[0].method, "POST");
    assert.match(calls[0].body, /\"channelRanges\":\[/);
    assert.equal(body.data.sampleEncoding, "base64_packed_channel_ranges_v1");
    assert.equal(body.data.samples.length, 2);
    assert.equal(body.data.channelRanges[1].startChannel, 100);
  } finally {
    global.fetch = originalFetch;
  }
});
