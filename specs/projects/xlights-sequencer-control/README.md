# xLights Sequencer Control + Agent Autonomy

Status: Draft baseline for pre-implementation alignment.  
Date: 2026-03-02

## Purpose
Define the full target contract between xLightsDesigner and xLights before further API implementation, with explicit boundaries and autonomous-agent execution requirements.

## Files
- `project-spec.md`: source-of-truth scope, requirements, and acceptance criteria.
- `api-surface-contract.md`: required endpoint/capability matrix for full sequencer control.
- `autonomy-access-requirements.md`: required local permissions, tooling, and non-interactive execution policy for Codex/agents.
- `implementation-roadmap.md`: phased delivery plan from discovery to full sequence authoring.
- `implementation-status-matrix.md`: command-by-command contract coverage against current xLights branch.
- `implementation-work-packages.md`: sequenced PR work packages with scope and acceptance gates.
- `wp7-spec.md`: formal WP-7 scope and acceptance specification.
- `wp7-task-breakdown.md`: executable WP-7 task plan and sequencing.
- `wp8-spec.md`: formal WP-8 fixture-pack/versioning scope and acceptance specification.
- `wp8-task-breakdown.md`: executable WP-8 tasks for bootstrap portability and CI integration.
- `gap-audit.md`: delta between current documented/implemented surface and required target surface.
- `decision-log.md`: locked decisions to minimize implementation churn.
- `acceptance-test-matrix.md`: cross-domain acceptance tests for autonomous, non-UI sequencing loops.
- `schemas/`: machine-readable JSON Schema artifacts for request validation.
- `integration-test-harness.md`: required non-UI integration scripts and report format contract.
- `test-fixtures.example.env`: fixture/environment template for integration smoke scripts.
- `test-fixtures.manifest.json`: fixture manifest with expected baseline outputs per smoke suite.
