# Root Spec Cleanup Audit

Status: Active
Date: 2026-04-16
Owner: xLightsDesigner Team

Purpose: audit the root `specs/` layer after the domain cleanup passes so only true cross-domain policy and planning docs remain active at the root.

## Current Root Role

The root `specs/` layer should contain only:
- cross-domain execution plan
- repo/spec governance policy
- traceability
- cross-domain storage policy where it still aligns to the live app

It should not remain a parking lot for historical reorganization events or superseded sequence-control reset plans.

## File Decisions

| File | Decision | Reason |
| --- | --- | --- |
| `README.md` | update | Keep as the root entry point, but trim historical audit links out of the canonical path. |
| `current-app-plan-2026-04-05.md` | keep | Still the active cross-domain execution summary. |
| `repo-structure-governance.md` | keep | Still aligned to the single-tree/single-runtime policy and repo layout rules. |
| `requirements-traceability-matrix.md` | keep | Still the active cross-domain requirement-to-implementation skeleton. |
| `spec-lifecycle-policy.md` | keep | Still active and now more important after the archive cleanup wave. |
| `spec-organization-policy-2026-04-13.md` | keep | Still the active policy for how cleanup/replacement should occur. |
| `xlightsdesigner-project-storage-layout.md` | keep | Still referenced by active app-ui docs and not clearly contradicted by the current app. |
| `agent-release-quality-gates.md` | keep, but needs update | Still a legitimate cross-domain category, but the evidence links are stale and still tied to older sequence-control docs. This is now an update gap, not an archive candidate. |
| `spec-consolidation-audit-2026-03-11.md` | archive | Historical record of the March consolidation event, not an active root entry point. |
| `spec-organization-audit-2026-04-13.md` | archive | Historical transitional audit superseded by the completed domain cleanup passes. |
| `xlights-sequencer-control-architecture-reset-plan-2026-03-11.md` | archive | Historical sequence-control reset plan already marked as non-current inside the document itself. |

## Outcome

Active root is now narrowed to:
- current plan
- governance
- lifecycle policy
- organization policy
- traceability
- storage layout
- release-quality gate draft

Historical root-level reorganization/reset records now live under:
- [specs/archive/root](/Users/robterry/Projects/xLightsDesigner/specs/archive/root)

## Remaining Gap

`agent-release-quality-gates.md` still points at older sequence-control evidence sources. It should be refreshed against the current app and `2026.06` migration/training validation stack rather than archived blindly.
