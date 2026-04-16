# xLights Upstream Tracking Policy

Status: Archived
Date: 2026-04-13
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-16
Superseded By: `xlights-2026-06-api-migration-plan-2026-04-16.md`, `xlights-2026-06-owned-api-boundary-and-audit-2026-04-16.md`

## Purpose

Define how xLightsDesigner should track upstream xLights changes while the upstream repository is undergoing significant refactor work.

## Archive Note
This policy is no longer aligned with the current integration state.

It assumes:
- the old local xLights tree at `/Users/robterry/xLights`
- the old owned branch strategy
- pre-`2026.06` migration posture

The active integration baseline is now `/Users/robterry/xLights-2026.06`, and migration governance is defined by the `2026.06` specs listed above.

This policy exists to prevent the sequencing POC from being destabilized by upstream churn while still ensuring that render and preview architecture changes are actively monitored.

## Canonical Upstream Reference

For upstream architecture and rendering audits, the canonical source of truth is:
- `https://github.com/xLightsSequencer/xLights`
- branch: `master`

This is the branch that should be used when assessing:
- current render architecture
- preview composition behavior
- geometry/layout seams
- likely future integration opportunities

## Local Integration Branch

The local fork/integration branch used for xLightsDesigner work should remain on the owned stable branch until an explicit migration checkpoint is chosen.

Current local xLights integration tree:
- `/Users/robterry/xLights`

Current observed branch:
- `api-cleanup`

This local branch should be treated as:
- the current owned integration surface
- the branch used to preserve app-side stability while the sequencing POC is still proving value

## Core Policy

### Track upstream continuously
xLightsDesigner should continuously watch upstream `master` for changes relevant to:
- rendering
- preview composition
- layout geometry
- owned API opportunities
- sequence render orchestration

### Do not live-track unstable upstream work in the active integration path
The active xLightsDesigner integration branch should not be rebased or migrated continuously against upstream refactor churn.

Reason:
- the sequencing POC needs a stable integration target
- upstream AI-assisted refactor work is likely to produce interface churn and transient instability
- active POC work should not become hostage to upstream movement

## Operational Rule

Use this split:

### Upstream `master`
Use for:
- audits
- architecture review
- watchlist maintenance
- future migration planning

### Owned local integration branch
Use for:
- active app integration
- owned API work
- sequencing POC implementation
- acceptance validation

## Migration Rule

Do not switch the owned branch to newer upstream code until:
1. the upstream refactor has substantially stabilized
2. major upstream bugs have been worked through
3. xLightsDesigner can run its own acceptance and integration validation against the candidate migration state

This means the migration should be:
- deliberate
- checkpointed
- test-gated

Not continuous.

## Why This Policy Is Correct

A live-tracking approach would create these risks:
- active sequencing work blocked by unrelated upstream instability
- moving internal render seams during POC implementation
- repeated integration breakage
- difficulty distinguishing xLightsDesigner defects from upstream churn

A watch-then-adopt approach gives:
- stable owned integration during POC
- ongoing awareness of upstream render changes
- cleaner migration timing
- lower debugging ambiguity

## What Must Be Watched

The watchlist should prioritize upstream changes affecting:
- preview composition logic
- node coordinate generation
- render buffer initialization
- frame export / preview capture
- render-current style APIs
- layout geometry APIs
- owned automation/API surfaces related to sequencing and render validation

## Recommended Process

### 1. Maintain a lightweight upstream watch cadence
Regularly inspect upstream `master` for render/preview/API changes relevant to xLightsDesigner.

### 2. Keep a compatibility watchlist
Document files and surfaces likely to affect:
- preview scene reconstruction
- render truth checkpoints
- geometry export
- owned sequencing control

### 3. Migrate only at explicit checkpoints
When upstream appears stable enough:
- choose a migration candidate
- run xLightsDesigner acceptance/integration validation
- fix adaptation issues on a migration branch
- only then adopt as the new owned base

## POC Rule

During the sequencing quality POC:
- stability of the owned integration path is more important than staying on the latest upstream refactor state
- awareness of upstream render evolution is still required

So the correct policy is:
- watch upstream closely
- adopt upstream selectively

## Recommendation

Lock in the following process:
- use upstream `master` as the canonical audit source
- keep the owned local integration branch stable for active product work
- do not live-track refactor churn in the active integration branch
- switch to newer upstream code only after stabilization and explicit validation
