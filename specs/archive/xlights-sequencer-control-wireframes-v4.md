# xLightsDesigner Wireframes v4 (Implementation Pass)

Status: Draft  
Date: 2026-03-04  
Purpose: Control-level wireframe contract for implementation.

## 1) Locked UX Decisions
- Project screen includes project-level settings.
- Design screen is the primary workspace (chat + live proposed changes).
- Global status/message/help bar appears on every screen.
- Impact-size cues over detailed risk language.
- No timeline/sequencer duplication from xLights.

## 2) Information Architecture
- Left navigation: `Project`, `Design`, `History`, `Metadata`.
- Top header: `Project`, `Active Sequence`, `xLights Status`, `Revision`, `Refresh`, `Review in xLights`.
- Global status bar under header: one-line message + `View Details`.

## 3) Screen Specs

## 3.1 Project Screen
Sections:
- `Project Summary`: project name, show folder, xLights version, compatibility status.
- `Sequence Workspace`: open/recent/new session, active sequence, sidecar metadata file.
- `Project-Level Settings`: discovery policy, multi-instance policy, retry policy, backup policy.
- `Session Actions`: resume, plan-only mode, open in xLights.

Primary controls:
- `Open Sequence`: opens sequence selector.
- `Recent`: dropdown/list.
- `New Session`: starts new Designer session on chosen sequence.
- `Plan Only`: enters no-apply mode.

## 3.2 Design Screen
Sections:
- `Chat Thread`: user and agent turns.
- `Intent Panel`: scope, range/label, mood, energy, priority, color constraints.
- `Proposed Next Write`: live list of pending changes.
- `Composer`: input + actions (`Generate/Refresh`, `Apply to xLights`, `Open Details`).

Primary controls:
- `Generate/Refresh`: regenerates proposal from current intent + chat context.
- `Apply to xLights`: applies current live proposal.
- `Open Details`: opens proposal detail drawer.

## 3.3 Proposal Detail Drawer (Optional)
Sections:
- Impact summary (approx effects impacted, models touched, labels touched).
- Revision token.
- Section grouping.
- Expandable effect-level details.

Primary controls:
- `Apply`, `Split by Section`, `Discard Draft`, `Back to Design`.

## 3.4 History Screen
Sections:
- Version list (latest first).
- Selected version summary.
- Actions (`Rollback to This Version`, `Compare`, `Reapply as Variant`).

## 3.5 Metadata Screen
Sections:
- Tag library (curated + user-extensible).
- Context assignment target (model/group).
- Orphaned metadata panel (`View Details`).

## 4) Control-State Contract

## 4.1 Common Status Inputs
- `xlightsConnected`: boolean
- `activeSequenceLoaded`: boolean
- `hasDraftProposal`: boolean
- `proposalStale`: boolean
- `applyInProgress`: boolean
- `planOnlyMode`: boolean

## 4.2 Control Enablement Rules
1. `Generate/Refresh`
- Enabled when `activeSequenceLoaded = true` OR `planOnlyMode = true`.
- Disabled while `applyInProgress = true`.

2. `Apply to xLights` / `Apply`
- Enabled when `hasDraftProposal = true` AND `xlightsConnected = true` AND `planOnlyMode = false` AND `proposalStale = false`.
- Disabled otherwise with inline reason:
  - `Connect to xLights to apply`,
  - `Refresh proposal before apply`,
  - `Exit plan-only mode to apply`.

3. `Open Details`
- Enabled when `hasDraftProposal = true`.

4. `Rollback to This Version`
- Enabled when selected version is not current head.
- Disabled while `applyInProgress = true`.

5. `Review in xLights`
- Enabled when `xlightsConnected = true` AND `activeSequenceLoaded = true`.

## 5) Validation Contract

## 5.1 Intent Validation
- `Scope` required before generate/apply.
- If scope is `Range`, one of:
  - explicit start/end time, or
  - timing label reference.
- If scope is `Models`, at least one model/group selected.

## 5.2 Proposal Validation
- Proposal must carry:
  - revision base token,
  - impacted model list (may be grouped),
  - approx effects impacted count.
- If proposal was generated on stale revision, block apply and prompt refresh.

## 6) Confirmation and Safety Contract

## 6.1 Apply Confirmation
- Default: single-step apply from Design screen.
- Additional confirmation required when:
  - approx effects impacted exceeds large-change threshold,
  - proposal indicates broad multi-section mutation.

## 6.2 Rollback Confirmation
- Always requires target version selection.
- Confirmation text includes target version id and timestamp.
- On confirm, rollback triggers re-render and posts status-bar progress.

## 6.3 Conflict Handling
- If sequence changed since proposal creation:
  - block apply,
  - show status-bar warning,
  - present actions: `Rebase/Refresh`, `Regenerate`, `Cancel`.

## 7) Messaging Contract (Global Status Bar)
- Message levels: `info`, `warning`, `action-required`.
- Single active message line; queue additional messages in diagnostics log.
- `View Details` deep-links:
  - compatibility/orphan warnings -> Metadata screen
  - apply/revision/conflict details -> Design or History context

## 8) Proposed Changes List Contract
- Default visible rows: `5` (with `Show More`).
- Each row includes:
  - target section/label,
  - target model/group,
  - one-line operation summary.
- List order: highest user-priority intent first, then agent secondary updates.
- List updates in real time on intent/chat changes.

## 9) Compact/Mobile Contract
- Design screen tabs: `Chat`, `Intent`, `Proposed`.
- `Apply to xLights` fixed at bottom action bar when enabled.
- Proposal details open full-height sheet.

## 10) Open Items (Implementation Inputs Still Needed)
- Large-change threshold value for extra apply confirmation.
- Exact stale detection UI copy.
- Final wording for disabled-control reasons.
