import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

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
    getAppAudioAnalysisBridge: () => ({
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

test('analysis service runtime loads compact stanza feature corpus without lyric text', async () => {
  const state = { ui: {} };
  const assets = {
    'manifest.json': {
      packageId: 'pkg',
      version: '1.0',
      modules: [
        { id: 'audio_track_analysis', version: '0.1.0', path: 'modules/audio_track_analysis/module.manifest.json' }
      ]
    },
    'modules/audio_track_analysis/module.manifest.json': {
      version: '0.1.0',
      assets: {
        prompts: ['prompts/song_structure_system.md'],
        datasets: ['datasets/index.json']
      }
    },
    'modules/audio_track_analysis/prompts/song_structure_system.md': 'Use structure features.',
    'modules/audio_track_analysis/datasets/index.json': {
      sources: [
        {
          type: 'stanza-feature-corpus',
          path: 'datasets/structure_features_holiday_keywords.json'
        }
      ]
    },
    'modules/audio_track_analysis/datasets/structure_features_holiday_keywords.json': {
      songs: [
        {
          title: 'Feature Song',
          artist: 'Artist',
          status: 'ok',
          lyricsSource: 'synced',
          stanzas: [
            { index: 0, draftLabel: 'Verse', lineCount: 4, titleLineRatio: 0, globallyRepeatedLineRatio: 0 },
            { index: 1, draftLabel: 'Chorus', lineCount: 6, titleLineRatio: 0.5, globallyRepeatedLineRatio: 0.8 }
          ]
        }
      ]
    }
  };
  const runtime = createAnalysisServiceRuntime({
    state,
    dirnameRelPath: (value = '') => path.posix.dirname(value),
    joinRelPath: (base = '', child = '') => path.posix.join(base, child),
    getAppTrainingPackageBridge: () => ({
      readTrainingPackageAsset: async ({ relativePath, asJson }) => {
        const value = assets[relativePath];
        if (value == null) return { ok: false, error: 'missing' };
        return asJson ? { ok: true, data: value } : { ok: true, text: String(value) };
      }
    })
  });

  const bundle = await runtime.loadAudioTrainingPackageBundle({ force: true });
  assert.equal(bundle.ok, true);
  assert.equal(bundle.corpusSongs.length, 1);
  assert.equal(bundle.corpusSongs[0].stanzas[0].lineCount, 4);
  assert.equal('text' in bundle.corpusSongs[0].stanzas[0], false);
  assert.equal('lines' in bundle.corpusSongs[0].stanzas[0], false);
});
