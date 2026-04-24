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

export function loadProjectDisplayMetadataAssignments(projectFile = '') {
  const projectDir = path.dirname(str(projectFile));
  const metadataPath = path.join(projectDir, 'layout', 'layout-metadata.json');
  if (!fs.existsSync(metadataPath)) return [];
  const document = readJson(metadataPath);
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
  return Array.from(targetIds)
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
    .filter(Boolean)
    .sort((a, b) => a.targetId.localeCompare(b.targetId));
}
