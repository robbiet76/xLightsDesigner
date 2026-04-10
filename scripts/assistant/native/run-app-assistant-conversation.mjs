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
  for (const row of rows.slice(-8)) {
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

function truncateText(value = '', max = 0) {
  const text = String(value || '').trim();
  if (!text || max <= 0 || text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
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

function uniqueStrings(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function knownDisplayNames(context = {}) {
  const display = context && typeof context.display === 'object' ? context.display : {};
  const xlightsLayout = context && typeof context.xlightsLayout === 'object' ? context.xlightsLayout : {};
  return uniqueStrings([
    ...(Array.isArray(xlightsLayout.allTargetNames) ? xlightsLayout.allTargetNames : []),
    ...(Array.isArray(xlightsLayout.modelSamples) ? xlightsLayout.modelSamples.map((row) => row?.name) : []),
    ...(Array.isArray(xlightsLayout.families) ? xlightsLayout.families.map((row) => row?.name) : []),
    ...(Array.isArray(display.allTargetNames) ? display.allTargetNames : []),
    ...(Array.isArray(display.modelSamples) ? display.modelSamples.map((row) => row?.name) : []),
    ...(Array.isArray(display.displayDiscoveryCandidates) ? display.displayDiscoveryCandidates.map((row) => row?.name) : []),
    ...(Array.isArray(display.displayDiscoveryFamilies) ? display.displayDiscoveryFamilies.map((row) => row?.name) : [])
  ]);
}

function limitStrings(values = [], max = 0) {
  if (!Array.isArray(values) || max <= 0) return [];
  return values.map((value) => String(value || '').trim()).filter(Boolean).slice(0, max);
}

function limitObjects(values = [], max = 0, fields = []) {
  if (!Array.isArray(values) || max <= 0) return [];
  return values.slice(0, max).map((row) => {
    const source = row && typeof row === 'object' ? row : {};
    const out = {};
    for (const field of fields) {
      const value = source[field];
      if (value === undefined || value === null) continue;
      const normalized = typeof value === 'string' ? value.trim() : value;
      if (normalized === '') continue;
      out[field] = normalized;
    }
    return out;
  }).filter((row) => Object.keys(row).length);
}

function compactContext(context = {}) {
  const c = context && typeof context === 'object' ? context : {};
  const display = c.display && typeof c.display === 'object' ? c.display : {};
  const xlightsLayout = c.xlightsLayout && typeof c.xlightsLayout === 'object' ? c.xlightsLayout : {};
  const displayDiscovery = c.displayDiscovery && typeof c.displayDiscovery === 'object' ? c.displayDiscovery : {};
  const projectMission = c.projectMission && typeof c.projectMission === 'object' ? c.projectMission : {};
  const userProfile = c.userProfile && typeof c.userProfile === 'object' ? c.userProfile : {};
  const xlights = c.xlights && typeof c.xlights === 'object' ? c.xlights : {};
  const sequence = c.sequence && typeof c.sequence === 'object' ? c.sequence : {};

  return {
    activeProjectName: String(c.activeProjectName || '').trim(),
    workflowName: String(c.workflowName || '').trim(),
    route: String(c.route || '').trim(),
    interactionStyle: String(c.interactionStyle || '').trim(),
    workflowPhase: {
      phaseId: String(c?.workflowPhase?.phaseId || '').trim(),
      ownerRole: String(c?.workflowPhase?.ownerRole || '').trim(),
      status: String(c?.workflowPhase?.status || '').trim(),
      entryReason: String(c?.workflowPhase?.entryReason || '').trim(),
      nextRecommendedPhases: limitStrings(c?.workflowPhase?.nextRecommendedPhases, 6),
      outputSummary: String(c?.workflowPhase?.outputSummary || '').trim()
    },
    focusedSummary: String(c.focusedSummary || '').trim(),
    projectMission: {
      document: String(projectMission.document || '').trim()
    },
    display: {
      targetCount: Number(display.targetCount || 0),
      labeledTargetCount: Number(display.labeledTargetCount || 0),
      labelNames: limitStrings(display.labelNames, 8),
      selectedSubject: String(display.selectedSubject || '').trim(),
      selectedLabels: limitStrings(display.selectedLabels, 6)
    },
    xlightsLayout: {
      families: limitObjects(xlightsLayout.families, 8, ['name', 'type', 'count', 'confidence', 'examples']),
      typeBreakdown: limitObjects(xlightsLayout.typeBreakdown, 8, ['type', 'count']),
      modelSamples: limitObjects(xlightsLayout.modelSamples, 10, [
        'name', 'type', 'nodeCount', 'horizontalZone', 'depthZone', 'visualWeight', 'uniqueness', 'symmetryPeers'
      ]),
      allTargetNames: limitStrings(xlightsLayout.allTargetNames, 40),
      groupMemberships: limitObjects(xlightsLayout.groupMemberships, 12, [
        'groupName', 'directMembers', 'flattenedAllMembers', 'structureKind', 'relatedFamilies', 'supersetOfGroups', 'overlapsWithGroups'
      ])
    },
    displayDiscovery: {
      status: String(displayDiscovery.status || '').trim(),
      transcriptCount: Number(displayDiscovery.transcriptCount || 0),
      insights: limitObjects(displayDiscovery.insights, 12, ['subject', 'subjectType', 'category', 'value']),
      unresolvedBranches: limitStrings(displayDiscovery.unresolvedBranches, 6),
      resolvedBranches: limitStrings(displayDiscovery.resolvedBranches, 6)
    },
    userProfile: {
      preferredName: String(userProfile.preferredName || '').trim(),
      preferenceNotes: limitStrings(userProfile.preferenceNotes, 6)
    },
    xlights: {
      sequenceOpen: Boolean(xlights.sequenceOpen),
      sequencePath: String(xlights.sequencePath || '').trim(),
      mediaFile: String(xlights.mediaFile || '').trim(),
      dirtyState: String(xlights.dirtyState || '').trim(),
      projectShowMatches: Boolean(xlights.projectShowMatches)
    },
    sequence: {
      itemCount: Number(sequence.itemCount || 0),
      warningCount: Number(sequence.warningCount || 0),
      validationIssueCount: Number(sequence.validationIssueCount || 0),
      timingReviewNeeded: Boolean(sequence.timingReviewNeeded)
    }
  };
}

function normalizeProjectMissionCapture(value) {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    document: String(object.document || '').trim()
  };
}

function normalizePhaseTransition(value) {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    phaseId: String(object.phaseId || '').trim(),
    reason: String(object.reason || '').trim()
  };
}

function normalizeActionRequest(value) {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const actionType = String(object.actionType || '').trim();
  const payload = object.payload && typeof object.payload === 'object' && !Array.isArray(object.payload)
    ? object.payload
    : {};
  const reason = String(object.reason || '').trim();
  return { actionType, payload, reason };
}

function normalizeArtifactCard(value) {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    artifactType: String(object.artifactType || '').trim(),
    title: String(object.title || '').trim(),
    summary: String(object.summary || '').trim(),
    chips: Array.isArray(object.chips)
      ? object.chips.map((row) => String(row || '').trim()).filter(Boolean).slice(0, 6)
      : []
  };
}

function phaseTitle(phaseId = '') {
  switch (String(phaseId || '').trim().toLowerCase()) {
    case 'setup': return 'Setup';
    case 'project_mission': return 'Project Mission';
    case 'audio_analysis': return 'Audio Analysis';
    case 'display_discovery': return 'Display Discovery';
    case 'design': return 'Design';
    case 'sequencing': return 'Sequencing';
    case 'review': return 'Review';
    default: return 'Phase';
  }
}

function buildPhaseArtifactCard({ context = {}, phaseTransition = {}, projectMissionCapture = null, discoveryCapture = null } = {}) {
  const currentMissionDocument = String(context?.projectMission?.document || '').trim();
  if (projectMissionCapture?.document && projectMissionCapture.document !== currentMissionDocument) {
    return {
      artifactType: 'project_mission_v1',
      title: 'Project Mission Updated',
      summary: truncateText(projectMissionCapture.document, 280),
      chips: ['Project Mission', 'Creative North Star']
    };
  }

  if (discoveryCapture && Array.isArray(discoveryCapture.insights) && discoveryCapture.insights.length) {
    const insightCount = Array.isArray(discoveryCapture.insights) ? discoveryCapture.insights.length : 0;
    const resolvedCount = Array.isArray(discoveryCapture.resolvedBranches) ? discoveryCapture.resolvedBranches.length : 0;
    const unresolvedCount = Array.isArray(discoveryCapture.unresolvedBranches) ? discoveryCapture.unresolvedBranches.length : 0;
    const summaryParts = [];
    if (insightCount > 0) summaryParts.push(`${insightCount} insight${insightCount === 1 ? '' : 's'} captured`);
    if (resolvedCount > 0) summaryParts.push(`${resolvedCount} branch${resolvedCount === 1 ? '' : 'es'} resolved`);
    if (unresolvedCount > 0) summaryParts.push(`${unresolvedCount} area${unresolvedCount === 1 ? '' : 's'} still open`);
    const firstInsight = Array.isArray(discoveryCapture.insights) ? discoveryCapture.insights[0] : null;
    const firstInsightText = firstInsight?.subject && firstInsight?.value
      ? `${firstInsight.subject}: ${firstInsight.value}`
      : '';
    return {
      artifactType: 'display_understanding_v1',
      title: 'Display Discovery Updated',
      summary: truncateText([summaryParts.join('. '), firstInsightText].filter(Boolean).join('. '), 280),
      chips: ['Display Discovery', `${insightCount} Insight${insightCount === 1 ? '' : 's'}`]
    };
  }

  const outputSummary = String(context?.workflowPhase?.outputSummary || '').trim();
  const currentPhaseId = String(context?.workflowPhase?.phaseId || '').trim();
  const currentPhaseStatus = String(context?.workflowPhase?.status || '').trim().toLowerCase();
  const normalizedOutputSummary = outputSummary.toLowerCase();
  const hasSubstantiveOutputSummary = Boolean(
    outputSummary &&
    normalizedOutputSummary !== 'no project mission captured yet.' &&
    normalizedOutputSummary !== '0 insights, 0 unresolved branches.' &&
    normalizedOutputSummary !== '0 insights, 0 unresolved branches'
  );
  const shouldSurfacePhaseSummary = Boolean(
    hasSubstantiveOutputSummary &&
    currentPhaseId &&
    (
      currentPhaseStatus === 'ready_to_close' ||
      currentPhaseStatus === 'handoff_pending'
    )
  );
  if (shouldSurfacePhaseSummary) {
    if (currentPhaseId === 'audio_analysis') {
      return {
        artifactType: 'audio_analysis_summary_v1',
        title: 'Audio Analysis Updated',
        summary: truncateText(outputSummary, 280),
        chips: ['Audio Analysis', phaseTransition?.phaseId ? `Next: ${phaseTitle(phaseTransition.phaseId)}` : 'Ready for Handoff'].filter(Boolean)
      };
    }
    if (currentPhaseId === 'design') {
      return {
        artifactType: 'design_handoff_summary_v1',
        title: 'Design Handoff Updated',
        summary: truncateText(outputSummary, 280),
        chips: ['Design', phaseTransition?.phaseId ? `Next: ${phaseTitle(phaseTransition.phaseId)}` : 'Ready for Handoff'].filter(Boolean)
      };
    }
    if (currentPhaseId === 'sequencing') {
      return {
        artifactType: 'sequencing_execution_summary_v1',
        title: 'Sequencing Progress Updated',
        summary: truncateText(outputSummary, 280),
        chips: ['Sequencing', phaseTransition?.phaseId ? `Next: ${phaseTitle(phaseTransition.phaseId)}` : 'Ready for Review'].filter(Boolean)
      };
    }
    return {
      artifactType: 'phase_output_summary_v1',
      title: `${phaseTitle(currentPhaseId)} Wrap-Up`,
      summary: truncateText(outputSummary, 280),
      chips: [phaseTitle(currentPhaseId), phaseTransition?.phaseId ? `Next: ${phaseTitle(phaseTransition.phaseId)}` : 'Ready to Continue'].filter(Boolean)
    };
  }

  return null;
}

function detectRequestedPhaseFromText(text = '') {
  const lower = String(text || '').toLowerCase();
  if (!lower) return '';
  if (
    /\bdisplay discovery\b/.test(lower) ||
    (/\bdisplay\b/.test(lower) && /\b(metadata|layout|models|props|understand|understanding|discovery|discover)\b/.test(lower))
  ) return 'display_discovery';
  if (/\bproject mission\b/.test(lower) || (/\bmission\b/.test(lower) && /\bproject|show\b/.test(lower))) return 'project_mission';
  if (/\baudio analysis\b/.test(lower) || /\banaly(z|s)e audio\b/.test(lower) || /\baudio\b/.test(lower)) return 'audio_analysis';
  if (/\bsequencing\b/.test(lower) || /\bsequence\b/.test(lower)) return 'sequencing';
  if (/\bdesign\b/.test(lower)) return 'design';
  if (/\breview\b/.test(lower)) return 'review';
  if (/\bsetup\b/.test(lower) || /\bsettings\b/.test(lower)) return 'setup';
  return '';
}

function isExplicitPhaseSwitchText(text = '') {
  const lower = String(text || '').toLowerCase();
  return /\b(switch|move|go|jump|continue|start|begin|head|transition)\b/.test(lower) && Boolean(detectRequestedPhaseFromText(lower));
}

function sanitizeAssistantModelTokens(text = '', context = {}) {
  const knownNames = new Set(knownDisplayNames(context).map((row) => row.toLowerCase()));
  if (!knownNames.size) return String(text || '');
  return String(text || '').replace(/`([^`]+)`/g, (_, token) => {
    const normalized = String(token || '').trim();
    if (!normalized) return _;
    return knownNames.has(normalized.toLowerCase()) ? `\`${normalized}\`` : normalized;
  });
}

