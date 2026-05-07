# Sequence Agent Specs

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30

Active specifications and machine-readable contracts for `sequence_agent`, xLights control, model metadata, render-training knowledge, and sequencing quality.

## Current Specs

- `sequencing-system.md`
- `model-metadata.md`
- `xlights-api.md`
- `xlights-launch-runtime.md`
- `render-training-knowledge.md`
- `render-review-training.md`
- `sequencing-quality-curriculum.md`
- `production-sequence-read-benchmark.md`
- `unattended-training-operations.md`

These Markdown specs are the durable source of implementation guidance. Older `xlights-sequencer-control-*` prose specs live in `archive/` and are historical only.

## Machine-Readable Contracts

Render-training schemas:

- `sequencer-render-training-record.schema.json`
- `sequencer-render-training-sweep-manifest.schema.json`

Owned xLights API and fixture schemas:

- `xlights-sequencer-control-schemas-fixture-pack-manifest.schema.json`
- `xlights-sequencer-control-schemas-layout-media-timing.schema.json`
- `xlights-sequencer-control-schemas-sequencer-effects.schema.json`
- `xlights-sequencer-control-schemas-system-and-sequence.schema.json`
- `xlights-sequencer-control-schemas-v2-envelope.schema.json`

Fixture configuration:

- `xlights-sequencer-control-test-fixtures.manifest.json`
- `xlights-sequencer-control-test-fixtures.example.env`

The legacy `xlights-sequencer-control-*` prefix is retained for active JSON/schema filenames where tooling or `$id` values still depend on it. Do not use that prefix for new prose specs.

## Related Domains

- Audio timing taxonomy: `../audio-analyst/timing-track-taxonomy-and-sequencing-uses.md`
- Designer handoff: `../designer-dialog/sequencing-design-handoff-v2.md`
- Product plan: `../product-plan.md`
