## Stage 2 Metadata-Aware Prompts

Date: 2026-03-15
Stage: Stage 2 - Scene-Aware Design

Purpose:
- verify that the designer uses metadata tags as semantic scene context
- ensure tag-aware prompts resolve against real tagged props in the current layout
- confirm tag-aware output changes when metadata assignments change

Prompt set:

1. Character vs support roles
- `Keep the character props leading the chorus while support props stay subtle.`

2. Lyric vs rhythm roles
- `Use the lyric props for verse emphasis and let the rhythm props carry the lift in Chorus 1.`

3. Metadata change sensitivity
- `Use the lyric props for verse emphasis.`
- rerun after changing the lyric tag assignment and confirm the output changes

Expected baseline behavior:
- use real tagged props from metadata assignments
- preserve inferred tag names in the intent handoff
- avoid inventing nonexistent targets
- reflect semantic roles in proposal language, not just raw target matching
