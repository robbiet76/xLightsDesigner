# API Surface Contract: xLights Sequencer Control (Program-Level)

Status: Draft  
Date: 2026-03-02  
Version: `v2-alpha-program`

## 1) Transport and Envelope
Transport remains `POST /xlDoAutomation` using a versioned command envelope.

Request shape:
```json
{
  "apiVersion": 2,
  "cmd": "sequence.open",
  "params": {},
  "options": {
    "dryRun": false,
    "requestId": "optional-client-id"
  }
}
```

Envelope rules:
- `apiVersion` is required and must be `2`.
- `cmd` is required and must be a non-empty namespaced string.
- `params` is optional and defaults to `{}`.
- `options` is optional.
- `options.dryRun` defaults to `false`.
- `options.requestId` is echoed in responses when provided.

## 2) Common Response Contract
Success:
```json
{
  "res": 200,
  "apiVersion": 2,
  "cmd": "sequence.open",
  "requestId": "optional-client-id",
  "data": {},
  "warnings": []
}
```

Error:
```json
{
  "res": 422,
  "apiVersion": 2,
  "cmd": "sequence.open",
  "requestId": "optional-client-id",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "file is required",
    "details": [
      { "path": "params.file", "reason": "required" }
    ]
  }
}
```

Status codes:
- `200` success
- `400` malformed envelope or unsupported version
- `404` referenced resource not found
- `409` conflict
- `422` semantic validation failure
- `500` internal failure

Baseline error codes:
- `BAD_REQUEST`
- `UNSUPPORTED_API_VERSION`
- `UNKNOWN_COMMAND`
- `VALIDATION_ERROR`
- `SEQUENCE_NOT_OPEN`
- `SEQUENCE_NOT_FOUND`
- `MEDIA_NOT_AVAILABLE`
- `TRACK_NOT_FOUND`
- `TRACK_ALREADY_EXISTS`
- `EFFECT_NOT_FOUND`
- `DISPLAY_ELEMENT_NOT_FOUND`
- `CONFLICT`
- `INTERNAL_ERROR`

## 3) Cross-Cutting Rules
- All mutating endpoints must support dry-run semantics.
- Dry-run validates and computes response summaries but performs no persistence.
- Bulk operations require explicit filter parameters.
- Layer addressing must use explicit target (`layerIndex` or stable layer id).
- Layout namespace endpoints are read-only by contract.
- Controllers namespace is excluded from this program.
- Long-running operations should support async job semantics (`jobId`, progress, cancel).
- Sequence mutations should support optimistic concurrency controls (`revisionToken`).

## 4) Command Contracts

## 4.1 System

### `system.getCapabilities`
Purpose: runtime feature detection and command discoverability.

Params: none.

Response `data`:
- `apiVersions`: number array
- `commands`: string array
- `features`: object map of booleans

Idempotency: read-only.

### `system.validateCommands`
Purpose: validate a batch of candidate commands before mutation.

Params:
- `commands` (array, required): envelope-like command objects.

Response `data`:
- `valid` (bool)
- `results` (array): per-command `{ index, valid, error? }`

Dry-run: always non-mutating.

## 4.2 Sequence Lifecycle

### `sequence.getOpen`
Purpose: return active sequence metadata.

Params: none.

Response `data`:
- `isOpen` (bool)
- `sequence` (object|null): `{ name, path, durationMs, frameMs, mediaFile }`

### `sequence.open`
Purpose: open an existing sequence.

Params:
- `file` (string, required)
- `force` (bool, default `false`)
- `promptIssues` (bool, default `false`)

Validation:
- file exists and is readable.

Response `data`:
- sequence metadata `{ name, path, durationMs, frameMs, mediaFile }`

Dry-run:
- validates file/permissions only; does not open sequence.

### `sequence.create`
Purpose: create a new sequence.

Params:
- `mediaFile` (string|null, optional)
- `durationMs` (int, required when `mediaFile` absent)
- `frameMs` (int, required)
- `view` (string|null, optional)

Validation:
- `frameMs > 0`
- `durationMs > 0` when media is not provided

Response `data`:
- created sequence metadata.

Dry-run:
- validates parameter set and media availability only.

### `sequence.save`
Purpose: save active sequence.

Params:
- `file` (string|null, optional): save-as target.

Validation:
- active sequence exists.

Response `data`:
- `saved` (bool)
- `file` (string)

Dry-run:
- validates save path only.

### `sequence.close`
Purpose: close active sequence.

Params:
- `force` (bool, default `false`)
- `quiet` (bool, default `false`)

