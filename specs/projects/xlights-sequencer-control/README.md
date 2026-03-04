# xLights Sequencer Control + Agent Autonomy

Status: Draft baseline for pre-implementation alignment.  
Date: 2026-03-02

## Purpose
Define the full target contract between xLightsDesigner and xLights before further API implementation, with explicit boundaries and autonomous-agent execution requirements.

## Files
- `project-spec.md`: source-of-truth scope, requirements, and acceptance criteria.
- `designer-interaction-contract.md`: user-to-agent intent, proposal/review, and iterative change-control contract for Designer UI workflows.
- `standalone-app-requirements.md`: consolidated standalone xLightsDesigner requirements with explicit gap register and phased closure plan.
- `wireframes-v1.md`: low-fidelity standalone UX wireframes (desktop + compact behavior) for core user flows.
- `wireframes-v3.md`: updated wireframes with project-level settings placement, live proposed-change list in Design, and global status bar behavior.
- `wireframes-v4.md`: implementation-focused control/state/validation/confirmation contract for core screens and actions.
- `wireframes-v4-implementation-checklist.md`: screen-by-screen implementation and acceptance checklist derived from wireframes v4.
- `xlightsdesigner-dev-backlog-v1.md`: prioritized engineering epics/stories and sprint sequence for starting standalone app development.
- `learning-and-freshness-loop.md`: preference learning + novelty/repetition-control requirements for long-term agent improvement.
- `model-context-and-semantic-metadata.md`: model/group spatial awareness and extensible semantic metadata contract for agent planning.
- `api-surface-contract.md`: required endpoint/capability matrix for full sequencer control.
- `autonomy-access-requirements.md`: required local permissions, tooling, and non-interactive execution policy for Codex/agents.
- `implementation-roadmap.md`: phased delivery plan from discovery to full sequence authoring.
- `implementation-status-matrix.md`: command-by-command contract coverage against current xLights branch.
- `implementation-work-packages.md`: sequenced PR work packages with scope and acceptance gates.
- `wp7-spec.md`: formal WP-7 scope and acceptance specification.
- `wp7-task-breakdown.md`: executable WP-7 task plan and sequencing.
- `wp8-spec.md`: formal WP-8 fixture-pack/versioning scope and acceptance specification.
- `wp8-task-breakdown.md`: executable WP-8 tasks for bootstrap portability and CI integration.
- `wp9-spec.md`: formal WP-9 scope for end-to-end API completeness and automation-layer modularization.
- `wp9-task-breakdown.md`: executable WP-9 implementation task sequence.
- `wp9-checklist.md`: maintainer go/no-go checklist for WP-9 autonomous readiness.
- `iteration-policy.md`: lightweight operating model for API evolution while xLightsDesigner is actively iterating.
- `designer-api-backlog.md`: live backlog of API friction discovered during Designer feature development.
- `temp-testing-changes.md`: required register for temporary non-API xLights testing/debug code edits.
- `gap-audit.md`: delta between current documented/implemented surface and required target surface.
- `decision-log.md`: locked decisions to minimize implementation churn.
- `acceptance-test-matrix.md`: cross-domain acceptance tests for autonomous, non-UI sequencing loops.
- `schemas/`: machine-readable JSON Schema artifacts for request validation.
- `integration-test-harness.md`: required non-UI integration scripts and report format contract.
- `test-fixtures.example.env`: fixture/environment template for integration smoke scripts.
- `test-fixtures.manifest.json`: fixture manifest with expected baseline outputs per smoke suite.
