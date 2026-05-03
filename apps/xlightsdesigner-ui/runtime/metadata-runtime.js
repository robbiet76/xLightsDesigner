import { buildNormalizedTargetMetadataRecords as buildDefaultNormalizedTargetMetadataRecords } from './target-metadata-runtime.js';
import { buildCustomModelStructureCatalog } from './custom-model-catalog.js';

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
    arraysEqualAsSets,
    buildNormalizedTargetMetadataRecords = buildDefaultNormalizedTargetMetadataRecords,
    getShowFolder = () => String(state?.showFolder || '').trim(),
    getProjectFilePath = () => String(state?.projectFilePath || '').trim(),
    persistDisplayRefreshArtifacts = () => ({ ok: false, skipped: true })
  } = deps;

  function str(value = '') {
    return String(value || '').trim();
  }

  function metadataObject() {
    if (!state.metadata || typeof state.metadata !== 'object' || Array.isArray(state.metadata)) {
      state.metadata = {};
    }
    if (!Array.isArray(state.metadata.assignments)) state.metadata.assignments = [];
    if (!state.metadata.preferencesByTargetId || typeof state.metadata.preferencesByTargetId !== 'object' || Array.isArray(state.metadata.preferencesByTargetId)) {
      state.metadata.preferencesByTargetId = {};
    }
    if (!Array.isArray(state.metadata.ignoredOrphanTargetIds)) state.metadata.ignoredOrphanTargetIds = [];
    if (!state.metadata.displayBinding || typeof state.metadata.displayBinding !== 'object' || Array.isArray(state.metadata.displayBinding)) {
      state.metadata.displayBinding = {};
    }
    return state.metadata;
  }

  function stableHash(value = '') {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function buildStructuralTargetRecords() {
    try {
      return buildNormalizedTargetMetadataRecords({
        sceneGraph: state.sceneGraph || {},
        metadataAssignments: [],
        metadataPreferencesByTargetId: {}
      });
    } catch {
      return [];
    }
  }

  function buildStructuralTargetIndex() {
    const records = buildStructuralTargetRecords();
    return new Map(records.map((row) => [String(row?.targetId || ''), row]).filter(([id]) => id));
  }

  function customStructureFingerprintRows() {
    const rows = Array.isArray(state.sceneGraph?.customModelCatalog?.models)
      ? state.sceneGraph.customModelCatalog.models
      : [];
    return rows.map((row) => String(row?.fingerprint || [
      String(row?.profile || ''),
      String(row?.nodeCount || ''),
      String(row?.construction?.dimensions?.width || ''),
      String(row?.construction?.dimensions?.height || ''),
      String(row?.construction?.dimensions?.layers || ''),
      Array.isArray(row?.submodels?.names) ? row.submodels.names.join(',') : ''
    ].join(':')));
  }

  function refreshCustomModelStructureCatalog() {
    if (!state.sceneGraph || typeof state.sceneGraph !== 'object' || Array.isArray(state.sceneGraph)) return null;
    const catalog = buildCustomModelStructureCatalog({
      sceneGraph: state.sceneGraph,
      source: {
        showFolder: String(getShowFolder() || ''),
        sceneGraphSource: String(state.health?.sceneGraphSource || '')
      }
    });
    state.sceneGraph.customModelCatalog = catalog;
    return catalog;
  }

  function buildTargetMetadataRefreshArtifact() {
    const records = buildNormalizedTargetMetadataRecords({
      sceneGraph: state.sceneGraph || {},
      metadataAssignments: metadataObject().assignments || [],
      metadataPreferencesByTargetId: metadataObject().preferencesByTargetId || {}
    });
    return {
      artifactType: 'target_metadata_index_v1',
      artifactVersion: '1.0',
      createdAt: new Date().toISOString(),
      source: {
        showFolder: String(getShowFolder() || ''),
        sceneGraphSource: String(state.health?.sceneGraphSource || '')
      },
      summary: {
        targetCount: records.length,
        modelCount: records.filter((row) => row?.targetKind === 'model').length,
        groupCount: records.filter((row) => row?.targetKind === 'group').length,
        submodelCount: records.filter((row) => row?.targetKind === 'submodel').length,
        targetsWithNodeLayout: records.filter((row) => row?.structure?.nodeLayoutMetadata).length,
        customModelCount: records.filter((row) => row?.structure?.customStructure).length
      },
      records
    };
  }

  function persistCurrentDisplayRefreshArtifacts({ targetMetadata = null, reconciliation = null } = {}) {
    const projectFilePath = String(getProjectFilePath() || '').trim();
    if (!projectFilePath) return { ok: false, skipped: true, reason: 'missing projectFilePath' };
    return persistDisplayRefreshArtifacts({
      projectFilePath,
      targetMetadata,
      reconciliation
    });
  }

  function buildDisplayMetadataLayoutFingerprint(targets = buildMetadataTargets({ includeSubmodels: true })) {
    const targetRows = targets.map((target) => [
      String(target?.type || ''),
      String(target?.parentFingerprint || target?.parentId || ''),
      String(target?.fingerprint || target?.id || ''),
      target?.fingerprint ? '' : String(target?.name || '')
    ].join(':'));
    const payload = [...targetRows, ...customStructureFingerprintRows()].sort().join('|');
    return payload ? stableHash(payload) : '';
  }

  function bindingLayoutFingerprint(binding = {}) {
    return String(binding?.xlightsLayoutFingerprint || binding?.layoutFingerprint || '');
  }

  function currentDisplayMetadataBindingRef(target = null, existingBinding = null, previousTarget = null) {
    const binding = metadataObject().displayBinding || {};
    const previousTargetId = str(previousTarget?.id || '');
    const previousTargetName = str(previousTarget?.name || previousTarget?.displayName || '');
    const layoutFingerprint = bindingLayoutFingerprint(binding) || buildDisplayMetadataLayoutFingerprint() || '';
    return {
      showFolder: String(binding.showFolder || getShowFolder() || ''),
      xlightsLayoutFingerprint: layoutFingerprint,
      layoutFingerprint,
      targetFingerprint: String(target?.fingerprint || existingBinding?.targetFingerprint || ''),
      targetFingerprintVersion: String(target?.fingerprintVersion || existingBinding?.targetFingerprintVersion || ''),
      previousTargetId: previousTargetId && previousTargetId !== str(target?.id)
        ? previousTargetId
        : String(existingBinding?.previousTargetId || ''),
      previousTargetName: previousTargetId && previousTargetId !== str(target?.id)
        ? previousTargetName
        : String(existingBinding?.previousTargetName || ''),
      previousTargetFingerprint: existingBinding?.targetFingerprint && target?.fingerprint && existingBinding.targetFingerprint !== target.fingerprint
        ? String(existingBinding.targetFingerprint)
        : String(existingBinding?.previousTargetFingerprint || ''),
      boundAt: String(existingBinding?.boundAt || new Date().toISOString()),
      lastBoundAt: new Date().toISOString()
    };
  }

  function hasMetadataPreferencePayload(value = {}) {
    return Boolean(
      String(value?.rolePreference || '').trim()
      || (Array.isArray(value?.semanticHints) && value.semanticHints.length)
      || (Array.isArray(value?.submodelHints) && value.submodelHints.length)
      || (Array.isArray(value?.effectAvoidances) && value.effectAvoidances.length)
    );
  }

  function buildMetadataTargets({ includeSubmodels = true } = {}) {
    const byId = new Map();
    const structuralIndex = buildStructuralTargetIndex();
    (state.models || []).forEach((model) => {
      const id = modelStableId(model);
      if (!id) return;
      const structural = structuralIndex.get(id);
      byId.set(id, {
        id,
        name: String(model?.name || id),
        displayName: modelDisplayName(model),
        type: normalizeElementType(model?.type) || 'model',
        parentId: '',
        fingerprint: String(structural?.identity?.fingerprint || model?.identity?.fingerprint || model?.fingerprint || ''),
        fingerprintVersion: String(structural?.identity?.fingerprintVersion || model?.identity?.fingerprintVersion || model?.fingerprintVersion || ''),
        source: 'models'
      });
    });
    (state.submodels || []).forEach((submodel) => {
      if (!includeSubmodels) return;
      const id = String(submodel?.id || '').trim();
      if (!id) return;
      const structural = structuralIndex.get(id);
      const parentId = String(
        structural?.identity?.parentId
        || structural?.structure?.submodelMetadata?.parentId
        || submodel?.parentId
        || parseSubmodelParentId(id)
      ).trim();
      const rawName = String(submodel?.name || id);
      const displayName = String(structural?.identity?.displayName || (parentId ? `${parentId} / ${rawName}` : rawName));
      const parentStructural = structuralIndex.get(parentId);
      byId.set(id, {
        id,
        name: rawName,
        displayName,
        type: 'submodel',
        parentId,
        fingerprint: String(structural?.identity?.fingerprint || submodel?.identity?.fingerprint || submodel?.fingerprint || ''),
        fingerprintVersion: String(structural?.identity?.fingerprintVersion || submodel?.identity?.fingerprintVersion || submodel?.fingerprintVersion || ''),
        parentFingerprint: String(parentStructural?.identity?.fingerprint || ''),
        source: 'submodels'
      });
    });
    return Array.from(byId.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  function buildLiveFingerprintIndex(targets = buildMetadataTargets({ includeSubmodels: true })) {
    const byFingerprint = new Map();
    const collisions = new Set();
    for (const target of targets) {
      const fingerprint = String(target?.fingerprint || '').trim();
      if (!fingerprint) continue;
      if (byFingerprint.has(fingerprint)) {
        collisions.add(fingerprint);
        continue;
      }
      byFingerprint.set(fingerprint, target);
    }
    for (const fingerprint of collisions) byFingerprint.delete(fingerprint);
    return byFingerprint;
  }

  function buildLiveFingerprintCandidateIndex(targets = buildMetadataTargets({ includeSubmodels: true })) {
    const byFingerprint = new Map();
    for (const target of targets) {
      const fingerprint = str(target?.fingerprint);
      if (!fingerprint) continue;
      const rows = byFingerprint.get(fingerprint) || [];
      rows.push(target);
      byFingerprint.set(fingerprint, rows);
    }
    return byFingerprint;
  }

  function normalizedIdentityValues(values = []) {
    return new Set(values.map((value) => str(value).toLowerCase()).filter(Boolean));
  }

  function resolveSafeFingerprintTarget({ fingerprint = '', currentId = '', targetName = '', existingBinding = {}, candidateIndex = new Map() } = {}) {
    const candidates = candidateIndex.get(str(fingerprint)) || [];
    if (candidates.length === 1) return candidates[0];
    if (candidates.length < 2) return null;
    const identityValues = normalizedIdentityValues([
      currentId,
      targetName,
      existingBinding?.previousTargetId,
      existingBinding?.previousTargetName
    ]);
    const exactMatches = candidates.filter((target) => {
      const values = normalizedIdentityValues([target?.id, target?.name, target?.displayName]);
      return Array.from(values).some((value) => identityValues.has(value));
    });
    return exactMatches.length === 1 ? exactMatches[0] : null;
  }

  function displayBindingForTarget(target = null, existingBinding = null, previousTarget = null) {
    return currentDisplayMetadataBindingRef(target, existingBinding, previousTarget);
  }

  function retargetAssignment(assignment = {}, target = null) {
    if (!target) return assignment;
    const previousTarget = {
      id: str(assignment?.targetId),
      name: str(assignment?.targetName)
    };
    const changedTarget = previousTarget.id && previousTarget.id !== str(target.id);
    const targetType = target?.type || (String(target.id || '').includes('/') ? 'submodel' : 'model');
    const targetParentId = targetType === 'submodel' ? (target?.parentId || parseSubmodelParentId(target.id)) : '';
    return {
      ...assignment,
      targetId: target.id,
      targetName: target?.displayName || getMetadataTargetNameById(target.id),
      targetType,
      targetParentId,
      targetParentName: targetParentId ? getMetadataTargetNameById(targetParentId) : '',
      displayBinding: displayBindingForTarget(target, assignment?.displayBinding, changedTarget ? previousTarget : null)
    };
  }

  function mergePreferenceRecords(existing = {}, incoming = {}) {
    const merged = { ...existing, ...incoming };
    for (const key of ['semanticHints', 'submodelHints', 'effectAvoidances']) {
      const values = normalizeStringArray([...(existing?.[key] || []), ...(incoming?.[key] || [])]);
      if (values.length) merged[key] = values; else delete merged[key];
    }
    if (!String(merged.rolePreference || '').trim()) delete merged.rolePreference;
    return merged;
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

  function markDisplayMetadataPendingReconciliation(reason = 'display changed') {
    const metadata = metadataObject();
    const now = new Date().toISOString();
    metadata.displayBinding = {
      ...metadata.displayBinding,
      showFolder: String(getShowFolder() || ''),
      status: 'pending',
      pendingReason: String(reason || 'display changed'),
      xlightsLayoutFingerprint: bindingLayoutFingerprint(metadata.displayBinding),
      layoutFingerprint: bindingLayoutFingerprint(metadata.displayBinding),
      lastChangedAt: now
    };
    state.ui.metadataTargetId = '';
    state.ui.metadataSelectionIds = [];
    invalidatePlanHandoff(`display metadata pending reconciliation: ${String(reason || 'display changed')}`);
  }

  function reconcileDisplayMetadataForSceneGraphChange({ reason = 'scene graph refreshed' } = {}) {
    const metadata = metadataObject();
    refreshCustomModelStructureCatalog();
    const targets = buildMetadataTargets({ includeSubmodels: true });
    const liveIds = new Set(targets.map((target) => String(target.id || '')).filter(Boolean));
    const liveById = new Map(targets.map((target) => [String(target.id || ''), target]).filter(([id]) => id));
    const liveByFingerprint = buildLiveFingerprintIndex(targets);
    const liveFingerprintCandidates = buildLiveFingerprintCandidateIndex(targets);
    const ignored = new Set((metadata.ignoredOrphanTargetIds || []).map(String));
    const assignments = Array.isArray(metadata.assignments) ? metadata.assignments : [];
    const remappedAssignments = assignments.map((assignment) => {
      const currentId = String(assignment?.targetId || '');
      const liveTarget = liveById.get(currentId);
      if (liveTarget) return retargetAssignment(assignment, liveTarget);
      const fingerprint = String(assignment?.displayBinding?.targetFingerprint || '').trim();
      const fingerprintTarget = fingerprint
        ? liveByFingerprint.get(fingerprint) || resolveSafeFingerprintTarget({
            fingerprint,
            currentId,
            targetName: assignment?.targetName,
            existingBinding: assignment?.displayBinding,
            candidateIndex: liveFingerprintCandidates
          })
        : null;
      return fingerprintTarget ? retargetAssignment(assignment, fingerprintTarget) : assignment;
    });
    metadata.assignments = remappedAssignments;
    const nextPreferencesByTargetId = {};
    for (const [targetId, preference] of Object.entries(metadata.preferencesByTargetId || {})) {
      const currentId = String(targetId || '');
      const liveTarget = liveById.get(currentId);
      const fingerprint = String(preference?.displayBinding?.targetFingerprint || '').trim();
      const fingerprintTarget = !liveTarget && fingerprint
        ? liveByFingerprint.get(fingerprint) || resolveSafeFingerprintTarget({
            fingerprint,
            currentId,
            targetName: currentId,
            existingBinding: preference?.displayBinding,
            candidateIndex: liveFingerprintCandidates
          })
        : null;
      const target = liveTarget || fingerprintTarget || null;
      const nextId = target?.id || currentId;
      const changedTarget = Boolean(target && currentId && currentId !== target.id);
      const nextPreference = target
        ? {
            ...preference,
            displayBinding: displayBindingForTarget(
              target,
              preference?.displayBinding,
              changedTarget ? { id: currentId, name: currentId } : null
            )
          }
        : preference;
      nextPreferencesByTargetId[nextId] = mergePreferenceRecords(nextPreferencesByTargetId[nextId] || {}, nextPreference);
    }
    metadata.preferencesByTargetId = nextPreferencesByTargetId;
    const preferenceIds = Object.keys(metadata.preferencesByTargetId || {}).map(String).filter(Boolean);
    const assignmentIds = remappedAssignments.map((row) => String(row?.targetId || '')).filter(Boolean);
    const orphanTargetIds = Array.from(new Set([
      ...assignmentIds.filter((id) => !liveIds.has(id) && !ignored.has(id)),
      ...preferenceIds.filter((id) => !liveIds.has(id) && !ignored.has(id))
    ])).sort((a, b) => a.localeCompare(b));
    const activeAssignmentCount = assignmentIds.filter((id) => liveIds.has(id)).length;
    const activePreferenceCount = preferenceIds.filter((id) => liveIds.has(id)).length;
    const previousFingerprint = bindingLayoutFingerprint(metadata.displayBinding);
    const layoutFingerprint = buildDisplayMetadataLayoutFingerprint(targets);
    const now = new Date().toISOString();

    metadata.displayBinding = {
      showFolder: String(getShowFolder() || ''),
      xlightsLayoutFingerprint: layoutFingerprint,
      layoutFingerprint,
      previousXlightsLayoutFingerprint: previousFingerprint && previousFingerprint !== layoutFingerprint ? previousFingerprint : '',
      previousLayoutFingerprint: previousFingerprint && previousFingerprint !== layoutFingerprint ? previousFingerprint : '',
      status: 'reconciled',
      pendingReason: '',
      reconciledReason: String(reason || 'scene graph refreshed'),
      lastReconciledAt: now,
      lastChangedAt: String(metadata.displayBinding?.lastChangedAt || ''),
      summary: {
        targetCount: targets.length,
        activeAssignmentCount,
        activePreferenceCount,
        orphanTargetCount: orphanTargetIds.length,
        ignoredOrphanTargetCount: ignored.size,
        layoutChanged: Boolean(previousFingerprint && previousFingerprint !== layoutFingerprint)
      },
      orphanTargetIds
    };

    const targetMetadata = buildTargetMetadataRefreshArtifact();
    persistCurrentDisplayRefreshArtifacts({
      targetMetadata,
      reconciliation: metadata.displayBinding
    });

    ensureMetadataTargetSelection();
    if (orphanTargetIds.length) {
      setStatus('warning', `${orphanTargetIds.length} display metadata target${orphanTargetIds.length === 1 ? '' : 's'} need remapping after display refresh.`);
    }
    invalidatePlanHandoff('display metadata reconciled against refreshed display');
    return metadata.displayBinding;
  }

  function resolveAssignmentParentId(assignment) {
    const explicit = String(assignment?.targetParentId || '').trim();
    if (explicit) return explicit;
    const target = getMetadataTargetById(assignment?.targetId);
    if (target?.parentId) return target.parentId;
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
    const effective = buildRuntimeEffectiveMetadataAssignments(assignments, preferencesByTargetId, {
      resolveTarget: (targetId) => getMetadataTargetById(targetId)
    });
    return effective.filter((row) => getMetadataTargetById(row?.targetId));
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
      tags: nextTags,
      displayBinding: displayBindingForTarget(target, existing?.displayBinding)
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
      if (hasMetadataPreferencePayload(reduced)) next[id] = reduced; else delete next[id];
    } else {
      next[id] = {
        ...previous,
        rolePreference: value,
        displayBinding: displayBindingForTarget(target, previous.displayBinding)
      };
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
    if (Object.keys(reduced).length) reduced.displayBinding = displayBindingForTarget(target, reduced.displayBinding);
    if (hasMetadataPreferencePayload(reduced)) next[id] = reduced; else delete next[id];
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
    if (Object.keys(reduced).length) reduced.displayBinding = displayBindingForTarget(target, reduced.displayBinding);
    if (hasMetadataPreferencePayload(reduced)) next[id] = reduced; else delete next[id];
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
    if (Object.keys(reduced).length) reduced.displayBinding = displayBindingForTarget(target, reduced.displayBinding);
    if (hasMetadataPreferencePayload(reduced)) next[id] = reduced; else delete next[id];
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
      setStatus('warning', 'Select one or more display targets first.');
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
      setStatus('warning', 'Select one or more display targets first.');
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
      setStatus('warning', 'Select one or more display targets first.');
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
    const to = String(toTargetId || '').trim();
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
    markDisplayMetadataPendingReconciliation,
    reconcileDisplayMetadataForSceneGraphChange,
    buildDisplayMetadataLayoutFingerprint,
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
