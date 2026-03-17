# Designer Diagnostics Snapshots

Status: Active
Date: 2026-03-17
Owner: xLightsDesigner Team

Purpose: define the stable inspection snapshots needed during training so humans can evaluate concepts and resulting sequence translation without reading raw effect rows by default.

## Snapshot Types

### 1. Concept Snapshot

Unit:
- one active `designId`

Fields:
- `designId`
- `designRevision`
- `designAuthor`
- `designLabel`
- `anchor`
- `intentSummary`
- `focusTargets`
- `palette`
- `placementCount`
- `effectFamilies`
- `supersededRevisionCount`
- `previousRevisionSummary` when available

### 2. Sequence Link Snapshot

Unit:
- all Sequence rows linked to one `designId`

Fields:
- `designId`
- `designRevision`
- `rowCount`
- `targetCount`
- `sectionCount`
- `effectCount`
- `rows[]` summary entries

### 3. Apply Result Snapshot

Unit:
- one apply attempt

Fields:
- `historyEntryId`
- `designIdsApplied`
- `revisionBefore`
- `revisionAfter`
- `status`
- `verificationSummary`
- `readbackHighlights`

## Inspection Rules

Default inspection path during training:
1. inspect concept snapshot first
2. inspect linked sequence snapshot second
3. inspect apply result snapshot only when the sample was executed

This keeps evaluation conceptual first and technical second.

## Framework Rule

These snapshots should remain stable during the training phase.
They may gain additive fields, but their primary units should not change:
- concept snapshot by `designId`
- sequence link snapshot by `designId`
- apply result snapshot by apply history entry
