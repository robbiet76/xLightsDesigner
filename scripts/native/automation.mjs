#!/usr/bin/env node

const BASE_URL = process.env.XLD_NATIVE_AUTOMATION_URL || 'http://127.0.0.1:49916';

function usage() {
  console.error('usage: automation.mjs ping | get-health-snapshot | get-app-snapshot | get-assistant-snapshot | get-xlights-session | get-sequencer-validation-snapshot | open-project <projectFilePath> | select-workflow <project|layout|audio|design|sequence|review|history> | refresh-current-workflow | refresh-all | refresh-xlights-session | save-xlights-sequence | render-xlights-sequence | open-xlights-sequence <filePath> | create-xlights-sequence <filePath> [mediaFile] [durationMs] [frameMs] | generate-sequence-proposal [selectedTags] | propose-display-metadata-from-layout | apply-display-metadata-proposals | update-display-target-intent <targetIds> [rolePreference] [semanticHints] [effectAvoidances] | apply-assistant-action-request <actionType> [payloadJson] [reason] | reset-assistant-memory | send-assistant-prompt <prompt> | apply-review | defer-review | accept-timing-review | show-assistant | hide-assistant');
  process.exit(2);
}

async function request(method, path, body = null) {
  const init = { method, headers: {} };
  if (body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, init);
  const text = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = { ok: false, error: text }; }
  if (!response.ok) {
    process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
}

const [, , command, ...rest] = process.argv;
if (!command) usage();

switch (command) {
  case 'ping':
  case 'get-health-snapshot':
    await request('GET', '/health');
    break;
  case 'get-app-snapshot':
    await request('GET', '/snapshot');
    break;
  case 'get-assistant-snapshot':
    await request('GET', '/assistant-snapshot');
    break;
  case 'get-xlights-session':
    await request('GET', '/xlights-session');
    break;
  case 'get-sequencer-validation-snapshot':
    await request('GET', '/sequencer-validation-snapshot');
    break;
  case 'open-project':
    await request('POST', '/action', { action: 'openProject', filePath: String(rest[0] || '').trim() });
    break;
  case 'select-workflow':
    await request('POST', '/action', { action: 'selectWorkflow', workflow: String(rest[0] || '').trim() });
    break;
  case 'refresh-current-workflow':
    await request('POST', '/action', { action: 'refreshCurrentWorkflow' });
    break;
  case 'refresh-all':
    await request('POST', '/action', { action: 'refreshAll' });
    break;
  case 'refresh-xlights-session':
    await request('POST', '/action', { action: 'refreshXLightsSession' });
    break;
  case 'save-xlights-sequence':
    await request('POST', '/action', { action: 'saveXLightsSequence' });
    break;
  case 'render-xlights-sequence':
    await request('POST', '/action', { action: 'renderXLightsSequence' });
    break;
  case 'open-xlights-sequence':
    await request('POST', '/action', { action: 'openXLightsSequence', filePath: String(rest[0] || '').trim() });
    break;
  case 'create-xlights-sequence': {
    const [filePath = '', mediaFile = '', durationMs = '', frameMs = ''] = rest;
    const body = { action: 'createXLightsSequence', filePath: String(filePath).trim() };
    if (String(mediaFile).trim()) body.mediaFile = String(mediaFile).trim();
    if (String(durationMs).trim()) body.durationMs = Number(durationMs);
    if (String(frameMs).trim()) body.frameMs = Number(frameMs);
    await request('POST', '/action', body);
    break;
  }
  case 'propose-display-metadata-from-layout':
    await request('POST', '/action', { action: 'proposeDisplayMetadataFromLayout' });
    break;
  case 'apply-display-metadata-proposals':
    await request('POST', '/action', { action: 'applyDisplayMetadataProposals' });
    break;
  case 'generate-sequence-proposal':
    await request('POST', '/action', {
      action: 'generateSequenceProposal',
      selectedTagNames: rest.join(' ').trim()
    });
    break;
  case 'update-display-target-intent': {
    const [targetIds = '', rolePreference = '', semanticHints = '', effectAvoidances = ''] = rest;
    await request('POST', '/action', {
      action: 'updateDisplayTargetIntent',
      targetIds: String(targetIds).trim(),
      rolePreference: String(rolePreference).trim(),
      semanticHints: String(semanticHints).trim(),
      effectAvoidances: String(effectAvoidances).trim()
    });
    break;
  }
  case 'apply-assistant-action-request': {
    const [actionType = '', payloadJson = '{}', ...reasonParts] = rest;
    let payload = {};
    try {
      payload = JSON.parse(String(payloadJson || '{}'));
    } catch (error) {
      console.error(`Invalid payloadJson: ${error.message}`);
      process.exit(2);
    }
    await request('POST', '/action', {
      action: 'applyAssistantActionRequest',
      actionType: String(actionType).trim(),
      payload,
      reason: reasonParts.join(' ').trim()
    });
    break;
  }
  case 'reset-assistant-memory':
    await request('POST', '/action', { action: 'resetAssistantMemory' });
    break;
  case 'send-assistant-prompt':
    await request('POST', '/action', { action: 'sendAssistantPrompt', prompt: rest.join(' ').trim() });
    break;
  case 'apply-review':
    await request('POST', '/action', { action: 'applyReview' });
    break;
  case 'defer-review':
    await request('POST', '/action', { action: 'deferReview' });
    break;
  case 'accept-timing-review':
    await request('POST', '/action', { action: 'acceptTimingReview' });
    break;
  case 'show-assistant':
    await request('POST', '/action', { action: 'showAssistant' });
    break;
  case 'hide-assistant':
    await request('POST', '/action', { action: 'hideAssistant' });
    break;
  default:
    usage();
}
