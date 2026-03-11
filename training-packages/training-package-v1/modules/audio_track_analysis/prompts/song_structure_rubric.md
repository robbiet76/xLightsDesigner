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
- Pre-Chorus: short transition that leads into chorus language; often directly precedes a chorus return and has partial repetition/escalation rather than full hook block.
- Bridge: contrast section (new lyrical idea/perspective), commonly appears once in later song.
- Refrain vs Chorus:
  - Refrain is a recurring line/phrase embedded in larger verse-like text.
  - Chorus is a recurring full section block.
- Verse-to-chorus bleed handling:
  - If a stanza starts narrative (verse-like) but pivots into repeated title/hook language, bias the hook-heavy portion as Chorus.
  - If stanza boundaries are coarse and cannot split internally, label the stanza containing repeated title/hook lines as Chorus when that hook recurs in later stanzas.
  - Favor Chorus when title/hook words recur across 2+ lyrical stanzas, even if one stanza also contains narrative lines.
  - In Verse -> Pre-Chorus -> Chorus cycles, do not flatten transition stanzas into Verse when they function as lift into a repeated hook stanza.

## Evidence Inputs Passed to LLM
- `stanzaText` sample lines per lyrical section.
- `repeatedLineRatio`: fraction of lines that already appeared in earlier stanzas.
- `uniqueTokenRatio`: lexical novelty score in stanza text.
- `titleTokenRatio`: overlap with fingerprinted track title tokens.
- `titleLineHits` / `titleLineRatio`: direct title-phrase recurrence in stanza lines.
- `globallyRepeatedLineRatio` / `maxLineOverlapWithAny`: phrase-level repetition across stanzas.
- `nextLikelyChorus` / `transitionToHookScore`: transition evidence that current stanza is a lift into an upcoming chorus-like stanza.
- `progressionRelative` / `cadenceRelative`: harmonic repetition signals independent of key.
- `progressionSimilarityToPrev`: adjacency similarity to detect recurring section types.

## Decision Priority
1. Lyric semantics and recurrence (title/hook repetition, line overlap).
2. Relative position in local cycle (transition into repeated hook implies Pre-Chorus).
3. Harmonic repetition/contrast as supporting evidence only.

This rubric is semantic-first: timing boundaries come from lyric timestamps, while labels come from language and recurrence evidence.
