# Autonomous Agent Access Requirements (Codex + xLightsDesigner)

Status: Draft  
Date: 2026-03-02

## 1) Goal
Allow Codex/agents to iterate and test toward defined goals with minimal manual approvals while maintaining safety boundaries.

## 2) Required Local Access

### 2.1 Filesystem
- Read/write access to:
  - xLightsDesigner repo root.
  - xLights repo root.
  - temporary build/log directories used by tests.

### 2.2 Network
- Access to local automation endpoint (`localhost` xLights listener).
- Outbound git network access for push/pull when explicitly requested.
- Optional outbound LLM provider access when agent workflows use external reasoning.

### 2.3 Tooling
- Non-interactive git operations.
- Build/test commands for xLights and xLightsDesigner.
- Script execution for smoke/integration verification.
- `jq` for fixture-pack and manifest validation.
- `shasum` for optional fixture checksum verification.

### 2.4 Audio Analysis Backend Prerequisites
- The analysis backend is pluggable; VAMP is one supported option, not a hard dependency.
- For VAMP-based workflows, recommended installers are:
  - Apple Silicon (M1+): `https://dankulp.com/xlights/archive/qm-vamp-plugins-1.8.dmg`
  - Intel: `https://code.soundsoftware.ac.uk/projects/vamp-plugin-pack`
- Agents should discover backend availability from capabilities and treat missing optional backends as environment constraints, not implementation failures.

## 3) Non-Interactive Execution Policy
- Prefer deterministic scripts over manual UI interaction.
- Use API-level smoke/integration tests as release gates.
- Run fixture bootstrap preflight before smoke suites when fixture-pack gating is enabled.
- Avoid requiring user approval between every loop step unless:
  - destructive action,
  - scope change,
  - unresolved ambiguity with product impact.

## 4) Required Agent Capabilities
- Discover API capabilities and branch behavior by command, not assumptions.
- Execute dry-run first for mutating operations when available.
- Apply mutation, then verify via readback endpoints.
- Produce machine-readable run report with pass/fail and error details.

## 5) Safety Guardrails
- Controllers remain out of scope for this program.
- Layout/model write operations are blocked by contract.
- Sequence mutations require explicit targets and validation.
- Unknown command or schema mismatches must fail fast.

## 6) Definition of Autonomous Readiness
The system is autonomously usable when an agent can run, end-to-end, without manual intervention:
1. open/create sequence and attach media,
2. discover layout and sequence context,
3. create/edit timing and effects,
4. verify resulting state via summaries/readback,
5. exit with deterministic report.

## 7) Operational Checklist
- Dual-root workspace configured and persisted.
- Session started with writable access to both repos.
- Network permissions configured to avoid repeated push/build prompts.
- Fixture manifest validated (`scripts/xlights-control/validate-fixture-manifest.sh`).
- Fixture bootstrap report generated when required (`scripts/xlights-control/bootstrap-fixtures.sh`).
- Shared smoke-test entrypoints documented and runnable.

## 8) Automation Layer Code Organization Requirement
- API command handlers should be grouped by namespace/domain and implemented in separate files.
- `xLightsAutomations.cpp` should remain a thin router/orchestration layer only.
- xLights API layer must expose raw/structured authoritative data and deterministic mutations, but must not contain higher-order agent logic.
- Explicitly out of scope for xLights API layer:
  - creative/quality scoring of render outcomes,
  - heuristic ranking of effect choices,
  - autonomous plan optimization logic.
- These next-level behaviors are required in xLightsDesigner, using API outputs as input signals.
- Proposed implementation grouping:
  - `automation/api/SystemApi.*`
  - `automation/api/SequenceApi.*`
  - `automation/api/LayoutApi.*`
  - `automation/api/MediaApi.*`
  - `automation/api/TimingApi.*`
  - `automation/api/EffectsApi.*`
  - `automation/api/TransactionsApi.*` (WP-9)
  - `automation/api/JobsApi.*` (WP-9)
- Shared request parsing/validation helpers should live in a focused common module, not duplicated per command group.
