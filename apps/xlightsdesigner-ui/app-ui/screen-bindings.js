export function bindScreenEvents({
  app,
  state,
  persist,
  render,
  setStatus,
  saveCurrentProjectSnapshot,
  setAudioPathWithAgentPolicy,
  onSaveProjectSettings,
  onOpenSelectedProject,
  onCreateNewProject,
  onSaveProjectAs,
  onResetProjectWorkspace,
  onBrowseProjectMetadataRoot,
  onOpenSelectedSequence,
  onNewSequence,
  onSaveSequenceCurrent,
  onSaveSequenceAs,
  onSelectCatalogSequence,
  onBrowseShowFolder,
  onBrowseMediaFolder,
  onRefreshMediaCatalog,
  onNewSession,
  onReferenceMediaSelected,
  addPaletteSwatch,
  onRunCreativeAnalysis,
  onAnalyzeAudio,
  onRegenerateCreativeBrief,
  onAcceptCreativeBrief,
  onEditBriefDirection,
  onRemoveReferenceMedia,
  onPreviewReferenceMedia,
  onToggleReferenceEligible,
  removePaletteSwatch,
  onRefreshModels,
  selectAllMetadataTargets,
  clearMetadataSelection,
  toggleMetadataSelectionId,
  removeMetadataAssignment,
  setMetadataFocusedTarget,
  updateMetadataTargetRolePreference,
  updateMetadataTargetSemanticHints,
  updateMetadataTargetSubmodelHints,
  updateMetadataTargetEffectAvoidances,
  addMetadataTargetSemanticHint,
  removeMetadataTargetSemanticHint,
  addMetadataTargetSubmodelHint,
  removeMetadataTargetSubmodelHint,
  addMetadataTargetEffectAvoidance,
  removeMetadataTargetEffectAvoidance,
  bulkSetMetadataRolePreference,
  bulkAddMetadataSemanticHint,
  bulkAddMetadataEffectAvoidance,
  ignoreMetadataOrphan,
  remapMetadataOrphan,
  onUseRecent,
  onRefresh,
  onRegenerate,
  onCancelDraft,
  onRefreshAndRegenerate,
  onRebaseDraft,
  setSectionFilter,
  setDesignTab,
  onInspectDesignConcept,
  onReviseDesignConcept,
  onRemoveDesignConcept,
  onRemoveSelectedProposed,
  onRemoveAllProposed,
  toggleProposedSelection,
  toggleProposedSelectionGroup,
  removeProposedLine,
  updateProposedLine,
  onCancelJob,
  insertModelIntoDraft,
  onRollbackToVersion,
  onCompareVersion,
  onReapplyVariant,
  onSelectHistoryEntry,
  onInspectArtifact,
  onCloseArtifactDetail,
  onAcceptTimingTrackReview
} = {}) {
  const saveProjectBtn = app.querySelector("#save-project");
  if (saveProjectBtn) saveProjectBtn.addEventListener("click", onSaveProjectSettings);

  const openSelectedProjectBtn = app.querySelector("#open-selected-project");
  if (openSelectedProjectBtn) openSelectedProjectBtn.addEventListener("click", onOpenSelectedProject);

  const newProjectBtn = app.querySelector("#new-project");
  if (newProjectBtn) newProjectBtn.addEventListener("click", onCreateNewProject);

  const saveProjectAsBtn = app.querySelector("#save-project-as");
  if (saveProjectAsBtn) saveProjectAsBtn.addEventListener("click", onSaveProjectAs);

  const resetProjectBtn = app.querySelector("#reset-project");
  if (resetProjectBtn) resetProjectBtn.addEventListener("click", onResetProjectWorkspace);

  const browseProjectRootBtn = app.querySelector("#browse-project-root");
  if (browseProjectRootBtn) browseProjectRootBtn.addEventListener("click", onBrowseProjectMetadataRoot);

  const projectConceptInput = app.querySelector("#project-concept-input");
  if (projectConceptInput) {
    projectConceptInput.addEventListener("input", () => {
      state.projectConcept = projectConceptInput.value;
      saveCurrentProjectSnapshot();
      persist();
    });
  }

  const openSequenceBtn = app.querySelector("#open-sequence");
  if (openSequenceBtn) openSequenceBtn.addEventListener("click", onOpenSelectedSequence);

  const newSequenceBtn = app.querySelector("#new-sequence");
  if (newSequenceBtn) newSequenceBtn.addEventListener("click", onNewSequence);

  const saveSequenceBtn = app.querySelector("#save-sequence");
  if (saveSequenceBtn) saveSequenceBtn.addEventListener("click", onSaveSequenceCurrent);

  const saveSequenceAsBtn = app.querySelector("#save-sequence-as");
  if (saveSequenceAsBtn) saveSequenceAsBtn.addEventListener("click", onSaveSequenceAs);

  const sequenceCatalogSelect = app.querySelector("#sequence-catalog-select");
  if (sequenceCatalogSelect) sequenceCatalogSelect.addEventListener("change", onSelectCatalogSequence);

  const browseShowFolderBtn = app.querySelector("#browse-showfolder");
  if (browseShowFolderBtn) browseShowFolderBtn.addEventListener("click", onBrowseShowFolder);

  const browseMediaPathBtn = app.querySelector("#browse-mediapath");
  if (browseMediaPathBtn) browseMediaPathBtn.addEventListener("click", onBrowseMediaFolder);

  const mediaPathInput = app.querySelector("#mediapath-input");
  if (mediaPathInput) {
    mediaPathInput.addEventListener("change", () => {
      state.mediaPath = mediaPathInput.value.trim() || "";
      saveCurrentProjectSnapshot();
      persist();
      render();
      void onRefreshMediaCatalog?.({ silent: true });
    });
  }

  const newSessionBtn = app.querySelector("#new-session");
  if (newSessionBtn) newSessionBtn.addEventListener("click", onNewSession);

  const creativeGoalsInput = app.querySelector("#creative-goals-input");
  if (creativeGoalsInput) {
    creativeGoalsInput.addEventListener("input", () => {
      state.creative.goals = creativeGoalsInput.value;
      state.flags.creativeBriefReady = false;
      persist();
    });
  }

  const creativeInspirationInput = app.querySelector("#creative-inspiration-input");
  if (creativeInspirationInput) {
    creativeInspirationInput.addEventListener("input", () => {
      state.creative.inspiration = creativeInspirationInput.value;
      state.flags.creativeBriefReady = false;
      persist();
    });
  }

  const creativeNotesInput = app.querySelector("#creative-notes-input");
  if (creativeNotesInput) {
    creativeNotesInput.addEventListener("input", () => {
      state.creative.notes = creativeNotesInput.value;
      state.flags.creativeBriefReady = false;
      persist();
    });
  }

  const creativeBriefTextInput = app.querySelector("#creative-brief-text");
  if (creativeBriefTextInput) {
    creativeBriefTextInput.addEventListener("input", () => {
      state.creative.briefText = creativeBriefTextInput.value;
      persist();
    });
  }

  const addReferenceMediaBtn = app.querySelector("#add-reference-media");
  if (addReferenceMediaBtn) addReferenceMediaBtn.addEventListener("click", onReferenceMediaSelected);

  const addPaletteSwatchBtn = app.querySelector("#add-palette-swatch");
  if (addPaletteSwatchBtn) addPaletteSwatchBtn.addEventListener("click", addPaletteSwatch);

  const runCreativeAnalysisBtn = app.querySelector("#run-creative-analysis");
  if (runCreativeAnalysisBtn) runCreativeAnalysisBtn.addEventListener("click", onRunCreativeAnalysis);

  const analyzeAudioBtn = app.querySelector("#analyze-audio");
  if (analyzeAudioBtn) analyzeAudioBtn.addEventListener("click", onAnalyzeAudio);

  const audioTrackSelect = app.querySelector("#audio-track-select");
  if (audioTrackSelect) {
    audioTrackSelect.addEventListener("change", () => {
      setAudioPathWithAgentPolicy(audioTrackSelect.value.trim() || "", "audio track selected");
      saveCurrentProjectSnapshot();
      persist();
      render();
    });
  }

  app.querySelectorAll("[data-inspect-artifact]").forEach((btn) => {
    btn.addEventListener("click", () => onInspectArtifact?.(btn.dataset.inspectArtifact));
  });

  const closeArtifactDetailBtn = app.querySelector("[data-close-artifact-detail]");
  if (closeArtifactDetailBtn) closeArtifactDetailBtn.addEventListener("click", () => onCloseArtifactDetail?.());

  const regenerateCreativeBriefBtn = app.querySelector("#regenerate-creative-brief");
  if (regenerateCreativeBriefBtn) regenerateCreativeBriefBtn.addEventListener("click", onRegenerateCreativeBrief);

  const acceptCreativeBriefBtn = app.querySelector("#accept-creative-brief");
  if (acceptCreativeBriefBtn) acceptCreativeBriefBtn.addEventListener("click", onAcceptCreativeBrief);

  const editBriefDirectionBtn = app.querySelector("#edit-brief-direction");
  if (editBriefDirectionBtn) editBriefDirectionBtn.addEventListener("click", onEditBriefDirection);

  app.querySelectorAll("[data-ref-remove]").forEach((btn) => {
    btn.addEventListener("click", () => onRemoveReferenceMedia(btn.dataset.refRemove));
  });

  app.querySelectorAll("[data-ref-preview]").forEach((btn) => {
    btn.addEventListener("click", () => onPreviewReferenceMedia(btn.dataset.refPreview));
  });

  app.querySelectorAll("[data-ref-toggle-eligible]").forEach((btn) => {
    btn.addEventListener("click", () => onToggleReferenceEligible(btn.dataset.refToggleEligible));
  });

  app.querySelectorAll("[data-palette-remove]").forEach((btn) => {
    btn.addEventListener("click", () => removePaletteSwatch(btn.dataset.paletteRemove));
  });

  const refreshModelsBtn = app.querySelector("#refresh-models");
  if (refreshModelsBtn) refreshModelsBtn.addEventListener("click", onRefreshModels);

  app.querySelectorAll("[data-metadata-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = String(btn.dataset.metadataView || "").trim() === "grid" ? "grid" : "guided";
      if (next === state.ui.metadataView) return;
      state.ui.metadataView = next;
      persist();
      render();
    });
  });

  const metadataFilterNameInput = app.querySelector("#metadata-filter-name");
  if (metadataFilterNameInput) {
    const commitNameFilter = () => {
      const next = metadataFilterNameInput.value;
      if (next === state.ui.metadataFilterName) return;
      state.ui.metadataFilterName = next;
      persist();
      render();
    };
    metadataFilterNameInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commitNameFilter();
    });
    metadataFilterNameInput.addEventListener("change", commitNameFilter);
    metadataFilterNameInput.addEventListener("blur", commitNameFilter);
  }

  const bindMetadataGridFilter = (selector, stateKey) => {
    const input = app.querySelector(selector);
    if (!input) return;
    const commit = () => {
      const next = input.value;
      if (next === state.ui[stateKey]) return;
      state.ui[stateKey] = next;
      persist();
      render();
    };
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commit();
    });
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
  };

  bindMetadataGridFilter("#metadata-filter-type", "metadataFilterType");
  bindMetadataGridFilter("#metadata-filter-role", "metadataFilterRole");
  bindMetadataGridFilter("#metadata-filter-visual-hints", "metadataFilterVisualHints");
  bindMetadataGridFilter("#metadata-filter-effect-avoidances", "metadataFilterEffectAvoidances");

  const metadataSelectVisibleBtn = app.querySelector("#metadata-select-visible");
  if (metadataSelectVisibleBtn) {
    metadataSelectVisibleBtn.addEventListener("click", () => {
      const visibleIds = Array.from(app.querySelectorAll("[data-metadata-select]"))
        .map((node) => String(node.dataset.metadataSelect || "").trim())
        .filter(Boolean);
      selectAllMetadataTargets(visibleIds);
    });
  }

  const metadataClearSelectionBtn = app.querySelector("#metadata-clear-selection");
  if (metadataClearSelectionBtn) metadataClearSelectionBtn.addEventListener("click", clearMetadataSelection);

  const metadataBulkVisualSelect = app.querySelector("#metadata-bulk-visual-hint");
  const metadataBulkVisualOther = app.querySelector("#metadata-bulk-visual-hint-other");
  if (metadataBulkVisualSelect && metadataBulkVisualOther) {
    const syncBulkVisualOther = () => {
      const needsOther = String(metadataBulkVisualSelect.value || "") === "__other__";
      metadataBulkVisualOther.disabled = !needsOther;
      if (!needsOther) metadataBulkVisualOther.value = "";
    };
    metadataBulkVisualSelect.addEventListener("change", syncBulkVisualOther);
    syncBulkVisualOther();
  }

  const metadataBulkAvoidSelect = app.querySelector("#metadata-bulk-effect-avoidance");
  const metadataBulkAvoidOther = app.querySelector("#metadata-bulk-effect-avoidance-other");
  if (metadataBulkAvoidSelect && metadataBulkAvoidOther) {
    const syncBulkAvoidOther = () => {
      const needsOther = String(metadataBulkAvoidSelect.value || "") === "__other__";
      metadataBulkAvoidOther.disabled = !needsOther;
      if (!needsOther) metadataBulkAvoidOther.value = "";
    };
    metadataBulkAvoidSelect.addEventListener("change", syncBulkAvoidOther);
    syncBulkAvoidOther();
  }

  const metadataBulkApplyRoleBtn = app.querySelector("#metadata-bulk-apply-role");
  if (metadataBulkApplyRoleBtn) {
    metadataBulkApplyRoleBtn.addEventListener("click", () => {
      const select = app.querySelector("#metadata-bulk-role");
      const value = String(select?.value || "").trim();
      bulkSetMetadataRolePreference(value === "__auto__" ? "" : value);
    });
  }

  const metadataBulkApplyVisualBtn = app.querySelector("#metadata-bulk-apply-visual-hint");
  if (metadataBulkApplyVisualBtn) {
    metadataBulkApplyVisualBtn.addEventListener("click", () => {
      const select = app.querySelector("#metadata-bulk-visual-hint");
      const other = app.querySelector("#metadata-bulk-visual-hint-other");
      const selectedValue = String(select?.value || "").trim();
      const nextValue = selectedValue === "__other__" ? String(other?.value || "").trim() : selectedValue;
      bulkAddMetadataSemanticHint(nextValue);
    });
  }

  const metadataBulkApplyAvoidBtn = app.querySelector("#metadata-bulk-apply-effect-avoidance");
  if (metadataBulkApplyAvoidBtn) {
    metadataBulkApplyAvoidBtn.addEventListener("click", () => {
      const select = app.querySelector("#metadata-bulk-effect-avoidance");
      const other = app.querySelector("#metadata-bulk-effect-avoidance-other");
      const selectedValue = String(select?.value || "").trim();
      const nextValue = selectedValue === "__other__" ? String(other?.value || "").trim() : selectedValue;
      bulkAddMetadataEffectAvoidance(nextValue);
    });
  }

  app.querySelectorAll("[data-metadata-select]").forEach((input) => {
    const renderPreservingMetadataGridScroll = () => {
      const workspaceBody = app.querySelector(".workspace-content-body");
      const wrap = app.querySelector(".metadata-targets-wrap");
      const workspaceTop = workspaceBody ? workspaceBody.scrollTop : null;
      const workspaceLeft = workspaceBody ? workspaceBody.scrollLeft : null;
      const top = wrap ? wrap.scrollTop : null;
      const left = wrap ? wrap.scrollLeft : null;
      render();
      if (workspaceTop == null && workspaceLeft == null && top == null && left == null) return;
      requestAnimationFrame(() => {
        const nextWorkspaceBody = app.querySelector(".workspace-content-body");
        const nextWrap = app.querySelector(".metadata-targets-wrap");
        if (nextWorkspaceBody) {
          if (workspaceTop != null) nextWorkspaceBody.scrollTop = workspaceTop;
          if (workspaceLeft != null) nextWorkspaceBody.scrollLeft = workspaceLeft;
        }
        if (!nextWrap) return;
        if (top != null) nextWrap.scrollTop = top;
        if (left != null) nextWrap.scrollLeft = left;
      });
    };
    input.addEventListener("change", () => {
      toggleMetadataSelectionId(input.dataset.metadataSelect);
      renderPreservingMetadataGridScroll();
    });
  });

  app.querySelectorAll("[data-metadata-focus]").forEach((btn) => {
    const renderPreservingMetadataGridScroll = () => {
      const workspaceBody = app.querySelector(".workspace-content-body");
      const wrap = app.querySelector(".metadata-targets-wrap");
      const workspaceTop = workspaceBody ? workspaceBody.scrollTop : null;
      const workspaceLeft = workspaceBody ? workspaceBody.scrollLeft : null;
      const top = wrap ? wrap.scrollTop : null;
      const left = wrap ? wrap.scrollLeft : null;
      render();
      if (workspaceTop == null && workspaceLeft == null && top == null && left == null) return;
      requestAnimationFrame(() => {
        const nextWorkspaceBody = app.querySelector(".workspace-content-body");
        const nextWrap = app.querySelector(".metadata-targets-wrap");
        if (nextWorkspaceBody) {
          if (workspaceTop != null) nextWorkspaceBody.scrollTop = workspaceTop;
          if (workspaceLeft != null) nextWorkspaceBody.scrollLeft = workspaceLeft;
        }
        if (!nextWrap) return;
        if (top != null) nextWrap.scrollTop = top;
        if (left != null) nextWrap.scrollLeft = left;
      });
    };
    btn.addEventListener("click", () => {
      setMetadataFocusedTarget(btn.dataset.metadataFocus);
      renderPreservingMetadataGridScroll();
    });
  });

  app.querySelectorAll("[data-metadata-role-preference]").forEach((select) => {
    select.addEventListener("change", () => {
      updateMetadataTargetRolePreference(select.dataset.metadataRolePreference, select.value);
      render();
    });
  });

  app.querySelectorAll("[data-metadata-suggestion-select]").forEach((select) => {
    const syncOtherState = () => {
      const field = String(select.dataset.metadataSuggestionSelect || "").trim();
      const targetId = String(select.dataset.metadataTargetId || "").trim();
      const otherInput = app.querySelector(`[data-metadata-other-input="${field}"][data-metadata-target-id="${targetId}"]`);
      if (!otherInput) return;
      const needsOther = String(select.value || "") === "__other__";
      otherInput.disabled = !needsOther;
      if (needsOther) otherInput.focus();
      else otherInput.value = "";
    };
    select.addEventListener("change", syncOtherState);
    syncOtherState();
  });

  app.querySelectorAll("[data-metadata-add-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = String(btn.dataset.metadataAddItem || "").trim();
      const targetId = String(btn.dataset.metadataTargetId || "").trim();
      const select = app.querySelector(`[data-metadata-suggestion-select="${field}"][data-metadata-target-id="${targetId}"]`);
      const otherInput = app.querySelector(`[data-metadata-other-input="${field}"][data-metadata-target-id="${targetId}"]`);
      const selectedValue = String(select?.value || "").trim();
      const customValue = String(otherInput?.value || "").trim();
      const nextValue = selectedValue === "__other__" ? customValue : selectedValue;
      if (!nextValue) return;
      if (field === "semanticHints") addMetadataTargetSemanticHint(targetId, nextValue);
      if (field === "effectAvoidances") addMetadataTargetEffectAvoidance(targetId, nextValue);
      render();
    });
  });

  app.querySelectorAll("[data-metadata-other-input]").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const field = String(input.dataset.metadataOtherInput || "").trim();
      const targetId = String(input.dataset.metadataTargetId || "").trim();
      const btn = app.querySelector(`[data-metadata-add-item="${field}"][data-metadata-target-id="${targetId}"]`);
      btn?.click();
    });
  });

  app.querySelectorAll("[data-metadata-remove-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = String(btn.dataset.metadataRemoveItem || "").trim();
      const targetId = String(btn.dataset.metadataTargetId || "").trim();
      const value = String(btn.dataset.metadataValue || "").trim();
      if (field === "semanticHints") removeMetadataTargetSemanticHint(targetId, value);
      if (field === "effectAvoidances") removeMetadataTargetEffectAvoidance(targetId, value);
      render();
    });
  });

  app.querySelectorAll("[data-remove-assignment]").forEach((btn) => {
    btn.addEventListener("click", () => removeMetadataAssignment(btn.dataset.removeAssignment));
  });

  app.querySelectorAll("[data-orphan-ignore]").forEach((btn) => {
    btn.addEventListener("click", () => ignoreMetadataOrphan(btn.dataset.orphanIgnore));
  });

  app.querySelectorAll("[data-orphan-remap]").forEach((select) => {
    select.addEventListener("change", () => {
      const fromTargetId = select.dataset.orphanRemap;
      remapMetadataOrphan(fromTargetId, select.value);
    });
  });

  const refreshRecentsBtn = app.querySelector("#refresh-recents");
  if (refreshRecentsBtn) {
    refreshRecentsBtn.addEventListener("click", () => {
      setStatus("info", "Recent sequence list refreshed.");
      render();
    });
  }

  const newSequenceTypeInput = app.querySelector("#new-sequence-type-input");
  if (newSequenceTypeInput) {
    newSequenceTypeInput.addEventListener("change", () => {
      state.newSequenceType = newSequenceTypeInput.value === "animation" ? "animation" : "musical";
      persist();
      render();
    });
  }

  const newSequenceFrameInput = app.querySelector("#new-sequence-frame-input");
  if (newSequenceFrameInput) {
    newSequenceFrameInput.addEventListener("change", () => {
      const parsed = Number.parseInt(newSequenceFrameInput.value, 10);
      state.newSequenceFrameMs = Number.isFinite(parsed) ? Math.max(1, parsed) : state.newSequenceFrameMs;
      persist();
    });
  }

  const newSequenceDurationInput = app.querySelector("#new-sequence-duration-input");
  if (newSequenceDurationInput) {
    newSequenceDurationInput.addEventListener("change", () => {
      const parsed = Number.parseInt(newSequenceDurationInput.value, 10);
      state.newSequenceDurationMs = Number.isFinite(parsed) ? Math.max(1, parsed) : state.newSequenceDurationMs;
      persist();
    });
  }

  const audioPathInput = app.querySelector("#audio-path-input");
  if (audioPathInput) {
    audioPathInput.addEventListener("change", () => {
      setAudioPathWithAgentPolicy(audioPathInput.value.trim() || "", "audio path edited");
      persist();
    });
  }

  const staleRefreshBtn = app.querySelector("#status-refresh");
  if (staleRefreshBtn) staleRefreshBtn.addEventListener("click", onRefresh);

  const staleRegenBtn = app.querySelector("#status-regenerate");
  if (staleRegenBtn) staleRegenBtn.addEventListener("click", onRegenerate);

  const staleCancelBtn = app.querySelector("#status-cancel");
  if (staleCancelBtn) staleCancelBtn.addEventListener("click", onCancelDraft);

  const staleRefreshRegenerateBtn = app.querySelector("#stale-refresh-regenerate");
  if (staleRefreshRegenerateBtn) staleRefreshRegenerateBtn.addEventListener("click", onRefreshAndRegenerate);

  const staleRebaseBtn = app.querySelector("#stale-rebase");
  if (staleRebaseBtn) staleRebaseBtn.addEventListener("click", onRebaseDraft);

  const staleRefreshOnlyBtn = app.querySelector("#stale-refresh-only");
  if (staleRefreshOnlyBtn) staleRefreshOnlyBtn.addEventListener("click", onRefresh);

  const staleCancelDraftBtn = app.querySelector("#stale-cancel-draft");
  if (staleCancelDraftBtn) staleCancelDraftBtn.addEventListener("click", onCancelDraft);

  app.querySelectorAll("[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => setSectionFilter(btn.dataset.section));
  });

  app.querySelectorAll("[data-design-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setDesignTab(btn.dataset.designTab));
  });

  app.querySelectorAll("[data-design-remove]").forEach((btn) => {
    btn.addEventListener("click", () => onRemoveDesignConcept(btn.dataset.designRemove));
  });

  app.querySelectorAll("[data-design-revise]").forEach((btn) => {
    btn.addEventListener("click", () => onReviseDesignConcept(btn.dataset.designRevise));
  });

  app.querySelectorAll("[data-design-inspect]").forEach((btn) => {
    btn.addEventListener("click", () => onInspectDesignConcept(btn.dataset.designInspect));
  });

  const clearSequenceDesignFilterBtn = app.querySelector("#clear-sequence-design-filter");
  if (clearSequenceDesignFilterBtn) clearSequenceDesignFilterBtn.addEventListener("click", () => {
    state.ui.sequenceDesignFilterId = "";
    persist();
    render();
  });

  app.querySelectorAll("[data-accept-timing-review]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const policyKey = String(btn.dataset.acceptTimingReview || "").trim();
      const trackName = String(btn.dataset.trackName || "").trim();
      if (!policyKey && !trackName) return;
      await onAcceptTimingTrackReview?.({ policyKey, trackName });
    });
  });

  const removeSelectedProposedBtn = app.querySelector("#remove-selected-proposed");
  if (removeSelectedProposedBtn) removeSelectedProposedBtn.addEventListener("click", onRemoveSelectedProposed);

  const removeAllProposedBtn = app.querySelector("#remove-all-proposed");
  if (removeAllProposedBtn) removeAllProposedBtn.addEventListener("click", onRemoveAllProposed);

  const proposedPayloadDetails = app.querySelector(".proposed-payload-footer");
  if (proposedPayloadDetails) {
    proposedPayloadDetails.addEventListener("toggle", () => {
      state.ui.proposedPayloadOpen = proposedPayloadDetails.open;
      persist();
    });
  }

  app.querySelectorAll("[data-proposed-select]").forEach((input) => {
    input.addEventListener("change", () => toggleProposedSelection(input.dataset.proposedSelect));
  });

  app.querySelectorAll("[data-proposed-group-select]").forEach((input) => {
    input.addEventListener("change", () => toggleProposedSelectionGroup(input.dataset.proposedGroupSelect));
  });

  app.querySelectorAll("[data-proposed-delete]").forEach((btn) => {
    btn.addEventListener("click", () => removeProposedLine(Number.parseInt(btn.dataset.proposedDelete, 10)));
  });

  app.querySelectorAll("[data-proposed-focus]").forEach((cell) => {
    cell.addEventListener("click", () => toggleProposedSelection(cell.dataset.proposedFocus));
  });

  app.querySelectorAll("[data-proposed-tag-type]").forEach((tag) => {
    tag.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const type = String(tag.dataset.proposedTagType || "").trim();
      const value = String(tag.dataset.proposedTagValue || "").trim();
      if (!type || !value) return;
      if (type === "section") {
        state.ui.chatDraft = `Focus updates on section "${value}". `;
        setStatus("info", `Section tag selected: ${value}`);
      } else if (type === "model") {
        state.ui.chatDraft = `Focus updates on model "${value}". `;
        setStatus("info", `Model tag selected: ${value}`);
      } else {
        state.ui.chatDraft = `${value} `;
      }
      persist();
      render();
    });
  });

  app.querySelectorAll("[data-proposed-input]").forEach((input) => {
    input.addEventListener("change", () =>
      updateProposedLine(Number.parseInt(input.dataset.proposedInput, 10), input.value)
    );
  });

  app.querySelectorAll("[data-proposed-remove]").forEach((btn) => {
    btn.addEventListener("click", () =>
      removeProposedLine(Number.parseInt(btn.dataset.proposedRemove, 10))
    );
  });

  app.querySelectorAll("[data-history-entry]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (typeof onSelectHistoryEntry === "function") {
        await onSelectHistoryEntry(btn.dataset.historyEntry || "");
        return;
      }
      state.ui.selectedHistoryEntry = btn.dataset.historyEntry || "";
      persist();
      render();
    });
  });

  app.querySelectorAll("[data-recent]").forEach((btn) => {
    btn.addEventListener("click", () => onUseRecent(btn.dataset.recent));
  });

  app.querySelectorAll("[data-cancel-job]").forEach((btn) => {
    btn.addEventListener("click", () => onCancelJob(btn.dataset.cancelJob));
  });

  app.querySelectorAll("[data-insert-model]").forEach((btn) => {
    btn.addEventListener("click", () => insertModelIntoDraft(btn.dataset.insertModel));
  });

  app.querySelectorAll("[data-version]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedVersion = btn.dataset.version;
      persist();
      render();
    });
  });
}
