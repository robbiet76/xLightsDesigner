import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAudioAnalysisProvider,
  buildAudioAnalysisServiceRequest,
  summarizeProviderSelection
} from "../../../agent/audio-analyst/audio-provider-adapters.js";

test("normalizeAudioAnalysisProvider constrains provider ids", () => {
  assert.equal(normalizeAudioAnalysisProvider("beatnet"), "librosa");
  assert.equal(normalizeAudioAnalysisProvider("LIBROSA"), "librosa");
  assert.equal(normalizeAudioAnalysisProvider("unknown"), "librosa");
});

test("buildAudioAnalysisServiceRequest normalizes fields for service bridge", () => {
  const request = buildAudioAnalysisServiceRequest({
    filePath: " /tmp/Song.mp3 ",
    baseUrl: "http://127.0.0.1:5055/",
    provider: "bad-provider",
    analysisProfileMode: " FAST ",
    apiKey: " key ",
    authBearer: ""
  });

  assert.equal(request.filePath, "/tmp/Song.mp3");
  assert.equal(request.baseUrl, "http://127.0.0.1:5055");
  assert.equal(request.provider, "librosa");
  assert.equal(request.analysisProfileMode, "fast");
  assert.equal(request.apiKey, "key");
  assert.equal(request.authBearer, undefined);
});

test("summarizeProviderSelection emits deterministic diagnostics", () => {
  const lines = summarizeProviderSelection({
    engine: "beatnet",
    autoSelection: {
      selectedProvider: "beatnet",
      selectedScore: 0.9321
    }
  });

  assert.deepEqual(lines, [
    "Analysis engine selected: beatnet",
    "Auto provider selection: beatnet (score 0.932)."
  ]);
});
