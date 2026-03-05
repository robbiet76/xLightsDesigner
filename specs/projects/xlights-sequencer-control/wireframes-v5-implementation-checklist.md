# Wireframes v5 Implementation Checklist

Status: Draft  
Date: 2026-03-05  
Source: `wireframes-v5.md`

## 1) Global Shell
- [ ] Header renders `Project`, `Active Sequence`, `xLights Status`, `Revision`, `Refresh`, `Review in xLights`.
- [ ] Global status bar renders under header on every screen.
- [ ] Left navigation renders `Project`, `Sequence`, `Design`, `History`, `Metadata`.
- [ ] Diagnostics renders as bottom expandable drawer (collapsed by default).

Acceptance criteria:
- [ ] Navigation/active screen state persists across reload.
- [ ] Status levels support `info`, `warning`, `action-required`.

## 2) Project Screen
- [ ] Project summary card includes project name, show folder, endpoint/version compatibility.
- [ ] Project settings support discovery/retry/backup policy inputs.
- [ ] Session state card shows active sequence, plan-only mode, last sync.

Acceptance criteria:
- [ ] Project settings persist per project.
- [ ] Refresh connection updates status and diagnostics.

## 3) Sequence Screen (Setup + Creative Analysis)
- [ ] Sequence setup section supports open/select sequence and media confirmation.
- [ ] Kickoff section captures goals/style/inspiration and freeform notes.
- [ ] Reference Media section supports upload/list/remove/preview.
- [ ] Creative Brief panel renders generated brief fields.
- [ ] Controls exist: `Run Creative Analysis`, `Regenerate Brief`, `Accept Brief and Start Design`.

Acceptance criteria:
- [ ] Creative Analysis cannot run without an active sequence + media.
- [ ] `Accept Brief and Start Design` is gated by `creativeBriefReady`.

## 4) Reference Media Storage + Format Policy
- [ ] Uploaded references are copied/saved under a Designer media folder inside the active sequence folder.
- [ ] Traceability stores reference ids/filenames for each attached item.
- [ ] References can be marked `inspiration-only` vs `sequence-eligible`.
- [ ] Sequence-eligible items are validated against xLights-supported media formats.

Acceptance criteria:
- [ ] Unsupported format never blocks creative analysis when marked inspiration-only.
- [ ] Unsupported format is blocked from sequence-eligible usage with clear reason text.
- [ ] Stored reference paths remain sequence-folder relative where possible.

## 5) Design Screen (Chat + Proposed Summary)
- [ ] Left pane renders rich chat thread and composer.
- [ ] Right pane renders proposed change pick-list (agent-authored summary lines).
- [ ] Actions exist: `Add Line`, `Edit Selected`, `Remove Selected`, `Apply to xLights`, `Discard Draft`.
- [ ] Proposed rows remain plain-language summaries (no rigid field syntax requirement).

Acceptance criteria:
- [ ] Chat-only flow can drive proposal updates end-to-end.
- [ ] Proposal lines update from latest chat intent and creative-brief context.

## 6) Apply, Revision, and Safety
- [ ] Apply button state follows `hasDraftProposal`, connectivity, plan-only, and stale checks.
- [ ] Stale proposals are blocked from apply with refresh/rebase guidance.
- [ ] Apply completion creates one history version checkpoint.

Acceptance criteria:
- [ ] No apply on stale revision.
- [ ] No apply in plan-only mode.

## 7) History Screen
- [ ] Version list shows one row per approved agent update.
- [ ] Version detail panel shows summary, approx impact, and revision context.
- [ ] Rollback flow supports target selection and confirmation.

Acceptance criteria:
- [ ] Rollback generates status updates and refreshes current design state.

## 8) Metadata Screen
- [ ] Tag library supports curated + user-extensible tags.
- [ ] Assignment UI supports model/group semantic metadata.
- [ ] Orphaned assignments can be ignored or remapped.

Acceptance criteria:
- [ ] Metadata persists in sequence sidecar/app config stores per spec.

## 9) Open Inputs
- [ ] Finalize xLights-supported format list used for sequence-eligible media validation.
- [ ] Finalize designer media folder naming convention under sequence directory.
- [ ] Finalize max upload size and retention policy for reference media.
