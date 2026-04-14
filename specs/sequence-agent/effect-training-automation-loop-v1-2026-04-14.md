# Effect Training Automation Loop v1

Status: Active  
Date: 2026-04-14  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-14

## Purpose

Define the automated training loop that should drive effect-family and later parameter-level training without mixing:
- general sequencing training
- user/project/director preference learning

## Governing Rule

The automation loop must only write:
- `general_training`

It must not write:
- user taste
- project taste
- director preference bias

## Automation Goal

The automation loop should be able to:
1. refresh the unified training set
2. refresh effect-settings coverage
3. classify effects by training readiness
4. schedule the next training work automatically
5. harvest durable outcome records back into the shared general-training set

## Readiness Classes

### `ready_for_parameter_screening`
- effect has parameter registry coverage
- effect is not yet meaningfully screened
- automation can generate and execute new parameter sweeps now

### `ready_for_expansion`
- effect already has screened parameter subset coverage
- automation can deepen or broaden sampling later

### `needs_registry`
- effect has coarse intent translation only
- parameter automation should not run yet
- registry and manifest design work must come first

## Current Expected Ready Set

As of this version, the first expected `ready_for_parameter_screening` effects are:
- `Shockwave`
- `Twinkle`

These are the correct automation starting point because they have:
- registry-defined parameters
- no full screened subset yet

## Loop Stages

### 1. Refresh
- rebuild unified training set
- rebuild effect settings coverage report

### 2. Plan
- build an automation plan from the current coverage state
- classify each effect into one readiness class
- order runnable effects by priority

### 3. Execute
- for `ready_for_parameter_screening` effects:
  - generate parameter sweep manifests
  - run bounded sweeps
  - write render training records

### 4. Learn
- harvest live effect outcome records
- rebuild unified training set
- update coverage and future automation plan

## Boundaries

Do not automate:
- full exhaustive parameter search across all effects at once
- preference capture
- parameter learning for effects with no registry-defined parameter surface

Do automate:
- bounded effect-by-effect parameter screening
- registry-backed sweep execution
- durable general-training aggregation

## Canonical Planning Artifact

The automation loop should produce:
- `effect_training_automation_plan_v1`

That artifact must declare:
- effect name
- family
- coverage status
- readiness class
- priority
- next action

## Acceptance Standard

This automation loop is correct when:
- it can refresh and classify the current effect-training surface automatically
- it only schedules parameter automation where registry support exists
- it leaves `needs_registry` effects out of execution
- it writes only general-training outputs
