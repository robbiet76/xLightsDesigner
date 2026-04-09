import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  executeAppAssistantConversation
} from '../../../apps/xlightsdesigner-ui/agent/app-assistant/app-assistant-orchestrator.js';
import {
  buildDisplayDiscoveryGuidance,
  inferUserPreferenceNotes,
  shouldContinueDisplayDiscovery,
  shouldStartDisplayDiscovery
} from '../../../apps/xlightsdesigner-ui/agent/designer-dialog/display-discovery.js';

const OPENAI_MODEL = 'gpt-5.4';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const AGENT_CONFIG_FILENAME = 'xlightsdesigner-agent-config.json';

function parseArgs(argv = []) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = String(argv[i] || '');
    if (!key.startsWith('--')) continue;
    out[key.slice(2)] = String(argv[i + 1] || '');
    i += 1;
  }
  return out;
}

function agentConfigPath() {
  return path.join(os.homedir(), 'Library/Application Support/xlightsdesigner-desktop', AGENT_CONFIG_FILENAME);
}

function readStoredAgentConfig() {
  const file = agentConfigPath();
  if (!fs.existsSync(file)) return { apiKey: '', model: '', baseUrl: '' };
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      apiKey: String(parsed?.apiKey || '').trim(),
      model: String(parsed?.model || '').trim(),
      baseUrl: String(parsed?.baseUrl || '').trim().replace(/\/+$/, '')
    };
  } catch {
    return { apiKey: '', model: '', baseUrl: '' };
  }
}

function getAgentConfig() {
  const stored = readStoredAgentConfig();
  const envKey = String(process.env.OPENAI_API_KEY || '').trim();
  const envModel = String(process.env.OPENAI_MODEL || '').trim();
  const envBaseUrl = String(process.env.OPENAI_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = stored.apiKey || envKey;
  const model = stored.model || envModel || OPENAI_MODEL;
  const baseUrl = stored.baseUrl || envBaseUrl || OPENAI_BASE_URL;
  return {
    apiKey,
    model,
    baseUrl,
    configured: Boolean(apiKey)
  };
}

function normalizeConversationMessages(messages = []) {
  const rows = Array.isArray(messages) ? messages : [];
  const out = [];
  for (const row of rows.slice(-12)) {
    const roleRaw = String(row?.role || row?.who || '').trim().toLowerCase();
    const content = String(row?.content || row?.text || '').trim();
    if (!content) continue;
    const role = roleRaw === 'assistant' || roleRaw === 'agent'
      ? 'assistant'
      : roleRaw === 'system'
        ? 'system'
        : 'user';
    const contentType = role === 'assistant' ? 'output_text' : 'input_text';
    out.push({ role, content: [{ type: contentType, text: content }] });
  }
  return out;
}

function extractResponseText(body) {
  if (typeof body?.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();
  const output = Array.isArray(body?.output) ? body.output : [];
  const textChunks = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      if (c?.type === 'output_text' && typeof c?.text === 'string') textChunks.push(c.text);
      if (c?.type === 'text' && typeof c?.text === 'string') textChunks.push(c.text);
    }
  }
  return textChunks.join('\n').trim();
}

function parseAgentJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function inferProposalIntent({ userMessage = '', assistantMessage = '', context = {} } = {}) {
  const user = String(userMessage || '').toLowerCase();
  const assistant = String(assistantMessage || '').toLowerCase();
  const route = String(context?.route || '').toLowerCase();
  const sequenceOpen = Boolean(context?.activeSequenceLoaded);
  const planOnly = Boolean(context?.planOnlyMode);
  const actionTerms = ['sequence', 'design', 'generate', 'create', 'build', 'add', 'remove', 'change', 'update', 'apply', 'revise', 'refine'];
  const hasActionTerm = actionTerms.some((term) => user.includes(term));
  const asksQuestion = user.includes('?');
  const allowsProposal = sequenceOpen || planOnly || route === 'design';
  if (!allowsProposal) return false;
  if (!hasActionTerm) return false;
  if (asksQuestion && !assistant.includes('ready')) return false;
  return true;
}

function normalizeDiscoveryCapture(value) {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const insights = Array.isArray(object.insights)
    ? object.insights.map((row) => ({
        subject: String(row?.subject || '').trim(),
        subjectType: String(row?.subjectType || '').trim(),
        category: String(row?.category || '').trim(),
        value: String(row?.value || '').trim(),
        rationale: String(row?.rationale || '').trim()
      })).filter((row) => row.subject && row.category && row.value)
    : [];
  const openQuestions = Array.isArray(object.openQuestions)
    ? object.openQuestions.map((row) => String(row || '').trim()).filter(Boolean)
    : [];
  const tagProposals = Array.isArray(object.tagProposals)
    ? object.tagProposals.map((row) => ({
        tagName: String(row?.tagName || '').trim(),
        tagDescription: String(row?.tagDescription || '').trim(),
        rationale: String(row?.rationale || '').trim(),
        targetNames: Array.isArray(row?.targetNames)
          ? row.targetNames.map((value) => String(value || '').trim()).filter(Boolean)
          : []
      })).filter((row) => row.tagName && row.targetNames.length)
    : [];
  const status = String(object.status || '').trim();
  return {
    status: status || '',
    insights,
    openQuestions,
    tagProposals
  };
}

