export function emptyAgentRuntimeState() {
  return {
    loaded: false,
    error: '',
    packageId: '',
    packageVersion: '',
    registryVersion: '',
    registryValid: false,
    registryErrors: [],
    lastLoadedAt: '',
    activeRole: '',
    roles: [],
    profilesById: {},
    handoffs: {
      analysis_handoff_v1: null,
      intent_handoff_v1: null,
      plan_handoff_v1: null
    }
  };
}

export function createAgentSupportRuntime(deps = {}) {
  const {
    state,
    agentRuntime,
    getDesktopTrainingPackageBridge = () => null,
    getDesktopAgentConversationBridge = () => null,
    getDesktopAgentConfigBridge = () => null,
    validateTrainingAgentRegistry,
    isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    refreshAgentRuntimeHealth = () => {},
    pushDiagnostic = () => {},
    setStatus = () => {},
    setStatusWithDiagnostics = () => {},
    render = () => {},
    persist = () => {},
    confirm = () => false
  } = deps;

  let trainingPackageAgentBundleCache = null;
  let trainingPackageAgentBundleCacheAt = 0;

  async function loadAgentRuntimeBundle({ force = false } = {}) {
    const CACHE_TTL_MS = 60_000;
    if (!force && trainingPackageAgentBundleCache && (Date.now() - trainingPackageAgentBundleCacheAt) < CACHE_TTL_MS) {
      return trainingPackageAgentBundleCache;
    }
    const bridge = getDesktopTrainingPackageBridge();
    if (!bridge) {
      const out = { ok: false, error: 'Desktop training package bridge unavailable.' };
      trainingPackageAgentBundleCache = out;
      trainingPackageAgentBundleCacheAt = Date.now();
      return out;
    }
    try {
      const manifestRes = await bridge.readTrainingPackageAsset({ relativePath: 'manifest.json', asJson: true });
      if (!manifestRes?.ok || !isPlainObject(manifestRes.data)) {
        const out = { ok: false, error: String(manifestRes?.error || 'Training package manifest not found.') };
        trainingPackageAgentBundleCache = out;
        trainingPackageAgentBundleCacheAt = Date.now();
        return out;
      }
      const manifest = manifestRes.data;
      const registryRes = await bridge.readTrainingPackageAsset({ relativePath: 'agents/registry.json', asJson: true });
      if (!registryRes?.ok || !isPlainObject(registryRes.data)) {
        const out = { ok: false, error: String(registryRes?.error || 'Agent registry not found.') };
        trainingPackageAgentBundleCache = out;
        trainingPackageAgentBundleCacheAt = Date.now();
        return out;
      }
      const registry = registryRes.data;
      const refs = Array.isArray(registry?.agents) ? registry.agents : [];
      const profiles = [];
      for (const ref of refs) {
        const id = String(ref?.id || '').trim();
        const path = String(ref?.path || '').trim();
        if (!id || !path) {
          const out = { ok: false, error: 'Agent registry contains an entry with missing id/path.' };
          trainingPackageAgentBundleCache = out;
          trainingPackageAgentBundleCacheAt = Date.now();
          return out;
        }
        const profileRes = await bridge.readTrainingPackageAsset({ relativePath: path, asJson: true });
        if (!profileRes?.ok || !isPlainObject(profileRes.data)) {
          const out = { ok: false, error: `Agent profile load failed for ${id} (${path}).` };
          trainingPackageAgentBundleCache = out;
          trainingPackageAgentBundleCacheAt = Date.now();
          return out;
        }
        profiles.push({
          id,
          status: String(ref?.status || '').trim() || 'unknown',
          path,
          profile: profileRes.data
        });
      }
      const parity = validateTrainingAgentRegistry({ registry, profiles });
      if (!parity.ok) {
        const out = {
          ok: false,
          error: `Agent registry validation failed: ${parity.errors.join('; ')}`,
          registryVersion: String(registry?.version || '').trim(),
          registryErrors: parity.errors
        };
        trainingPackageAgentBundleCache = out;
        trainingPackageAgentBundleCacheAt = Date.now();
        return out;
      }
      const out = {
        ok: true,
        packageId: String(manifest?.packageId || '').trim(),
        packageVersion: String(manifest?.version || '').trim(),
        registryVersion: String(registry?.version || '').trim(),
        registryValid: true,
        registryErrors: [],
        profiles
      };
      trainingPackageAgentBundleCache = out;
      trainingPackageAgentBundleCacheAt = Date.now();
      return out;
    } catch (err) {
      const out = { ok: false, error: String(err?.message || err) };
      trainingPackageAgentBundleCache = out;
      trainingPackageAgentBundleCacheAt = Date.now();
      return out;
    }
  }

  async function hydrateAgentRuntime({ force = false, quiet = true } = {}) {
    const loaded = await loadAgentRuntimeBundle({ force });
    if (!loaded?.ok) {
      Object.assign(agentRuntime, emptyAgentRuntimeState(), {
        error: String(loaded?.error || 'Unknown agent runtime load error'),
        registryVersion: String(loaded?.registryVersion || ''),
        registryValid: false,
        registryErrors: Array.isArray(loaded?.registryErrors) ? loaded.registryErrors : []
      });
      refreshAgentRuntimeHealth();
      if (!quiet) pushDiagnostic('warning', `Agent runtime load failed: ${agentRuntime.error}`);
      return false;
    }
    const profilesById = {};
    for (const row of loaded.profiles || []) {
      profilesById[row.id] = {
        id: row.id,
        status: row.status,
        path: row.path,
        profile: row.profile
      };
    }
    const next = emptyAgentRuntimeState();
    next.loaded = true;
    next.packageId = loaded.packageId;
    next.packageVersion = loaded.packageVersion;
    next.registryVersion = loaded.registryVersion;
    next.registryValid = Boolean(loaded.registryValid);
    next.registryErrors = Array.isArray(loaded.registryErrors) ? loaded.registryErrors : [];
    next.lastLoadedAt = new Date().toISOString();
    next.roles = (loaded.profiles || []).map((r) => r.id);
    next.profilesById = profilesById;
    next.activeRole = next.roles.includes(agentRuntime.activeRole) ? agentRuntime.activeRole : '';
    next.handoffs = agentRuntime.handoffs || next.handoffs;
    Object.assign(agentRuntime, next);
    refreshAgentRuntimeHealth();
    if (!quiet) {
      pushDiagnostic('info', `Agent runtime loaded (${next.roles.length} role${next.roles.length === 1 ? '' : 's'}, registry ${next.registryVersion || 'unknown'}).`);
    }
    return true;
  }

  async function hydrateAgentHealth() {
    const bridge = getDesktopAgentConversationBridge();
    if (!bridge) {
      state.health.agentProvider = '';
      state.health.agentModel = '';
      state.health.agentConfigured = false;
      state.health.agentHasStoredApiKey = false;
      state.health.agentConfigSource = 'none';
      return;
    }
    try {
      const res = await bridge.getAgentHealth();
      if (res?.ok) {
        state.health.agentProvider = String(res.provider || 'openai');
        state.health.agentModel = String(res.model || '');
        state.health.agentConfigured = Boolean(res.configured);
        state.health.agentHasStoredApiKey = Boolean(res.hasStoredApiKey);
        state.health.agentConfigSource = String(res.source || 'none');
      }
    } catch {
      state.health.agentConfigured = false;
    }
  }

  async function hydrateAgentConfigDraft() {
    const bridge = getDesktopAgentConfigBridge();
    if (!bridge) return;
    try {
      const res = await bridge.getAgentConfig();
      if (!res?.ok) return;
      state.ui.agentModelDraft = String(res.model || state.ui.agentModelDraft || '');
      state.ui.agentBaseUrlDraft = String(res.baseUrl || state.ui.agentBaseUrlDraft || '');
      state.health.agentHasStoredApiKey = Boolean(res.hasStoredApiKey);
      state.health.agentConfigSource = String(res.source || state.health.agentConfigSource || 'none');
    } catch {
      // Non-fatal config read failure.
    }
  }

  async function saveAgentConfig({ apiKey = '', model = '', baseUrl = '' } = {}) {
    const bridge = getDesktopAgentConfigBridge();
    if (!bridge) {
      setStatusWithDiagnostics('warning', 'Cloud agent config requires desktop runtime.');
      render();
      return false;
    }
    try {
      const res = await bridge.setAgentConfig({
        apiKey: String(apiKey || '').trim() || undefined,
        model: String(model || '').trim(),
        baseUrl: String(baseUrl || '').trim()
      });
      if (!res?.ok) {
        setStatusWithDiagnostics('action-required', 'Saving cloud agent config failed.', String(res?.error || 'Unknown error'));
        render();
        return false;
      }
      state.ui.agentApiKeyDraft = '';
      await hydrateAgentHealth();
      await hydrateAgentConfigDraft();
      setStatus('info', 'Cloud agent config saved.');
      persist();
      render();
      return true;
    } catch (err) {
      setStatusWithDiagnostics('action-required', 'Saving cloud agent config failed.', String(err?.message || err));
      render();
      return false;
    }
  }

  async function clearStoredAgentApiKey() {
    const bridge = getDesktopAgentConfigBridge();
    if (!bridge) {
      setStatusWithDiagnostics('warning', 'Cloud agent config requires desktop runtime.');
      render();
      return false;
    }
    if (!confirm('Clear stored cloud agent API key?')) return false;
    try {
      const res = await bridge.setAgentConfig({ clearApiKey: true });
      if (!res?.ok) {
        setStatusWithDiagnostics('action-required', 'Clearing API key failed.', String(res?.error || 'Unknown error'));
        render();
        return false;
      }
      await hydrateAgentHealth();
      await hydrateAgentConfigDraft();
      setStatus('info', 'Stored cloud agent API key cleared.');
      persist();
      render();
      return true;
    } catch (err) {
      setStatusWithDiagnostics('action-required', 'Clearing API key failed.', String(err?.message || err));
      render();
      return false;
    }
  }

  return {
    loadAgentRuntimeBundle,
    hydrateAgentRuntime,
    hydrateAgentHealth,
    hydrateAgentConfigDraft,
    saveAgentConfig,
    clearStoredAgentApiKey
  };
}
