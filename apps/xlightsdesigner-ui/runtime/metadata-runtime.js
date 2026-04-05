export function createMetadataRuntime(deps = {}) {
  const {
    state,
    persist = () => {},
    render = () => {},
    saveCurrentProjectSnapshot = () => {},
    setStatus = () => {},
    invalidatePlanHandoff = () => {},
    mergeVisualHintDefinitions,
    ensureVisualHintDefinitions,
    defineVisualHint,
    toStoredVisualHintDefinitions,
    isControlledMetadataTag,
    mergeMetadataTagRecords,
    normalizeMetadataTagName,
    toStoredMetadataTagRecords,
    buildRuntimeEffectiveMetadataAssignments,
    parseSubmodelParentId,
    modelStableId,
    modelDisplayName,
    normalizeElementType,
    normalizeStringArray,
    arraysEqualAsSets
  } = deps;

  function buildMetadataTargets({ includeSubmodels = true } = {}) {
    const byId = new Map();
    (state.models || []).forEach((model) => {
      const id = modelStableId(model);
      if (!id) return;
      byId.set(id, {
        id,
        name: String(model?.name || id),
        displayName: modelDisplayName(model),
        type: normalizeElementType(model?.type) || 'model',
        parentId: '',
        source: 'models'
      });
    });
    (state.submodels || []).forEach((submodel) => {
      if (!includeSubmodels) return;
      const id = String(submodel?.id || '').trim();
      if (!id) return;
      const parentId = String(submodel?.parentId || parseSubmodelParentId(id)).trim();
      const rawName = String(submodel?.name || id);
      const displayName = parentId ? `${parentId} / ${rawName}` : rawName;
      byId.set(id, {
        id,
        name: rawName,
        displayName,
        type: 'submodel',
        parentId,
        source: 'submodels'
      });
    });
    return Array.from(byId.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  function getMetadataTargetById(id) {
    const key = String(id || '');
    if (!key) return null;
    return buildMetadataTargets().find((target) => target.id === key) || null;
  }

  function getMetadataTargetNameById(id) {
    const found = getMetadataTargetById(id);
    return found ? found.displayName : String(id || '');
  }

  function setMetadataFocusedTarget(targetId) {
    const id = String(targetId || '').trim();
    if (!id || state.ui.metadataTargetId === id) return;
    state.ui.metadataTargetId = id;
    persist();
  }

  function normalizeMetadataSelectionIds(selectionIds, availableIds = null) {
    const available = availableIds || new Set(buildMetadataTargets().map((target) => String(target.id)));
    const selected = Array.isArray(selectionIds) ? selectionIds : [];
    const out = [];
    for (const raw of selected) {
      const value = String(raw || '').trim();
      if (!value || !available.has(value) || out.includes(value)) continue;
      out.push(value);
    }
    return out;
  }

  function ensureMetadataTargetSelection() {
    const options = buildMetadataTargets({ includeSubmodels: true }).map((target) => target.id).filter(Boolean);
    if (!options.length) {
      state.ui.metadataTargetId = '';
      state.ui.metadataSelectionIds = [];
      return;
    }
    if (!options.includes(state.ui.metadataTargetId)) state.ui.metadataTargetId = options[0];
    const optionSet = new Set(options.map(String));
    state.ui.metadataSelectionIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds, optionSet);
  }

  function resolveAssignmentParentId(assignment) {
    const explicit = String(assignment?.targetParentId || '').trim();
    if (explicit) return explicit;
    const type = normalizeElementType(assignment?.targetType || '');
    if (type === 'submodel') return parseSubmodelParentId(assignment?.targetId);
    const id = String(assignment?.targetId || '');
    if (id.includes('/')) return parseSubmodelParentId(id);
    return '';
  }

  function getLiveModelOrGroupIdSet() {
    return new Set((state.models || []).map(modelStableId).filter(Boolean));
  }

  function getMetadataOrphans() {
    const liveTargetIds = new Set(buildMetadataTargets({ includeSubmodels: true }).map((target) => target.id).filter(Boolean));
    const liveModelOrGroupIds = getLiveModelOrGroupIdSet();
    const ignored = new Set((state.metadata?.ignoredOrphanTargetIds || []).map(String));
    return (state.metadata?.assignments || []).filter((assignment) => {
      const targetId = String(assignment?.targetId || '');
      if (!targetId || ignored.has(targetId)) return false;
      const targetType = normalizeElementType(assignment?.targetType || '');
      const isSubmodel = targetType === 'submodel' || targetId.includes('/');
      if (isSubmodel) {
        const parentId = resolveAssignmentParentId(assignment);
        return !parentId || !liveModelOrGroupIds.has(parentId);
      }
      return !liveTargetIds.has(targetId);
    });
  }

  function saveMetadataAndRender(statusText = '') {
    if (statusText) setStatus('info', statusText);
    saveCurrentProjectSnapshot();
    persist();
    render();
  }

  function getVisualHintDefinitionRecords() {
    return mergeVisualHintDefinitions(state.metadata?.visualHintDefinitions || []);
  }

  function setVisualHintDefinitionRecords(records) {
    state.metadata.visualHintDefinitions = toStoredVisualHintDefinitions(records);
  }

  function ensurePersistedVisualHintDefinitions(hintNames = []) {
    const next = ensureVisualHintDefinitions(getVisualHintDefinitionRecords(), hintNames, { timestamp: new Date().toISOString() });
    setVisualHintDefinitionRecords(next);
  }

  function definePersistedVisualHint(rawName, definition = {}) {
    const next = defineVisualHint(getVisualHintDefinitionRecords(), rawName, {
      ...definition,
      timestamp: definition?.timestamp || new Date().toISOString()
    });
    setVisualHintDefinitionRecords(next);
    invalidatePlanHandoff(`visual hint definition updated: ${String(rawName || '').trim()}`);
    return next.find((row) => row.name === normalizeMetadataTagName(rawName)) || null;
  }

  function normalizeMetadataTagDescription(description) {
    return String(description || '').trim();
  }

  function parseMetadataPreferenceList(raw) {
    return Array.from(new Set(String(raw || '').split(/[,;|]/).map((row) => normalizeMetadataTagName(row)).filter(Boolean)));
  }

  function buildEffectiveMetadataAssignments(assignments = state.metadata?.assignments || [], preferencesByTargetId = state.metadata?.preferencesByTargetId || {}) {
    return buildRuntimeEffectiveMetadataAssignments(assignments, preferencesByTargetId, {
      resolveTarget: (targetId) => getMetadataTargetById(targetId)
    });
  }

  function getMetadataTagRecords() {
    return mergeMetadataTagRecords(state.metadata?.tags || []);
  }

  function setMetadataTagRecords(records) {
    state.metadata.tags = toStoredMetadataTagRecords(records);
  }

  function updateMetadataTagDescription(tagName, description) {
    const name = normalizeMetadataTagName(tagName);
    if (!name || isControlledMetadataTag(name)) return;
    const nextDescription = normalizeMetadataTagDescription(description);
    const records = getMetadataTagRecords();
    const idx = records.findIndex((record) => record.name === name);
    if (idx < 0 || String(records[idx].description || '') === nextDescription) return;
    records[idx] = { ...records[idx], description: nextDescription };
    setMetadataTagRecords(records);
    persist();
  }

  function normalizeMetadataSelectedTags(tags) {
    const known = new Set(getMetadataTagRecords().map((record) => record.name));
    const selected = Array.isArray(tags) ? tags : [];
    const out = [];
    for (const raw of selected) {
      const value = normalizeMetadataTagName(raw);
      if (!value || !known.has(value) || out.includes(value)) continue;
      out.push(value);
    }
    return out;
  }

  function addMetadataTag() {
    const name = normalizeMetadataTagName(state.ui.metadataNewTag);
    const description = normalizeMetadataTagDescription(state.ui.metadataNewTagDescription);
    if (!name) return;
    const records = getMetadataTagRecords();
    if (records.some((record) => record.name === name)) {
      setStatus('warning', `Tag already exists: ${name}`);
      return render();
    }
    records.push({ name, description });
    records.sort((a, b) => a.name.localeCompare(b.name));
    setMetadataTagRecords(records);
    state.ui.metadataSelectedTags = Array.from(new Set([...(state.ui.metadataSelectedTags || []), name]));
    state.ui.metadataNewTag = '';
    state.ui.metadataNewTagDescription = '';
    saveMetadataAndRender(`Added tag: ${name}`);
  }

  function removeMetadataTag(tagName) {
    const name = normalizeMetadataTagName(tagName);
    if (!name) return;
    if (isControlledMetadataTag(name)) {
      setStatus('warning', `Controlled tag cannot be removed: ${name}`);
      return render();
    }
    const records = getMetadataTagRecords().filter((record) => record.name !== name);
    setMetadataTagRecords(records);
    state.metadata.assignments = (state.metadata?.assignments || []).map((a) => ({ ...a, tags: (a.tags || []).filter((t) => t !== name) }));
    state.ui.metadataSelectedTags = (state.ui.metadataSelectedTags || []).filter((t) => t !== name);
    saveMetadataAndRender(`Removed tag: ${name}`);
  }

  function toggleMetadataSelectedTag(tagName) {
    const name = normalizeMetadataTagName(tagName);
    if (!name) return;
    const before = normalizeStringArray(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags));
    const selected = new Set(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags));
    if (selected.has(name)) selected.delete(name); else selected.add(name);
    state.ui.metadataSelectedTags = normalizeMetadataSelectedTags(Array.from(selected));
    const after = normalizeStringArray(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags));
    if (!arraysEqualAsSets(before, after)) invalidatePlanHandoff('selected tags changed');
    persist();
  }

  function clearMetadataSelectedTags() {
    const before = normalizeStringArray(normalizeMetadataSelectedTags(state.ui.metadataSelectedTags));
    state.ui.metadataSelectedTags = [];
    if (before.length) invalidatePlanHandoff('selected tags cleared');
    persist();
    render();
  }

  function parseMetadataFilterTerms(raw) {
    return String(raw || '').toLowerCase().split(/[,;|]/).map((part) => part.trim()).filter(Boolean);
  }

  function matchesMetadataFilterValue(haystack, rawFilter) {
    const terms = parseMetadataFilterTerms(rawFilter);
    if (!terms.length) return true;
    const text = String(haystack || '').toLowerCase();
    const includeTerms = terms.filter((term) => !term.startsWith('!'));
    const excludeTerms = terms.filter((term) => term.startsWith('!')).map((term) => term.slice(1)).filter(Boolean);
    if (excludeTerms.some((term) => text.includes(term))) return false;
    if (!includeTerms.length) return true;
    return includeTerms.some((term) => text.includes(term));
  }

  function setMetadataSelectionIds(selectionIds, { save = true } = {}) {
    const before = normalizeStringArray(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds));
    state.ui.metadataSelectionIds = normalizeMetadataSelectionIds(selectionIds);
    const after = normalizeStringArray(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds));
    if (!arraysEqualAsSets(before, after)) invalidatePlanHandoff('target selection changed');
    if (save) persist();
  }

  function toggleMetadataSelectionId(targetId) {
    const id = String(targetId || '').trim();
    if (!id) return;
    const selected = new Set(normalizeMetadataSelectionIds(state.ui.metadataSelectionIds));
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    setMetadataSelectionIds(Array.from(selected));
  }

  function clearMetadataSelection() {
    setMetadataSelectionIds([]);
    render();
  }

  function selectAllMetadataTargets(targetIds) {
    const ids = Array.isArray(targetIds) ? targetIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
    setMetadataSelectionIds(ids);
    render();
  }

  function upsertMetadataAssignmentTags(targetId, tagsToAdd = [], tagsToRemove = []) {
    const id = String(targetId || '').trim();
    if (!id) return false;
    const target = getMetadataTargetById(id);
    if (!target) return false;
    const addSet = new Set(normalizeMetadataSelectedTags(tagsToAdd));
    const removeSet = new Set(normalizeMetadataSelectedTags(tagsToRemove));
    const assignments = state.metadata?.assignments || [];
    const idx = assignments.findIndex((a) => String(a.targetId) === id);
    const existing = idx >= 0 ? assignments[idx] : null;
    const currentTags = new Set(Array.isArray(existing?.tags) ? existing.tags : []);
    for (const t of addSet) currentTags.add(t);
    for (const t of removeSet) currentTags.delete(t);
    const nextTags = Array.from(currentTags);
    if (!nextTags.length) {
      if (idx >= 0) assignments.splice(idx, 1);
      state.metadata.assignments = [...assignments];
      return true;
    }
    const targetType = target?.type || (id.includes('/') ? 'submodel' : 'model');
    const targetParentId = targetType === 'submodel' ? (target?.parentId || parseSubmodelParentId(id)) : '';
    const targetParentName = targetParentId ? getMetadataTargetNameById(targetParentId) : '';
    const next = {
      targetId: id,
      targetName: target?.displayName || getMetadataTargetNameById(id),
      targetType,
      targetParentId,
      targetParentName,
      tags: nextTags
    };
    if (idx >= 0) assignments[idx] = next; else assignments.push(next);
    state.metadata.assignments = [...assignments];
    state.metadata.ignoredOrphanTargetIds = (state.metadata?.ignoredOrphanTargetIds || []).filter((orphanId) => String(orphanId) !== id);
    return true;
  }

  function updateMetadataTargetRolePreference(targetId, rolePreference = '') {
    const id = String(targetId || '').trim();
    if (!id) return false;
    const target = getMetadataTargetById(id);
    if (!target) return false;
    const value = String(rolePreference || '').trim().toLowerCase();
    const allowed = new Set(['', 'focal', 'support', 'background', 'frame', 'accent']);
    if (!allowed.has(value)) return false;
    const current = state.metadata?.preferencesByTargetId && typeof state.metadata.preferencesByTargetId === 'object' ? state.metadata.preferencesByTargetId : {};
    const previous = current[id] && typeof current[id] === 'object' ? current[id] : {};
    if (String(previous.rolePreference || '') === value) return true;
    const next = { ...current };
    if (!value) {
      const reduced = { ...previous };
      delete reduced.rolePreference;
      if (Object.keys(reduced).length) next[id] = reduced; else delete next[id];
    } else {
      next[id] = { ...previous, rolePreference: value };
    }
    state.metadata.preferencesByTargetId = next;
    invalidatePlanHandoff('metadata role preference changed');
    saveMetadataAndRender(`Updated role preference for ${target.displayName || id}.`);
    return true;
  }

  function updateMetadataTargetSemanticHints(targetId, rawValue = '') {
    const id = String(targetId || '').trim();
    if (!id) return false;
    const target = getMetadataTargetById(id);
    if (!target) return false;
    const nextValues = parseMetadataPreferenceList(rawValue);
    const current = state.metadata?.preferencesByTargetId && typeof state.metadata.preferencesByTargetId === 'object' ? state.metadata.preferencesByTargetId : {};
    const previous = current[id] && typeof current[id] === 'object' ? current[id] : {};
    const previousValues = Array.isArray(previous.semanticHints) ? previous.semanticHints : [];
    if (JSON.stringify(previousValues) === JSON.stringify(nextValues)) return true;
    const next = { ...current };
    const reduced = { ...previous };
    if (nextValues.length) reduced.semanticHints = nextValues; else delete reduced.semanticHints;
    if (Object.keys(reduced).length) next[id] = reduced; else delete next[id];
    state.metadata.preferencesByTargetId = next;
    ensurePersistedVisualHintDefinitions(nextValues);
    invalidatePlanHandoff('metadata semantic hints changed');
    saveMetadataAndRender(`Updated semantic hints for ${target.displayName || id}.`);
    return true;
  }

  function addMetadataTargetSemanticHint(targetId, value = '') {
    const id = String(targetId || '').trim();
    if (!id) return false;
    const current = state.metadata?.preferencesByTargetId?.[id]?.semanticHints || [];
    const next = Array.from(new Set([...current, ...parseMetadataPreferenceList(value)]));
    return updateMetadataTargetSemanticHints(id, next.join(', '));
  }

  function removeMetadataTargetSemanticHint(targetId, value = '') {
    const id = String(targetId || '').trim();
    if (!id) return false;
    const current = state.metadata?.preferencesByTargetId?.[id]?.semanticHints || [];
    const next = current.filter((row) => String(row || '').trim().toLowerCase() !== String(value || '').trim().toLowerCase());
    return updateMetadataTargetSemanticHints(id, next.join(', '));
  }

  function updateMetadataTargetSubmodelHints(targetId, rawValue = '') {
    const id = String(targetId || '').trim();
    if (!id) return false;
    const target = getMetadataTargetById(id);
    if (!target) return false;
    const nextValues = parseMetadataPreferenceList(rawValue);
    const current = state.metadata?.preferencesByTargetId && typeof state.metadata.preferencesByTargetId === 'object' ? state.metadata.preferencesByTargetId : {};
    const previous = current[id] && typeof current[id] === 'object' ? current[id] : {};
    const previousValues = Array.isArray(previous.submodelHints) ? previous.submodelHints : [];
    if (JSON.stringify(previousValues) === JSON.stringify(nextValues)) return true;
    const next = { ...current };
    const reduced = { ...previous };
    if (nextValues.length) reduced.submodelHints = nextValues; else delete reduced.submodelHints;
    if (Object.keys(reduced).length) next[id] = reduced; else delete next[id];
    state.metadata.preferencesByTargetId = next;
    invalidatePlanHandoff('metadata submodel hints changed');
    saveMetadataAndRender(`Updated submodel hints for ${target.displayName || id}.`);
    return true;
  }

  function addMetadataTargetSubmodelHint(targetId, value = '') {
    const id = String(targetId || '').trim();
    if (!id) return false;
    const current = state.metadata?.preferencesByTargetId?.[id]?.submodelHints || [];
    const next = Array.from(new Set([...current, ...parseMetadataPreferenceList(value)]));
    return updateMetadataTargetSubmodelHints(id, next.join(', '));
  }

  function removeMetadataTargetSubmodelHint(targetId, value = '') {
    const id = String(targetId || '').trim();
    if (!id) return false;
    const current = state.metadata?.preferencesByTargetId?.[id]?.submodelHints || [];
    const next = current.filter((row) => String(row || '').trim().toLowerCase() !== String(value || '').trim().toLowerCase());
    return updateMetadataTargetSubmodelHints(id, next.join(', '));
  }

  function updateMetadataTargetEffectAvoidances(targetId, rawValue = '') {
    const id = String(targetId || '').trim();
    if (!id) return false;
    const target = getMetadataTargetById(id);
    if (!target) return false;
    const nextValues = parseMetadataPreferenceList(rawValue);
    const current = state.metadata?.preferencesByTargetId && typeof state.metadata.preferencesByTargetId === 'object' ? state.metadata.preferencesByTargetId : {};
    const previous = current[id] && typeof current[id] === 'object' ? current[id] : {};
    const previousValues = Array.isArray(previous.effectAvoidances) ? previous.effectAvoidances : [];
    if (JSON.stringify(previousValues) === JSON.stringify(nextValues)) return true;
    const next = { ...current };
    const reduced = { ...previous };
    if (nextValues.length) reduced.effectAvoidances = nextValues; else delete reduced.effectAvoidances;
    if (Object.keys(reduced).length) next[id] = reduced; else delete next[id];
    state.metadata.preferencesByTargetId = next;
    invalidatePlanHandoff('metadata effect avoidances changed');
    saveMetadataAndRender(`Updated effect avoidances for ${target.displayName || id}.`);
    return true;
  }

  function addMetadataTargetEffectAvoidance(targetId, value = '') {
    const id = String(targetId || '').trim();
    if (!id) return false;
    const current = state.metadata?.preferencesByTargetId?.[id]?.effectAvoidances || [];
    const next = Array.from(new Set([...current, ...parseMetadataPreferenceList(value)]));
    return updateMetadataTargetEffectAvoidances(id, next.join(', '));
  }

  function removeMetadataTargetEffectAvoidance(targetId, value = '') {
    const id = String(targetId || '').trim();
    if (!id) return false;
    const current = state.metadata?.preferencesByTargetId?.[id]?.effectAvoidances || [];
    const next = current.filter((row) => String(row || '').trim().toLowerCase() !== String(value || '').trim().toLowerCase());
    return updateMetadataTargetEffectAvoidances(id, next.join(', '));
  }

  function bulkSetMetadataRolePreference(rolePreference = '') {
    const selectedIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds);
    if (!selectedIds.length) {
      setStatus('warning', 'Select one or more layout targets first.');
      return render();
    }
    let touched = 0;
    for (const id of selectedIds) if (updateMetadataTargetRolePreference(id, rolePreference)) touched += 1;
    saveMetadataAndRender(`Updated role preference for ${touched} target${touched === 1 ? '' : 's'}.`);
  }

  function bulkAddMetadataSemanticHint(value = '') {
    const selectedIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds);
    const nextValue = String(value || '').trim();
    if (!selectedIds.length) {
      setStatus('warning', 'Select one or more layout targets first.');
      return render();
    }
    if (!nextValue) {
      setStatus('warning', 'Choose or enter a visual hint first.');
      return render();
    }
    let touched = 0;
    for (const id of selectedIds) if (addMetadataTargetSemanticHint(id, nextValue)) touched += 1;
    saveMetadataAndRender(`Added visual hint to ${touched} target${touched === 1 ? '' : 's'}.`);
  }

  function bulkAddMetadataEffectAvoidance(value = '') {
    const selectedIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds);
    const nextValue = String(value || '').trim();
    if (!selectedIds.length) {
      setStatus('warning', 'Select one or more layout targets first.');
      return render();
    }
    if (!nextValue) {
      setStatus('warning', 'Choose or enter an effect avoidance first.');
      return render();
    }
    let touched = 0;
    for (const id of selectedIds) if (addMetadataTargetEffectAvoidance(id, nextValue)) touched += 1;
    saveMetadataAndRender(`Added effect avoidance to ${touched} target${touched === 1 ? '' : 's'}.`);
  }

  function applyTagsToSelectedMetadataTargets() {
    const selectedIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds);
    if (!selectedIds.length) {
      setStatus('warning', 'Select one or more metadata targets first.');
      return render();
    }
    const opTags = normalizeMetadataSelectedTags(state.ui.metadataSelectedTags);
    if (!opTags.length) {
      setStatus('warning', 'Select one or more tags to apply.');
      return render();
    }
    let touched = 0;
    for (const id of selectedIds) if (upsertMetadataAssignmentTags(id, opTags, [])) touched += 1;
    saveMetadataAndRender(`Applied ${opTags.length} tag${opTags.length === 1 ? '' : 's'} to ${touched} target${touched === 1 ? '' : 's'}.`);
  }

  function removeTagsFromSelectedMetadataTargets() {
    const selectedIds = normalizeMetadataSelectionIds(state.ui.metadataSelectionIds);
    if (!selectedIds.length) {
      setStatus('warning', 'Select one or more metadata targets first.');
      return render();
    }
    const opTags = normalizeMetadataSelectedTags(state.ui.metadataSelectedTags);
    if (!opTags.length) {
      setStatus('warning', 'Select one or more tags to remove.');
      return render();
    }
    let touched = 0;
    for (const id of selectedIds) if (upsertMetadataAssignmentTags(id, [], opTags)) touched += 1;
    saveMetadataAndRender(`Removed ${opTags.length} tag${opTags.length === 1 ? '' : 's'} from ${touched} target${touched === 1 ? '' : 's'}.`);
  }

  function removeMetadataAssignment(targetId) {
    state.metadata.assignments = (state.metadata?.assignments || []).filter((a) => String(a.targetId) !== String(targetId));
    state.metadata.ignoredOrphanTargetIds = (state.metadata?.ignoredOrphanTargetIds || []).filter((id) => String(id) !== String(targetId));
    saveMetadataAndRender('Removed metadata assignment.');
  }

  function ignoreMetadataOrphan(targetId) {
    const current = new Set((state.metadata?.ignoredOrphanTargetIds || []).map(String));
    current.add(String(targetId));
    state.metadata.ignoredOrphanTargetIds = [...current];
    saveMetadataAndRender('Ignored orphan metadata target.');
  }

  function remapMetadataOrphan(fromTargetId, toTargetId) {
    const to = String(toTargetId || '').trim().toLowerCase();
    if (!to) {
      setStatus('warning', 'Select a replacement target for remap.');
      return render();
    }
    const target = getMetadataTargetById(to);
    const assignments = state.metadata?.assignments || [];
    const idx = assignments.findIndex((a) => String(a.targetId) === String(fromTargetId));
    if (idx < 0) return;
    const existingTags = Array.isArray(assignments[idx]?.tags) ? assignments[idx].tags : [];
    upsertMetadataAssignmentTags(to, existingTags, []);
    state.metadata.assignments = state.metadata.assignments.filter((a) => String(a.targetId) !== String(fromTargetId));
    state.metadata.ignoredOrphanTargetIds = (state.metadata?.ignoredOrphanTargetIds || []).filter((id) => String(id) !== String(fromTargetId));
    saveMetadataAndRender(`Remapped metadata from ${String(fromTargetId)} to ${target?.displayName || to}.`);
  }

  return {
    buildMetadataTargets,
    getMetadataTargetById,
    getMetadataTargetNameById,
    setMetadataFocusedTarget,
    ensureMetadataTargetSelection,
    getMetadataOrphans,
    getVisualHintDefinitionRecords,
    setVisualHintDefinitionRecords,
    ensurePersistedVisualHintDefinitions,
    definePersistedVisualHint,
    parseMetadataPreferenceList,
    buildEffectiveMetadataAssignments,
    getMetadataTagRecords,
    setMetadataTagRecords,
    updateMetadataTagDescription,
    addMetadataTag,
    removeMetadataTag,
    normalizeMetadataSelectedTags,
    normalizeMetadataSelectionIds,
    parseMetadataFilterTerms,
    matchesMetadataFilterValue,
    toggleMetadataSelectedTag,
    clearMetadataSelectedTags,
    setMetadataSelectionIds,
    toggleMetadataSelectionId,
    clearMetadataSelection,
    selectAllMetadataTargets,
    upsertMetadataAssignmentTags,
    updateMetadataTargetRolePreference,
    updateMetadataTargetSemanticHints,
    addMetadataTargetSemanticHint,
    removeMetadataTargetSemanticHint,
    updateMetadataTargetSubmodelHints,
    addMetadataTargetSubmodelHint,
    removeMetadataTargetSubmodelHint,
    updateMetadataTargetEffectAvoidances,
    addMetadataTargetEffectAvoidance,
    removeMetadataTargetEffectAvoidance,
    bulkSetMetadataRolePreference,
    bulkAddMetadataSemanticHint,
    bulkAddMetadataEffectAvoidance,
    applyTagsToSelectedMetadataTargets,
    removeTagsFromSelectedMetadataTargets,
    removeMetadataAssignment,
    ignoreMetadataOrphan,
    remapMetadataOrphan
  };
}
