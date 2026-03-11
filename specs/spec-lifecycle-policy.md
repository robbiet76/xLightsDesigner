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
