# Spec Lifecycle Policy

Status: Active
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11

## Purpose
Define how specs are created, promoted, archived, and deprecated.

## Required Front Matter
All active spec docs should include:
- `Status`
- `Date`
- `Owner`
- `Last Reviewed`
- `Supersedes` (optional)
- `Superseded By` (optional)

## Naming Convention

Default rule for dated implementation specs:
- use `descriptive-kebab-case-YYYY-MM-DD.md`

Reason:
- the date in the filename makes spec age visible at a glance
- it reduces ambiguity when multiple iterations exist for the same topic

Allowed exceptions:
- domain indexes such as `README.md`
- stable governance documents where the filename is intentionally canonical
- schema files and non-Markdown machine-readable contracts

## Status Values
- `Draft`: under active authoring; not yet authoritative.
- `Active`: source-of-truth for implementation decisions.
- `Deprecated`: still readable but not used for new implementation.
- `Archived`: historical record only (stored under `specs/archive/`).

## Promotion Rules
- A doc becomes `Active` only when referenced by `specs/README.md` or a domain README.
- Replaced docs must include `Superseded By` before archival.

## Archive Rules
- Move superseded step-by-step artifacts to `specs/archive/`.
- Do not delete archived files unless duplicated and explicitly approved.
- When archiving a dated spec, preserve the dated filename.
