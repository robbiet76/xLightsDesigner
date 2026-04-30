# Render Training Catalog

Status: Active
Date: 2026-04-30
Owner: xLightsDesigner Team

This directory contains the durable catalog layer for sequencer render training.

The catalog is intentionally split into lifecycle classes. Runtime code should consume generated bundles through loader APIs, not raw catalog files directly.

## Inventory

The authoritative file classification is:

- `knowledge-inventory.v1.json`

Validate the inventory with:

```bash
node scripts/sequencer-render-training/tooling/validate-training-catalog-inventory.mjs
```

## Lifecycle Classes

- `curated_source`: hand-maintained or deliberately curated source inputs for training and generation.
- `promoted_evidence`: durable promoted training records that can be used to rebuild curated/generated knowledge.
- `generated_catalog`: rebuildable catalog outputs produced from curated source and promoted evidence.
- `generated_semantics`: rebuildable compact semantic records used to export runtime bundles.
- `report`: generated audits, coverage reports, plans, and dossiers used for review and planning.
- `source_snapshot`: imported upstream source data kept for diffing and compatibility tracking.
- `memory`: durable outcome memory that is append/harvest oriented.

## Runtime Rule

The checked-in runtime bundles under `apps/xlightsdesigner-ui/agent/sequence-agent/generated/` are generated artifacts. They should carry provenance and be regenerated from this catalog layer. Do not hand-edit them.

## Promoted Screening Evidence

Promoted effect-screening records are stored as compact JSONL packs in:

- `effect-screening-record-packs/`

The old one-file-per-record layout was intentionally removed because it created thousands of files and retained raw frame payloads that are not needed for durable learning. Use `pack-effect-screening-records.mjs` to rebuild the packs from loose records or mixed pack/staging inputs.

## Generated Reports

Effect-training dossiers are no longer checked into the catalog. Generate them on demand with `build-effect-training-dossiers.mjs` into a run artifact directory when a detailed per-effect review is needed.