Validation:
- active sequence existence unless `quiet=true`.

Response `data`:
- `closed` (bool)

Dry-run:
- validates close preconditions only.

## 4.3 Layout Discovery (Read-Only)

### `layout.getModels`
Response `data`:
- `models` array with `{ name, type, startChannel, endChannel, groupNames[] }`

### `layout.getModel`
Params:
- `name` (string, required)

Response `data`:
- detailed model metadata.

### `layout.getViews`
Response `data`:
- `views` array with model memberships.

### `layout.getDisplayElements`
Response `data`:
- `elements` array with `{ id, name, type, orderIndex, parentId }`

All `layout.*` commands:
- Idempotency: read-only.
- Must reject write-like params with `VALIDATION_ERROR`.

## 4.4 Media + Audio

### `media.get`
Purpose: get active sequence media assignment.

Response `data`:
- `mediaFile` (string|null)
- `hasMedia` (bool)

### `media.set`
Purpose: set/replace active sequence media file.

Params:
- `mediaFile` (string, required)

Validation:
- active sequence exists
- file exists/readable

Response `data`:
- `mediaFile`
- `updated` (bool)

Dry-run:
- validates file only.

### `media.getMetadata`
Purpose: return media metadata for timing/effect operations.

Params:
- `mediaFile` (string|null, optional): defaults to active sequence media.

Response `data`:
- `durationMs`
- `sampleRate`
- `channels`
- `bitrate` (optional)

### `timing.listAnalysisPlugins`
Purpose: list available timing analysis providers/plugins.

Response `data`:
- `plugins` array of `{ id, name, provider? }`

## 4.5 Timing Track Control

### `timing.getTracks`
Params:
- `includeCounts` (bool, default `false`)

Response `data`:
- `tracks` array with `{ name, type, markCount? }`

### `timing.createTrack`
Params:
- `trackName` (string, required)
- `trackType` (string, default `variable`)
- `replaceIfExists` (bool, default `false`)
- `addToAllViews` (bool, default `false`)

Conflict:
- existing track + `replaceIfExists=false` -> `TRACK_ALREADY_EXISTS`

Response `data`:
- `trackName`
- `action`: `created|updated`

Dry-run:
- validates naming and collisions only.

### `timing.renameTrack`
Params:
- `trackName` (string, required)
- `newTrackName` (string, required)

Validation:
- source exists
- destination not conflicting

Response `data`:
- `trackName`
- `newTrackName`

Dry-run:
- validates only.

### `timing.deleteTrack`
Params:
- `trackName` (string, required)

Response `data`:
- `deleted` (bool)

Dry-run:
- validates existence only.

## 4.6 Timing Mark Control

### `timing.getMarks`
Params:
- `trackName` (string, required)
- `startMs` (int, optional)
- `endMs` (int, optional)

Response `data`:
- `trackName`
- `marks` array of `{ startMs, endMs, label }`

### `timing.insertMarks`
Params:
- `trackName` (string, required)
- `marks` (array, required): `{ startMs, endMs?, label? }`

Validation:
- marks non-negative and ordered
- no invalid overlap for target mark type

Response `data`:
- `trackName`
- `insertedCount`

Dry-run:
- validates and returns `insertedCount` estimate.

### `timing.replaceMarks`
Params:
- `trackName` (string, required)
- `marks` (array, required)

Response `data`:
- `trackName`
- `replacedCount`

Dry-run:
- validates and returns replacement summary.

### `timing.deleteMarks`
Params:
- `trackName` (string, required)
- filter fields: `markIndexes[]` or `startMs/endMs` range

Validation:
- at least one filter selector required.

Response `data`:
- `trackName`
- `deletedCount`

Dry-run:
- validates and returns delete summary.

### `timing.getTrackSummary`
Params:
- `trackName` (string, required)

Response `data`:
- `trackName`
- `markCount`
- `startMs`
- `endMs`
- `intervalStats`: `{ minMs, maxMs, avgMs }`
- `layers`: `{ phrases, words, phonemes }`

Idempotency: read-only.

## 4.7 Display Element Ordering

### `sequencer.getDisplayElementOrder`
Response `data`:
- `elements` array of `{ id, name, orderIndex }`

### `sequencer.setDisplayElementOrder`
Params:
- `orderedIds` (array, required)

Validation:
- ids must map to existing display elements
- list must be complete or explicit partial mode must be set

Response `data`:
- `updated` (bool)
- `elementCount`

Dry-run:
- validates reorder feasibility only.

