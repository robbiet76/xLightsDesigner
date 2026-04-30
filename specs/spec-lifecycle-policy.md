# Spec Lifecycle Policy

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30

## Purpose

Define how specs are created, promoted, consolidated, archived, and deleted.

## Front Matter

Active specs should include:

- `Status`
- `Owner`
- `Last Reviewed`
- `Supersedes` when replacing older specs
- `Superseded By` only when a retained historical file remains

`Date` is optional and should be used only when the document is intentionally a point-in-time assessment or evidence record.

## Naming Convention

Long-lived specs use stable kebab-case filenames without dates.

Allowed dated filenames:

- release impact audits
- point-in-time product assessments kept for history
- evidence readouts that are intentionally not the durable contract

Disallowed for active durable specs:

- dated implementation plans
- dated checklists
- dated cleanup audits
- dated migration plans once the durable decision is known

## Status Values

- `Draft`: under active authoring.
- `Active`: source-of-truth for implementation decisions.
- `Deprecated`: readable but not used for new implementation.
- `Archived`: historical record only.

## Promotion Rules

A doc becomes active only when referenced by `specs/README.md` or a domain README.

When a dated or step-by-step file produces durable decisions, fold those decisions into the current domain spec and remove the old file unless it still has explicit reference value.

## Archive Rules

Archive sparingly. The archive is not a second active spec tree.

Retain archived files only when they explain current code, training-package references, or a major historical decision that is not captured elsewhere.
