# Sequencer Phase 3 Implementation Checklist

Status: Active
Date: 2026-04-13
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-13

## Purpose

Execution checklist for the next sequencing phase after the feedback loop and retained regression harness were locked.

## 1. Regression Harness Discipline

- [ ] keep the retained proof suites green during live-loop work
- [ ] treat retained expectation changes as intentional contract changes, not incidental drift
- [ ] avoid adding new retained artifact families unless they directly support live sequencing behavior

## 2. Live Review Visibility

- [ ] preserve request scope, render observation, render critique, artistic goal, revision objective, and gate in history snapshots
- [ ] show the full pass chain in the Review screen
- [ ] show the same chain in History screen inspection
- [ ] make repeated instability obvious across consecutive passes

## 3. Revision Role Planning

- [x] define a small bounded role set:
  - strengthen lead
  - reduce competing support
  - widen support
  - increase section contrast
  - add section development
- [ ] map roles to safe prop targeting rules
- [x] map roles to safe effect-family biases
- [ ] keep parameter tuning out of this layer
- [x] map unresolved prior-pass proof signals into the bounded revision-role set

## 4. Repeated-Pass Memory

- [ ] capture revision attempt summaries
- [ ] capture resulting critique changes
- [ ] store success/failure memory by scope, critique type, and chosen revision role
- [ ] bias future planning from this memory

## 5. Group / Model Drilldown

- [ ] keep section instability at section level until repeated failures justify drilldown
- [ ] identify implicated props/groups from drilldown windows
- [ ] emit bounded group/model revision hints
- [ ] avoid effect-parameter tuning at this rung

## 6. Effect-Family Learning

- [ ] record effect-family choice in revision memory
- [ ] record outcome deltas after each revision pass
- [ ] identify effect-family tendencies for focus, support balance, section contrast, and section development
- [ ] use those tendencies to bias future sequencing plans

## 7. Parameter-Level Learning Later

- [ ] do not start parameter-level search until revision roles and effect-family learning are stable
- [ ] define a narrow first parameter-learning target only after the earlier items are working in live sequencing

## Exit Check

- [ ] second-pass sequencing decisions are visibly more informed by the prior pass
- [ ] review/history inspection makes the pass-to-pass reasoning chain easy to follow
- [ ] retained regressions stay green while live behavior improves
