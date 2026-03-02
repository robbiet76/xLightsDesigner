# Decision Log: xLights Sequencer Control Program

Date: 2026-03-02  
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
