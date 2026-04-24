import fs from 'node:fs';
import path from 'node:path';

function str(value = '') {
  return String(value || '').trim();
}

function readJson(filePath = '') {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadProjectDisplayMetadataAssignments(projectFile = '') {
  const projectDir = path.dirname(str(projectFile));
  const metadataPath = path.join(projectDir, 'layout', 'layout-metadata.json');
  if (!fs.existsSync(metadataPath)) return [];
  const document = readJson(metadataPath);
  const tags = Array.isArray(document?.tags) ? document.tags : [];
  const tagById = new Map(tags.map((tag) => [str(tag?.id), tag]).filter(([id]) => id));
  const targetTags = document?.targetTags && typeof document.targetTags === 'object' ? document.targetTags : {};
  return Object.entries(targetTags)
    .map(([targetId, tagIds]) => {
      const resolvedTags = Array.isArray(tagIds)
        ? tagIds.map((tagId) => tagById.get(str(tagId))).filter(Boolean)
        : [];
      const tagNames = resolvedTags.map((tag) => str(tag?.name)).filter(Boolean);
      if (!str(targetId) || !tagNames.length) return null;
      const semanticHints = resolvedTags
        .map((tag) => str(tag?.description))
        .filter(Boolean);
      return {
        targetId: str(targetId),
        tags: tagNames,
        semanticHints,
        source: 'xlightsdesigner_project_display_metadata'
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.targetId.localeCompare(b.targetId));
}
