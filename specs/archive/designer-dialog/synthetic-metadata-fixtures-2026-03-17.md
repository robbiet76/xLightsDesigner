# Synthetic Metadata Fixtures

Status: Active
Date: 2026-03-17
Owner: xLightsDesigner Team

Purpose: provide a stable synthetic metadata layer for deep designer-training evals before real user metadata is widely available.

## Role

These fixtures exist to test whether the designer:
- uses metadata tags as semantic context
- changes target selection when metadata changes
- combines metadata with layout and music context instead of using tags mechanically

These fixtures are:
- synthetic
- test-only
- intentionally opinionated

They are not production truth and should not be presented as canonical user metadata.

## Interim Policy

Until real user/project metadata is available at scale:
- use the synthetic fixture pack as the default metadata source for metadata-aware eval cases
- allow eval cases to override or remap a subset of tags
- keep the synthetic vocabulary small and semantically clear

## Fixture Vocabulary

The first fixture pack uses these tags:

- `character`
  - props that can carry personality or narrative focus
- `support`
  - props intended to reinforce rather than lead
- `lyric`
  - props suitable for phrase/lyric emphasis
- `rhythm`
  - props suitable for pulse/groove-driven motion
- `focal`
  - props that can act as the primary attention anchor
- `accent`
  - props suited to short hits, reveals, or punctuation
- `wash`
  - props suited to broad color-field support
- `perimeter`
  - props that frame the scene or edges
- `centerpiece`
  - props near the visual center or strongest compositional emphasis
- `background`
  - props best used as depth/support rather than lead
- `vertical`
  - props whose geometry supports vertical motion or rise/fall reads
- `horizontal`
  - props whose geometry supports sweeps, framing, or horizon-style reads

## Expected Use

Good metadata-aware behavior should:
- prefer `character` + `focal` props for leading narrative moments
- use `support`, `wash`, and `background` props for reinforcement
- choose `lyric` props differently from `rhythm` props
- combine `centerpiece` / `perimeter` with layout context rather than duplicating it
- treat metadata as soft semantic guidance, not a hard replacement for design reasoning

Bad metadata-aware behavior includes:
- directly mapping one tag to one effect family without context
- ignoring the difference between `lyric` and `rhythm`
- ignoring layout/focus even when metadata exists
- touching every tagged prop equally without compositional restraint

## Files

- [synthetic-metadata-fixture-v1.json](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/synthetic-metadata-fixture-v1.json)

## Next Step

Use this fixture pack in the first metadata-aware eval set and note where:
- the designer reasoning is weak
- the fixture vocabulary is insufficient
- real user metadata will need richer concepts
