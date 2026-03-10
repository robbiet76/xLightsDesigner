# Song Structure Rubric (LLM Relabeling)

This rubric guides lyric-based section labeling in the app.

## Sources
- Open Music Theory: formal functions and recurring-section contrast guidance.
  - https://viva.pressbooks.pub/openmusictheory/chapter/verse-chorus-forms/
  - https://viva.pressbooks.pub/openmusictheory/chapter/aaba-form/
- NSAI (Nashville Songwriters Association International): practical songwriting anatomy guidance for verse/chorus/bridge roles.
  - https://www.nashvillesongwriters.com/lyric-writing-101

## Applied Heuristics
- Verse: lyrical novelty, narrative/detail progression, lower exact repetition.
- Chorus/Refrain: repeated hook/title language, emotional center, strong recurrence.
- Pre-Chorus: short transition that leads into chorus language.
- Bridge: contrast section (new lyrical idea/perspective), commonly appears once in later song.
- Refrain vs Chorus:
  - Refrain is a recurring line/phrase embedded in larger verse-like text.
  - Chorus is a recurring full section block.
- Verse-to-chorus bleed handling:
  - If a stanza starts narrative (verse-like) but pivots into repeated title/hook language, bias the hook-heavy portion as Chorus.
  - If stanza boundaries are coarse and cannot split internally, label the stanza containing repeated title/hook lines as Chorus when that hook recurs in later stanzas.
  - Favor Chorus when title/hook words recur across 2+ lyrical stanzas, even if one stanza also contains narrative lines.

## Evidence Inputs Passed to LLM
- `stanzaText` sample lines per lyrical section.
- `repeatedLineRatio`: fraction of lines that already appeared in earlier stanzas.
- `uniqueTokenRatio`: lexical novelty score in stanza text.
- `titleTokenRatio`: overlap with fingerprinted track title tokens.
- line-level recurrence of title/hook phrases across adjacent stanzas (used to detect verse-to-chorus transitions).

This rubric is semantic-first: timing boundaries come from lyric timestamps, while labels come from language and recurrence evidence.

## Follow-up Work Placeholder
- TODO: Build a dedicated song-structure training/evaluation pack to improve Verse vs Chorus discrimination, with emphasis on title-hook repetition and verse-to-chorus bleed transitions across diverse genres.
- TODO: Add a measurable benchmark set (tracks + expected section labels) and require regression checks before prompt/rubric updates ship.
- TODO: Add chord-progression evidence as a secondary structure signal (per-bar chord inference + repeating harmonic loop detection) and fuse it with lyric/section evidence for chorus and section-boundary confidence.