async function extractDisplayDiscoveryCapture({ cfg, context = {}, userMessage = '', assistantMessage = '' } = {}) {
  const systemPrompt = [
    'You extract structured display-discovery learnings from a designer conversation turn.',
    'Return JSON only.',
    'Only capture information that the user explicitly confirmed or clearly stated.',
    'Do not invent new facts.',
    'Output shape:',
    '{"status":"in_progress|ready_for_proposal","insights":[{"subject":"","subjectType":"model|family|group","category":"","value":"","rationale":""}],"openQuestions":["..."],"tagProposals":[{"tagName":"","tagDescription":"","rationale":"","targetNames":["..."]}]}',
    'Use short categorical values when possible, but keep them natural.',
    'When enough has been confirmed, include one or more reviewable tag proposals using broad durable metadata, not narrow one-off labels.',
    'Use explicit targetNames from the known model list whenever possible.',
    'If nothing was confirmed, return {"status":"in_progress","insights":[],"openQuestions":[],"tagProposals":[]}.'
  ].join('\n');
  const userText = [
    `Context: ${JSON.stringify(context)}`,
    `User message: ${String(userMessage || '')}`,
    `Assistant reply: ${String(assistantMessage || '')}`
  ].join('\n');
  const response = await callOpenAIResponses({
    cfg,
    systemPrompt,
    userMessage: userText,
    messages: [],
    previousResponseId: '',
    maxOutputTokens: 500
  });
  if (!response.ok) {
    return { status: '', insights: [], openQuestions: [] };
  }
  return normalizeDiscoveryCapture(parseAgentJson(response.modelText));
}

function buildAgentSystemPrompt(context = {}, userMessage = '') {
  const c = context && typeof context === 'object' ? context : {};
  const discoveryGuidance = shouldStartDisplayDiscovery({ context: c, userMessage })
    ? buildDisplayDiscoveryGuidance(c)
    : "";
  const ongoingDiscovery = shouldContinueDisplayDiscovery({ context: c })
    ? "Display discovery is already in progress for this project. Continue that conversation naturally instead of restarting it."
    : "";
  return [
    'You are the xLightsDesigner App Assistant.',
    'You are the unified conversational shell for the whole app, not just the design specialist.',
    'Coordinate naturally across project setup, media selection, metadata, audio analysis, creative design, and sequencing workflow.',
    'When the user is clearly discussing creative direction, behave like a creative design specialist.',
    'When the user is clearly asking about analysis, sequencing, or setup, respond in that workflow context instead of forcing a design conversation.',
    'Hold a natural multi-turn conversation and preserve continuity with prior turns.',
    'Be concise, practical, and collaborative. Ask targeted follow-up questions only when missing information materially affects the next useful step.',
    'Default to making bounded assumptions and moving the workflow forward when the request is broad but still usable.',
    'Do not require the user to specify low-level xLights effects unless they are expressing a concrete constraint.',
    'Do not invent specific effect names that are not supplied by the user or present in the local context.',
    'Do not invent specific models, tags, layout groups, or current sequence contents that are not explicitly present in Context.',
    'If Context does not provide enough grounded detail about tags, models, or live effects, say so plainly and work from the confirmed facts only.',
    'Treat xLights session facts in Context as authoritative for what is open, saved, or available right now.',
    'Do not claim that models are tagged, effects are already applied, or timing is aligned unless Context explicitly supports that claim.',
    'Tag names alone do not prove what models they are assigned to, how many models they cover, or what they should be used for. Do not treat tag names as meaningful model groups unless Context explicitly says so.',
    'Do not infer sequence quality, musical alignment, or effect coverage from low warning counts, low item counts, or the absence of validation issues. State those limits explicitly.',
    'When Context only confirms counts and status, summarize counts and status. Do not upgrade them into claims about artistic quality or existing effect structure.',
    'When relevant, mention concrete next actions you can perform in the app.',
    'Keep specialist boundaries intact: audio analysis is media-only, design proposals are review-first, and sequence execution must remain explicit.',
    'For broad creative kickoff prompts, keep the conversation with the designer. Do not jump straight into sequencing or imply that edits are already being made.',
    'When userProfile preference notes are present in Context, honor them as durable workflow preferences unless the user explicitly changes direction.',
    'Treat the chat as the main workflow guide. Pages support the conversation and provide visual confirmation; they are not the primary control surface.',
    'Return your result as a JSON object. The user will only see assistantMessage, not the raw JSON.',
    'The JSON shape should be: {"assistantMessage":"...","shouldGenerateProposal":false,"proposalIntent":"","displayDiscoveryCapture":{"status":"in_progress|ready_for_proposal","insights":[{"subject":"","subjectType":"model|family|group","category":"","value":"","rationale":""}],"openQuestions":["..."]}}.',
    'assistantMessage must remain natural language, concise, and user-facing.',
    'When display discovery is active, determine confirmed learnings from the user response and include them in displayDiscoveryCapture. Use only confirmed or clearly stated information for insights.',
    'If nothing new was confirmed, return an empty insights array.',
    c.rollingConversationSummary ? `Rolling conversation summary:\n${String(c.rollingConversationSummary).trim()}` : "",
    ongoingDiscovery,
    discoveryGuidance,
    `Context: ${JSON.stringify(c)}`
  ].filter(Boolean).join('\n');
}

