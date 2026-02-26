# API Contract: Audio Timing + Lyrics (Phase 1)

Status: Draft  
Version: `v2-alpha1`  
Date: 2026-02-26

## 1) Transport and Envelope

Endpoint transport (existing):
- `POST /xlDoAutomation`

All new Phase 1 commands use this JSON envelope:

```json
{
  "apiVersion": 2,
  "cmd": "timing.createFromAudio",
  "params": {},
  "options": {
    "dryRun": false,
    "requestId": "optional-string"
  }
}
```

Envelope rules:
- `apiVersion`: required, must be `2`.
- `cmd`: required, namespaced string.
- `params`: optional object, defaults to `{}`.
- `options`: optional object.
- `options.dryRun`: optional bool, default `false`.
- `options.requestId`: optional string echoed in response.

## 2) Common Responses

Success:
```json
{
  "res": 200,
  "apiVersion": 2,
  "cmd": "timing.createFromAudio",
  "requestId": "optional-string",
  "data": {},
  "warnings": []
}
```

Error:
```json
{
  "res": 422,
  "apiVersion": 2,
  "cmd": "timing.createFromAudio",
  "requestId": "optional-string",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "trackName is required",
    "details": [
      { "path": "params.trackName", "reason": "required" }
    ]
  }
}
```

Standard status codes:
- `200`: success
- `400`: malformed envelope / unsupported `apiVersion`
- `404`: referenced entity not found (track/file/plugin)
- `409`: conflict (duplicate track with replace disabled)
- `422`: semantic validation error
- `500`: unexpected internal error

Standard error codes:
- `BAD_REQUEST`
- `UNSUPPORTED_API_VERSION`
- `UNKNOWN_COMMAND`
- `VALIDATION_ERROR`
- `SEQUENCE_NOT_OPEN`
- `MEDIA_NOT_AVAILABLE`
- `PLUGIN_NOT_FOUND`
- `TRACK_NOT_FOUND`
- `TRACK_ALREADY_EXISTS`
- `FILE_NOT_FOUND`
- `INTERNAL_ERROR`

## 3) Command Contracts

## 3.1 `system.getCapabilities`
Purpose: feature discovery for clients.

Request:
```json
{ "apiVersion": 2, "cmd": "system.getCapabilities", "params": {} }
```

Response `data`:
- `apiVersions`: `[2]`
- `commands`: string array
- `features`:
  - `vampPluginsAvailable` (bool)
  - `lyricsSrtImportAvailable` (bool)
  - `songStructureDetectionAvailable` (bool)

Idempotency: read-only.

## 3.2 `timing.listAnalysisPlugins`
Purpose: list available audio-analysis plugins.

Request:
```json
{ "apiVersion": 2, "cmd": "timing.listAnalysisPlugins", "params": {} }
```

Response `data`:
- `plugins`: array of:
  - `id` (string)
  - `name` (string)

Idempotency: read-only.

## 3.3 `timing.createFromAudio`
Purpose: create timing marks from selected analysis plugin.

Params:
- `plugin` (string, required)
- `trackName` (string, required)
- `mediaFile` (string|null, optional)
- `replaceIfExists` (bool, default `false`)
- `addToAllViews` (bool, default `false`)

Validation:
- `plugin` must exist in `timing.listAnalysisPlugins`.
- `trackName` non-empty.
- media must resolve to a readable file.

Conflict behavior:
- existing track + `replaceIfExists=false` -> `409 TRACK_ALREADY_EXISTS`
- existing track + `replaceIfExists=true` -> replace marks in target timing layer.

Response `data`:
- `trackName`
- `action`: `created|updated`
- `plugin`
- `markCount`
- `startMs`
- `endMs`

Idempotency:
- same inputs + same source state => same resulting marks/count.

## 3.4 `timing.getTrackSummary`
Purpose: query timing track metrics.

Params:
- `trackName` (string, required)

Validation:
- timing track must exist.

Response `data`:
- `trackName`
- `markCount`
- `startMs`
- `endMs`
- `intervalStats`:
  - `minMs`
  - `maxMs`
  - `avgMs`
- `layers`:
  - `phrases` (count)
  - `words` (count)
  - `phonemes` (count)

Idempotency: read-only.

## 3.5 `timing.detectSongStructure`
Purpose: detect coarse song sections and write labeled timing marks.

Params:
- `trackName` (string, required)
- `mediaFile` (string|null, optional)
- `replaceIfExists` (bool, default `false`)
- `labelStyle` (string, default `standard`)

`labelStyle` values:
- `standard` (default labels: Intro/Verse/PreChorus/Chorus/Bridge/Outro/Instrumental)
- `compact` (Section A/B/C...)

Validation:
- `trackName` non-empty
- media must resolve/read

Conflict behavior:
- existing track + `replaceIfExists=false` -> `409 TRACK_ALREADY_EXISTS`
- existing track + `replaceIfExists=true` -> replace structure marks