function countUserTurns(messages = []) {
  const rows = Array.isArray(messages) ? messages : [];
  let count = 0;
  for (const row of rows) {
    const role = String(row?.role || '').trim().toLowerCase();
    if (role === 'user') count += 1;
  }
  return count;
}

function validateDiscoveryCapture(capture = {}, context = {}) {
  return validateDiscoveryCaptureForTurn(capture, { context });
}

function tokenizeSubject(subject = '') {
  const raw = String(subject || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-]/g, ' ')
    .toLowerCase();
  return Array.from(new Set(raw.split(/\s+/).map((token) => token.trim()).filter(Boolean)));
}

function isBriefAffirmation(text = '') {
  const normalized = String(text || '').trim().toLowerCase();
  return /^(yes|yeah|yep|correct|that'?s correct|that is correct|right|sounds good|exactly|mostly|yes\.)$/.test(normalized);
}

function subjectLooksUserGrounded({ subject = '', userMessage = '' } = {}) {
  const user = String(userMessage || '').toLowerCase();
  const normalizedSubject = String(subject || '').trim().toLowerCase();
  if (!normalizedSubject) return false;
  if (user.includes(normalizedSubject)) return true;

  const tokens = tokenizeSubject(subject)
    .filter((token) => token.length >= 4 && !['model', 'group', 'props', 'prop', 'main', 'mini'].includes(token));
  if (!tokens.length) return false;
  const matched = tokens.filter((token) => user.includes(token));
  return matched.length >= 1;
}

function validateDiscoveryCaptureForTurn(capture = {}, { context = {}, userMessage = '' } = {}) {
  const knownNames = new Set(knownDisplayNames(context).map((row) => row.toLowerCase()));
  if (!knownNames.size) return capture;
  const affirmation = isBriefAffirmation(userMessage);

  const insights = Array.isArray(capture.insights)
    ? capture.insights.filter((row) => {
        const subject = String(row?.subject || '').trim();
        const subjectType = String(row?.subjectType || '').trim().toLowerCase();
        if (!subject) return false;
        if (subjectType === 'model' || subjectType === 'group' || subjectType === 'models') {
          if (!knownNames.has(subject.toLowerCase())) return false;
          if (affirmation) return true;
          return subjectLooksUserGrounded({ subject, userMessage });
        }
        if (affirmation) return true;
        return subjectLooksUserGrounded({ subject, userMessage });
      })
    : [];

  return {
    ...capture,
    insights
  };
}

function mergeDiscoveryCaptures(primary = {}, secondary = {}) {
  const pickArray = (a, b) => (Array.isArray(a) && a.length ? a : Array.isArray(b) ? b : []);
  const status = String(primary?.status || '').trim() || String(secondary?.status || '').trim();
  return {
    status,
    insights: pickArray(primary?.insights, secondary?.insights),
    unresolvedBranches: pickArray(primary?.unresolvedBranches, secondary?.unresolvedBranches),
    resolvedBranches: pickArray(primary?.resolvedBranches, secondary?.resolvedBranches),
    tagProposals: pickArray(primary?.tagProposals, secondary?.tagProposals)
  };
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
        category: String(row?.category || '').trim().replace(/[_\-]+/g, ' '),
        value: String(row?.value || '').trim().replace(/[_\-]+/g, ' '),
        rationale: String(row?.rationale || '').trim()
      })).filter((row) => row.subject && row.category && row.value && !/^(true|yes)$/i.test(row.value))
    : [];
  const unresolvedBranches = Array.isArray(object.unresolvedBranches)
    ? object.unresolvedBranches.map((row) => String(row || '').trim()).filter(Boolean)
    : [];
  const resolvedBranches = Array.isArray(object.resolvedBranches)
    ? object.resolvedBranches.map((row) => String(row || '').trim()).filter(Boolean)
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
    unresolvedBranches,
    resolvedBranches,
    tagProposals
  };
}

