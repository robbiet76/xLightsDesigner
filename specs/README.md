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

## Root Canonical Entry Points
- `current-app-plan-2026-04-05.md`
- `repo-structure-governance.md`
- `spec-organization-audit-2026-04-13.md`

## Domain Indexes
- `app-assistant/README.md`
- `app-ui/README.md`
- `audio-analyst/README.md`
- `designer-dialog/README.md`
- `sequence-agent/README.md`

## Current Cross-Domain Canonical Specs
- `app-ui/native-cutover-audit-2026-04-10.md`
- `app-ui/native-app-architecture-diagram-2026-04-10.md`
- `app-ui/cross-platform-shell-boundary-2026-04-10.md`
- `app-ui/hybrid-cloud-learning-and-billing-2026-04-10.md`
- `app-assistant/app-assistant-role-and-boundary.md`
- `designer-dialog/designer-interaction-contract.md`
- `designer-dialog/sequencing-design-handoff-v2-spec-2026-03-19.md`
- `sequence-agent/sequencing-poc-boundary-2026-04-10.md`
- `sequence-agent/sequencing-feedback-loop-v1-2026-04-13.md`
- `sequence-agent/sequence-critique-v1-2026-04-13.md`
- `sequence-agent/sequence-revision-gating-policy-v1-2026-04-13.md`
- `sequence-agent/sequence-artistic-goal-v1-2026-04-13.md`
- `sequence-agent/sequence-revision-objective-v1-2026-04-13.md`

## Consolidation Record
- `spec-consolidation-audit-2026-03-11.md`
- `spec-organization-audit-2026-04-13.md`
- `spec-lifecycle-policy.md`
- `requirements-traceability-matrix.md`
- `agent-release-quality-gates.md`
