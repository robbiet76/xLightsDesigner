# Wireframes v4 Implementation Checklist

Status: Draft  
Date: 2026-03-04  
Source: `wireframes-v4.md`

## 1) Global Shell
- [ ] Header renders `Project`, `Active Sequence`, `xLights Status`, `Revision`, `Refresh`, `Review in xLights`.
- [ ] Global status/message/help bar renders under header on every screen.
- [ ] Left navigation renders `Project`, `Design`, `History`, `Metadata`.
- [ ] Footer shows `last sync`, background jobs, diagnostics entry.

Acceptance criteria:
- [ ] Navigation state persists when switching screens.
- [ ] Status bar supports `info`, `warning`, `action-required`.
- [ ] `View Details` deep-link behavior routes to appropriate screen/context.

## 2) Project Screen
- [ ] Project summary card shows project name, show folder, xLights version, compatibility.
- [ ] Sequence workspace supports `Open Sequence`, `Recent`, `New Session`.
- [ ] Project-level settings section exists on this screen (no separate Settings page).
- [ ] Session actions include `Resume Last`, `Plan Only`, `Open in xLights`.

Acceptance criteria:
- [ ] One active sequence at a time is enforced.
- [ ] Entering plan-only mode sets app state to no-apply.
- [ ] Settings persist and reload correctly per project.

## 3) Design Screen
- [ ] Chat thread renders user/agent turns.
- [ ] Intent panel supports scope, range/label, mood, energy, priority, color constraints.
- [ ] Live `Proposed Next Write` list updates from chat/intent changes.
- [ ] Composer row includes `Generate/Refresh`, `Apply to xLights`, `Open Details`.

Acceptance criteria:
- [ ] `Generate/Refresh` enablement follows state contract.
- [ ] `Apply to xLights` enablement/disabled reasons follow state contract.
- [ ] `Open Details` only enabled when draft proposal exists.
- [ ] Missing detail behavior allows artistic-license generation.

## 4) Proposal Detail Drawer
- [ ] Drawer opens from Design screen without leaving workflow.
- [ ] Shows impact summary (approx effects impacted, models touched, labels touched).
- [ ] Shows revision base token and section grouping.
- [ ] Supports expandable effect-level details.
- [ ] Actions present: `Apply`, `Split by Section`, `Discard Draft`, `Back to Design`.

Acceptance criteria:
- [ ] Drawer data matches current draft proposal exactly.
- [ ] `Split by Section` produces section-grouped apply options.

## 5) History Screen
- [ ] Version list displays latest-first with summary + approx effects count.
- [ ] Version detail panel shows scope/models/labels for selected version.
- [ ] Actions include `Rollback to This Version`, `Compare`, `Reapply as Variant`.

Acceptance criteria:
- [ ] Each approved apply creates one new version entry.
- [ ] Rollback requires target version selection and confirmation.
- [ ] Rollback triggers rerender and status-bar progress.

## 6) Metadata Screen
- [ ] Tag library supports curated + user-extensible tags.
- [ ] Context assignment supports model/group targeting.
- [ ] Orphaned metadata panel visible with `View Details`.

Acceptance criteria:
- [ ] Metadata edits persist in project/sequence metadata stores.
- [ ] Missing model identity entries are surfaced as orphaned.

## 7) Control-State Rules
- [ ] Implement shared state flags:
  - `xlightsConnected`
  - `activeSequenceLoaded`
  - `hasDraftProposal`
  - `proposalStale`
  - `applyInProgress`
  - `planOnlyMode`
- [ ] Apply enable/disable logic implemented exactly per spec.
- [ ] Review/rollback/open-details enablement implemented per spec.

Acceptance criteria:
- [ ] Disabled controls always show reason text.
- [ ] State transitions are deterministic and testable.

## 8) Validation and Conflict Handling
- [ ] Intent validation enforces required scope/range/model selections.
- [ ] Proposal validation requires revision token + impact summary fields.
- [ ] Stale proposal detection blocks apply.
- [ ] Conflict actions provided: `Rebase/Refresh`, `Regenerate`, `Cancel`.

Acceptance criteria:
- [ ] Stale apply attempt never mutates xLights.
- [ ] Conflict path always returns user to valid next action.

## 9) Confirmation and Safety
- [ ] Apply supports default single-step action.
- [ ] Extra confirmation path exists for large-change proposals.
- [ ] Rollback confirmation includes target version id + timestamp.

Acceptance criteria:
- [ ] Confirmation UX is minimal for small changes.
- [ ] Large-change threshold hook exists (value configurable).

## 10) Proposed-Changes List
- [ ] Default visible row count set to 5.
- [ ] `Show More` reveals additional items.
- [ ] Row format includes section/label, model/group, one-line summary.
- [ ] Ordering uses user-priority first, then secondary updates.

Acceptance criteria:
- [ ] List refreshes immediately after intent/chat edits.
- [ ] Apply action always maps to currently visible draft revision.

## 11) Compact/Mobile
- [ ] Design screen supports `Chat`, `Intent`, `Proposed` tabs.
- [ ] `Apply to xLights` appears in fixed bottom action bar when enabled.
- [ ] Proposal detail opens full-height sheet.

Acceptance criteria:
- [ ] No control loss vs desktop (feature parity preserved).

## 12) Open Implementation Inputs
- [ ] Finalize large-change threshold value.
- [ ] Finalize stale detection wording.
- [ ] Finalize disabled-control reason strings.
