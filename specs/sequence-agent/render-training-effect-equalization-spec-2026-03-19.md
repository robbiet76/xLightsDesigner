## Effect Equalization

Purpose:
- bring the active Stage 1 effect set to a common maturity target before expanding the effect roster further
- make that target measurable and automatable

Current board:
- [/tmp/render-training-current-effect-equalization.v1.json](/tmp/render-training-current-effect-equalization.v1.json)

Equal state definition:
- target stage:
  - `selector_ready_with_evidence`
- required per effect:
  - `execution_ready`
  - `structurally_observable`
  - `structurally_retrievable`
  - `selector_ready`
  - at least `2` passed selector cases where the effect is the selected effect

Current effect set:
- `Bars`
- `Marquee`
- `Pinwheel`
- `Spirals`
- `Twinkle`
- `Shockwave`

Current result:
- equalized:
  - `Bars`
  - `Marquee`
  - `Pinwheel`
  - `Spirals`
  - `Twinkle`
- not yet equalized:
  - `Shockwave`

Current blocker:
- `Shockwave`
  - still `structurally_retrievable`
  - missing:
    - `selector_ready`
    - sufficient selector evidence depth

What equalization means operationally:
1. every current effect has a stable Stage 1 geometry set
2. every current effect has constrained retrieval evidence
3. every current effect can win supported selector cases against the current merged selector set
4. no effect is promoted based only on one-off examples or intuition

Automation target:
- the render-training system should be able to regenerate the equalization board from artifacts with no manual editing

Required artifact classes per effect:
1. broad screening summary
- example:
  - effect summary JSON

2. effect-local retrieval evidence
- effect intent map
- retrieval eval results

3. interaction evidence for complex effects
- interaction run summary
- interaction intent map
- interaction retrieval eval

4. cross-effect selector evidence
- merged selector intent map
- selector eval cases

Standard automation pipeline:
1. run effect screening plan
2. generate effect summary
3. generate effect intent map
4. run effect retrieval eval
5. if effect is complex:
   - run interaction set
   - generate interaction intent map
   - run interaction retrieval eval
6. merge selector maps
7. run selector evaluation
8. regenerate equalization board

Current automation pieces now in place:
- merge selector maps:
  - [merge-intent-maps.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/merge-intent-maps.py)
- equalization board:
  - [generate-current-effect-equalization-board.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/generators/generate-current-effect-equalization-board.py)

Recommended immediate next step:
1. add `Shockwave` selector cases until it reaches the same selector evidence depth as the other equalized effects
2. regenerate the equalization board
3. once all six are equalized, define the next phase from a stable base

Recommended next phase after equalization:
- do not add many new effects immediately
- first automate the promotion pipeline itself:
  - one command to rebuild:
    - summaries
    - intent maps
    - retrieval evals
    - selector evals
    - equalization board
- then use that automation to onboard the next effect class consistently
