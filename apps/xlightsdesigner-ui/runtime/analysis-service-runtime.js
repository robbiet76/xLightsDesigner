export function createAnalysisServiceRuntime(deps = {}) {
  const {
    state,
    defaultAnalysisServiceUrl = '',
    getDesktopAudioAnalysisBridge = () => null,
    getDesktopTrainingPackageBridge = () => null,
    dirnameRelPath = (value = '') => value,
    joinRelPath = (base = '', child = '') => `${base}/${child}`,
    isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    persist = () => {},
    render = () => {},
    setStatusWithDiagnostics = () => {}
  } = deps;

  let analysisServiceProbeInFlight = false;
  let trainingPackageAudioBundleCache = null;
  let trainingPackageAudioBundleCacheAt = 0;

  function normalizeAnalysisServiceBaseUrl(raw = '') {
    return String(raw || '').trim().replace(/\/+$/, '');
  }

  function ensureAnalysisServiceDefaults(targetState) {
    if (!targetState || typeof targetState !== 'object') return;
    if (!targetState.ui || typeof targetState.ui !== 'object') return;
    if (!normalizeAnalysisServiceBaseUrl(targetState.ui.analysisServiceUrlDraft)) {
      targetState.ui.analysisServiceUrlDraft = defaultAnalysisServiceUrl;
    }
  }

  function getAnalysisServiceHeaderBadgeText() {
    const baseUrl = normalizeAnalysisServiceBaseUrl(state.ui.analysisServiceUrlDraft);
    if (!baseUrl) return 'Analysis: URL missing';
    if (state.ui.analysisServiceChecking) return 'Analysis: Checking';
    return state.ui.analysisServiceReady ? 'Analysis: Ready' : 'Analysis: Unavailable';
  }

  async function loadAudioTrainingPackageBundle({ force = false } = {}) {
    const CACHE_TTL_MS = 60_000;
    if (!force && trainingPackageAudioBundleCache && (Date.now() - trainingPackageAudioBundleCacheAt) < CACHE_TTL_MS) {
      return trainingPackageAudioBundleCache;
    }
    const bridge = getDesktopTrainingPackageBridge();
    if (!bridge) {
      const out = { ok: false, error: 'Desktop training package bridge unavailable.' };
      trainingPackageAudioBundleCache = out;
      trainingPackageAudioBundleCacheAt = Date.now();
      return out;
    }
    try {
      const manifestRes = await bridge.readTrainingPackageAsset({ relativePath: 'manifest.json', asJson: true });
      if (!manifestRes?.ok) {
        const out = { ok: false, error: String(manifestRes?.error || 'Training package manifest not found.') };
        trainingPackageAudioBundleCache = out;
        trainingPackageAudioBundleCacheAt = Date.now();
        return out;
      }
      const pkg = manifestRes?.data && typeof manifestRes.data === 'object' ? manifestRes.data : {};
      const modules = Array.isArray(pkg?.modules) ? pkg.modules : [];
      const audioModuleRef = modules.find((m) => String(m?.id || '').trim() === 'audio_track_analysis');
      const modulePath = String(audioModuleRef?.path || '').trim();
      if (!modulePath) {
        const out = { ok: false, error: 'audio_track_analysis module path missing in training package.' };
        trainingPackageAudioBundleCache = out;
        trainingPackageAudioBundleCacheAt = Date.now();
        return out;
      }
      const moduleRes = await bridge.readTrainingPackageAsset({ relativePath: modulePath, asJson: true });
      if (!moduleRes?.ok) {
        const out = { ok: false, error: String(moduleRes?.error || 'Audio module manifest read failed.') };
        trainingPackageAudioBundleCache = out;
        trainingPackageAudioBundleCacheAt = Date.now();
        return out;
      }
      const moduleData = moduleRes?.data && typeof moduleRes.data === 'object' ? moduleRes.data : {};
      const moduleVersion = String(moduleData?.version || '').trim();
      const promptFiles = Array.isArray(moduleData?.assets?.prompts)
        ? moduleData.assets.prompts.map((p) => String(p || '').trim()).filter(Boolean)
        : [];
      const moduleDir = dirnameRelPath(modulePath);
      const promptTexts = [];
      for (const rel of promptFiles) {
        const absRel = joinRelPath(moduleDir, rel);
        const textRes = await bridge.readTrainingPackageAsset({ relativePath: absRel, asJson: false });
        if (!textRes?.ok) continue;
        const text = String(textRes?.text || '').trim();
        if (!text) continue;
        promptTexts.push({ path: absRel, text });
      }
      if (!promptTexts.length) {
        const out = { ok: false, error: 'No prompt assets available for audio_track_analysis module.' };
        trainingPackageAudioBundleCache = out;
        trainingPackageAudioBundleCacheAt = Date.now();
        return out;
      }
      const combinedPromptText = promptTexts.map((row) => `# Asset: ${row.path}\n${row.text}`).join('\n\n');
      const datasetFiles = Array.isArray(moduleData?.assets?.datasets)
        ? moduleData.assets.datasets.map((p) => String(p || '').trim()).filter(Boolean)
        : [];
      const corpusSongs = [];
      for (const rel of datasetFiles) {
        const datasetIndexPath = joinRelPath(moduleDir, rel);
        const datasetRes = await bridge.readTrainingPackageAsset({ relativePath: datasetIndexPath, asJson: true });
        if (!datasetRes?.ok || !datasetRes?.data || typeof datasetRes.data !== 'object') continue;
        const sources = Array.isArray(datasetRes.data.sources) ? datasetRes.data.sources : [];
        for (const src of sources) {
          if (String(src?.type || '').trim() !== 'stanza-corpus') continue;
          const srcPath = String(src?.path || '').trim();
          if (!srcPath) continue;
          const corpusPath = joinRelPath(moduleDir, srcPath);
          const corpusRes = await bridge.readTrainingPackageAsset({ relativePath: corpusPath, asJson: true });
          if (!corpusRes?.ok || !corpusRes?.data || typeof corpusRes.data !== 'object') continue;
          const songs = Array.isArray(corpusRes.data.songs) ? corpusRes.data.songs : [];
          for (const song of songs) {
            if (!song || typeof song !== 'object') continue;
            if (String(song?.status || '').trim() !== 'ok') continue;
            corpusSongs.push(song);
          }
        }
      }
      const out = {
        ok: true,
        packageId: String(pkg?.packageId || '').trim() || 'unknown-package',
        packageVersion: String(pkg?.version || '').trim() || 'unknown-version',
        moduleId: 'audio_track_analysis',
        moduleVersion: moduleVersion || 'unknown-version',
        promptPaths: promptTexts.map((p) => p.path),
        combinedPromptText,
        corpusSongs
      };
      trainingPackageAudioBundleCache = out;
      trainingPackageAudioBundleCacheAt = Date.now();
      return out;
    } catch (err) {
      const out = { ok: false, error: String(err?.message || err) };
      trainingPackageAudioBundleCache = out;
      trainingPackageAudioBundleCacheAt = Date.now();
      return out;
    }
  }

  async function probeAnalysisServiceHealth({ quiet = true, force = false } = {}) {
    const bridge = getDesktopAudioAnalysisBridge();
    const baseUrl = normalizeAnalysisServiceBaseUrl(state.ui.analysisServiceUrlDraft);
    const commitIfChanged = (mutate) => {
      const before = JSON.stringify({
        ready: Boolean(state.ui.analysisServiceReady),
        checking: Boolean(state.ui.analysisServiceChecking),
        error: String(state.ui.analysisServiceLastError || '')
      });
      mutate();
      const after = JSON.stringify({
        ready: Boolean(state.ui.analysisServiceReady),
        checking: Boolean(state.ui.analysisServiceChecking),
        error: String(state.ui.analysisServiceLastError || '')
      });
      if (before !== after) {
        persist();
        render();
      }
    };
    if (!bridge || typeof bridge.checkAudioAnalysisService !== 'function') {
      commitIfChanged(() => {
        state.ui.analysisServiceReady = false;
        state.ui.analysisServiceChecking = false;
        state.ui.analysisServiceLastError = 'Desktop analysis health bridge unavailable.';
        state.ui.analysisServiceLastCheckedAt = new Date().toISOString();
      });
      if (!quiet) setStatusWithDiagnostics('warning', state.ui.analysisServiceLastError);
      return false;
    }
    if (!baseUrl) {
      commitIfChanged(() => {
        state.ui.analysisServiceReady = false;
        state.ui.analysisServiceChecking = false;
        state.ui.analysisServiceLastError = 'Audio analysis service URL is required.';
        state.ui.analysisServiceLastCheckedAt = new Date().toISOString();
      });
      return false;
    }
    if (analysisServiceProbeInFlight && !force) return Boolean(state.ui.analysisServiceReady);
    analysisServiceProbeInFlight = true;
    if (!quiet) {
      commitIfChanged(() => {
        state.ui.analysisServiceChecking = true;
      });
    }
    try {
      const res = await bridge.checkAudioAnalysisService({
        baseUrl,
        apiKey: String(state.ui.analysisServiceApiKeyDraft || '').trim() || undefined,
        authBearer: String(state.ui.analysisServiceAuthBearerDraft || '').trim() || undefined,
        timeoutMs: 5000
      });
      const ok = Boolean(res?.ok && res?.reachable);
      const detailBits = [];
      if (res && typeof res === 'object') {
        if (res.selfHealAttempted === true) detailBits.push('self-heal attempted');
        const dir = String(res.analysisServiceDir || '').trim();
        if (dir) detailBits.push(`dir=${dir}`);
      }
      const detail = detailBits.length ? ` (${detailBits.join(', ')})` : '';
      commitIfChanged(() => {
        state.ui.analysisServiceReady = ok;
        state.ui.analysisServiceLastError = ok
          ? ''
          : `${String(res?.error || 'Analysis service unavailable.')}${detail}`;
        state.ui.analysisServiceLastCheckedAt = new Date().toISOString();
      });
      if (!ok && !quiet) {
        setStatusWithDiagnostics('warning', `Audio analysis service unavailable: ${state.ui.analysisServiceLastError}`);
      }
      return ok;
    } catch (err) {
      commitIfChanged(() => {
        state.ui.analysisServiceReady = false;
        state.ui.analysisServiceLastError = String(err?.message || err);
        state.ui.analysisServiceLastCheckedAt = new Date().toISOString();
      });
      if (!quiet) {
        setStatusWithDiagnostics('warning', `Audio analysis service unavailable: ${state.ui.analysisServiceLastError}`);
      }
      return false;
    } finally {
      analysisServiceProbeInFlight = false;
      if (!quiet) {
        commitIfChanged(() => {
          state.ui.analysisServiceChecking = false;
        });
      }
    }
  }

  return {
    normalizeAnalysisServiceBaseUrl,
    ensureAnalysisServiceDefaults,
    getAnalysisServiceHeaderBadgeText,
    loadAudioTrainingPackageBundle,
    probeAnalysisServiceHealth
  };
}
