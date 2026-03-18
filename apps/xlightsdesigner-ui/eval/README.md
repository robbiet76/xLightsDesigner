# Designer Eval Folder

This folder contains the offline eval corpus and runner for the deep designer-training phase.

Current contents:
- `designer-eval-cases-v1.json`: canonical tracked eval corpus
- `run-designer-eval.mjs`: offline runner for the current designer runtime/orchestrator
- `synthetic-metadata-fixture-v1.json`: synthetic metadata fixture used by metadata-aware eval cases

Current policy:
- use the frozen pre-training framework and handoff contract
- prefer offline validation over live apply during iterative designer training
- treat structural scorer output as the automated gate
- use comparative quality cases to ensure the scorer prefers stronger outputs over flatter but still valid alternatives
- use fixture-shift cases so the same prompt must adapt across alternate layouts and song arcs, not just one synthetic scene

Runner modes:
- `default`: normal single-output pass/fail eval
- `framework_assisted`: revise-in-place eval using app-equivalent merge semantics
- `paired_preference`: compare two director profiles on the same prompt
- `repeated_preference`: confirm stability across repeated preference-aware runs
- `paired_metadata`: confirm metadata changes actually change target selection
- `paired_fixture`: confirm layout or song-arc changes actually change target selection or section behavior
- `paired_quality`: compare a stronger prompt against a flatter alternative and require the scorer to prefer the stronger result
