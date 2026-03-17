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
- treat artistic quality notes as human-review input until richer scorers exist

Notes:
- revise-existing-concept cases are defined in the corpus now, but the first runner treats them as `framework_assisted` and does not fully auto-score concept identity preservation through the app revision flow yet
- promotion decisions should use the scored subset plus targeted human review on the deferred revise slice until revise scoring is automated