## 4.8 Effects + Layers

### `effects.list`
Params:
- `modelName` (string|null, optional)
- `layerIndex` (int|null, optional)
- `startMs` (int|null, optional)
- `endMs` (int|null, optional)

Response `data`:
- `effects` array with `{ id, modelName, layerIndex, effectName, startMs, endMs, settings }`

Idempotency: read-only.

### `effects.create`
Params:
- `modelName` (string, required)
- `layerIndex` (int, required)
- `effectName` (string, required)
- `startMs` (int, required)
- `endMs` (int, required)
- `settings` (object, optional)

Validation:
- `endMs > startMs`
- model/layer exist

Response `data`:
- `effectId`
- `created` (bool)

Dry-run:
- validates and returns simulated placement metadata.

### `effects.update`
Params:
- `effectId` (string|int, required)
- `startMs` (int, optional)
- `endMs` (int, optional)
- `settings` (object, optional)

Validation:
- effect exists
- range remains valid

Response `data`:
- `effectId`
- `updated` (bool)

Dry-run:
- validates only.

### `effects.delete`
Params:
- one selector required: `effectIds[]` or filter set (`modelName/layerIndex/startMs/endMs`)

Response `data`:
- `deletedCount`

Dry-run:
- returns deletion summary only.

### `effects.shift`
Params:
- target filter (`effectIds[]` or model/layer/range)
- `deltaMs` (int, required)
- `clipToSequence` (bool, default `true`)

Validation:
- non-empty target
- `deltaMs != 0`

Response `data`:
- `shiftedCount`
- `clippedCount`

Dry-run:
- returns projected movement summary.

### `effects.alignToTiming`
Params:
- target filter (`effectIds[]` or model/layer/range)
- `timingTrackName` (string, required)
- `mode` (string, default `nearest`): `nearest|expand|contract`

Response `data`:
- `alignedCount`

Dry-run:
- returns projected align summary.

### `effects.clone`
Params:
- source filter (`sourceModelName`, `sourceLayerIndex`, optional range)
- destination targets (`targetModels[]`, `targetLayerIndex`)
- `mode` (string, default `replace`): `replace|append`

Response `data`:
- `createdCount`
- `updatedCount`

Dry-run:
- returns projected clone summary.

## 4.9 Proposed WP-9 Extensions

### `effects.listDefinitions`
Purpose: enumerate effect definitions and parameter contracts.

Response `data`:
- `effects` array of:
  - `effectName`
  - `category`
  - `params[]` with:
    - `name`
    - `type` (`int|float|bool|string|enum|color|curve|file`)
    - `required`
    - `default`
    - `min/max` (where applicable)
    - `enumValues[]` (where applicable)
    - `description`

### `effects.getDefinition`
Purpose: fetch one effect definition by effect name.

Params:
- `effectName` (string, required)

Response `data`:
- `effect` object matching the schema used by `effects.listDefinitions`.

### `transactions.begin`
Purpose: start an atomic mutation scope.

Response `data`:
- `transactionId`
- `sequenceRevision`
- `expiresAt`

### `transactions.commit`
Purpose: atomically apply staged mutations.

Params:
- `transactionId` (string, required)
- `expectedRevision` (string, optional/recommended)

Response `data`:
- `committed`
- `newRevision`
- `appliedCommandCount`

### `transactions.rollback`
Purpose: abandon staged mutations.

Params:
- `transactionId` (string, required)

Response `data`:
- `rolledBack`

### `jobs.get`
Purpose: poll async operation progress and result payload.

Params:
- `jobId` (string, required)

Response `data`:
- `jobId`
- `status` (`queued|running|completed|failed|cancelled`)
- `progressPct`
- `result`
- `error`

### `jobs.cancel`
Purpose: cancel a running async operation.

Params:
- `jobId` (string, required)

Response `data`:
- `cancelled`

### `sequence.getRevision`
Purpose: fetch current sequence revision token.

Response `data`:
- `sequencePath`
- `revisionToken`
- `lastModifiedEpochMs`

## 5) Implementation Architecture Requirement (WP-9)
- API command logic should be grouped into separate source files by namespace/domain.
- `xLightsAutomations.cpp` should be limited to envelope parsing, routing, and shared orchestration.
- Domain behavior should not continue to expand in a single monolithic file.

## 6) Completion Definition
This contract is complete when each command in Sections 4.1-4.9 has:
- schema-locked params and response keys,
- validation rules and error mappings,
- dry-run behavior (if mutating),
- integration tests proving deterministic behavior.
