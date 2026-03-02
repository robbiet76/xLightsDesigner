# JSON Schemas (v2 Program Contract)

These schemas provide machine-readable validation for the xLights sequencer control program contract.

Files:
- `v2-envelope.schema.json`: common v2 request envelope.
- `system-and-sequence.schema.json`: `system.*` and `sequence.*` params schemas.
- `layout-media-timing.schema.json`: `layout.*`, `media.*`, and timing-track/mark command params schemas.
- `sequencer-effects.schema.json`: display element ordering and effects/layer command params schemas.

Notes:
- These schemas validate request payload structure and required fields.
- Runtime/business-rule checks (resource existence, conflicts, and side effects) remain implementation responsibilities.
