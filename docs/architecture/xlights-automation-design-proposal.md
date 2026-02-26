# xLights Automation API Design Proposal

Date: 2026-02-26  
Context repo: `/Users/robterry/Projects/xLightsDesigner`  
Source analyzed: `/Users/robterry/xLights/xLights` (`f3d67a91a689`)

## Decision to Make
Should new agent-sequencing APIs be added by:
1. Extending existing `ProcessAutomation`, or
2. Introducing a separate v2 API surface now?

## Recommendation (Short)
Use **`ProcessAutomation` as the transport and entry point**, but add a **versioned command contract inside it** and freeze legacy semantics.

This gives maintainers the low-friction extension path they likely prefer while preserving a clean migration path to a formal v2 namespace later.

## Goals
- Preserve backward compatibility for existing `xlDo` and GET/POST automation users.
- Add agent-critical sequencing APIs (timing/effect lifecycle) safely.
- Avoid accumulating more unversioned, ad-hoc command semantics.
- Make future extraction to a dedicated API v2 cheap.

## Non-Goals
- Replacing the entire automation transport now.
- Immediate full REST redesign.
- Headless/server re-architecture in phase 1.

## Current Constraints
- Current automation is centralized in a monolithic command chain: `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp:92`
- Transport mixes GET command paths and POST JSON (`/xlDoAutomation`): `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp:1175`
- Runtime is GUI-loop based with UI-coupled sequencing operations.
- Legacy docs already warned the API is experimental and evolving.

## Option Analysis

### Option A: Extend existing `ProcessAutomation` directly (unversioned)
Pros
- Lowest short-term implementation friction.
- Highest likely maintainer acceptance initially.
- No new routing layer.

Cons
- Continues flat command namespace drift.
- Harder to enforce stable schemas/error contracts.
- Increased long-term migration cost.

### Option B: Build separate endpoint namespace/API v2 now
Pros
- Clean contract boundary from day 1.
- Easier strict typing/versioning.
- Better long-term maintainability.

Cons
- Higher upfront change and review scope.
- Greater maintainer skepticism/risk perception.
- Duplicated handling during transition.

### Option C (Recommended): Extend `ProcessAutomation` with internal versioned command contracts
Pros
- Keeps existing entry point, reducing political/operational overhead.
- Introduces explicit versioning and schema discipline now.
- Avoids lock-in by separating legacy vs versioned dispatch paths.
- Enables gradual migration to external `/api/v2` later without redesigning commands.

Cons
- Requires discipline to avoid slipping new features into legacy command style.
- Transitional complexity (two behavior classes in one transport).

## Why Option C Avoids a Corner
Design guardrails:
1. **Legacy freeze**
- Existing commands remain behavior-compatible.
- No new P0 features are added as unversioned legacy commands.

2. **Versioned command envelope for all new APIs**
- POST `/xlDoAutomation` payload must include `apiVersion` for new commands.
- Example:
```json
{
  "apiVersion": 2,
  "cmd": "sequencing.createTimingTrack",
  "params": { "name": "Beat", "kind": "variable" }
}
```

3. **Namespaced command IDs**
- Use domain names (`sequencing.*`, `timing.*`, `effects.*`, `playback.*`, `system.*`).
- Prevents flat namespace collisions and ambiguous semantics.

4. **Central capability discovery**
- Add `getCapabilities` returning supported `apiVersions`, commands, and feature flags.
- Agents can adapt without hardcoding assumptions.

5. **Schema validation gate**
- Reject invalid payloads before side effects.
- Standardized error envelope for v2 commands.

6. **Dispatcher split in code organization**
- Keep transport in `ProcessAutomation`.
- Route into handlers by version/module (`handleLegacy`, `handleV2Sequencing`, etc.).
- This keeps future extraction to `/api/v2` mostly routing work.

## Proposed Contract Shape (v2-in-current-transport)

### Request
```json
{
  "apiVersion": 2,
  "cmd": "effects.shift",
  "params": {
    "target": { "model": "MegaTree", "layer": 0, "startMs": 0, "endMs": 60000 },
    "deltaMs": 50,
    "mode": "snap_to_timing"
  },
  "options": {
    "dryRun": false,
    "requestId": "client-generated-id"
  }
}
```

### Response
```json
{
  "res": 200,
  "apiVersion": 2,
  "cmd": "effects.shift",
  "requestId": "client-generated-id",
  "data": {},
  "warnings": []
}
```

### Error
```json
{
  "res": 422,
  "apiVersion": 2,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "deltaMs must be non-zero",
    "details": [{ "path": "params.deltaMs", "reason": "must_not_equal_zero" }]
  }
}
```

## Initial Endpoint Set Under v2 Contract
P0 sequence-authoring endpoints:
- `timing.createTrack`
- `timing.renameTrack`
- `timing.deleteTrack`
- `timing.getTracks`
- `timing.insertMarks`
- `timing.replaceMarks`
- `timing.deleteMarks`
- `effects.list`
- `effects.delete`
- `effects.shift`
- `effects.alignToTiming`
- `system.validateCommands` (dry-run batch)
- `system.getCapabilities`

## Migration Policy
- Legacy commands continue unchanged for existing tooling.
- New functionality lands only in v2 contract.
- If a legacy equivalent is needed, implement as thin adapter into v2 handler.

## Maintainer Buy-In Strategy
1. Keep PR-1 narrow: introduce versioned dispatcher + `getCapabilities` + 1-2 non-controversial endpoints.
2. Show zero regression for existing commands via compatibility tests.
3. Add docs demonstrating no required migration for current users.
4. Follow with P0 sequencing endpoints in smaller PRs.

## Risks and Mitigations
- Risk: Versioning ignored in practice.
- Mitigation: PR rule: any new command must be v2 namespaced.

- Risk: UI-coupled side effects produce nondeterministic automation.
- Mitigation: require dry-run and explicit target filters; avoid implicit selection state.

- Risk: monolithic function remains hard to maintain.
- Mitigation: incremental extraction into per-domain handlers while preserving entrypoint.

## Proposed Implementation Phases
1. **Phase 0**: Add versioned envelope parsing + `getCapabilities` + standardized v2 error model.
2. **Phase 1**: Add timing track/mark CRUD (P0).
3. **Phase 2**: Add effect lifecycle completeness (`list/delete/shift/align`) (P0).
4. **Phase 3**: Add playback/preview and validation enhancements (P1).

## Acceptance Criteria for the Decision
This decision is successful if:
- Existing automation clients continue to work unchanged.
- New agent features ship without adding unversioned flat commands.
- Future move to `/api/v2` requires routing changes, not contract rewrite.

## Decision
Proceed with **Option C**: extend current `ProcessAutomation` with a versioned, namespaced v2 command contract.
