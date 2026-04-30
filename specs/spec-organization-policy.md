# Spec Organization Policy

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: `spec-organization-policy.md`

## Purpose

Keep specs useful as current implementation guidance instead of a chronological record of every development pass.

## Rules

- Active specs should be concise, durable, and linked from `specs/README.md` or a domain README.
- Long-lived specs should not include dates in filenames.
- Dated files are allowed only for point-in-time assessments, release audits, or evidence records that are intentionally historical.
- Old implementation plans should be folded into durable specs, then deleted unless there is a specific reason to preserve them.
- Archive is for historical records that still have meaningful reference value, not a permanent junk drawer.
- Generated artifacts, run logs, and proof outputs do not belong in `specs/`.

## Domain Shape

Each active domain should prefer:

- `README.md`
- one or two durable overview specs
- contracts or schemas that are actively consumed
- evidence only when it cannot be represented better in generated training/catalog artifacts

## Cleanup Standard

When consolidating specs:

1. Identify the durable decisions.
2. Move those decisions into the current domain spec.
3. Update references.
4. Remove the superseded file.
5. Run a missing-link/reference check.
