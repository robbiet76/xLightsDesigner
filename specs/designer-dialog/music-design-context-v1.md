# Music Design Context v1

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30

## Purpose

Define the designer-facing music-structure context artifact derived from audio analysis.

## 1) Role

`music_design_context_v1` is a distilled, designer-usable view of the audio analysis artifact.

It exists so the designer can reason like a lighting designer about:
- section arc
- tension and release
- rhythmic density
- lyrical emphasis
- phrase boundaries
- where to reveal, intensify, simplify, or resolve

## 2) Source

Derived from:
- `analysis_artifact_v1`
- `analysis_handoff_v1`

It should not replace the audio artifact. It is a designer-facing distilled layer.

## 3) Properties

- stable until audio analysis changes
- derived from audio analysis
- optimized for design reasoning, not raw analysis inspection

## 4) Suggested Shape

```json
{
  "artifactType": "music_design_context_v1",
  "artifactVersion": "1.0",
  "mediaId": "media-uuid-or-hash",
  "sectionArc": [
    { "label": "Intro", "energy": "low", "density": "sparse" },
    { "label": "Verse", "energy": "medium", "density": "moderate" },
    { "label": "Chorus", "energy": "high", "density": "dense" }
  ],
  "designCues": {
    "revealMoments": ["Intro->Verse", "Verse->Chorus"],
    "holdMoments": ["Outro"],
    "lyricFocusMoments": ["Chorus 1"]
  }
}
```
