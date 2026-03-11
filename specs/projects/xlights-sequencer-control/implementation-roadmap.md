# Implementation Roadmap: Full Sequencer Control Program

Status: Active (governed by architecture reset plan)  
Date: 2026-03-11

Planning note:
- This roadmap remains valid as a phase inventory.
- Active execution ordering and gates are now controlled by `architecture-reset-plan-2026-03-11.md`.

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

## Phase 5: Contract Reconciliation + Production Hardening (WP-7)
- Close remaining endpoint-level contract gap (`layout.getDisplayElements`).
- Reconcile docs and acceptance semantics to shipped behavior.
- Finalize deterministic fixture setup for repeatable runs.
- Harden validation and explicit legacy regression gates.

Completion note:
- Phase executed and closed on 2026-03-02.
- Follow-on fixture packaging/versioning remains a post-WP-7 improvement item.

Exit criteria:
- Specs accurately describe implementation reality.
- Autonomous harness is repeatable and actionable in local + CI contexts.
- No unresolved high-impact contract ambiguity before further API expansion.

## Phase 6: Fixture Pack Portability (WP-8)
- Introduce fixture pack versioning metadata and validation rules.
- Add non-interactive bootstrap workflow for fixture preparation.
- Embed fixture pack identity in harness summary outputs.
- Add CI checks for fixture pack/bootstrap consistency.

Exit criteria:
- Fixture setup is reproducible and portable across local + CI runs.
- Agent loops can detect fixture mismatch conditions deterministically.

## Phase 7: End-to-End Authoring Completeness + API Decomposition (WP-9)
- Add missing control-plane APIs required for fully autonomous sequence building:
  - effect definition introspection
  - transaction semantics
  - async job lifecycle
  - structured open/save/render diagnostics
  - revision/concurrency tokens
- Reconcile capabilities and command availability to remove feature drift.
- Restructure automation implementation into grouped API modules and keep router code thin.

Exit criteria:
- Agent can run full create/edit/save loops with deterministic API-only control and recoverable failures.
- Long-running calls are observable/cancelable.
- Concurrent/stale-write hazards are explicitly guarded.
- `xLightsAutomations.cpp` is reduced to routing and shared orchestration, with command logic in grouped files.
