# xLightsDesigner Current-State Audit (2026-03-15)

Status: Active audit
Date: 2026-03-15
Owner: xLightsDesigner Team

Purpose: capture where the application actually stands today, what is materially working, what remains incomplete, and what should be treated as the next gated implementation path.

## Executive Summary

Current state:
- the application shell, workflow pages, and core project/audio/design/sequence/review/history UX are now materially coherent
- direct technical sequencing works end to end through xLights when xLights is connected and the sequence is in a valid state
- artifact-backed history and live dashboard workflows are in place
- the designer framework is structurally strong enough to begin real capability-building

Primary remaining gap:
- `designer_dialog` quality is still the biggest functional gap
- the framework exists, but the actual creative intelligence, training depth, and validation loop are not yet strong enough

Recommended next focus:
1. stop broad feature expansion
2. build designer capability in small gated steps
3. validate each step against real usage before proceeding
4. validate actual effect creation quality separately on a clean blank sequence

## What Is In Good Shape

### 1. Shell and workflow UX

Working:
- `Project`, `Audio`, `Design`, `Sequence`, `Review`, `Metadata`, `History`, `Settings`
- clearer page roles
- first-run flow and reset behavior
- live dashboard pattern for `Design` and `Sequence`
- unified apply gate in `Review`
- artifact-backed revision flow in `History`
- simplified chat presentation with agent-specific bubble colors

Assessment:
- strong enough for iterative functional validation
- remaining work is refinement, not structural rescue

### 2. xLights connectivity and sequence apply baseline

Working:
- endpoint fallback/probing between known localhost ports
- direct technical sequencing path
- apply flow writing into xLights
- revision tracking fix
- approval gating flow
- apply/history snapshot capture

Known caveat:
- xLights autosave had to be disabled as a short-term workaround because of the xLights-side backup assert path

Assessment:
- sufficient for current application-side sequencing work
- xLights-side autosave root cause remains a separate follow-up

Remaining validation need:
- actual effect creation quality should now be tested on a clean blank sequence, not only against existing worked sequences

### 3. Sequence-agent architecture

Working:
- canonical `sequence_agent` contracts
- deterministic planning pipeline
- command graph as source of truth
- apply verification/readback
- direct user technical request normalization into the same downstream intent shape
- broad corpus and domain pre-gate audits exist

Assessment:
- v1 technical sequencing foundation is largely in place
- remaining work is mostly polish, larger corpus coverage, and later xLights API isolation cleanup

### 4. Audio-analyst role

Working:
- role boundary is clear
- artifact generation and orchestration path exist
- designer-facing music context can already be derived from analysis output

Assessment:
- good enough as an upstream dependency for current designer work

### 5. History and artifact identity

Working:
- artifact ids
- history entries reference immutable artifacts
- apply captures:
  - design state
  - sequence state
  - audio/scene context
  - execution state

Assessment:
- this is the correct traceability model
- sufficient for training/evaluation-driven iteration

## What Is Still Incomplete

### 1. Designer capability is structurally ready but not behaviorally ready

In place:
- contracts
- runtime/orchestrator split
- cloud response seam
- scene context
- music context
- project-scoped director profile
- traceability

Still incomplete:
- broad high-quality conversational training set
- robust assumption behavior on real prompts
- strong handling of memory/reference/emotional prompts
- designer quality evaluation loop tied to real examples
- disciplined staged rollout of learned preference influence

Assessment:
- biggest remaining product gap

### 2. Cloud-first designer behavior is only partially realized

In place:
- hybrid seam exists
- cloud designer response contract exists
- local normalization/fallback exists

Still incomplete:
- strong prompt package for real creative conversation
- sufficient eval coverage to trust cloud-first behavior
- explicit validation of cloud-vs-fallback quality in real usage

Assessment:
- architecture is ready
- quality is not yet ready to rely on by default

### 3. Training assets are active but still early

In place:
- training module structure
- prompt/fewshot/eval scaffolding
- two-bucket knowledge model
- designer-facing context artifacts

Still incomplete:
- enough high-quality examples to teach the designer reliably
- iterative refinement based on observed failures
- a disciplined minimum-to-advanced training rollout

Assessment:
- this is the right next workstream

### 4. `app.js` still contains too much orchestration glue

Still true:
- some cross-role orchestration and chat behavior still live in `app.js`
- not all role-specific state transitions have been fully extracted

Assessment:
- not the immediate blocker
- should be cleaned up after the next capability gates are stable

### 5. xLights integration isolation is still a future refactor

Decision already made:
- xLightsDesigner-owned API should ultimately live in a dedicated automation subtree
- `xLightsAutomations.cpp` should not remain a growth surface for xLightsDesigner behavior

Current status:
- not yet executed

Assessment:
- important, but not the immediate next move

## Product Gaps By Severity

### P1: Designer quality and training depth

Why it matters:
- this is the main missing capability between current app quality and the intended end-state product

Symptoms today:
- designer is structurally present but still not trustworthy enough for broad natural conversation
- sequencing can work, but the creative layer is not yet rich enough

### P2: Gated validation discipline

Why it matters:
- the system has enough moving parts now that progress must be staged
- otherwise training, runtime, and UI changes will blur together and regressions will be harder to isolate

### P3: Cloud designer confidence

Why it matters:
- the intended end-state is cloud-first reasoning with local normalization
- that means training/eval quality gates are now mandatory, not optional

## What Should Not Be The Focus Right Now

Do not prioritize next:
- broad UI redesign beyond targeted refinement
- more speculative workflow surfaces
- global preference management UI
- xLights API isolation refactor
- additional sequencing-detail UX

Reason:
- these are not the primary blockers to product capability right now

## Immediate Next Validation Track

The next major validation track should be:
- clean-sequence effect-creation validation

Reference:
- [clean-sequence-validation-plan-2026-03-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/clean-sequence-validation-plan-2026-03-15.md)

## Recommended Next Program

The application is ready to shift from:
- broad structural building

to:
- gated designer capability building

Recommended sequence:
1. establish a minimum viable designer training gate
2. validate it against simple real prompts
3. only then move to broader conversational and preference sophistication

## Current Next Move

The staged baseline through Stage 7 is now in place.

Immediate next move:
1. stop adding more synthetic baseline tests
2. run a real live evaluation session in the installed app
3. record observed gaps using:
   - [live-evaluation-script-2026-03-15.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/live-evaluation-script-2026-03-15.md)
4. use those observations to decide whether the next work should be:
   - prompt/training quality
   - runtime normalization refinement
   - cloud-first quality tuning

## Decision

Proceed with a staged training-and-validation checklist where:
- each stage is intentionally small
- each stage has a pass/fail gate
- no later step starts until the current one is working
