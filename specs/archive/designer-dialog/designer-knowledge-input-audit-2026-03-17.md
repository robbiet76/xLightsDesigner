# Designer Knowledge Input Audit

Status: Active
Date: 2026-03-17
Owner: xLightsDesigner Team

Purpose: define the knowledge/context inputs that are available to the designer during deep training, identify the current gaps, and lock the vocabulary boundaries for stage-lighting and composition reasoning.

## 1. Metadata Availability

Current sources available to the designer:
- xLights source structure:
  - models
  - groups
  - submodels
  - scene/layout context
- user-managed metadata assignments:
  - target-to-tag mappings stored in app metadata state
  - tags selected in the Metadata page
  - tags passed into designer normalization and target resolution

Current evidence in product:
- Metadata dashboard exists and supports:
  - tag creation
  - tag description editing
  - applying/removing tags to selected targets
- designer runtime receives:
  - `metadataAssignments`
  - selected metadata tags
- prompt normalization supports:
  - inferred tags
  - explicitly scoped tag references such as `lyric props`

Conclusion:
- metadata needed for training is available now from:
  - xLights source structure
  - user dialog capture via Metadata page
- synthetic metadata fixtures remain valid for corpus training, but they are no longer the only available metadata path

## 2. Music Context Availability

Current music inputs available to the designer:
- section arc from analysis:
  - label
  - energy
  - density
- cue families:
  - beat windows
  - chord windows
  - phrase windows
- derived high-level moments:
  - reveal moments
  - hold moments
  - lyric focus moments

Current evidence in product:
- `musicDesignContext.sectionArc`
- `musicDesignContext.designCues.revealMoments`
- `musicDesignContext.designCues.holdMoments`
- `musicDesignContext.designCues.lyricFocusMoments`
- `musicDesignContext.designCues.cueWindowsBySection`

Current identified gaps:
- transition-strength scoring is still implicit rather than explicit
- harmonic summaries are usable but still sparse compared to a full phrase/harmony model
- lyric-derived focus is section-level, not semantic-line-quality aware

Conclusion:
- music inputs are sufficient for current training and eval
- the remaining work is better cue richness, not missing baseline infrastructure

## 3. Allowed Stage-Lighting Vocabulary

Allowed and actively evaluated terms:
- key light
- fill
- wash
- accent
- punch
- silhouette
- blackout-style restraint
- cue stack
- focal vs support
- reveal
- backlight-style support

Allowed but secondary:
- glow
- cinematic frame
- theatrical frame
- controlled depth
- restrained support

Unsupported or currently noisy terms:
- gobo
- shutter cut
- beam angle
- iris
- fixture-specific pan/tilt language
- followspot
- practicals
- haze-driven beam language

Rule:
- use stage-lighting vocabulary only when it changes:
  - target choice
  - layer choice
  - density/restraint
  - focal hierarchy
- decorative lighting language without sequencing consequences should be treated as noise

## 4. Composition Principles In Scope

Actively evaluated composition principles:
- balance
- contrast
- emphasis
- focal hierarchy
- negative space
- framing
- rhythm
- repetition
- progression
- depth

Allowed but not currently primary scoring criteria:
- symmetry
- asymmetry
- visual weight
- pacing through repetition

Out of scope for direct scoring right now:
- fine-art theory language that does not change sequencing decisions
- academic terminology without target/layout implications

Rule:
- composition reasoning is in scope only when it changes:
  - coverage density
  - focal/support allocation
  - target spread
  - framing choices
  - restraint vs payoff

## 5. Training Implication

Training should now assume:
- metadata is available and should be used
- layout awareness is available and should be used
- music cue windows are available and should be used when appropriate
- lighting/composition language is allowed only when operationally meaningful

This means the next training work should focus on:
- better concept evolution
- richer thematic continuity
- better live validation cadence

Not on reopening context/input architecture.
