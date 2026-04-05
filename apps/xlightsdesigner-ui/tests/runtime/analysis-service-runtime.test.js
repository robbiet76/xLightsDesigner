import test from 'node:test';
import assert from 'node:assert/strict';

import { createAnalysisServiceRuntime } from '../../runtime/analysis-service-runtime.js';

test('analysis service runtime reports badge state', () => {
  const state = { ui: { analysisServiceUrlDraft: 'http://127.0.0.1:5055', analysisServiceChecking: false, analysisServiceReady: true } };
  const runtime = createAnalysisServiceRuntime({ state, defaultAnalysisServiceUrl: 'http://127.0.0.1:5055' });
  assert.equal(runtime.getAnalysisServiceHeaderBadgeText(), 'Analysis: Ready');
  state.ui.analysisServiceChecking = true;
  assert.equal(runtime.getAnalysisServiceHeaderBadgeText(), 'Analysis: Checking');
  state.ui.analysisServiceChecking = false;
  state.ui.analysisServiceUrlDraft = '';
  assert.equal(runtime.getAnalysisServiceHeaderBadgeText(), 'Analysis: URL missing');
});

test('analysis service runtime probes bridge health', async () => {
  const state = { ui: { analysisServiceUrlDraft: 'http://127.0.0.1:5055', analysisServiceApiKeyDraft: '', analysisServiceAuthBearerDraft: '' } };
  let persisted = 0;
  let rendered = 0;
  const runtime = createAnalysisServiceRuntime({
    state,
    getDesktopAudioAnalysisBridge: () => ({
      checkAudioAnalysisService: async () => ({ ok: true, reachable: true })
    }),
    persist: () => { persisted += 1; },
    render: () => { rendered += 1; }
  });
  const ok = await runtime.probeAnalysisServiceHealth({ quiet: false, force: true });
  assert.equal(ok, true);
  assert.equal(state.ui.analysisServiceReady, true);
  assert.ok(persisted >= 1);
  assert.ok(rendered >= 1);
});
