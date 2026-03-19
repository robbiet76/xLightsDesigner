# Render Training Retention Policy

Status: Draft  
Date: 2026-03-19  
Owner: xLightsDesigner Team

System roadmap reference:
- [render-training-system-roadmap-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/render-training-system-roadmap-2026-03-19.md)

## 1. Purpose

Render training will continue generating large numbers of raw artifacts.
This policy defines what should be kept, what can be pruned, and how cleanup should work without discarding learning value.

The core rule is:
- keep durable learning artifacts
- keep selected benchmark/debug raw artifacts
- delete superseded raw artifacts once their learnings are captured

## 2. Artifact Classes

### 2.1 Durable outputs

Keep long-term:
- summaries
- intent maps
- retrieval evaluations
- selector evaluations
- controlled vocabulary evaluations
- maturity reports
- geometry gap reports
- complexity reports
- selected benchmark manifests/specs

These are the primary retained learning artifacts.

### 2.2 Rebuildable raw artifacts

Prune aggressively when superseded:
- intermediate `.xsq` in `working/`
- transient `.fseq` copies staged outside canonical storage
- one-off smoke-run outputs under `/tmp`
- old generated manifests copied only for one run

### 2.3 Selective raw retention

Keep only where justified:
- canonical `.fseq` for benchmark runs
- canonical `.fseq` for important transition examples
- canonical `.fseq` for debugging anchors
- canonical `.xsq` only when useful for debugging or reproducibility

## 3. Current Workspace Policy

Canonical training workspace:
- `/Users/robterry/Projects/xLightsDesigner/render-training`

Current folder roles:
- `working/`
  - active/generated `.xsq`
  - should not retain `.fseq`
- `fseq/`
  - canonical retained `.fseq`
- `manifests/`
  - copied/generated manifests used to run retained corpora
- `records/`
  - future retained record exports when needed
- `derived/`
  - future retained summaries/evaluations when copied into the workspace

## 4. Cleanup Rules

### 4.1 Always safe

- remove staged `.fseq` from `working/`
- remove superseded smoke-run outputs in `/tmp`
- remove duplicate raw artifacts already preserved canonically elsewhere

### 4.2 Safe by age/count policy

Allow cleanup tooling to:
- keep only the newest `N` `.xsq` files in `working/`
- keep only the newest `N` manifests in `manifests/`
- optionally prune older canonical `.fseq` unless explicitly protected

### 4.3 Protected artifacts

Allow protection by:
- benchmark run prefix
- explicit keep list
- newest-run count

Protected artifacts must not be deleted by default cleanup.

## 5. Cleanup Principles

1. prefer deleting rebuildable raw artifacts first
2. never delete durable learning summaries by default
3. preserve enough benchmark/debug artifacts to re-check analyzer behavior
4. keep cleanup deterministic and explainable
5. support dry-run before deletion

## 6. Near-Term Tooling Requirement

The training system should include a cleanup tool that can:
- report current disk usage by artifact class
- dry-run planned deletions
- remove stale `.fseq` from `working/`
- prune old `.xsq` in `working/`
- prune old copied manifests in `manifests/`
- preserve explicitly protected artifacts

That tool should be conservative by default.
