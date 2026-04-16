# History Implementation Checklist

Status: Active
Date: 2026-03-13
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-13

## Phase A: Artifact Identity
- [ ] Add shared artifact-id utility for canonical hashing
- [ ] Add `artifactId`, `artifactType`, `artifactVersion`, `createdAt` to persisted artifact contracts
- [ ] Make major artifacts immutable once persisted
- [ ] Persist artifacts by id under project storage

## Phase B: History Contract
- [ ] Define `history_entry_v1`
- [ ] Add history entry persistence under project storage
- [ ] Add lightweight `snapshotSummary` fields for fast UI rendering
- [ ] Reference artifacts by id rather than embedding full payloads

## Phase C: Apply Snapshot Capture
- [ ] Freeze current artifact refs at apply time
- [ ] Persist `apply_result_v1` with artifact id
- [ ] Create `history_entry_v1` on successful apply
- [ ] Include design, sequence, scene, music, and execution references in each entry

## Phase D: Live Dashboard Alignment
- [ ] Make `Sequence` a live translation dashboard parallel to `Design`
- [ ] Show normalized intent, resolved targets, timing anchors, and plan summary on `Sequence`
- [ ] Show current apply snapshot summary on `Review`
- [ ] Show pending vs implemented state consistently across `Design`, `Sequence`, and `Review`

## Phase E: History UI
- [ ] Build `History` from `history_entry_v1`
- [ ] Add structured artifact dereference view for each history entry
- [ ] Keep raw payloads hidden by default
- [ ] Show design summary, sequence summary, and apply summary per entry

## Phase F: Lifecycle And Status
- [ ] Extend proposal lifecycle to support `pending`, `partially_applied`, `fully_applied`, `superseded`
- [ ] Surface implementation status on `Design`
- [ ] Surface implementation status on `Sequence`
- [ ] Surface implementation status in `History`
