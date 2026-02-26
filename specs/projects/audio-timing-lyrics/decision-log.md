# Decision Log: Audio Timing + Lyrics (Phase 1)

Date: 2026-02-26  
Status: Locked defaults for implementation unless explicitly revised.

## Purpose
Capture key behavior decisions ahead of coding to reduce churn across PR-1/PR-2/PR-3.

## Decisions

### D1) API version strategy
Decision:
- Keep legacy automation unchanged.
- Add new commands only under `apiVersion: 2`.

Rationale:
- Lowest maintainer risk and clean feature detection.

Impacted work:
- PR-1

---

### D2) v2 request compatibility behavior
Decision:
- If `apiVersion` is present and not `2`, return `400 UNSUPPORTED_API_VERSION`.
- If `apiVersion` is absent, continue legacy behavior path.

Rationale:
- Backward compatibility for existing scripts with explicit guardrails for new clients.

Impacted work:
- PR-1

---

### D3) `timing.createFromAudio` plugin parameters (PR-2)
Decision:
- Defer plugin parameter override API to later phase.
- PR-2 uses plugin default parameters only.

Rationale:
- Avoid broad surface area in initial non-UI extraction.
- Minimizes behavior mismatch with current UI flows.

Impacted work:
- PR-2

---

### D4) `timing.createEnergySections` confidence field
Decision:
- Include `confidence` field in response payload.
- For PR-2 alpha, use deterministic heuristic score in `0.0..1.0`.
- If reliable confidence cannot be computed, return `0.0` and include warning.

Rationale:
- Keeps contract stable now without blocking on advanced model work.

Impacted work:
- PR-2

---

### D5) Bars/downbeats behavior on irregular source beats
Decision:
- Ignore invalid/non-monotonic duplicates.
- Derive bars from remaining ordered marks.
- If insufficient valid marks remain, return `422 VALIDATION_ERROR`.

Rationale:
- Deterministic output and clear failure mode.

Impacted work:
- PR-2

---

### D6) Lyrics replace semantics
Decision:
- `replaceExistingLayers=true`: replace generated lyric layers on target track (phrase/word/phoneme) only.
- Non-lyric or unrelated timing data on same track should not be modified.
- `replaceExistingLayers=false`: if generated lyric layers already exist, return `409 TRACK_ALREADY_EXISTS`.

Rationale:
- Safer default for user content while preserving deterministic automation behavior.

Impacted work:
- PR-3

---

### D7) Unknown-word reporting format
Decision:
- Return both:
  - `unknownWords`: unique sorted string array
  - `unknownWordCount`: integer total unknown token occurrences

Rationale:
- Useful for both UI display and machine triage without extra calls.

Impacted work:
- PR-3

---

### D8) `lyrics.importSrt` phoneme default
Decision:
- Default `breakdownPhonemes=true`.

Rationale:
- Aligns with phase-1 goal of producing immediately useful lyric scaffolding.

Impacted work:
- PR-3

---

### D9) Dry-run semantics for mutating endpoints
Decision:
- Validate and compute summary output where possible.
- Do not persist sequence/track/layer mutations.

Rationale:
- Enables safe planning and client-side retries.

Impacted work:
- PR-1/PR-2/PR-3

---

### D10) Song structure in phase 1
Decision:
- Keep `timing.detectSongStructure` optional and capability-gated.
- If unavailable, advertise `songStructureDetectionAvailable=false`.

Rationale:
- Avoid blocking phase-1 delivery on classifier maturity.

Impacted work:
- Optional PR-4

## Change Control
- Any change to these decisions requires:
  - update to this file,
  - linked update to `api-contract.md`,
  - note in PR description.
