# Implementation Roadmap: Full Sequencer Control Program

Status: Draft  
Date: 2026-03-02

## Phase 0: Contract Hardening
- Lock full program scope and boundaries.
- Freeze command naming conventions and error model.
- Define capability discovery payload and version policy.
- Deliver baseline autonomous test harness shape.

Exit criteria:
- Program-level spec accepted.
- No ambiguous scope between controllers/layout/sequencer domains.

## Phase 1: Discovery + Sequence Lifecycle
- Finalize `system.*`, `sequence.*`, `layout.*` read-only discovery commands.
- Ensure deterministic payloads and legacy compatibility.

Exit criteria:
- xLightsDesigner can discover environment and open/create/save/close sequences without UI coupling.

## Phase 2: Timing Control Foundation
- Deliver timing track CRUD and mark CRUD contracts + implementations.
- Include summaries and deterministic interval/stat outputs.
- Align with audio-timing-lyrics project where overlap exists.

Exit criteria:
- Agent can fully author and rewrite timing scaffolding through API only.

## Phase 3: Display Elements + Effect Lifecycle
- Deliver display element ordering APIs.
- Deliver effect list/create/update/delete and bulk operations.
- Lock layer addressing semantics and conflict handling.

Exit criteria:
- Agent can perform full sequencing edits (not just append-only).

## Phase 4: Validation + Autonomous Loops
- Ship `system.validateCommands` batch dry-run.
- Add end-to-end scriptable tests for full loop behavior.
- Add regression gates for legacy automation compatibility.

Exit criteria:
- Agent loop can run autonomously with deterministic pass/fail reporting.

## Phase 5: Production Hardening
- Performance and stability pass on song-sized datasets.
- Error contract hardening and troubleshooting telemetry.
- Documented runbooks for local autonomous development.

Exit criteria:
- Stable developer workflow with minimal manual intervention.

