# Wireframes v5 Implementation Checklist

Status: Draft  
Date: 2026-03-05  
Source: `wireframes-v5.md`

## 1) Global Shell
- [x] Header renders `Project`, `Active Sequence`, `xLights Status`, `Revision`, `Refresh`, `Review in xLights`.
- [x] Global status bar renders under header on every screen.
- [x] Left navigation renders `Project`, `Sequence`, `Design`, `History`, `Metadata`.
- [x] Diagnostics renders as bottom expandable drawer (collapsed by default).

Acceptance criteria:
- [x] Navigation/active screen state persists across reload.
- [x] Status levels support `info`, `warning`, `action-required`.

## 2) Project Screen
- [x] Project summary card includes project name, show folder, endpoint/version compatibility.
- [x] Project settings support discovery/retry/backup policy inputs.
- [x] Session state card shows active sequence, plan-only mode, last sync.

Acceptance criteria:
- [x] Project settings persist per project.
- [x] Refresh connection updates status and diagnostics.

## 3) Sequence Screen (Setup + Creative Analysis)
- [x] Sequence setup section supports open/select sequence and media confirmation.
- [x] Kickoff section captures goals/style/inspiration and freeform notes.
- [x] Reference Media section supports upload/list/remove/preview.
- [x] Creative Brief panel renders generated brief fields.
- [x] Controls exist: `Run Creative Analysis`, `Regenerate Brief`, `Accept Brief and Start Design`.

Acceptance criteria:
- [x] Creative Analysis cannot run without an active sequence + media.
- [x] `Accept Brief and Start Design` is gated by `creativeBriefReady`.

## 4) Reference Media Storage + Format Policy
- [x] Uploaded references are staged with stored paths under a Designer media folder inside the active sequence folder.
- [x] Traceability stores reference ids/filenames for each attached item.
- [x] References can be marked `inspiration-only` vs `sequence-eligible`.
- [x] Sequence-eligible items are validated against xLights-supported media formats.

Acceptance criteria:
- [x] Unsupported format never blocks creative analysis when marked inspiration-only.
- [x] Unsupported format is blocked from sequence-eligible usage with clear reason text.
- [x] Stored reference paths remain sequence-folder relative where possible.

## 5) Design Screen (Chat + Proposed Summary)
- [x] Left pane renders rich chat thread and composer.
- [x] Right pane renders proposed change pick-list (agent-authored summary lines).
- [x] Actions exist: `Add Line`, `Edit Selected`, `Remove Selected`, `Apply to xLights`, `Discard Draft`.
- [x] Proposed rows remain plain-language summaries (no rigid field syntax requirement).

Acceptance criteria:
- [x] Chat-only flow can drive proposal updates end-to-end.
- [x] Proposal lines update from latest chat intent and creative-brief context.

## 6) Apply, Revision, and Safety
- [x] Apply button state follows `hasDraftProposal`, connectivity, plan-only, and stale checks.
- [x] Stale proposals are blocked from apply with refresh/rebase guidance.
- [x] Apply completion creates one history version checkpoint.

Acceptance criteria:
- [x] No apply on stale revision.
- [x] No apply in plan-only mode.

## 7) History Screen
- [x] Version list shows one row per approved agent update.
- [x] Version detail panel shows summary, approx impact, and revision context.
- [x] Rollback flow supports target selection and confirmation.

Acceptance criteria:
- [x] Rollback generates status updates and refreshes current design state.

## 8) Metadata Screen
- [x] Tag library supports curated + user-extensible tags.
- [x] Assignment UI supports model/group semantic metadata.
- [x] Orphaned assignments can be ignored or remapped.

Acceptance criteria:
- [x] Metadata persists in sequence sidecar/app config stores per spec.

## 9) Open Inputs
- [ ] Finalize xLights-supported format list used for sequence-eligible media validation.
- [ ] Finalize designer media folder naming convention under sequence directory.
- [ ] Finalize max upload size and retention policy for reference media.