async function callOpenAIResponses({ cfg, systemPrompt = '', userMessage = '', messages = [], previousResponseId = '', maxOutputTokens = 900 } = {}) {
  const input = [
    { role: 'system', content: [{ type: 'input_text', text: String(systemPrompt || '') }] },
    ...normalizeConversationMessages(messages || []),
    { role: 'user', content: [{ type: 'input_text', text: String(userMessage || '') }] }
  ];
  const body = { model: cfg.model, input, max_output_tokens: maxOutputTokens };
  if (previousResponseId) body.previous_response_id = previousResponseId;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response = null;
  try {
    response = await fetch(`${cfg.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  const raw = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  if (!response.ok) {
    const errMsg = parsed?.error?.message || raw || `HTTP ${response.status}`;
    return { ok: false, code: 'AGENT_UPSTREAM_ERROR', error: String(errMsg) };
  }
  return {
    ok: true,
    parsed: parsed || {},
    modelText: extractResponseText(parsed || {}),
    responseId: String(parsed?.id || '').trim()
  };
}

async function runAgentConversation(payload = {}) {
  const cfg = getAgentConfig();
  if (!cfg.configured) {
    return { ok: false, code: 'AGENT_NOT_CONFIGURED', error: 'OPENAI_API_KEY is not set in desktop app environment.' };
  }
  const userMessage = String(payload?.userMessage || '').trim();
  if (!userMessage) return { ok: false, code: 'AGENT_EMPTY_MESSAGE', error: 'Missing userMessage' };
  const context = payload?.context && typeof payload.context === 'object' ? payload.context : {};
  const previousResponseId = String(payload?.previousResponseId || '').trim();
  const response = await callOpenAIResponses({
    cfg,
    systemPrompt: buildAgentSystemPrompt(context, userMessage),
    userMessage,
    messages: payload?.messages || [],
    previousResponseId,
    maxOutputTokens: 900
  });
  if (!response.ok) return { ok: false, code: response.code, error: response.error };
  const modelText = response.modelText;
  const json = parseAgentJson(modelText) || {};
  const assistantMessage = String(json?.assistantMessage || modelText || 'I can continue from here. Tell me what you want to design next.').trim();
  const displayDiscoveryCapture = normalizeDiscoveryCapture(json?.displayDiscoveryCapture);
  const shouldGenerateProposal = typeof json?.shouldGenerateProposal === 'boolean'
    ? Boolean(json.shouldGenerateProposal)
    : inferProposalIntent({ userMessage, assistantMessage, context });
  const proposalIntent = String(json?.proposalIntent || userMessage).trim();
  const responseId = String(response.responseId || '').trim();
  if (!assistantMessage) {
    return { ok: false, code: 'AGENT_EMPTY_RESPONSE', error: 'Agent returned an empty response.' };
  }
  const finalDiscoveryCapture =
    (displayDiscoveryCapture.insights.length || displayDiscoveryCapture.openQuestions.length || displayDiscoveryCapture.status)
      ? displayDiscoveryCapture
      : (shouldStartDisplayDiscovery({ context, userMessage }) || shouldContinueDisplayDiscovery({ context }))
        ? await extractDisplayDiscoveryCapture({
            cfg,
            context,
            userMessage,
            assistantMessage
          })
        : { status: '', insights: [], openQuestions: [], tagProposals: [] };

  return {
    ok: true,
    provider: 'openai',
    model: cfg.model,
    assistantMessage,
    shouldGenerateProposal,
    proposalIntent,
    responseId,
    userPreferenceNotes: inferUserPreferenceNotes(userMessage),
    displayDiscoveryCapture: finalDiscoveryCapture
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payloadJson = String(args.payload || '').trim();
  if (!payloadJson) {
    process.stderr.write('Missing --payload\n');
    process.exit(1);
  }
  const payload = JSON.parse(payloadJson);
  const result = await executeAppAssistantConversation({
    userMessage: String(payload?.userMessage || ''),
    messages: Array.isArray(payload?.messages) ? payload.messages : [],
    previousResponseId: String(payload?.previousResponseId || ''),
    context: payload?.context && typeof payload.context === 'object' ? payload.context : {},
    bridge: { runAgentConversation }
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error?.message || error)}\n`);
  process.exit(1);
});
