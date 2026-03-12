# Repo Structure Governance

Status: Active
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11

## Purpose
Keep repository layout purpose-built and predictable so new work lands in the correct location.

## Canonical Top-Level Layout
- `apps/`: runtime applications and services.
- `training-packages/`: portable LLM training assets (provider-agnostic).
- `specs/`: implementation-facing requirements, roadmaps, acceptance criteria.
- `docs/`: architecture and supporting reference material.
- `scripts/`: developer automation and build/validation helpers.

## Domain Structure
- Domain runtime modules should live under app-owned domain folders when the boundary is stable.
- Current domain anchors:
  - `apps/xlightsdesigner-ui/agent/audio-analyst/`
  - `apps/xlightsdesigner-ui/agent/designer-dialog/`
  - `apps/xlightsdesigner-ui/agent/sequence-agent/`
  - `apps/xlightsdesigner-ui/tests/agent/audio-analyst/`
  - `apps/xlightsdesigner-ui/tests/agent/designer-dialog/`
  - `apps/xlightsdesigner-ui/tests/agent/sequence-agent/`
  - `specs/audio-analyst/`
  - `specs/designer-dialog/`
  - `specs/sequence-agent/`
- Shared utilities that are not domain-owned should remain outside domain folders.
- Historical specs should move to a domain archive folder or `specs/archive/`, not remain mixed with active domain specs.

## Placement Rules
- App runtime code belongs under `apps/*`.
- Experimental/eval scripts tied to one app belong under that app in `eval/` or `tests/`.
- Canonical reusable datasets/prompts/few-shot examples belong in `training-packages/training-package-v1/modules/*`.
- Specs must not be used as runtime data stores.
- Machine-local files (`*.local.*`, virtualenvs, generated caches) are not committed.

## Data Ownership Rules
- `training-packages/.../datasets/*` is canonical for packaged corpora.
- App `eval/` may reference packaged corpora but should not maintain duplicate canonical copies.
- User-specific references (for example local track paths) must use local-only files (example template committed, local variant ignored).

## Required Hygiene
- No absolute machine paths in committed defaults.
- Prefer repo-relative path resolution from script location.
- Keep `.gitignore` aligned with generated artifacts used by this repo.
- If a new folder type is introduced, update this governance doc and root `README.md`.
