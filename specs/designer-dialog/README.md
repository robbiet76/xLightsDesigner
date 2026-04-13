# Designer Dialog Specs

Status: Active
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-13

Active specs for the `designer_dialog` domain.

Scope:
- conversational intent gathering
- artistic direction
- display and music context normalization
- structured handoff into sequencing

## Canonical Entry Points

- [designer-interaction-contract.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/designer-interaction-contract.md)
- [sequencing-design-handoff-v2-spec-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/sequencing-design-handoff-v2-spec-2026-03-19.md)
- [director-profile-v1.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/director-profile-v1.md)
- [display-metadata-v1-2026-04-08.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/display-metadata-v1-2026-04-08.md)
- [design-scene-context-v1.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/design-scene-context-v1.md)
- [music-design-context-v1.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/music-design-context-v1.md)

## Supporting Active Specs

- [getting-to-know-your-display-conversation-2026-04-08.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/getting-to-know-your-display-conversation-2026-04-08.md)
- [designer-to-sequencer-handoff-audit-and-roadmap-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/designer-to-sequencer-handoff-audit-and-roadmap-2026-03-19.md)
- [designer-sequencer-effect-placement-contract-2026-03-17.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/designer-sequencer-effect-placement-contract-2026-03-17.md)
- [designer-training-rubric-2026-03-17.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/designer-training-rubric-2026-03-17.md)
- [designer-knowledge-input-audit-2026-03-17.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/designer-knowledge-input-audit-2026-03-17.md)
- [xlights-effect-support-audit-2026-03-17.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/xlights-effect-support-audit-2026-03-17.md)

## Reference / Training-Phase Material

These remain useful, but they are not the primary entry path for current sequencing work.

- `conversational-training-seed-notes.md`
- `deep-training-next-phase-checklist-2026-03-17.md`
- `designer-diagnostics-snapshots-2026-03-17.md`
- `designer-eval-baseline-2026-03-17.md`
- `gated-training-checklist-2026-03-15.md`
- `live-evaluation-script-2026-03-15.md`
- `pre-training-framework-checklist-2026-03-17.md`
- `pre-training-handoff-freeze-2026-03-17.md`
- `stage1-minimum-viable-designer-prompts-2026-03-15.md`
- `stage2-metadata-aware-prompts-2026-03-15.md`
- `stage2-scene-aware-prompts-2026-03-15.md`
- `stage3-music-aware-prompts-2026-03-15.md`
- `stage4-clarification-discipline-prompts-2026-03-15.md`
- `stage5-reference-memory-prompts-2026-03-15.md`
- `stage6-conservative-preference-learning-prompts-2026-03-15.md`
- `stage7-cloud-first-confidence-2026-03-15.md`
- `synthetic-metadata-fixtures-2026-03-17.md`
- `training-audit-and-next-checklist-2026-03-17.md`
- `training-plan-2026-03-13.md`

## Relationship to Sequencing

The designer remains upstream of `sequence_agent`.

Current rule:
- designer owns artistic intent and structured handoff quality
- sequencer owns execution and revision realization
