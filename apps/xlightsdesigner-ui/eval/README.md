# Designer Eval Folder

This folder contains the offline eval corpus and runner for the deep designer-training phase.

Current contents:
- `designer-eval-cases-v1.json`: canonical tracked eval corpus
- `live-design-validation-suite-v1.json`: canonical live comparative validation scenarios for real saved sequences, including scoped focus, stage-lighting, composition, motion-language, and render-discipline slices
- `live-design-validation-suite-extended-v1.json`: slower extended live pack that adds alternate saved-sequence coverage beyond the promoted baseline pack, including additional whole-pass composition checks on alternate saved-sequence families
- `run-designer-eval.mjs`: offline runner for the current designer runtime/orchestrator
- `synthetic-metadata-fixture-v1.json`: synthetic metadata fixture used by metadata-aware eval cases

Current policy:
- use the frozen pre-training framework and handoff contract
- prefer offline validation over live apply during iterative designer training
- treat structural scorer output as the automated gate
- use comparative quality cases to ensure the scorer prefers stronger outputs over flatter but still valid alternatives
- use fixture-shift cases so the same prompt must adapt across alternate layouts and song arcs, not just one synthetic scene
- use the live scenario pack after offline changes are green to validate real-sequence comparative behavior without apply-by-default
- keep the promoted live baseline pack small enough to complete reliably
- use the extended live pack for slower alternate-sequence probes and broader cadence checks
- the desktop automation CLI now scales the live-suite timeout with scenario count so the extended pack can complete without manual timeout overrides
- the desktop live-suite runner now reuses `refreshFromXLights` and `analyzeAudio` work per `(sequencePath, analyzePrompt)` context instead of repeating that setup for every scenario on the same sequence

Runner modes:
- `default`: normal single-output pass/fail eval
- `framework_assisted`: revise-in-place eval using app-equivalent merge semantics
- `paired_preference`: compare two director profiles on the same prompt
- `repeated_preference`: confirm stability across repeated preference-aware runs
- `paired_metadata`: confirm metadata changes actually change target selection
- `paired_fixture`: confirm layout or song-arc changes actually change target selection or section behavior
- `delete_regenerate`: remove one concept from a seeded draft, regenerate a scoped replacement, and confirm the rest of the draft survives unchanged
- `paired_quality`: compare a stronger prompt against a flatter alternative and require the scorer to prefer the stronger result
