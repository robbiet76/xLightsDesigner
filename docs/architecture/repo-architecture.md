# Repository Architecture

Status: Active
Owner: xLightsDesigner maintainers
Last Reviewed: 2026-04-30

## Purpose

Capture the durable repository organization decisions from earlier directory audits without keeping each dated audit as an active document.

## Canonical Tracked Roots

- `apps/`: product app code, shared runtime code, and tests.
- `scripts/`: developer automation, validation, training, and repo-maintenance helpers.
- `specs/`: active implementation-facing product and domain specs.
- `docs/`: architecture and operational documentation.
- `training-packages/`: curated training package inputs and indexes.

## Canonical Generated Root

Use `var/` for generated and operational outputs.

Examples:

- `var/logs/`
- `var/repo-audit/`
- `var/render-training/`
- `var/sequence-validation/`
- `var/sequence-validation-show/`

Root-level generated working directories such as `logs/`, `render-training/`, `sequence-validation/`, and `sequence-validation-show/` are non-canonical migration leftovers. New scripts should write to `var/`.

## Source Ownership Rules

- Product code belongs under `apps/`.
- Durable implementation requirements belong under `specs/`.
- Operational runbooks and architecture notes belong under `docs/`.
- Generated logs, manifests, screenshots, render outputs, and temporary validation sequences belong under `var/` or another ignored external workspace.
- Tracked eval fixtures may stay under the owning source tree only when they are small, intentional, and test-owned.

## Render-Training Structure

`scripts/sequencer-render-training/` is the active render-training tooling root. It should keep stable source, runners, catalogs, manifests, and proof fixtures organized inside that subtree while generated run output stays out of git.

The durable training policy now lives in `specs/sequence-agent/render-training-knowledge.md`.

## Docs Versus Specs

Use `specs/` for normative behavior, contracts, requirements, policies, and acceptance gates.

Use `docs/` for explanatory architecture, operational runbooks, historical evidence logs, and repo-maintenance guidance.
