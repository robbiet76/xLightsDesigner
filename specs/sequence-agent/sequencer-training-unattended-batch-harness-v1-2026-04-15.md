# Sequencer Training Unattended Batch Harness v1

Status: Active  
Date: 2026-04-15  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-15

## Purpose

Define the unattended controller for sequencer-training reset work.

A proper regeneration pass must be able to run without operator intervention, gather the relevant evidence and planning artifacts, and emit one consolidated report that says whether a clean regeneration run is actually allowed.

This spec exists to prevent the reset from drifting back into:

- quick manual spot checks
- fragmented one-off scripts
- ambiguous readiness claims
- informal summaries that are not traceable to a batch run

## Core Principle

Training reset work must run through one unattended controller.

That controller must:

- refresh preserved evidence-derived planning artifacts
- compute additive interaction coverage
- summarize regeneration blockers
- emit one consolidated batch report

## Canonical Entrypoint

Current controller:

- [run-sequencer-training-reset-cycle.sh](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/runners/run-sequencer-training-reset-cycle.sh)

Current consolidated report builder:

- [build-sequencer-training-reset-report.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-sequencer-training-reset-report.mjs)

## Required Inputs

The unattended controller must be able to run from preserved evidence and current planning inputs:

- screening records
- effect parameter registry
- sweep manifests
- interaction manifests
- current coverage/planning builders
- optional harvest input from a prior screening run

## Required Outputs

Each unattended run must emit:

- effect settings coverage report
- automation plan snapshot
- screening plan snapshot
- interaction coverage report
- one consolidated regeneration-gate report
- one run log

## Required Gates

The controller must answer, in machine-readable form:

1. Is interaction coverage complete enough for the runnable effect set?
2. Are interaction-aware record generators present?
3. Are the canonical regeneration prerequisites satisfied?
4. Is a clean regeneration run allowed right now?

## Clean Run Policy

A clean regeneration run must not begin until the unattended controller reports:

- `interactionCoverageReady = true`
- `recordGeneratorsReady = true`
- `cleanRegenerationAllowed = true`

Anything else is a blocked run, not a partial success.

## Operator Mode

The controller must support:

- unattended execution with no prompts
- optional harvest-source ingestion
- optional strict mode that exits nonzero when clean regeneration is not yet allowed

## Current Phase Boundary

This unattended controller is the correct next control surface before the first clean regeneration pass.

It is allowed to use transitional planning artifacts as inputs while the record generators are being built.
It is not allowed to claim that the clean regeneration path is ready until the interaction-aware generators exist.
