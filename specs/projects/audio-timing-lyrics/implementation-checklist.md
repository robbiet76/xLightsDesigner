# Implementation Checklist: Audio Timing + Lyrics (Phase 1)

Date: 2026-02-26  
Status: Execution checklist for xLights PR work.

## Global Prerequisites
- [ ] v2 envelope accepted by `/xlDoAutomation` with `apiVersion`, `cmd`, `params`, `options`.
- [ ] Standard response shape implemented for success/error (`res`, `apiVersion`, `cmd`, `data` or `error`).
- [ ] Standard error codes wired (`UNSUPPORTED_API_VERSION`, `UNKNOWN_COMMAND`, `VALIDATION_ERROR`, `TRACK_ALREADY_EXISTS`, etc.).
- [ ] Dry-run behavior (`options.dryRun=true`) validates and reports, without persistence.

## PR-1: Framework + Discovery

### `system.getCapabilities`
Implementation checklist:
- [ ] Command handler added under v2 routing.
- [ ] Returns `apiVersions`, `commands`, and feature flags.
- [ ] Feature flags reflect runtime availability (not hardcoded true).

Acceptance tests:
- [ ] `apiVersion=2` returns `res=200`.
- [ ] `commands` includes all phase-1 endpoints currently enabled.
- [ ] If song-structure backend is unavailable, response sets `songStructureDetectionAvailable=false`.

### `timing.listAnalysisPlugins`
Implementation checklist:
- [ ] Handler calls VAMP plugin discovery from current media runtime.
- [ ] Response returns stable plugin identifiers/names.

Acceptance tests:
- [ ] Returns `res=200` with `plugins` array.
- [ ] Empty-plugin environments return `plugins=[]` (not error).
- [ ] No sequence/media returns clear error (`SEQUENCE_NOT_OPEN` or `MEDIA_NOT_AVAILABLE`).

## PR-2: Audio Timing Generation

### `timing.createFromAudio`
Implementation checklist:
- [ ] Non-UI plugin processing helper extracted from dialog path.
- [ ] Supports `plugin`, `trackName`, optional `mediaFile`, `replaceIfExists`.
- [ ] Collision behavior enforced (`409` when replace is false and track exists).
- [ ] Existing UI flow still works via shared helper (no behavior drift).

Acceptance tests:
- [ ] Valid request creates timing track and returns `markCount > 0` for known plugin/media.
- [ ] Unknown plugin returns `PLUGIN_NOT_FOUND`.
- [ ] Existing track + `replaceIfExists=false` returns `TRACK_ALREADY_EXISTS`.
- [ ] Existing track + `replaceIfExists=true` updates same track name.

### `timing.getTrackSummary`
Implementation checklist:
- [ ] Handler reads timing track and computes mark/layer statistics.
- [ ] Returns interval stats (`minMs`, `maxMs`, `avgMs`) and layer counts.

Acceptance tests:
- [ ] Existing track returns deterministic summary values.
- [ ] Missing track returns `TRACK_NOT_FOUND`.
- [ ] Track with no marks returns valid zero-safe summary (no divide-by-zero).

### `timing.createBarsFromBeats`
Implementation checklist:
- [ ] Source track lookup/validation added.
- [ ] Bar/downbeat derivation added with `beatsPerBar`.
- [ ] Target track write path uses standard collision rules.

Acceptance tests:
- [ ] Known beat track + `beatsPerBar=4` creates bar track with ordered marks.
- [ ] Invalid `beatsPerBar<=0` returns `VALIDATION_ERROR`.
- [ ] Missing source track returns `TRACK_NOT_FOUND`.

### `timing.createEnergySections`
Implementation checklist:
- [ ] Local energy analyzer added (deterministic segmentation).
- [ ] Supports `levels`, `smoothingMs`, `replaceIfExists`.
- [ ] Output sections are sorted and non-overlapping.

Acceptance tests:
- [ ] Valid media creates `sectionCount > 0`.
- [ ] Sections cover non-zero duration and are time-ordered.
- [ ] Invalid `levels` or `smoothingMs` returns `VALIDATION_ERROR`.

## PR-3: Lyrics Tracks

### `lyrics.createTrackFromText`
Implementation checklist:
- [ ] Non-dialog helper extracted for phrase/word/phoneme generation.
- [ ] Supports `startMs`, `endMs`, `breakdownWords`, `breakdownPhonemes`, `replaceExistingLayers`.
- [ ] Unknown-word reporting returned in response.

Acceptance tests:
- [ ] Valid lyrics text creates phrase layer and expected counts.
- [ ] `breakdownWords=false` suppresses word/phoneme creation.
- [ ] Invalid ranges (`endMs<=startMs`) return `VALIDATION_ERROR`.
- [ ] Empty text returns `VALIDATION_ERROR`.

### `lyrics.importSrt`
Implementation checklist:
- [ ] API wrapper calls SRT parser/import path without UI dependency.
- [ ] Supports target `trackName` and replace behavior.
- [ ] Returns import counts + parse warnings.

Acceptance tests:
- [ ] Valid SRT imports with `subtitleEntries > 0`.
- [ ] Missing file returns `FILE_NOT_FOUND`.
- [ ] Malformed SRT returns `VALIDATION_ERROR` with parse details.

## PR-4 (Optional): Song Structure

### `timing.detectSongStructure`
Implementation checklist:
- [ ] Song structure analyzer added behind capability flag.
- [ ] Emits labeled sections with confidence.
- [ ] Fallback behavior defined for low-confidence outputs.

Acceptance tests:
- [ ] If enabled, returns ordered non-overlapping sections.
- [ ] If disabled/unavailable, endpoint returns explicit not-supported error or excluded capability.
- [ ] Confidence values constrained to `0.0..1.0`.

## Cross-Cutting Validation Checklist
- [ ] No legacy command behavior changed.
- [ ] All new mutating endpoints honor dry-run no-mutation guarantee.
- [ ] All endpoints return machine-parseable deterministic keys.
- [ ] Error payload always contains `code` + `message`.
- [ ] Unit/integration tests added for each endpoint’s happy-path + key failures.

## Exit Criteria for Phase 1
- [ ] External client can run full prep flow:
  - list plugins
  - create base timing track
  - create bars/downbeats track
  - create energy track
  - create or import lyrics track
  - read summaries
- [ ] Run completes without UI dialogs.
- [ ] Existing xLights manual workflows remain intact.
