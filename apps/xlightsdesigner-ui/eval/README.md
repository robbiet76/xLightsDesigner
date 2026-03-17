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

Runner modes:
- `default`: normal single-output pass/fail eval
- `framework_assisted`: revise-in-place eval using app-equivalent merge semantics
- `paired_preference`: compare two director profiles on the same prompt
- `repeated_preference`: confirm stability across repeated preference-aware runs
- `paired_metadata`: confirm metadata changes actually change target selection
- `paired_quality`: compare a stronger prompt against a flatter alternative and require the scorer to prefer the stronger result
