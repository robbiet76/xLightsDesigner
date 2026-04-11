# Sequencing POC Boundary

Status: Draft
Date: 2026-04-10
Owner: xLightsDesigner Team

## Purpose

Define the boundary for the current product phase.

The team is currently in a proof-of-concept phase for sequencing quality.
This spec exists to keep the work focused on the real problem and to prevent premature investment in production-scale cloud infrastructure before the sequencing system has demonstrated value.

## Current Phase

Current phase:
- `POC`

This phase continues until the product can demonstrate that it can generate quality sequences that reflect user intent.

## POC Success Bar

The POC is successful only when the system can produce sequence outputs that are:
- visually credible
- aligned with user intent
- compositionally coherent
- worth iterating from rather than discarding

This is a quality bar, not a functionality bar.

The POC is **not** complete when the system can merely:
- write effects successfully
- render without errors
- satisfy structural or execution metrics
- produce technically valid but artistically weak output

## POC Non-Goals

The following are explicitly not the main goal of the current phase:
- production cloud deployment
- centralized training infrastructure rollout
- monetization optimization
- large-scale sync architecture
- enterprise multi-user platform concerns

These can be planned for, but they must not become the primary focus of current sequencing work.

## Required Architectural Constraint

Even though the current phase is local-first POC work, the implementation should still be future-compatible with cloud migration.

That means:
- artifacts should be versioned
- artifact schemas should be explicit
- learning records should not be trapped in ad hoc UI state
- local storage should be portable to a future central artifact store
- boundaries between local execution and future shared knowledge should remain clear

In short:
- local-first now
- cloud-compatible by design
- cloud migration later

## What Should Be Optimized Right Now

During the POC, the team should optimize for:
- faster local iteration
- learning-loop clarity
- render feedback quality
- design-to-sequencing handoff quality
- sequence critique and revision workflows
- evidence that the system can improve output meaningfully

## What Should Not Be Optimized Right Now

During the POC, the team should avoid spending major effort on:
- full SaaS infrastructure
- production billing systems
- large-scale cloud data pipelines
- centralized training operations
- full account-sync platforms

Those become justified after the sequencing value proposition is proven.

## Local-First Rule

For the POC, execution should remain local-first.

This includes:
- xLights integration
- sequence editing
- authoritative render checkpoints
- local preview reconstruction or local surrogate prediction
- local critique loops
- local learning artifact generation

This is the right way to keep iteration fast and controllable while quality is still unproven.

## Future-Compatibility Rule

Although the POC is local-first, every major learning artifact should be designed as if it may later be uploaded to a centralized system.

That includes future artifacts such as:
- preview scene geometry exports
- preview scene frames or tensors
- render observations
- critique bundles
- prediction-vs-truth comparisons
- sequence learning records

The system should avoid local-only dead ends.

## Recommended Decision Rule

When choosing between two implementation paths during the POC:
- prefer the path that improves the ability to create and evaluate quality sequences locally
- as long as it does not create a dead-end format or architecture that blocks future cloud migration

This is the governing tradeoff for the current phase.

## Recommendation

Treat the current effort as a sequencing quality proof of concept.

Success means:
- the system can generate quality sequences that reflect user intent

Until that is demonstrated:
- keep execution local-first
- treat cloud infrastructure as future architecture, not current product scope
- design artifacts and contracts so they can migrate to the cloud later without redesign