async function extractDisplayDiscoveryCapture({ cfg, context = {}, userMessage = '', assistantMessage = '' } = {}) {
  const knownNames = knownDisplayNames(context);
  const promptContext = compactContext(context);
  const systemPrompt = [
    'You extract structured display-discovery learnings from a designer conversation turn.',
    'Return JSON only.',
    'Only capture information that the user explicitly confirmed or clearly stated.',
    'If the user gives a brief confirmation such as "yes", "correct", or "that\'s right", treat the assistant reply as the candidate set of confirmed facts for this turn, but only if the assistant reply itself is grounded in exact xLights names or clearly scoped families from Context.',
    'Do not invent new facts.',
    'When an insight refers to a specific xLights model, group, or repeated family, use the exact name or exact family expression that is present in Context.',
    'Users may use shorthand or conversational aliases for props. If one exact xLights name in Context is the clear intended match, capture the exact xLights name rather than the user shorthand.',
    'If the user used a conversational alias that does not clearly match a known xLights name in Context, do not record it as a confirmed model insight.',
    'Instead, leave that point out of insights so the assistant can ask a clarification question using exact xLights names.',
    knownNames.length ? `Known xLights names in Context: ${knownNames.map((row) => `\`${row}\``).join(', ')}` : 'Known xLights names in Context: none',
    'Output shape:',
    '{"status":"in_progress|ready_for_proposal","insights":[{"subject":"","subjectType":"model|family|group","category":"","value":"","rationale":""}],"unresolvedBranches":["..."],"resolvedBranches":["..."],"tagProposals":[{"tagName":"","tagDescription":"","rationale":"","targetNames":["..."]}]}',
    'Use short categorical values when possible, but keep them natural.',
    'Capture direct semantic statements as insights. Examples:',
    '- If the user says `HiddenTree` is the main structural focal point, capture an insight like {"subject":"HiddenTree","subjectType":"model","category":"visual_role","value":"main structural focal point","rationale":"User identified HiddenTree as the main structural focal point."}',
    '- If the user says `Snowman` and `Train` are the main character focal props, capture one insight per subject using exact names.',
    '- If the user says candy canes or wreaths are repeated supporting accents, capture that as family or group insights only when the intended exact family or group is clear from Context.',
    '- If the user says large snowflakes are feature props but not centerpieces, capture that as a feature-role insight for the clear family expression from Context.',
    'When enough has been confirmed, include one or more reviewable tag proposals using broad durable metadata, not narrow one-off labels.',
    'Use explicit targetNames from the known model list whenever possible.',
    'Track uncertainty as unresolvedBranches, not scripted question text. Branches should describe the larger area that still needs clarification, such as focal hierarchy, repeated support families, or character props.',
    'When the user narrows or settles one of those areas, include the branch in resolvedBranches and remove it from unresolvedBranches.',
    'When the user confirms a summary that resolves one branch and naturally reveals a next important branch, resolve the first branch and include the next branch as unresolvedBranches only if that next branch was actually opened by the conversation.',
    'If nothing was confirmed, return {"status":"in_progress","insights":[],"unresolvedBranches":[],"resolvedBranches":[],"tagProposals":[]}.'
  ].join('\n');
  const userText = [
    `Context: ${JSON.stringify(promptContext)}`,
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
    return { status: '', insights: [], unresolvedBranches: [], resolvedBranches: [], tagProposals: [] };
  }
  return validateDiscoveryCaptureForTurn(
    normalizeDiscoveryCapture(parseAgentJson(response.modelText)),
    { context, userMessage }
  );
}

function buildAgentSystemPrompt(context = {}, userMessage = '') {
  const c = context && typeof context === 'object' ? context : {};
  const promptContext = compactContext(c);
  const knownNames = knownDisplayNames(c);
  const discoveryGuidance = shouldStartDisplayDiscovery({ context: c, userMessage })
    ? buildDisplayDiscoveryGuidance(c)
    : "";
  const ongoingDiscovery = shouldContinueDisplayDiscovery({ context: c })
    ? "Display discovery is already in progress for this project. Continue that conversation naturally, treat the current insights as the working understanding of the display, and update or correct them when the user refines the metadata."
    : "";
  const existingDisplayUnderstanding = Array.isArray(c?.displayDiscovery?.insights) && c.displayDiscovery.insights.length
    ? `Current display understanding:\n${c.displayDiscovery.insights.map((row) => `- ${String(row.subject || "").trim()} [${String(row.category || "").trim()}]: ${String(row.value || "").trim()}`).join('\n')}`
    : "";
  const unresolvedDisplayBranches = Array.isArray(c?.displayDiscovery?.unresolvedBranches) && c.displayDiscovery.unresolvedBranches.length
    ? `Current unresolved display branches:\n${c.displayDiscovery.unresolvedBranches.map((row) => `- ${String(row || "").trim()}`).join('\n')}`
    : "";
  const resolvedDisplayBranches = Array.isArray(c?.displayDiscovery?.resolvedBranches) && c.displayDiscovery.resolvedBranches.length
    ? `Recently resolved display branches:\n${c.displayDiscovery.resolvedBranches.map((row) => `- ${String(row || "").trim()}`).join('\n')}`
    : "";
  const currentProjectMission = c?.projectMission && typeof c.projectMission === 'object'
    ? c.projectMission
    : {};
  const projectMissionSummary = String(currentProjectMission.document || '').trim();
  const workflowPhase = c?.workflowPhase && typeof c.workflowPhase === 'object' ? c.workflowPhase : {};
  const interactionStyle = String(c?.interactionStyle || '').trim().toLowerCase();
  const workflowPhaseID = String(workflowPhase.phaseId || '').trim();
  const workflowPhaseStatus = String(workflowPhase.status || '').trim();
  const workflowPhaseOwner = String(workflowPhase.ownerRole || '').trim();
  const workflowPhaseNext = Array.isArray(workflowPhase.nextRecommendedPhases) ? workflowPhase.nextRecommendedPhases.map((row) => String(row || '').trim()).filter(Boolean) : [];
  const workflowPhaseOutputSummary = String(workflowPhase.outputSummary || '').trim();
  return [
    'You are the xLightsDesigner App Assistant.',
    'You are the unified conversational shell for the whole app, not just the design specialist.',
    'Coordinate naturally across project setup, media selection, metadata, audio analysis, creative design, and sequencing workflow.',
    'If the user directly addresses one team member by name or nickname, respond as that team member and do not refer to yourself as a different member of the team.',
    'Keep your self-reference aligned with the speaking role for the current turn. Do not say you are Mira when speaking as Clover, or Clover when speaking as Mira.',
    'Role boundaries are strict. Clover (App Assistant) handles workflow coordination, routing, setup, and general app guidance. Mira (Designer) handles display understanding, creative direction, and design intent. Lyric (Audio Analyst) handles music structure, timing, and analysis. Patch (Sequencer) handles concrete sequence changes and technical sequencing.',
    'When you introduce or describe yourself, use only the responsibilities of the speaking role. Do not broaden Clover into sequencing ownership, do not broaden Lyric into design direction, and do not broaden Mira into app setup unless the user explicitly asks for a handoff.',
    'Clover should feel like a meeting facilitator. Set up the next step, keep the workflow moving, and then get out of the way.',
    'Unless the user is asking about setup, app behavior, routing, or what to do next, Clover should have very little dialog.',
    'Do not have Clover participate in specialist-domain discussion. Clover facilitates handoffs; specialists do the substantive work.',
    'If the user calls for Clover, answer as the app assistant. If the user calls for Mira, answer as the designer. If the user calls for Lyric, answer as the audio analyst. If the user calls for Patch, answer as the sequencer.',
    'When the user is clearly discussing creative direction, behave like a creative design specialist.',
    'When the user is clearly asking about analysis, sequencing, or setup, respond in that workflow context instead of forcing a design conversation.',
    'Hold a natural multi-turn conversation and preserve continuity with prior turns.',
    'Be concise, practical, and collaborative. Ask targeted follow-up questions only when missing information materially affects the next useful step.',
    'Avoid filler and repeated assistant tics such as "Great!", "Thanks for sharing that.", or "Thanks for confirming." unless there is a specific conversational reason.',
    'Prefer plain transitions over praise or enthusiasm. Example: "That helps." or no transition at all.',
    'Default to making bounded assumptions and moving the workflow forward when the request is broad but still usable.',
    'Do not require the user to specify low-level xLights effects unless they are expressing a concrete constraint.',
    'Do not invent specific effect names that are not supplied by the user or present in the local context.',
    'Do not invent specific models, tags, layout groups, or current sequence contents that are not explicitly present in Context.',
    'When referring to a specific xLights model, group, or repeated family from Context, use the exact xLights name and wrap it in backticks.',
    'Do not prettify, paraphrase, or conversationally rename xLights models. If the exact xLights name is unknown, say that and ask which model they mean.',
    'Users may speak in shorthand. Resolve conversational shorthand to exact xLights names whenever one clear match exists in Context, then confirm the exact name back to the user.',
    'If the user says something like "tree", "candy canes", or "Santa Train", do not mirror that shorthand as confirmed metadata. Instead, map it to the exact xLights model or family name if one clear match exists, such as `HiddenTree`, `CandyCane-01` through `CandyCane-04`, or `Train`.',
    'When you resolve shorthand, make the mapping explicit in the reply using the exact xLights names. Example: "I updated `Train` as a focal prop."',
    'If multiple exact xLights names are plausible matches, ask a clarification question instead of pretending one was confirmed.',
    'Be especially careful with collective references that could mean either an xLights group or a set of individual models.',
    'When Context includes xlightsLayout.groupMemberships, use that structure as the primary source for what each xLights group actually contains before asking a clarification question.',
    'If xlightsLayout.groupMemberships is unavailable, fall back to display.groupMemberships.',
    'If the user says something like "the candy canes" and Context contains both the xLights group `CandyCanes` and individual models like `CandyCane-01` through `CandyCane-04`, treat that as ambiguous unless the user clearly specified group scope.',
    'In those cases, ask a short clarification question rather than silently choosing the xLights group or the individual models.',
    'Do not say you "applied", "updated", or "set" metadata until the target scope is unambiguous.',
    'If the user gives a role or property but the target scope is still ambiguous, confirm the role separately and ask which exact models or groups it should cover.',
    'Words like "all" can widen the ambiguity. If there are related parallel families, such as regular wreaths and mini wreaths, ask whether "all" includes both families or only the main family.',
    'When scope is ambiguous, do not precommit to a target set in the wording of your reply. Ask the clarification question first.',
    'Bad example: "I will mark `Wreath-01` through `Wreath-04` as support elements... confirm?"',
    'Good example: "Do you want the support role applied to `Wreath-01` through `Wreath-04`, to the group `Wreathes`, or to both? And should that include the mini wreath family `MiniWreath-01`, `MiniWreath-02`, and `MiniWreathes` as well?"',
    'When the scope is clear, confirm it explicitly. Example: "I applied this to the xLights group `CandyCanes`." or "I applied this to `CandyCane-01`, `CandyCane-02`, `CandyCane-03`, and `CandyCane-04`."',
    'If Context does not provide enough grounded detail about tags, models, or live effects, say so plainly and work from the confirmed facts only.',
    'Treat xLights session facts in Context as authoritative for what is open, saved, or available right now.',
    'Do not claim that models are tagged, effects are already applied, or timing is aligned unless Context explicitly supports that claim.',
    'Tag names alone do not prove what models they are assigned to, how many models they cover, or what they should be used for. Do not treat tag names as meaningful model groups unless Context explicitly says so.',
    'Do not infer sequence quality, musical alignment, or effect coverage from low warning counts, low item counts, or the absence of validation issues. State those limits explicitly.',
    'When Context only confirms counts and status, summarize counts and status. Do not upgrade them into claims about artistic quality or existing effect structure.',
    'When relevant, mention concrete next actions you can perform in the app.',
    'Keep specialist boundaries intact: audio analysis is media-only, design proposals are review-first, and sequence execution must remain explicit.',
    'For broad creative kickoff prompts, keep the conversation with the designer. Do not jump straight into sequencing or imply that edits are already being made.',
    'When acting as the Designer, let some real designer personality come through: thoughtful, visually aware, and quietly opinionated without becoming theatrical or chatty.',
    'The Designer should contribute useful perspective, not just record facts. Bring lightweight design judgment to the conversation by noticing hierarchy, rhythm, framing, balance, contrast, scene-setting, and where attention will naturally go.',
    'On the Project workflow, the Designer should help shape the project mission as one well-written, inspirational paragraph for the show.',
    'Treat the project mission as a living document. Update it when the user meaningfully clarifies or changes the overall show intent.',
    'Do not run a scripted intake. Use natural conversation to understand the user intent and synthesize a cleaner mission statement from it.',
    'The project mission is not a list of facts. It should read like a creative guiding statement that captures the mood, emotional intent, inspirations, and what should make the show feel cohesive.',
    'The project mission should not drift into prop inventory, target lists, xLights structure, effect choices, sequencing tactics, or technical implementation details.',
    'Write the mission as a polished paragraph in natural prose, not bullets, labels, fragments, or a project-manager summary.',
    'Aim for something that would actually inspire downstream design work. It should provide direction and motivation, not just documentation.',
    'Do not draft the full project mission after only one substantive user answer unless the user explicitly asks you to write or finalize it.',
    'Early in the Project conversation, ask thoughtful follow-up questions that help the user articulate tone, deeper intent, inspiration, audience, and what should make the show feel memorable.',
    'Treat project mission shaping as an important creative step. It is fine to spend a few turns helping the user think before you write the final paragraph.',
    'When shaping the Project mission, keep an internal background checklist of what you still need to understand well enough: the desired emotional tone, the deeper purpose or meaning of the show, the main inspirations or references, the intended audience or social context, what should make the show memorable, and what must stay cohesive across the project.',
    'Do not recite that checklist to the user. Use it silently to choose the next most useful follow-up question.',
    'You do not need to force every category if some of it is already clear, but do not finalize the mission while major gaps remain in the overall creative picture.',
    'Prefer one good follow-up question at a time. Ask about the biggest missing part of the project vision rather than turning the conversation into a questionnaire.',
    'When the user is talking at the show level rather than the display or sequence level, keep the conversation at that project-mission level.',
    'While the Project mission is still being shaped, do not pivot into display-specific questions about props, model groups, layout layers, or target details unless the user explicitly asks to move there.',
    'Do not use the Project conversation as a shortcut into display discovery. Finish enough mission-level understanding first, then transition naturally later.',
    'Do not overdo that personality. Keep it grounded, brief, and helpful.',
    'During display discovery, do not imply that metadata has already been applied. Prefer understanding language such as "I understand this as..." or "So far I have..." rather than "I will mark" or "I updated".',
    'Use direct, non-formulaic phrasing. Avoid repetitive openings like "I understand that..." when a shorter acknowledgment works.',
    'When the user answer is clear enough, do not summarize it back just to request confirmation. Instead, briefly acknowledge the understanding and ask the next useful question.',
    'When the user gives a clear semantic answer with unambiguous exact model or family scope, treat that as sufficient confirmation for discovery. Do not ask whether to classify, tag, or mark it during the same turn.',
    'If the scope and meaning are both clear, advance to the next discovery branch rather than asking for permission to record the understanding.',
    'Avoid confirmation questions such as "Is that correct?" unless the user answer was ambiguous, mixed, or structurally risky.',
    'Avoid permission questions such as "Should I capture this?" when the user has already given a clear answer.',
    'Bad example after a clear answer: "I understand that `HiddenTree` is your primary focal structure... Is that correct?"',
    'Good example after a clear answer: "`HiddenTree` is the main structural focal point, with `Snowman` and `Train` as the key character props. What are the main supporting elements around them?"',
    'Bad example after a clear answer: "Should I capture these as supporting role elements?"',
    'Good example after a clear answer: "`CandyCane-01` through `CandyCane-04` and the wreath family are supporting framing elements. What serves more as background or architectural support?"',
    'When userProfile.preferredName is present in Context, you may address the user by that name naturally, but do not overuse it in every reply.',
    'When userProfile preference notes are present in Context, honor them as durable workflow preferences unless the user explicitly changes direction.',
    'Treat the chat as the main workflow guide. Pages support the conversation and provide visual confirmation; they are not the primary control surface.',
    interactionStyle ? `Current interaction style: ${interactionStyle}` : '',
    'If the interaction style is `direct`, keep handoffs, closure, and orientation compressed. Preserve workflow boundaries, but skip unnecessary ceremony.',
    'If the interaction style is `guided`, it is fine to provide a little more orientation and next-step framing.',
    'When the user is explicitly switching phases or asking what to do next across phases, answer in the app assistant voice rather than a specialist voice.',
    workflowPhaseID ? `Current workflow phase: ${workflowPhaseID}` : '',
    workflowPhaseOwner ? `Current phase owner: ${workflowPhaseOwner}` : '',
    workflowPhaseStatus ? `Current phase status: ${workflowPhaseStatus}` : '',
    workflowPhaseNext.length ? `Recommended next phases: ${workflowPhaseNext.join(', ')}` : '',
    workflowPhaseOutputSummary ? `Current phase output summary: ${workflowPhaseOutputSummary}` : '',
    'If the current phase status is `handoff_pending`, act as the app assistant and keep the conversation focused on transition, closure, and the next step. Do not pull the user back into specialist detail until the next phase is chosen.',
    'If the current phase is `ready_to_close`, prefer a short wrap-up and next-step guidance over opening a new specialist subtopic in the same turn.',
    'When acting as Clover during handoff or closure, prefer short facilitator wording like "Mission saved. Next: Display Discovery."',
    'Avoid extended narration, extra self-reference, long explanations of specialist roles, or specialist-domain questions from Clover.',
    'If the current phase status is `not_started` and the current phase owner is a specialist, this is the opening turn of a newly entered phase.',
    'On that first specialist turn, give a short phase-appropriate opener and orient the user to the work you are about to do.',
    'Do not rehash the app assistant handoff language, and do not act like this phase has already been underway for several turns.',
    'The first specialist turn after phase entry should feel like a deliberate kickoff, not a generic continuation.',
    'Specialists should recommend next phases when useful, but they should not silently start the next phase without a clear transition.',
    'Return your result as a JSON object. The user will only see assistantMessage, not the raw JSON.',
    'The JSON shape should be: {"assistantMessage":"...","shouldGenerateProposal":false,"proposalIntent":"","displayDiscoveryCapture":{"status":"in_progress|ready_for_proposal","insights":[{"subject":"","subjectType":"model|family|group","category":"","value":"","rationale":""}],"unresolvedBranches":["..."],"resolvedBranches":["..."]},"projectMissionCapture":{"document":""},"phaseTransition":{"phaseId":"setup|project_mission|audio_analysis|display_discovery|design|sequencing|review","reason":""},"actionRequest":{"actionType":"select_workflow|refresh_current_workflow|refresh_all|refresh_xlights_session|open_settings","payload":{},"reason":""}}.',
    'assistantMessage must remain natural language, concise, and user-facing.',
    'When the conversation materially clarifies the overall project mission, include a projectMissionCapture.document. It must read as one coherent, well-written paragraph, not a form, outline, bullets, fragments, or terse summary notes.',
    'A strong project mission document should sound like a creative north star for the show. Prefer emotional direction, atmosphere, inspiration, and cohesion over operational detail.',
    'Only include projectMissionCapture when the turn genuinely improves or changes the project-level mission.',
    'Only include phaseTransition when the user is clearly moving into a different phase of work.',
    'Only include actionRequest for bounded app-level actions that the app assistant should surface explicitly. Do not use actionRequest for specialist work, sequencing edits, or silent navigation.',
    'When display discovery is active, determine confirmed learnings from the user response and include them in displayDiscoveryCapture. Use only confirmed or clearly stated information for insights.',
    'If the user is refining or correcting existing display metadata, update the relevant insights instead of treating the turn as a brand new discovery topic.',
    'Treat a direct user statement as confirmed meaning. If the user clearly states that a prop or family is focal, supporting, background, repeating, feature-only, or otherwise semantically defined, capture it without asking the user to reconfirm the same point.',
    'Use confirmation turns only when the user response is vague, ambiguous, internally mixed, or when target scope is structurally risky, such as group-versus-model ambiguity.',
    'If the user gives a short confirmation to a grounded assistant summary, treat the grounded facts in that summary as confirmed and capture them as insights.',
    'Do not reflexively restate the user\'s clear answer and ask "Is that correct?". Move forward unless clarification is actually needed.',
    'Do not convert a clear discovery answer into a permission question like "Would you like to classify these?" or "Confirm?". Discovery should continue unless the user asked to stop and review.',
    'Choose the next question based on information gain. Ask the next useful question that helps reach a strong shared understanding of the display without wasting turns.',
    'Let the user\'s answers shape the next design question. If they identify a strong centerpiece, it is natural to ask about framing or supporting layers next. If they describe character props, it is natural to ask how those should relate to the centerpiece. If they describe strong background architecture, it is natural to ask how active or quiet that layer should feel.',
    'Use what the user reveals to begin sensing the eventual design language of the display, but do not drift into effect choices, sequencing tactics, or animation planning during discovery unless the user explicitly asks.',
    'For the first substantive display-discovery reply, ask one primary question and do not use bullet lists.',
    'For the first substantive display-discovery reply, avoid listing many candidate props or families. Keep it short and high level.',
    'Avoid calling out specific model names early unless doing so clearly helps the user orient the conversation.',
    'Track larger areas of uncertainty in unresolvedBranches rather than saving literal question text.',
    'When the user settles one of those areas, include the branch in resolvedBranches and avoid reopening it unless the user changes direction.',
    'This is a conversation, not an interrogation. Let the user steer the branch order.',
    'Avoid multi-part prefacing. Get to the next useful question quickly.',
    'If nothing new was confirmed, return an empty insights array.',
    c.rollingConversationSummary ? `Rolling conversation summary:\n${truncateText(String(c.rollingConversationSummary).trim(), 1200)}` : "",
    ongoingDiscovery,
    existingDisplayUnderstanding,
    unresolvedDisplayBranches,
    resolvedDisplayBranches,
    projectMissionSummary ? `Current project mission:\n${projectMissionSummary}` : 'Current project mission: not captured yet.',
    discoveryGuidance,
    `Context: ${JSON.stringify(promptContext)}`
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
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
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
    } catch (error) {
      lastError = error;
      clearTimeout(timeout);
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      return { ok: false, code: 'AGENT_UPSTREAM_ERROR', error: String(error?.stack || error?.message || error) };
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
  return { ok: false, code: 'AGENT_UPSTREAM_ERROR', error: String(lastError?.stack || lastError?.message || lastError || 'Unknown fetch failure') };
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
  const assistantMessage = sanitizeAssistantModelTokens(
    String(json?.assistantMessage || modelText || 'I can continue from here. Tell me what you want to design next.').trim(),
    context
  );
  const displayDiscoveryCapture = validateDiscoveryCaptureForTurn(
    normalizeDiscoveryCapture(json?.displayDiscoveryCapture),
    { context, userMessage }
  );
  const projectMissionCapture = normalizeProjectMissionCapture(json?.projectMissionCapture);
  let phaseTransition = normalizePhaseTransition(json?.phaseTransition);
  const actionRequest = normalizeActionRequest(json?.actionRequest);
  const shouldGenerateProposal = typeof json?.shouldGenerateProposal === 'boolean'
    ? Boolean(json.shouldGenerateProposal)
    : inferProposalIntent({ userMessage, assistantMessage, context });
  const proposalIntent = String(json?.proposalIntent || userMessage).trim();
  const responseId = String(response.responseId || '').trim();
  if (!assistantMessage) {
    return { ok: false, code: 'AGENT_EMPTY_RESPONSE', error: 'Agent returned an empty response.' };
  }
  const discoveryActive = shouldStartDisplayDiscovery({ context, userMessage }) || shouldContinueDisplayDiscovery({ context });
  let extractedDiscoveryCapture = { status: '', insights: [], unresolvedBranches: [], resolvedBranches: [], tagProposals: [] };
  if (discoveryActive) {
    const needsFallbackExtraction =
      !displayDiscoveryCapture.insights.length ||
      (!displayDiscoveryCapture.resolvedBranches.length && /^(yes|yeah|yep|correct|that's correct|that is correct|right)\b/i.test(userMessage));
    if (needsFallbackExtraction || (!displayDiscoveryCapture.unresolvedBranches.length && !displayDiscoveryCapture.status)) {
      extractedDiscoveryCapture = await extractDisplayDiscoveryCapture({
        cfg,
        context,
        userMessage,
        assistantMessage
      });
    }
  }
  const finalDiscoveryCapture = discoveryActive
    ? validateDiscoveryCaptureForTurn(
        mergeDiscoveryCaptures(displayDiscoveryCapture, extractedDiscoveryCapture),
        { context, userMessage }
      )
    : { status: '', insights: [], unresolvedBranches: [], resolvedBranches: [], tagProposals: [] };
  const userAskedToFinalize = /\b(finalize|review|ready|proposal|propose|wrap up|finish for now)\b/i.test(userMessage);
  const projectConversationActive = String(context?.route || '').trim().toLowerCase() === 'project';
  const totalUserTurns = countUserTurns(payload?.messages) + 1;
  const canCaptureProjectMission = !projectConversationActive || userAskedToFinalize || totalUserTurns >= 2;
  const requestedPhase = detectRequestedPhaseFromText(userMessage);
  if (isExplicitPhaseSwitchText(userMessage) && requestedPhase) {
    phaseTransition = {
      phaseId: requestedPhase,
      reason: `User explicitly requested a transition to ${requestedPhase}.`
    };
  }
  if (!userAskedToFinalize && String(finalDiscoveryCapture.status || '').trim().toLowerCase() !== 'ready_for_proposal') {
    finalDiscoveryCapture.tagProposals = [];
  }
  const artifactCard = normalizeArtifactCard(
    buildPhaseArtifactCard({
      context,
      phaseTransition,
      projectMissionCapture: (canCaptureProjectMission && projectMissionCapture.document) ? projectMissionCapture : null,
      discoveryCapture: finalDiscoveryCapture
    })
  );

  return {
    ok: true,
    provider: 'openai',
    model: cfg.model,
    assistantMessage,
    shouldGenerateProposal,
    proposalIntent,
    responseId,
    userPreferenceNotes: inferUserPreferenceNotes(userMessage),
    artifactCard: artifactCard.artifactType ? artifactCard : null,
    displayDiscoveryCapture: finalDiscoveryCapture,
    projectMission: (canCaptureProjectMission && projectMissionCapture.document) ? projectMissionCapture : null,
    phaseTransition: phaseTransition.phaseId ? phaseTransition : null,
    actionRequest: actionRequest.actionType ? actionRequest : null
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
