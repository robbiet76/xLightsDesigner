# Designer Dialog Spec Cleanup Audit

Status: Active
Date: 2026-04-16
Owner: xLightsDesigner Team

Purpose: audit the `designer-dialog` spec set against the current macOS app and remove historical training clutter from the active path.

## App Alignment Summary

The `designer-dialog` domain is still active in the current app.

Current evidence in product:
- [AssistantWindowViewModel.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/AssistantWindowViewModel.swift)
- [AppModel.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/AppModel.swift)
- [PendingWorkService.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Services/PendingWorkService.swift)
- [DisplayService.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Services/DisplayService.swift)
- [DesignSequenceReviewModels.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Models/DesignSequenceReviewModels.swift)

What is active in the app:
- assistant conversation and routing
- display-discovery and display metadata capture
- design proposal and pending-work read models
- structured handoff into sequencing and review
- project-scoped preference and context handling

Operational conclusion:
- keep the live interaction, context, and handoff contracts in the active directory
- archive historical training prompts, checklists, exploratory audits, and completed training baselines

## File Decisions

| File | Decision | Reason |
| --- | --- | --- |
| `README.md` | update | Keep as the active index, but shrink it to the live contract set and point historical material to archive. |
| `designer-interaction-contract.md` | keep | Still aligned to the active assistant/design/handoff workflow in the macOS app. |
| `sequencing-design-handoff-v2-spec-2026-03-19.md` | keep | Still the active designer-to-sequencer contract boundary. |
| `director-profile-v1.md` | keep | Still aligned to the app's project/user preference model. |
| `display-metadata-v1-2026-04-08.md` | keep | Still aligned to `DisplayService` and display metadata capture. |
| `design-scene-context-v1.md` | keep | Still aligned to the app's designer-facing layout/context model. |
| `music-design-context-v1.md` | keep | Still aligned to pending-work/music-context artifacts consumed by the app. |
| `getting-to-know-your-display-conversation-2026-04-08.md` | keep | Still aligned to the live display-discovery conversation path. |
| `designer-to-sequencer-handoff-audit-and-roadmap-2026-03-19.md` | archive | Roadmap material that led into the current handoff spec. No longer needed as active entry material. |
| `designer-sequencer-effect-placement-contract-2026-03-17.md` | archive | Early placement-first boundary exploration. Superseded by the current handoff direction and later sequence-agent work. |
| `designer-training-rubric-2026-03-17.md` | archive | Historical training-quality rubric, not an active app contract. |
| `designer-knowledge-input-audit-2026-03-17.md` | archive | Exploratory training input audit. Useful history, not active runtime guidance. |
| `xlights-effect-support-audit-2026-03-17.md` | archive | Historical effect-support sweep that is now better owned by the active sequence-agent/effectmetadata work. |
| `conversational-training-seed-notes.md` | archive | Early training seed notes, not active app contract. |
| `deep-training-next-phase-checklist-2026-03-17.md` | archive | Completed training checklist, not active state. |
| `designer-diagnostics-snapshots-2026-03-17.md` | archive | Training/eval instrumentation design, not active product contract. |
| `designer-eval-baseline-2026-03-17.md` | archive | Historical baseline report, not active spec surface. |
| `gated-training-checklist-2026-03-15.md` | archive | Historical training gate checklist. |
| `live-evaluation-script-2026-03-15.md` | archive | Historical eval procedure, not active app contract. |
| `pre-training-framework-checklist-2026-03-17.md` | archive | Completed historical checklist. |
| `pre-training-handoff-freeze-2026-03-17.md` | archive | Historical handoff-freeze planning, no longer active. |
| `stage1-minimum-viable-designer-prompts-2026-03-15.md` | archive | Historical prompt-stage material. |
| `stage2-metadata-aware-prompts-2026-03-15.md` | archive | Historical prompt-stage material. |
| `stage2-scene-aware-prompts-2026-03-15.md` | archive | Historical prompt-stage material. |
| `stage3-music-aware-prompts-2026-03-15.md` | archive | Historical prompt-stage material. |
| `stage4-clarification-discipline-prompts-2026-03-15.md` | archive | Historical prompt-stage material. |
| `stage5-reference-memory-prompts-2026-03-15.md` | archive | Historical prompt-stage material. |
| `stage6-conservative-preference-learning-prompts-2026-03-15.md` | archive | Historical prompt-stage material. |
| `stage7-cloud-first-confidence-2026-03-15.md` | archive | Historical prompt-stage material. |
| `synthetic-metadata-fixtures-2026-03-17.md` | archive | Historical eval-fixture guidance, not active runtime contract. |
| `training-audit-and-next-checklist-2026-03-17.md` | archive | Historical training audit and checklist. |
| `training-plan-2026-03-13.md` | archive | Historical training plan. |
| `implementation-checklist.md` | archive | Undated older implementation checklist. Not appropriate as active spec under the date-suffix policy. |
| `end-to-end-audit-2026-03-12.md` | archive | Historical early audit, not current execution guidance. |

## Outcome

Active `designer-dialog` now contains only:
- live conversation contract
- live context artifacts
- live handoff contract
- live display-discovery conversation guidance

Historical material now lives under:
- [specs/archive/designer-dialog](/Users/robterry/Projects/xLightsDesigner/specs/archive/designer-dialog)

## Naming Policy Note

Several retained active files predate the stricter date-suffix rule:
- `designer-interaction-contract.md`
- `director-profile-v1.md`
- `design-scene-context-v1.md`
- `music-design-context-v1.md`

They remain active because the app still aligns to them. Future substantive revisions should be published as dated successors rather than extending the undated filenames indefinitely.
