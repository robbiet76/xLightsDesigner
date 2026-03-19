# Designer To Sequencer Handoff Audit And Roadmap

Status: Draft
Date: 2026-03-19
Owner: xLightsDesigner Team

## Purpose
Audit the current `designer_dialog -> sequence_agent` handoff and define the next contract direction so sequencer training can rely on specific, actionable designer inputs instead of vague creative text.

## Current Source Of Truth
- [designer-interaction-contract.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/designer-interaction-contract.md)
- [designer-dialog-contracts.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/designer-dialog-contracts.js)
- [sequence-intent-handoff.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-intent-handoff.js)
- [handoff-contracts.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/handoff-contracts.js)
- [sequence-agent-contracts.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent-contracts.js)
- [brief-synthesizer.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/brief-synthesizer.js)
- [planner.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/planner.js)

## Current State
The current flow is structurally valid but too coarse for consistent sequencer training.

### What exists today
- `creative_brief_v1`
  - richer designer-side artifact
  - includes summary, goals summary, inspiration summary, sections, mood/energy arc, narrative cues, visual cues, and hypotheses
- `proposal_bundle_v1`
  - includes proposal lines, scope, constraints, execution plan, and traceability
- `intent_handoff_v1`
  - the actual sequencer-facing contract

### What the actual handoff currently contains
`intent_handoff_v1` currently reduces designer output to:
- `goal`
- `mode`
- `scope`
- `constraints`
- `directorPreferences`
- `approvalPolicy`
- optional `executionStrategy`

In practice, the most important creative collapse happens in [sequence-intent-handoff.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-intent-handoff.js):
- `directorPreferences.styleDirection`
- `directorPreferences.energyArc`
- `directorPreferences.focusElements`
- `directorPreferences.colorDirection`

This is too thin for reliable sequencer planning.

## Main Gaps
The current handoff does not require explicit operational sequencing directives for:
- section purpose
- prop-role assignment
- density target
- motion target
- focus hierarchy
- transition intent
- constraints and avoidances
- preferred visual/effect families
- escalation/hold/release behavior by section

This means the sequencer must still infer too much from vague fields like:
- `goal`
- `styleDirection`
- `energyArc`

That is not the right training boundary.

## Current Boundary Assessment

### Creative brief
Good for designer-side reasoning and traceability.

Current weakness:
- mostly string summaries
- not yet a strongly structured sequencing directive artifact

### Proposal bundle
Good for reviewability and execution traceability.

Current weakness:
- still primarily proposal text plus execution metadata
- not the clean canonical handoff contract the sequencer should train against

### Intent handoff
Good for minimum routing.

Current weakness:
- under-specified for real sequencing
- validates shape, not semantic completeness

## Required Direction
The designer should output a structured sequencing brief, not just broad creative language.

The sequencer should then execute that structured brief.

That implies a stronger handoff contract, likely a new version rather than stretching `intent_handoff_v1`.

## Recommended New Contract Direction
Introduce a dedicated designer-to-sequencer handoff contract, for example:
- `sequencing_design_handoff_v2`

### Required fields
1. `goal`
- concise objective for the section/pass

2. `sectionDirectives`
- one entry per relevant section
- each entry should include:
  - `sectionName`
  - `sectionPurpose`
  - `energyTarget`
  - `motionTarget`
  - `densityTarget`
  - `transitionIntent`

3. `propRoleAssignments`
- explicit role map, for example:
  - `lead`
  - `support`
  - `accent`
  - `background`

4. `focusPlan`
- focal props or groups
- what should lead visually
- what should remain secondary

5. `visualFamilyPreferences`
- preferred structural families or effect families
- not exact effect settings

6. `avoidances`
- what the sequencer should avoid
- examples:
  - full-yard fill
  - busy sparkle texture
  - high-flash behavior
  - too many simultaneous leaders

7. `preservationRules`
- explicit keep/avoid drift constraints

8. `executionLatitude`
- how much freedom the sequencer has
- examples:
  - `tight`
  - `moderate`
  - `broad`

## Example Of Good Handoff
Instead of:
- `Make this feel bigger`

The designer should hand off something closer to:
- section purpose: `chorus reveal`
- energy target: `high`
- motion target: `expanding directional motion`
- density target: `medium-high but readable`
- focus plan: `trees lead, arches support, stars accent phrase endings`
- visual family preferences: `large-form motion, not fine sparkle texture`
- avoidances: `no full-yard noise wall`

That is actionable.

## Training Implication
Designer training should be optimized to produce:
- clear
- specific
- reusable
- structured
handoff artifacts.

Sequencer training should be optimized to:
- consume those structured directives
- implement them correctly
- preserve variety without inventing a new vision

## Immediate Next Steps
1. define the new canonical handoff schema
2. add validator rules for semantic completeness, not just object presence
3. update designer tests to reject vague-only handoffs
4. update sequencer input validation to require the new structured fields before promotion of the new path
5. keep compatibility with `intent_handoff_v1` only as a temporary path during migration

## Recommendation
Do not continue training the sequencer against broad, under-structured designer inputs.

The next contract milestone should be:
- explicit designer sequencing directives
- stable schema
- test-backed validation

That will give the sequencer a clean training boundary and reduce style drift, guesswork, and inconsistent execution.
