# Decision Log: Audio Timing + Lyrics (Phase 1)

Status: Locked defaults for implementation unless explicitly revised.
Date: 2026-02-26
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11

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

### D3) `timing.createFromAudio` provider parameters (PR-2)
Decision:
- Defer provider parameter override API to later phase.
- PR-2 uses provider default parameters only.

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

---

### D11) Beat/bar source strategy (service-first + quality arbitration)
Decision:
- Use app-side analysis services (BeatNet + Librosa when available) as primary beat/onset sources.
- Score candidate beat streams and select best provider automatically.
- Use deterministic web tempo/meter validation from exact track identity (songbpm/getsongbpm) to detect half/double-time or bar-rate mismatches.
- Apply correction before writing final beat/bar tracks.
- Do not emit synthetic “success” data when service calls fail.

Rationale:
- Avoid dependency on local VAMP installation for hobbyist users.
- Beat providers can fail differently by song; quality arbitration is more robust than single-provider lock-in.
- Meter-aware correction plus exact-track validation materially improves beat/bar fidelity.

Impacted work:
- App analysis pipeline
- Analysis service contracts/metadata
- Beat/bar write stage

---

### D12) Fingerprint-first identity and cache
Decision:
- AudD fingerprint identity is authoritative for track-level lookups.
- Cache fingerprint->identity results to minimize repeat third-party calls.
- Local filename is fallback hint only when fingerprint identity is unavailable.

Rationale:
- Prevent mismatched lookups from renamed files.
- Reduce API quota consumption and improve responsiveness.

Impacted work:
- Analysis service identity layer
- Web validation and lyrics lookup paths

---

### D13) Chord progression as structure evidence
Decision:
- Add chord progression extraction as a secondary structure signal.
- Write a dedicated `XD: Chords` timing track.
- Feed chord recurrence evidence into LLM section labeling together with lyrics.

Rationale:
- Lyrics-only sectioning is fragile for instrumental passages and some genres.
- Harmonic recurrence improves chorus/section boundary confidence.

Impacted work:
- Analysis service feature extraction
- UI pipeline stage ordering
- Song-structure labeling prompt/evidence

---

### D14) VAMP support scope
Decision:
- VAMP integration/support is out of scope for this application.
- Users may install/use VAMP independently in xLights, but app pipeline logic will not depend on or orchestrate VAMP.

Rationale:
- Keeps setup simple for hobbyist users.
- Avoids optional local plugin dependency drift in core pipeline behavior.

Impacted work:
- All current/future pipeline specs and checklists

## Change Control
- Any change to these decisions requires:
  - update to this file,
  - linked update to `api-contract.md`,
  - note in PR description.
