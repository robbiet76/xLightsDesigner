# Designer Dialog Specs

Status: Active
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-16

Active specs for the `designer_dialog` domain.

Scope:
- conversational intent gathering
- artistic direction
- display and music context normalization
- structured handoff into sequencing

Cleanup audit:
- [designer-dialog-spec-cleanup-audit-2026-04-16.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/designer-dialog-spec-cleanup-audit-2026-04-16.md)

## Canonical Entry Points

- [designer-interaction-contract.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/designer-interaction-contract.md)
- [sequencing-design-handoff-v2-spec-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/sequencing-design-handoff-v2-spec-2026-03-19.md)
- [director-profile-v1.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/director-profile-v1.md)
- [display-metadata-v1-2026-04-08.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/display-metadata-v1-2026-04-08.md)
- [design-scene-context-v1.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/design-scene-context-v1.md)
- [music-design-context-v1.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/music-design-context-v1.md)

## Supporting Active Specs

- [getting-to-know-your-display-conversation-2026-04-08.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/getting-to-know-your-display-conversation-2026-04-08.md)

## Archived Historical Material

Historical training prompts, checklists, exploratory audits, and eval baselines now live under:

- [specs/archive/designer-dialog](/Users/robterry/Projects/xLightsDesigner/specs/archive/designer-dialog)

## Relationship to Sequencing

The designer remains upstream of `sequence_agent`.

Current rule:
- designer owns artistic intent and structured handoff quality
- sequencer owns execution and revision realization
