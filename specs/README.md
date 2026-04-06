# Specs

Status: Active
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-05

Implementation-facing specifications that drive development work.

## Layout
- `specs/`: active, authoritative spec set.
- `specs/app-assistant/`: active unified chat-shell specs and routing boundaries.
- `specs/app-ui/`: active application UI/UX specs and workflow design.
- `specs/audio-analyst/`: active `audio_analyst` specs and audits.
- `specs/designer-dialog/`: active `designer_dialog` interaction and workflow specs.
- `specs/sequence-agent/`: active `sequence_agent` and xLights sequencing specs.
- `specs/archive/`: historical planning artifacts, prior iterations, and closed work-package docs.

## Naming Convention
- domain directories own current active specs
- legacy flat specs are archived under domain-specific or root archive paths

## Non-Negotiable Development Policy
- maintain one canonical app source tree
- maintain one canonical xLights source tree
- maintain one canonical desktop state root
- do not create parallel app versions, alternate worktrees, or shadow runtime installs
- do not add legacy workflows, compatibility shims, migration readers, or dual-path runtime logic during initial development
- delete stale roots instead of preserving them

Primary policy source:
- `current-app-plan-2026-04-05.md`
- `repo-structure-governance.md`

## Active Entry Points
- `current-app-plan-2026-04-05.md`
- `app-ui/macos-native-migration-phase-plan-2026-04-06.md`
- `app-assistant/app-assistant-role-and-boundary.md`
- `app-assistant/implementation-checklist.md`
- `app-ui/implementation-checklist.md`
- `app-ui/page-roles-and-flow.md`
- `audio-analyst/implementation-checklist.md`
- `audio-analyst/provider-framework.md`
- `audio-analyst/timing-track-taxonomy-and-sequencing-uses-2026-04-05.md`
- `audio-analyst/timing-track-workflow-implementation-checklist-2026-04-02.md`
- `designer-dialog/designer-interaction-contract.md`
- `designer-dialog/implementation-checklist.md`
- `sequence-agent/sequencer-quality-and-training-on-reviewed-timing-checklist-2026-04-02.md`
- `sequence-agent/sequence-session-and-live-validation-refactor-plan-2026-04-05.md`
- `sequence-agent/xlights-sequencer-control-project-spec.md`
- `sequence-agent/xlights-sequencer-control-api-surface-contract.md`
- `repo-structure-governance.md`

## Consolidation Record
- `spec-consolidation-audit-2026-03-11.md`
- `spec-lifecycle-policy.md`
- `requirements-traceability-matrix.md`
- `agent-release-quality-gates.md`
