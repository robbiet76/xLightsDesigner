# Creative Director -> xLights Executor Contract (v1)

This contract lets the creative agent stay focused on design while the executor agent stays focused on xLights implementation.

## Rules

- Creative agent must output valid JSON matching `creative-to-xlights.schema.json`.
- Executor agent must not reinterpret high-level intent unless guardrails would be violated.
- Executor agent may choose exact xLights effects/parameters only from `allowed_effect_families` and section goals.
- Both agents must support two outputs: `experimental` and `safe`.

## Workflow

1. Creative agent analyzes song and holiday style intent.
2. Creative agent emits contract JSON.
3. Executor validates JSON against schema.
4. Executor builds timing tracks and sequence implementation.
5. Executor reports any unmapped fields or conflicts back to creative agent.

## Field intent (quick)

- `show`: holiday context and audience safety envelope.
- `song`: technical music metadata for alignment.
- `global_style`: palette, principle stack, and innovation operators.
- `sections`: core composition map by musical form.
- `timing`: beat/phrase sync strategy and critical hit points.
- `render_variants`: creative stretch level and safe fallback.
- `guardrails`: hard limits to avoid visual clutter.

## Example skeleton

```json
{
  "contract_version": "1.0.0",
  "show": {
    "holiday": "christmas",
    "creative_intent": "Warm nostalgic narrative that expands into triumphant choruses.",
    "target_audience": "family",
    "style_track": "nostalgic-deconstruction"
  },
  "song": {
    "title": "Example Song",
    "artist": "Example Artist",
    "duration_ms": 192000,
    "bpm": 128,
    "time_signature": "4/4"
  },
  "global_style": {
    "palette": {
      "primary": ["#C62828", "#1B5E20"],
      "accents": ["#F9A825"],
      "neutrals": ["#FFF3E0"],
      "temperature_bias": "warm"
    },
    "motion_profile": "moderate",
    "design_principles": [
      {
        "name": "focal_hierarchy",
        "application": "Prioritize mega-tree during choruses, roofline during verses."
      }
    ],
    "innovation_operators": [
      { "name": "narrative_reveal", "strength": 0.65 }
    ]
  },
  "sections": [
    {
      "id": "intro_1",
      "label": "Intro",
      "start_ms": 0,
      "end_ms": 15000,
      "musical_role": "intro",
      "mood": "wonder",
      "energy_target": 0.25,
      "focus_targets": ["roofline", "left-window-group"],
      "allowed_effect_families": ["dim_curve", "twinkle", "color_wash"],
      "cue_intent": "Slow reveal with restrained sparkle and warm gradients."
    }
  ],
  "timing": {
    "beat_grid": "quarter",
    "phrase_grid": 8,
    "sync_priority": "hybrid"
  },
  "render_variants": {
    "experimental": {
      "complexity": 0.8,
      "motion_intensity": 0.7,
      "color_tension": 0.5,
      "notes": "Allow controlled counterpoint in pre-chorus."
    },
    "safe": {
      "complexity": 0.45,
      "motion_intensity": 0.4,
      "color_tension": 0.2
    }
  },
  "guardrails": {
    "max_concurrent_motion_layers": 3,
    "max_palette_size_active": 4,
    "max_strobe_events_per_minute": 4,
    "require_focal_hierarchy": true,
    "neighborhood_mode": true,
    "quiet_hours_end_time_local": "22:00"
  },
  "notes_for_executor": [
    "Preserve phrase-level breathing room after every chorus.",
    "Do not use strobe_limited on window props."
  ]
}
```

## Executor response pattern

When execution is complete, return:

- Validation status
- Timing integrity checks (`start_ms < end_ms` and non-overlapping section windows unless overlap is intentional)
- List of section-to-model mappings used
- Any forced substitutions (with reasons)
- Risk flags where creative intent could not be matched exactly

## Versioning

- Increment patch for non-breaking enum/value additions.
- Increment minor for optional field additions.
- Increment major for required-field or semantic changes.
