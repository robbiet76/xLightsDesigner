# Sequencer Phase 3 Roadmap

Status: Active
Date: 2026-04-13
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-13

## Purpose

Define the next execution phase after the sequencing feedback loop, retained proof corpus, render observation bridge, revision gate, artistic goal, and revision objective contracts are in place.

This phase is about using that loop to improve live sequencing behavior.

## Phase Goal

The goal of this phase is to make `Patch` materially better at second-pass and later-pass sequencing decisions by using:
- live render observation
- artistic critique
- revision gating
- request scope
- retained training memory

The next phase should prove that the system is improving live sequencing behavior, not just producing richer artifacts.

## Governing Rule

Do not widen the proof architecture unless it is directly needed to improve live sequencing behavior.

The retained proof corpus is now a regression harness.
It should protect behavior while the next phase focuses on the live loop.

## Phase Workstreams

### 1. Live Loop Hardening

Goal:
- make each apply pass easy to inspect and compare

Work:
- preserve the full per-pass chain in history
- expose the chain in review/history UI
- make repeated instability easy to spot

Minimum pass chain:
- request scope
- render observation
- render critique
- sequence artistic goal
- sequence revision objective
- revision gate

### 2. Revision Role Planning

Goal:
- make critique change live sequencing behavior more directly

Work:
- strengthen prop targeting from revision targets
- strengthen effect-family bias from critique cues
- add explicit revision roles such as:
  - strengthen lead
  - reduce competing support
  - widen support
  - increase section contrast
  - add section development
- map those roles to bounded sequencing heuristics

Boundary:
- do not begin raw parameter tuning in this workstream

### 3. Repeated-Pass Learning Memory

Goal:
- let the sequencer learn from what worked and what failed across passes

Work:
- store revision attempts and resulting outcomes
- capture what changed, what improved, and what did not improve
- use those memories to bias future revision planning

### 4. Group / Model Drilldown

Goal:
- descend one rung lower only when section instability persists

Work:
- use drilldown sampling to identify which props or groups are causing instability
- keep the output bounded to prop/group responsibility
- do not jump straight to parameter-level effect tuning

### 5. Effect-Family Learning

Goal:
- teach the sequencer which effect-family choices tend to improve specific artistic failures

Work:
- capture before/after tuples for:
  - revision target
  - effect family
  - scope
  - rendered outcome
- learn effect-family tendencies for:
  - focus
  - support balance
  - section contrast
  - section development

Boundary:
- effect-family and placement only
- not parameter-level search

### 6. Parameter-Level Learning Later

Goal:
- only after the higher-level loop is stable, learn parameter-level improvement patterns

This is explicitly not the first target of this phase.

## Execution Order

1. lock the current retained regression harness
2. strengthen live review visibility
3. improve revision-role planning in the live sequencer
4. add repeated-pass memory
5. add group/model drilldown
6. add effect-family learning
7. defer parameter-level learning until those layers are stable

## Exit Criteria

This phase is successful when:
- the review/history UI shows a complete per-pass reasoning chain
- repeated section failures escalate predictably into drilldown sampling
- revision roles measurably change the next plan output
- retained regressions catch drift while live behavior continues to improve
- the team can point to examples where the second or third pass is better because the loop learned from the first pass

## Not In This Phase

- large new proof artifact families
- broad spec reorganization work
- universal visual target scoring
- raw parameter-grid search
- replacing xLights as the authoritative renderer
