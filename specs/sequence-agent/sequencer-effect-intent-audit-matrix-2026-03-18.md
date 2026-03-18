# Sequencer Effect Intent Audit Matrix

Status: Active
Date: 2026-03-18
Owner: xLightsDesigner Team

Purpose: capture the current intent-to-settings support level for the initial high-value effect set and identify which effects are only schema-safe versus truly ready for render-grounded training.

Legend:
- `Schema`: xLights parameter surface is known through the effect-definition catalog
- `Heuristic`: current translator has explicit capability metadata or parameter-matching rules
- `Render-grounded`: trained or validated against actual rendered outcomes

## Initial Audit Set

| Effect | Canonical xLights Name | Current Capability Entry | Current Realization State | Main Current Mapping Path | Primary Gap | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| On | `On` | Yes | Schema + partial heuristic | inferred directly from steady/hold language; palette/brightness translation only | no render-grounded understanding of hold intensity by prop type | audit actual `On` params and build hold/wash exemplars |
| Single Strand | `SingleStrand` | No | Schema only | structurally supported in xLights catalog, but not first-class in capability table | no explicit capability metadata; no semantic mapping | add capability entry and first dedicated audit |
| Color Wash | `Color Wash` | Yes | Schema + heuristic | capability table plus shared palette/intensity/render translation | settings choices are still coarse and not render-grounded | create wash exemplars across matrices/outlines/figures |
| Shimmer | `Shimmer` | Yes | Schema + heuristic | inferred from sparkle/shimmer language; shared speed/density translation | sparkle density and restraint are not tied to real render outcomes | capture restrained vs busy shimmer sweeps |
| Bars | `Bars` | Yes | Schema + heuristic | inferred from pulse/rhythm language; dedicated thickness/direction patterns | bar count/width/speed semantics still rely on naming heuristics | capture rhythmic sweeps across outlines and canes |
| Wave | `Wave` | Yes | Schema + heuristic | dedicated capability metadata and safer enum handling | motion character and direction semantics are not render-grounded | capture smooth/suspended wave behavior by prop type |
| Morph | `Morph` | Yes | Schema + heuristic | path-motion family with duration/length/thickness matching | path semantics are too specialized for current generic mapping | capture representative morph paths and timing outcomes |
| Meteors | `Meteors` | Yes | Schema + heuristic | particle-motion family with speed/count/length matching | trail length/count/direction tradeoffs are not learned | capture meteor sweeps on outlines and sparse props |
| Pinwheel | `Pinwheel` | Yes | Schema + heuristic | radial-motion family with speed/arms/thickness/direction patterns | style/arm semantics remain loosely interpreted | capture controlled radial-motion exemplars |

## Cross-Cutting Findings

1. The effect-definition catalog is authoritative for:
- parameter names
- types
- min/max bounds
- enum values

2. The capability table is hand-authored and incomplete.

3. The translator is intentionally safe but still shallow:
- regex parameter selection
- coarse scalar maps
- enum coercion where possible
- manual layer/render policy mapping

4. Render meaning is not yet represented as first-class knowledge.

## Initial Training Order

Recommended first realization order:
1. `On`
2. `SingleStrand`
3. `Bars`
4. `Wave`
5. `Color Wash`
6. `Shimmer`
7. `Meteors`
8. `Pinwheel`
9. `Morph`

Reason:
- starts with the most common foundational effects
- then broadens into rhythmic and motion-heavy families
- leaves the more path-specialized family (`Morph`) after the core harness exists

## Practical Implication

Today’s translator is good at:
- staying inside valid xLights schemas
- avoiding obviously invalid writes

It is not yet good at:
- choosing settings because they produce the right visual read

That distinction is the core sequencer training problem to solve next.
