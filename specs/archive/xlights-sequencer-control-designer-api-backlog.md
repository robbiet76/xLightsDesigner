# Designer API Backlog (Live)

Status: Active  
Date: 2026-03-03

## Usage
- Add items when xLightsDesigner feature work hits API friction.
- Keep entries short, concrete, and testable.
- Close items only with implementation + live harness evidence.

## Priority Legend
- `P0`: blocks active designer workflow, no workaround.
- `P1`: major friction, workaround exists but expensive/risky.
- `P2`: useful improvement, not blocking near-term delivery.

## Backlog

| ID | Priority | Area | Problem | Workaround | Acceptance Condition | Owner | Status |
|---|---|---|---|---|---|---|---|
| G8-CLOSEOUT-DOCS | P1 | Docs/Status | WP-9 docs still show bounded/open language in places despite live pass on rollback guard. | Manual interpretation of latest run evidence. | `gap-audit`, `implementation-status-matrix`, and `wp9-checklist` reflect current verified behavior and no stale blocker language. | API | Open |
| HARNESS-AUTO-LAUNCH-STABILITY | P1 | Harness | Auto-launch from non-GUI shell contexts can fail by design and requires manual startup. | Start xLights manually, then run smoke suites. | Stable, documented launcher path for live verification in developer environments; clear non-regression behavior in `run-all.sh`. | Harness | Open |

## Intake Template

Copy/paste for new items:

| ID | Priority | Area | Problem | Workaround | Acceptance Condition | Owner | Status |
|---|---|---|---|---|---|---|---|
| NEW-ID | P1 | API Domain | Clear one-line issue statement. | Current workaround or `None`. | Observable testable outcome. | API/Harness/Designer | Open |
