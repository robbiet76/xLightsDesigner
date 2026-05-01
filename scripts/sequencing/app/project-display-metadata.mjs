import fs from 'node:fs';
import path from 'node:path';

function str(value = '') {
  return String(value || '').trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of arr(values).map((row) => str(row)).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function readJson(filePath = '') {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeKey(value = '') {
  return str(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeTokenSet(value = '') {
  return new Set(
    str(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((row) => row.trim())
      .filter(Boolean)
  );
}

function mergeAssignment(into = new Map(), targetId = '', patch = {}) {
  const id = str(targetId);
  if (!id) return;
  const existing = into.get(id) || {
    targetId: id,
    tags: [],
    semanticHints: [],
    visualHintDefinitions: [],
    effectAvoidances: [],
    rolePreference: '',
    source: ''
  };
  const rolePreference = str(existing.rolePreference || patch.rolePreference);
  into.set(id, {
    ...existing,
    ...patch,
    targetId: id,
    tags: uniqueStrings([...(existing.tags || []), ...(patch.tags || [])]),
    semanticHints: uniqueStrings([...(existing.semanticHints || []), ...(patch.semanticHints || [])]),
    visualHintDefinitions: [...arr(existing.visualHintDefinitions), ...arr(patch.visualHintDefinitions)],
    effectAvoidances: uniqueStrings([...(existing.effectAvoidances || []), ...(patch.effectAvoidances || [])]),
    rolePreference,
    source: uniqueStrings([existing.source, patch.source]).join('+')
  });
}

function normalizeLayoutRows(layoutRows = []) {
  return arr(layoutRows)
    .map((row) => {
      const id = str(row?.id || row?.name || row?.targetId);
      return id ? {
        ...row,
        id,
        name: str(row?.name || id),
        displayAs: str(row?.displayAs || row?.type || row?.kind)
      } : null;
    })
    .filter(Boolean);
}

function normalizeMemberName(member = '') {
  return str(member?.id || member?.name || member?.targetId || member);
}

function buildGroupMembershipIndex(groupMemberships = {}) {
  const groups = arr(groupMemberships?.data?.groups || groupMemberships?.groups);
  const out = new Map();
  for (const group of groups) {
    const name = str(group?.groupName || group?.name || group?.id);
    if (!name) continue;
    out.set(name.toLowerCase(), {
      direct: arr(group.directMembers).map(normalizeMemberName).filter(Boolean),
      active: arr(group.activeMembers).map(normalizeMemberName).filter(Boolean),
      flattened: arr(group.flattenedMembers).map(normalizeMemberName).filter(Boolean),
      flattenedAll: arr(group.flattenedAllMembers).map(normalizeMemberName).filter(Boolean)
    });
  }
  return out;
}

function buildKnownTargetIndex({ layoutRows = [], groupMemberships = {} } = {}) {
  const rows = normalizeLayoutRows(layoutRows);
  const byLower = new Map();
  const byCompact = new Map();
  for (const row of rows) {
    byLower.set(row.name.toLowerCase(), row.name);
    byCompact.set(normalizeKey(row.name), row.name);
  }
  for (const groupName of buildGroupMembershipIndex(groupMemberships).keys()) {
    if (!byLower.has(groupName)) byLower.set(groupName, groupName);
    byCompact.set(normalizeKey(groupName), byLower.get(groupName) || groupName);
  }
  return { byLower, byCompact, rows };
}

function resolveInsightTargetNames(subject = '', explicitTargets = [], indexes = {}) {
  const candidates = uniqueStrings([...arr(explicitTargets), subject]);
  const resolved = [];
  for (const candidate of candidates) {
    const text = str(candidate);
    if (!text) continue;
    const exact = indexes.byLower?.get(text.toLowerCase()) || indexes.byCompact?.get(normalizeKey(text));
    if (exact) {
      resolved.push(exact);
      continue;
    }
    const candidateTokens = normalizeTokenSet(text);
    if (!candidateTokens.size) continue;
    for (const row of arr(indexes.rows)) {
      const rowTokens = normalizeTokenSet(row.name);
      const intersection = [...candidateTokens].filter((token) => rowTokens.has(token));
      if (
        intersection.length >= 2 ||
        (intersection.length === candidateTokens.size && candidateTokens.size > 0) ||
        (normalizeKey(row.name).includes(normalizeKey(text)) && normalizeKey(text).length >= 5)
      ) {
        resolved.push(row.name);
      }
    }
  }
  return uniqueStrings(resolved);
}

function expandedTargetsFor(targetId = '', groupIndex = new Map()) {
  const id = str(targetId);
  if (!id) return [];
  const group = groupIndex.get(id.toLowerCase());
  if (!group) return [id];
  const members = uniqueStrings([
    ...arr(group.flattened),
    ...arr(group.active),
    ...arr(group.direct)
  ]).filter((memberId) => memberId.toLowerCase() !== id.toLowerCase());
  return uniqueStrings([id, ...members]);
}

function rolePreferenceForInsight(insight = {}) {
  const categoryText = str(insight?.category).toLowerCase();
  const valueText = `${str(insight?.value)} ${str(insight?.rationale)}`.toLowerCase();
  if (/focal/.test(categoryText)) {
    if (/occasional|featured|highlight|accent|punctuation/.test(valueText)) return 'accent';
    if (/primary|secondary|lead|leads?|hero|focal|center stage|focus shifts?/.test(valueText)) return 'lead';
  }
  if (/primary|lead|hero/.test(valueText)) return 'lead';
  if (/tertiary|accent|highlight|spark|punctuation/.test(valueText)) return 'accent';
  if (/secondary|support|background|framing|rhythm|texture|volume/.test(valueText)) return 'support';
  const text = `${categoryText} ${valueText}`.toLowerCase();
  if (/primary|lead|hero|focal/.test(text)) return 'lead';
  if (/accent|highlight|spark|punctuation/.test(text)) return 'accent';
  if (/background|support|secondary|tertiary|framing|rhythm|texture|volume/.test(text)) return 'support';
  return '';
}

function loadDiscoveryAssignments(projectFile = '', { layoutRows = [], groupMemberships = {} } = {}) {
  const projectDir = path.dirname(str(projectFile));
  const canonicalDiscoveryPath = path.join(projectDir, 'display', 'discovery.json');
  const legacyDiscoveryPath = path.join(projectDir, 'layout', 'display-discovery.json');
  const discoveryPath = fs.existsSync(canonicalDiscoveryPath) ? canonicalDiscoveryPath : legacyDiscoveryPath;
  if (!fs.existsSync(discoveryPath)) return [];
  const document = readJson(discoveryPath);
  const insights = arr(document?.insights);
  if (!insights.length) return [];

  const groupIndex = buildGroupMembershipIndex(groupMemberships);
  const targetIndexes = buildKnownTargetIndex({ layoutRows, groupMemberships });
  const byTarget = new Map();

  for (const insight of insights) {
    const subject = str(insight?.subject);
    const category = str(insight?.category);
    const value = str(insight?.value || insight?.summary || insight?.rationale);
    const rolePreference = rolePreferenceForInsight(insight);
    const resolvedTargets = resolveInsightTargetNames(subject, insight?.targetNames, targetIndexes);
    const expandedTargets = uniqueStrings(resolvedTargets.flatMap((targetId) => expandedTargetsFor(targetId, groupIndex)));
    const tags = uniqueStrings([subject, category, rolePreference].filter(Boolean));
    const semanticHints = uniqueStrings([category, value].filter(Boolean));
    for (const targetId of expandedTargets) {
      mergeAssignment(byTarget, targetId, {
        tags,
        semanticHints,
        rolePreference,
        source: 'xlightsdesigner_display_discovery'
      });
    }
  }

  return Array.from(byTarget.values()).sort((a, b) => a.targetId.localeCompare(b.targetId));
}

function normalizeVisualHintDefinition(definition = {}) {
  const name = str(definition?.name);
  if (!name) return null;
  return {
    name,
    status: str(definition?.status),
    semanticClass: str(definition?.semanticClass),
    behavioralIntent: str(definition?.behavioralIntent),
    behavioralTags: uniqueStrings(definition?.behavioralTags),
    source: str(definition?.source),
    definedBy: str(definition?.definedBy)
  };
}

function inferBenchmarkFamilyTags(targetId = '', layoutRow = {}) {
  const text = `${str(targetId)} ${str(layoutRow?.name)} ${str(layoutRow?.displayAs || layoutRow?.type || layoutRow?.kind)}`.toLowerCase();
  const tags = [];
  if (/matrix/.test(text)) tags.push('matrix');
  if (/tree/.test(text)) tags.push('tree');
  if (/arch/.test(text)) tags.push('arch');
  if (/star/.test(text)) tags.push('star');
  if (/spinner|pinwheel|wheel/.test(text)) tags.push('spinner');
  if (/cane/.test(text)) tags.push('cane');
  if (/icicle/.test(text)) tags.push('icicle');
  if (/line|roof|outline|ridge/.test(text)) tags.push('line');
  if (/snowflake/.test(text)) tags.push('snowflake');
  if (/window/.test(text)) tags.push('window');
  if (/flood|spot/.test(text)) tags.push('flood');
  if (/pixel|node/.test(text)) tags.push('pixel');
  return uniqueStrings(tags);
}

function inferBenchmarkRolePreference(targetId = '', layoutRow = {}) {
  const text = `${str(targetId)} ${str(layoutRow?.name)} ${str(layoutRow?.displayAs || layoutRow?.type || layoutRow?.kind)}`.toLowerCase();
  if (/matrix|tree|star|spinner|pinwheel/.test(text)) return 'lead';
  if (/arch|cane|icicle|snowflake/.test(text)) return 'accent';
  if (/line|roof|outline|ridge|window/.test(text)) return 'support';
  return 'support';
}

function buildSyntheticBenchmarkAssignments({ layoutRows = [], existingAssignments = [] } = {}) {
  const existingTargetIds = new Set(arr(existingAssignments).map((row) => str(row?.targetId).toLowerCase()).filter(Boolean));
  const rows = normalizeLayoutRows(layoutRows);
  const out = [];
  for (const row of rows) {
    const targetId = str(row?.id || row?.name);
    if (!targetId || existingTargetIds.has(targetId.toLowerCase())) continue;
    const displayAs = str(row?.displayAs || row?.type || row?.kind).toLowerCase();
    if (displayAs === 'modelgroup') continue;
    const familyTags = inferBenchmarkFamilyTags(targetId, row);
    const rolePreference = inferBenchmarkRolePreference(targetId, row);
    const semanticHints = uniqueStrings([
      familyTags[0] ? `${familyTags[0]} fixture` : '',
      `${rolePreference} benchmark fixture`,
      'benchmark synthetic metadata'
    ]);
    const tags = uniqueStrings([
      'benchmark',
      'full display',
      ...familyTags,
      rolePreference,
      ...semanticHints
    ]);
    out.push({
      targetId,
      tags,
      semanticHints,
      visualHintDefinitions: [],
      effectAvoidances: [],
      rolePreference,
      source: 'xlightsdesigner_benchmark_synthetic_metadata'
    });
  }
  return out.sort((a, b) => a.targetId.localeCompare(b.targetId));
}

export function loadProjectDisplayMetadataAssignments(projectFile = '', context = {}) {
  const projectDir = path.dirname(str(projectFile));
  const canonicalMetadataPath = path.join(projectDir, 'display', 'metadata.json');
  const legacyMetadataPath = path.join(projectDir, 'layout', 'layout-metadata.json');
  const metadataPath = fs.existsSync(canonicalMetadataPath) ? canonicalMetadataPath : legacyMetadataPath;
  const document = fs.existsSync(metadataPath) ? readJson(metadataPath) : {};
  const tags = Array.isArray(document?.tags) ? document.tags : [];
  const tagById = new Map(tags.map((tag) => [str(tag?.id), tag]).filter(([id]) => id));
  const targetTags = document?.targetTags && typeof document.targetTags === 'object' ? document.targetTags : {};
  const preferencesByTargetId = document?.preferencesByTargetId && typeof document.preferencesByTargetId === 'object'
    ? document.preferencesByTargetId
    : {};
  const definitionIndex = new Map(
    arr(document?.visualHintDefinitions)
      .map(normalizeVisualHintDefinition)
      .filter(Boolean)
      .map((definition) => [definition.name.toLowerCase(), definition])
  );
  const targetIds = new Set([
    ...Object.keys(targetTags),
    ...Object.keys(preferencesByTargetId)
  ].map(str).filter(Boolean));

  const byTarget = new Map();
  for (const row of loadDiscoveryAssignments(projectFile, context)) {
    mergeAssignment(byTarget, row.targetId, row);
  }

  for (const row of Array.from(targetIds)
    .map((targetId) => {
      const tagIds = targetTags[targetId];
      const resolvedTags = Array.isArray(tagIds)
        ? tagIds.map((tagId) => tagById.get(str(tagId))).filter(Boolean)
        : [];
      const tagNames = resolvedTags.map((tag) => str(tag?.name)).filter(Boolean);
      const preference = preferencesByTargetId[targetId] && typeof preferencesByTargetId[targetId] === 'object'
        ? preferencesByTargetId[targetId]
        : {};
      const rolePreference = str(preference?.rolePreference);
      const semanticHints = uniqueStrings([
        ...resolvedTags.map((tag) => str(tag?.description)).filter(Boolean),
        ...arr(preference?.semanticHints),
        ...arr(preference?.submodelHints)
      ]);
      const visualHintDefinitions = semanticHints
        .map((name) => definitionIndex.get(name.toLowerCase()) || null)
        .filter((definition) => definition?.status === 'defined');
      const effectAvoidances = uniqueStrings(preference?.effectAvoidances);
      const allTags = uniqueStrings([
        ...tagNames,
        rolePreference,
        ...semanticHints
      ]);
      if (!targetId || !allTags.length) return null;
      return {
        targetId,
        tags: allTags,
        semanticHints,
        visualHintDefinitions,
        effectAvoidances,
        rolePreference,
        source: 'xlightsdesigner_project_display_metadata'
      };
    })
    .filter(Boolean)) {
    mergeAssignment(byTarget, row.targetId, row);
  }

  if (context?.allowSyntheticBenchmarkMetadata) {
    for (const row of buildSyntheticBenchmarkAssignments({
      layoutRows: context?.layoutRows,
      existingAssignments: Array.from(byTarget.values())
    })) {
      mergeAssignment(byTarget, row.targetId, row);
    }
  }

  return Array.from(byTarget.values()).sort((a, b) => a.targetId.localeCompare(b.targetId));
}
