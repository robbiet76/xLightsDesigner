import test from 'node:test';
import assert from 'node:assert/strict';

import { createAgentSupportRuntime, emptyAgentRuntimeState } from '../../runtime/agent-support-runtime.js';

test('agent support runtime hydrates runtime bundle', async () => {
  const state = { health: {}, ui: {} };
  const agentRuntime = emptyAgentRuntimeState();
  let refreshed = 0;
  const runtime = createAgentSupportRuntime({
    state,
    agentRuntime,
    getDesktopTrainingPackageBridge: () => ({
      readTrainingPackageAsset: async ({ relativePath }) => {
        if (relativePath === 'manifest.json') return { ok: true, data: { packageId: 'pkg', version: '1.0', modules: [] } };
        if (relativePath === 'agents/registry.json') return { ok: true, data: { version: '2', agents: [{ id: 'sequence_agent', path: 'agents/sequence.json' }] } };
        if (relativePath === 'agents/sequence.json') return { ok: true, data: { name: 'Sequence Agent' } };
        return { ok: false };
      }
    }),
    validateTrainingAgentRegistry: () => ({ ok: true, errors: [] }),
    refreshAgentRuntimeHealth: () => { refreshed += 1; }
  });
  const ok = await runtime.hydrateAgentRuntime({ force: true, quiet: true });
  assert.equal(ok, true);
  assert.equal(agentRuntime.loaded, true);
  assert.deepEqual(agentRuntime.roles, ['sequence_agent']);
  assert.ok(refreshed >= 1);
});

test('agent support runtime saves config through bridge', async () => {
  const state = { health: {}, ui: { agentApiKeyDraft: 'secret', agentModelDraft: '', agentBaseUrlDraft: '' } };
  let persisted = 0;
  let rendered = 0;
  const runtime = createAgentSupportRuntime({
    state,
    agentRuntime: emptyAgentRuntimeState(),
    getDesktopAgentConfigBridge: () => ({
      setAgentConfig: async () => ({ ok: true }),
      getAgentConfig: async () => ({ ok: true, model: 'gpt-x', baseUrl: 'https://api.example.com', hasStoredApiKey: true, source: 'desktop' })
    }),
    getDesktopAgentConversationBridge: () => ({
      getAgentHealth: async () => ({ ok: true, provider: 'openai', model: 'gpt-x', configured: true, hasStoredApiKey: true, source: 'desktop' })
    }),
    validateTrainingAgentRegistry: () => ({ ok: true, errors: [] }),
    persist: () => { persisted += 1; },
    render: () => { rendered += 1; },
    setStatus: () => {}
  });
  const ok = await runtime.saveAgentConfig({ apiKey: 'secret', model: 'gpt-x', baseUrl: 'https://api.example.com' });
  assert.equal(ok, true);
  assert.equal(state.ui.agentApiKeyDraft, '');
  assert.ok(persisted >= 1);
  assert.ok(rendered >= 1);
});
