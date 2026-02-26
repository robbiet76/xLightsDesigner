# PR-1 Task Breakdown: v2 Framework + Discovery

Date: 2026-02-26  
Scope: `system.getCapabilities`, `timing.listAnalysisPlugins`, v2 envelope/error scaffolding.

## PR-1 Outcome
Ship a minimal but stable v2 automation surface that is backward-compatible with existing automation commands.

## Files and Changes

### 1) `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`
Changes:
- Add v2 request parsing branch for JSON envelope:
  - required: `apiVersion`, `cmd`
  - optional: `params`, `options`
- Add v2 command dispatcher:
  - `system.getCapabilities`
  - `timing.listAnalysisPlugins`
- Add standardized response helpers:
  - `Success(res=200, apiVersion=2, cmd, data, warnings?)`
  - `Error(res, apiVersion=2, cmd, code, message, details?)`
- Preserve legacy behavior when:
  - `apiVersion` missing
  - legacy path/command forms are used

Complexity: Medium  
Risk: Medium (touches central automation router)

### 2) `/Users/robterry/xLights/xLights/xLightsMain.h` (if needed)
Changes:
- Declare private helper methods used by PR-1 dispatcher/serializers (if implemented as member helpers).

Complexity: Low  
Risk: Low

### 3) `/Users/robterry/xLights/xLights/AudioManager.cpp` (read-only for PR-1)
Changes:
- No core logic changes expected.
- Use existing `xLightsVamp::GetAvailablePlugins(...)` path.

Complexity: None  
Risk: None

## Endpoint-Level Tasks

### `system.getCapabilities`
Tasks:
- Define capability payload keys and keep them stable.
- Populate feature booleans from runtime checks:
  - `vampPluginsAvailable`
  - `lyricsSrtImportAvailable`
  - `songStructureDetectionAvailable` (likely false in PR-1)
- Include command list for currently enabled v2 endpoints only.

Acceptance:
- Returns `res=200` and machine-parseable `data`.

### `timing.listAnalysisPlugins`
Tasks:
- Verify sequence/media preconditions.
- Query VAMP plugin list using existing audio manager path.
- Return deterministic plugin list payload:
  - recommended fields: `id`, `name`

Acceptance:
- Returns `plugins` array; empty array is valid.

## Error Model Tasks
- Add/standardize codes at PR-1 layer:
  - `BAD_REQUEST`
  - `UNSUPPORTED_API_VERSION`
  - `UNKNOWN_COMMAND`
  - `SEQUENCE_NOT_OPEN`
  - `MEDIA_NOT_AVAILABLE`
  - `INTERNAL_ERROR`
- Ensure each error response includes:
  - `res`
  - `apiVersion`
  - `cmd` (when known)
  - `error.code`
  - `error.message`

## Test Plan (PR-1)

### Envelope tests
- `apiVersion` missing on v2-style payload -> `400 BAD_REQUEST` or legacy fallback (choose and document).
- `apiVersion != 2` -> `400 UNSUPPORTED_API_VERSION`.
- missing `cmd` -> `400 BAD_REQUEST`.
- unknown v2 command -> `404 UNKNOWN_COMMAND`.

### Capability tests
- `system.getCapabilities` returns expected top-level keys.
- command registry in response matches enabled PR-1 endpoints.

### Plugin list tests
- no sequence open -> `SEQUENCE_NOT_OPEN`.
- sequence open but no media -> `MEDIA_NOT_AVAILABLE`.
- media present and plugins available -> non-empty list.
- media present but no plugins installed -> empty list with `res=200`.

### Backward compatibility tests
- Existing legacy commands still execute with unchanged payload format/semantics.

## Implementation Order (Inside PR-1)
1. Add v2 envelope parser + response helpers.
2. Add `system.getCapabilities`.
3. Add `timing.listAnalysisPlugins`.
4. Add test coverage (envelope/errors + endpoints + legacy safety).
5. Manual smoke test through `/xlDoAutomation`.

## Definition of Done
- v2 envelope is functional and stable.
- Two discovery endpoints are live and documented.
- Error codes are deterministic.
- Legacy automation behavior is unchanged.
- PR includes tests and sample request/response payloads in description.

## Suggested PR Description Snippets

### Sample request: capabilities
```json
{
  "apiVersion": 2,
  "cmd": "system.getCapabilities",
  "params": {}
}
```

### Sample request: plugin list
```json
{
  "apiVersion": 2,
  "cmd": "timing.listAnalysisPlugins",
  "params": {}
}
```
