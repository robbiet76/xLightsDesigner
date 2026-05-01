# Product Plan

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: dated product plans and implementation-phase summaries

## Purpose

Define the current product direction for xLightsDesigner without preserving dated implementation-phase detail as the primary entry point.

## Product Goal

xLightsDesigner is a local-first creative sequencing tool for xLights. The product lets a user describe lighting intent in normal language, gathers the display, audio, timing, and preference context needed to make that request concrete, then safely creates, reviews, applies, renders, and validates xLights sequence changes.

The app is not just a chat wrapper. It is a controlled workflow that turns creative direction into auditable xLights edits.

## Core Workflow

1. The user selects or creates a project.
2. The project is bound to a show folder, sequence, media file, and display layout.
3. The app refreshes display metadata, model metadata, custom model construction data, timing data, and current sequence state.
4. Audio analysis creates reusable timing and music-context artifacts.
5. Designer conversation captures user intent, display understanding, style preferences, and constraints.
6. The sequence agent translates intent into structured sequence plans.
7. Review presents the plan, warnings, backups, and validation status before apply.
8. The owned xLights API applies approved sequence changes.
9. Render feedback and proof artifacts evaluate the result.
10. History stores recoverable project events, artifacts, and evidence.

## Non-Negotiable Development Policy

- Maintain one canonical app source tree.
- Maintain one canonical xLights source tree.
- Maintain one canonical app state root.
- Prefer deletion and consolidation over compatibility layers for obsolete local development paths.
- Do not create parallel app versions, alternate worktrees, or shadow runtime installs during initial product development.
- Treat generated artifacts as rebuildable unless they are explicitly promoted into a durable knowledge layer.

## Current Product Components

- macOS app: project shell, workflow screens, review/apply, history, settings, and local service orchestration.
- App assistant: routed conversational shell that helps users operate the product without owning specialist domain logic.
- Audio analyst: music analysis, timing tracks, and audio context.
- Designer dialog: user intent, display understanding, creative direction, and sequencing handoff.
- Sequence agent: effect selection, timing placement, target resolution, layer planning, revision planning, and xLights command generation.
- xLights owned API: show folder control, layout discovery, timing, effects, sequence lifecycle, render feedback, and validation.
- Training and knowledge layer: compact effect semantics, render proof evidence, training records, and learned priors.

## Current Execution Focus

The highest-value work is improving full-display sequencing quality while keeping the spec and training layers compact enough to guide development reliably.

Near-term work should favor:

- custom model and display metadata capture that refreshes when the selected layout/show folder changes
- effect and layer composition learning from render proof
- real sequence benchmarks and user-review feedback loops
- app reliability around project state, backups, apply, render, restore, and history
- spec and training consolidation whenever new work touches an area

## Durable References

- `local-completion-roadmap.md`
- `app-ui/app-workspace.md`
- `app-ui/project-storage.md`
- `designer-dialog/designer-interaction-contract.md`
- `sequence-agent/sequencing-system.md`
- `sequence-agent/render-training-knowledge.md`
- `sequence-agent/xlights-api.md`
- `sequence-agent/model-metadata.md`

Recent point-in-time assessment:

- `archive/product-state-assessment-2026-04-30.md`
