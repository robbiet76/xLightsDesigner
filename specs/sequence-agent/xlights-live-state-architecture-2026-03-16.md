# xLights Live State Architecture

## Goal
Provide canonical, backend-testable read models for actual xLights state before and after apply.

## Problem
The repo already has:
- direct xLights API reads in `api.js`
- targeted readback verification in `apply-readback.js`

But it does not yet have a canonical live-state contract that answers:
- what sequence is open
- what timing tracks exist
- what marks exist on those tracks
- what display ordering is active
- what effects exist for targeted windows

## Contracts
Initial contracts:
- `xlights_timing_state_v1`
- `xlights_sequence_state_v1`

Later contracts:
- `xlights_effect_occupancy_state_v1`
- `xlights_apply_verification_state_v1`

## Required Uses
- pre-apply validation
- post-apply verification
- backend-first clean-sequence testing
- timing-track existence and mark coverage checks

## Boundary Rules
- live-state builders derive from xLights APIs only
- they do not read UI page state as source of truth
- page-state builders may reference live-state contracts, but not vice versa

## Phase 1 Scope
Build canonical sequence/timing state with optional timing mark expansion.
