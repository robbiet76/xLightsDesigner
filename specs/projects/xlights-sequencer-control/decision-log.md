# Decision Log: xLights Sequencer Control Program

Date: 2026-03-03  
Status: Locked unless superseded by explicit revision.

## D1) Scope Boundaries
- Controllers are out of scope.
- Layout/model setup writes are out of scope.
- Layout discovery is read-only and in scope.
- Full sequencer read/write control is in scope.

## D2) Logic Placement
- xLights adds control hooks and deterministic execution helpers.
- Sequencing intelligence/planning remains in xLightsDesigner/agents.

## D3) Versioning
- New program commands use v2 envelope and namespaced command IDs.
- Legacy automation behavior remains unchanged.

## D4) Autonomy Goal
- The target developer loop is non-interactive by default with scripted validation.
- Manual approval steps are exception paths, not standard flow.

## D5) Delivery Strategy
- Continue additive phased delivery.
- Existing audio-timing-lyrics project remains an active subproject and should align to this program-level contract.

## D6) Bulk Target Selector Precedence
- For bulk effect/timing mutations:
  - if `effectIds`/explicit ids are provided, id selection takes precedence;
  - filter selectors are ignored except for validation warnings;
  - if no ids are provided, filter selectors are required.

## D7) Idempotency and Retry Semantics
- `options.requestId` is treated as the idempotency key for mutating v2 commands when provided.
- Replayed command with same `requestId`, same `cmd`, and same normalized params must return the same semantic result without duplicate mutation.
- If same `requestId` is reused with different params, return `409 CONFLICT`.

## D8) Default Overlap Resolution Policy
- Timing marks and effects must not create invalid negative-duration or reverse ranges.
- Overlaps are allowed only where existing xLights data model allows overlapping entities on the same layer/track type.
- Commands that would violate model constraints fail with `422 VALIDATION_ERROR` rather than silently rewriting user data.

## D9) Analysis Backend Strategy
- Audio/timing analysis backend is provider-agnostic.
- VAMP remains supported where available but is not mandatory for the overall program contract.
- Discovery/capability endpoints must expose which analysis backends/providers are currently available at runtime.

## D10) Legacy vs v2 Evolution Policy
- v2 is the feature-growth API surface for this program.
- Legacy API remains compatibility-only for existing clients and scripts.
- Legacy updates are restricted to:
  - behavioral bugfixes,
  - reliability hardening (including non-interactive automation behavior),
  - compatibility-preserving refactors.
- Net-new command capabilities and schema expansion must be introduced in v2 contracts.
- A full legacy API rewrite is explicitly deferred due to delivery risk and regression exposure; convergence should be incremental via shared internals plus legacy regression gating.

## D11) Display-Element Scope Semantics
- Active display-element subset selection and element ordering are separate controls.
- `sequencer.setActiveDisplayElements` controls include-only visibility of non-timing display elements.
- `sequencer.setDisplayElementOrder` remains the only ordering mutation API.

## D12) WP-9 Gate Posture (2026-03-03)
- Harness/documentation lockstep gaps (G9/G10) are considered closed based on full green `run-all.sh` evidence and synchronized status docs.
- Program gate remains `No-Go` for final WP-9 closeout while G8 remains open.
- G8 remains the sole tracked blocker: deterministic rollback guarantees for all mid-commit mutation failure classes.

## D13) Iteration-First API Strategy (2026-03-03)
- Shift from "100% closeout now" to iterative delivery driven by xLightsDesigner feature development.
- Keep a practical integration baseline and capture new API friction in a live backlog.
- Prioritize unblock value and deterministic behavior over full theoretical completeness at this stage.
- Maintain lightweight regression gates (critical smoke suites + crash watcher) on each API change batch.

## D14) Deployment Boundary: Standalone-First, Add-On Deferred (2026-03-04)
- xLightsDesigner remains a separate application/process and is not packaged into core xLights releases at this stage.
- Any xLights add-on/embedded integration path is explicitly deferred and considered optional future work.
- Rationale:
  - avoid tight coupling and release-risk spillover into xLights,
  - preserve independent release cadence for Designer,
  - reduce maintenance risk from xLights internal changes.
- If add-on exploration happens later, standalone operation must remain a fully supported fallback path.

## D15) Distribution Model: Single Packaged Desktop App, No Side Runtime Installs (2026-03-05)
- xLightsDesigner is distributed to end users as a single packaged desktop application.
- Internal implementation may use web UI technologies, but production users must not install side runtimes/tools (no separate Node/Python/Electron setup).
- Desktop-native capabilities (file dialogs, filesystem-backed project/metadata persistence, diagnostics export) must be provided through the packaged runtime boundary.
- Browser-only/dev-server mode is development-only and not the production delivery contract.

## D16) Initial Development Policy: No Legacy/Compatibility Shims (2026-03-05)
- During initial development, do not add legacy paths, compatibility shims, fallback schemas, or dual-format support.
- Fixes must target the current approved contract directly (root-cause first).
- Compatibility behavior may be considered only after first final release, with explicit approval and spec update.

## D17) Agent v1 Non-Goals and Blocked Operations (2026-03-07)
- Agent v1 is scoped to deterministic proposal/apply loops for sequencing mutations only.
- Agent v1 must not perform:
  - controller/output configuration changes,
  - layout/model write operations,
  - implicit global rewrites without elevated explicit confirmation,
  - autonomous background apply without user-triggered approval.
- Agent v1 apply path is blocked when:
  - sequence revision is stale,
  - scope is ambiguous or empty,
  - `system.validateCommands` fails,
  - plan contains commands outside approved v1 command set.

## D18) Guided Workflow + Settings-Edit Boundaries (2026-03-07)
- Agent v1 must operate as a guided creative partner, including explicit concept/tone/goals capture and gap-resolution prompts before first major mutation proposal.
- Agent v1 may propose and execute settings/form edits only for editable UI namespaces.
- Any settings edit requires explicit user confirmation and must be auditable with before/after deltas.
- Silent/background settings mutation is prohibited.

## D19) Audio-Analysis-First Kickoff Policy (2026-03-07)
- In `create` mode, analysis is mandatory before first major proposal:
  - media read
  - structure segmentation
  - timing extraction (tempo/time signature/beats/bars)
  - creative brief synthesis
- Optional enrichments (web context, lyric timing) remain non-blocking for proposal generation, but if present must be traceable in analysis metadata.

## D20) Sequencing Responsibility Split: Director User, Designer Agent (2026-03-07)
- The user primarily provides director-level intent (creative direction, priorities, constraints).
- The agent is responsible for sequencing craft decisions and concrete plan generation (target strategy, effect approach, layering/transition choices).
- The system must not depend on the user providing low-level effect instructions for normal plan generation.
- Explicit user low-level instructions, when provided, are treated as constraints/overrides.