Response `data`:
- `trackName`
- `action`: `created|updated`
- `sectionCount`
- `sections`: array of
  - `label`
  - `startMs`
  - `endMs`
  - `confidence` (`0.0..1.0`)
- `coverageMs`

Output invariants:
- sections ordered by `startMs`
- no overlap (`next.startMs >= current.endMs`)
- each section duration `> 0`

## 3.6 `lyrics.createTrackFromText`
Purpose: create phrases and optional word/phoneme layers from plain text.

Params:
- `trackName` (string, required)
- `text` (string, required; newline separates phrases)
- `startMs` (int, required)
- `endMs` (int, required)
- `replaceExistingLayers` (bool, default `false`)
- `breakdownWords` (bool, default `true`)
- `breakdownPhonemes` (bool, default `true`)

Validation:
- `text` must contain at least one non-empty line
- `startMs >= 0`
- `endMs > startMs`

Behavior:
- phrase layer always generated from text lines
- word layer generated only if `breakdownWords=true`
- phoneme layer generated only if `breakdownPhonemes=true`

Response `data`:
- `trackName`
- `action`: `created|updated`
- `counts`:
  - `phrases`
  - `words`
  - `phonemes`
- `unknownWords`: string array

Idempotency:
- with same text/timing/options and same dictionary, output counts are stable.

## 3.7 `timing.createBarsFromBeats`
Purpose: derive a bars/downbeats timing track from a beat track.

Params:
- `sourceTrackName` (string, required)
- `trackName` (string, required)
- `beatsPerBar` (int, default `4`)
- `replaceIfExists` (bool, default `false`)

Validation:
- source track must exist and contain valid marks
- `beatsPerBar > 0`

Conflict behavior:
- existing track + `replaceIfExists=false` -> `409 TRACK_ALREADY_EXISTS`
- existing track + `replaceIfExists=true` -> replace bar/downbeat marks

Response `data`:
- `trackName`
- `action`: `created|updated`
- `sourceTrackName`
- `beatsPerBar`
- `barCount`
- `downbeatCount`
- `startMs`
- `endMs`

Output invariants:
- generated marks ordered by time
- marks non-overlapping

## 3.8 `timing.createEnergySections`
Purpose: create low/medium/high intensity sections from audio analysis.

Params:
- `trackName` (string, required)
- `mediaFile` (string|null, optional)
- `replaceIfExists` (bool, default `false`)
- `levels` (array of strings, optional; default `["low","medium","high"]`)
- `smoothingMs` (int, optional; default implementation-defined)

Validation:
- media must resolve/read
- `levels` must contain at least 2 distinct labels
- `smoothingMs >= 0` if provided

Conflict behavior:
- existing track + `replaceIfExists=false` -> `409 TRACK_ALREADY_EXISTS`
- existing track + `replaceIfExists=true` -> replace energy sections

Response `data`:
- `trackName`
- `action`: `created|updated`
- `sectionCount`
- `sections`: array of
  - `label`
  - `startMs`
  - `endMs`
  - `confidence`
- `coverageMs`

Output invariants:
- sections ordered by `startMs`
- no overlap
- duration of each section `> 0`

## 3.9 `lyrics.importSrt`
Purpose: import subtitle timing into lyric scaffolding.

Params:
- `file` (string absolute path, required)
- `trackName` (string, required)
- `replaceExistingLayers` (bool, default `false`)
- `breakdownPhonemes` (bool, default `true`)

Validation:
- `file` must exist and parse as valid SRT
- `trackName` non-empty

Behavior:
- subtitle rows map to phrase timings
- optional phoneme breakdown from phrase/word text

Response `data`:
- `trackName`
- `action`: `created|updated`
- `subtitleEntries`
- `counts`:
  - `phrases`
  - `words`
  - `phonemes`
- `parseWarnings`: array

## 4) Dry-Run Rules
For mutating commands with `options.dryRun=true`:
- perform all validation and preflight checks,
- return computed `data` summaries where possible,
- do not persist any sequence changes.

Response still uses `res=200` when preflight passes.

## 5) Naming and Collision Rules
- Track names are case-sensitive in API contract.
- If target name exists and replace flag is false: return `409`.
- If replace flag is true: preserve track identity/name, replace generated content only.

## 6) Compatibility Rules
- Legacy unversioned commands remain unchanged.
- New phase-1 features must not be added as legacy flat commands.
- Any compatibility aliases must delegate to v2 handlers.

## 7) Minimal Contract Test Matrix
- envelope validation (`apiVersion`, unknown cmd, malformed types)
- per-command required fields
- plugin not found
- sequence/media missing
- duplicate track conflict vs replace path
- dry-run no-mutation verification
- summary output invariants
- bars/downbeats derivation invariants
- energy section ordering/coverage invariants
