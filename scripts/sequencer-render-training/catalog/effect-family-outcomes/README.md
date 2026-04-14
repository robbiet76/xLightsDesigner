# Effect Family Outcome Records

General-training outcome records harvested from live sequencing passes.

Rules:
- store only `effect_family_outcome_record_v1`
- store only `storageClass: general_training`
- do not store user, project, or director taste preferences here

Typical flow:
1. live app writes per-pass outcome records into project artifact storage
2. `harvest-effect-outcome-records.mjs` copies eligible records into this catalog
3. `build-unified-training-set.mjs` folds them into `sequencer-unified-training-set-v1.json`
