# Designer Visual Inspiration And Sequence Asset Generation

Status: Draft
Date: 2026-04-26
Owner: xLightsDesigner Team

## User Prompt

> I would like to explore adding the GPT Image 2 engine into the designer agent. Instead of only providing an overview of the song design, I would like them to do the following:
>
> Generate an image to be displayed in the app for the active song/sequence that shouws visually the inspiration/theme for the solg as well as the color palette. This is not intended to be an image of what the display itself will look like but more of a collage of imagery and color that provides a sense of what the sequncing will achive. This will be a helpful featuer for the user as it will give them an expectation of the feel of the end product. I would like the designer to also generate a collection of image and/or video files within the theme that the sequencer will use in the sequence. We have not added the picture and video effects yet but this is where they will come into use. We can store these files with the song metadata within the xLightsDesigner app folder which the sequencer can use as needed.

## Purpose

Extend `designer_dialog` from text-only creative direction into a visual design producer.

The designer should generate:

- a user-facing inspiration board image for the active song/sequence
- iterative image revisions as the design conversation evolves
- a reusable themed asset pack of image and video files that the sequencer may later place through picture/video effects
- structured metadata that explains palette, theme, intended sequence use, licensing/source, and handoff references

This is not a preview render of the physical xLights display. It is a mood, theme, and palette artifact that helps the user understand the intended feel of the finished sequence before sequencing work is applied.

## Product Intent

The visual board gives the director a fast expectation of the creative direction:

- theme and emotional tone
- color palette
- visual motifs
- texture and motion references
- genre-appropriate atmosphere

The asset pack gives `sequence_agent` concrete media materials it can use later when xLights picture/video effects are supported:

- still textures
- themed background plates
- motif images
- short motion loops
- video clips or generated video references
- thumbnails/spritesheets for Review UI

## Source And Resolution Requirements

Generated media should be original, custom-made content whenever possible. The normal path is generated imagery from the configured image provider, not internet-searched or scraped imagery.

Rules:

- Prefer generated images over web-searched images.
- Do not use internet image search as a default source for inspiration boards or sequence assets.
- If external/user-supplied references are used, record them as references that guide generation, not as untracked assets copied into sequencing.
- Every generated image must record provider/model/prompt metadata in the manifest.
- The app should preserve enough resolution for future reuse while displaying scaled-down previews in the UI.

Initial resolution policy:

- inspiration board source image target: 1536px wide or larger when the provider supports it
- native UI preview: scaled down to fit the Design pane
- generated sequence still assets: store source resolution plus optional preview/thumbnail
- thumbnails/spritesheets: stored separately from source files so low-resolution UI display does not destroy source quality
- if the provider only returns a smaller image, the manifest must record actual width/height and the UI must scale down rather than upscale aggressively

## OpenAI API Basis

Official OpenAI docs identify GPT Image models as supporting both image generation and image editing. The Image API edits endpoint can modify an existing image from image inputs and a prompt, with optional mask guidance. The Responses API supports conversational or multi-step image work, including multi-turn image editing. OpenAI's video generation docs also support generated video jobs, video content download, thumbnails, spritesheets, and image references for guiding video generation.

Implementation should start with image generation only, then add video generation after the app has the storage, review, and sequencer contracts for media effects.

Image revision behavior should use edit flows when the user accepts the design direction but asks for a small tweak. Full regeneration should be reserved for major theme/palette resets, unusable outputs, or user requests that invalidate the prior board.

## Storage Rule

All generated inspiration and sequence assets are xLightsDesigner-owned metadata and must live under the app-owned project folder, not the linked xLights show folder.

Visual inspiration is song/sequence-scoped. The Designer must not start the song design process or generate an inspiration image until the user has selected or opened a song/sequence context. Project name must not be used as a fallback sequence id for image generation. If the user asks through team chat before a song/sequence is active, the Designer should block the generation request and ask the user to select or open the song/sequence first.

Canonical location:

```text
<app-root>/
  projects/
    <project-name>/
      artifacts/
        visual-design/
          <sequence-id-or-song-id>/
            visual-design-manifest.json
            inspiration-board.png
            palette.json
            revisions/
              board-r002.png
              board-r003.png
            images/
              *.png
              *.webp
            videos/
              *.mp4
              *.webp
            thumbnails/
              *.webp
            spritesheets/
              *.jpg
```

The manifest is the canonical handoff artifact. Files are referenced by relative paths from the manifest so project moves remain possible.

The manifest keeps two related palette views. `palette.colors[]` and `palette.lightingColors[]` are the canonical sequencing palette selected by the Designer agent before image generation. This palette is intentional design state, chosen for the song, user direction, display, RGB-light suitability, and sequencing goals. `palette.imageColors[]` is optional diagnostic context sampled from the generated inspiration image to help validate whether the image visually coordinates with the approved palette. `palette.validation` records that coordination check. The app must not replace the Designer palette with image-sampled colors. If the generated image drifts away from the approved palette, the correct action is to revise/regenerate the image, not to scrape a new sequencing palette from it.

## New Artifact Contract

Artifact type:

- `visual_design_asset_pack_v1`

Minimum shape:

```json
{
  "artifactType": "visual_design_asset_pack_v1",
  "artifactVersion": 1,
  "artifactId": "visual-design-asset-pack-...",
  "createdAt": "2026-04-26T00:00:00.000Z",
  "sequenceId": "project-local-sequence-id",
  "trackIdentity": {
    "title": "Song Title",
    "artist": "Artist",
    "contentFingerprint": "optional-track-fingerprint"
  },
  "creativeIntent": {
    "themeSummary": "cinematic snowy brass celebration",
    "inspirationPrompt": "prompt used for the inspiration board",
    "palette": [
      { "name": "ice blue", "hex": "#8fd8ff", "role": "cool base" },
      { "name": "warm gold", "hex": "#ffd36a", "role": "impact accent" },
      { "name": "cranberry red", "hex": "#c8324a", "role": "holiday accent" },
      { "name": "pine green", "hex": "#1f7a4a", "role": "support" }
    ],
    "imagePalette": [
      { "name": "deep charcoal", "hex": "#161616", "role": "shadow" },
      { "name": "warm gold", "hex": "#ffd36a", "role": "impact accent" }
    ],
    "lightingPalette": [
      { "name": "warm gold", "hex": "#ffd36a", "role": "impact accent" },
      { "name": "ice blue", "hex": "#8fd8ff", "role": "cool base" }
    ],
    "motifs": ["snow sparkle", "gold fanfare", "soft streetlamp glow"],
    "avoidances": ["do not depict a literal xLights layout"]
  },
  "palette": {
    "required": true,
    "displayMode": "image_and_lighting_palettes",
    "coordinationRule": "Designer palette is canonical for sequencing; image colors are diagnostic validation context.",
    "colors": [
      { "name": "warm gold", "hex": "#ffd36a", "role": "impact accent" },
      { "name": "ice blue", "hex": "#8fd8ff", "role": "cool base" }
    ],
    "imageColors": [
      { "name": "deep charcoal", "hex": "#161616", "role": "shadow" },
      { "name": "warm gold", "hex": "#ffd36a", "role": "impact accent" },
      { "name": "ice blue", "hex": "#8fd8ff", "role": "cool base" }
    ],
    "lightingColors": [
      { "name": "warm gold", "hex": "#ffd36a", "role": "impact accent" },
      { "name": "ice blue", "hex": "#8fd8ff", "role": "cool base" }
    ],
    "validation": {
      "status": "pass",
      "method": "nearest_rgb_distance_v1",
      "matchedColorCount": 2,
      "requiredColorCount": 2,
      "averageDistance": 42,
      "recommendation": "Image coordinates with the Designer palette.",
      "matches": [
        { "paletteName": "warm gold", "paletteHex": "#ffd36a", "imageHex": "#f9ca63", "distance": 31, "status": "matched" }
      ]
    }
  },
  "displayAsset": {
    "kind": "inspiration_board",
    "relativePath": "inspiration-board.png",
    "mimeType": "image/png",
    "width": 1536,
    "height": 1024,
    "currentRevisionId": "board-r001"
  },
  "imageRevisions": [
    {
      "revisionId": "board-r001",
      "parentRevisionId": "",
      "mode": "generate",
      "relativePath": "inspiration-board.png",
      "promptRef": "prompt-001",
      "maskRef": "",
      "source": {
        "provider": "openai",
        "model": "gpt-image-1.5",
        "promptRef": "prompt-001"
      },
      "userRequest": "",
      "changeSummary": "Initial inspiration board.",
      "paletteLocked": true,
      "paletteChangeSummary": ""
    }
  ],
  "sequenceAssets": [
    {
      "assetId": "asset-001",
      "kind": "image",
      "relativePath": "images/snow-sparkle-texture.webp",
      "mimeType": "image/webp",
      "intendedUse": "picture_effect_texture",
      "recommendedSections": ["Intro", "Verse 1"],
      "paletteRoles": ["cool base", "sparkle highlight"],
      "motionUse": "static_or_slow_pan",
      "source": {
        "provider": "openai",
        "model": "gpt-image-1.5",
        "promptRef": "prompt-001"
      }
    }
  ],
  "mediaAssetPlans": [
    {
      "assetId": "planned-asset-001",
      "kind": "image",
      "status": "planned",
      "intendedUse": "picture_effect_texture",
      "generationPrompt": "Generate an original high-resolution texture plate...",
      "recommendedSections": ["Intro", "Verse 1"],
      "paletteRoles": ["cool base", "sparkle highlight"],
      "motifs": ["snow sparkle"],
      "motionUse": "static_or_slow_pan",
      "promptRef": ""
    }
  ],
  "prompts": [
    {
      "promptId": "prompt-001",
      "model": "gpt-image-1.5",
      "purpose": "inspiration_board",
      "operation": "generate",
      "inputRevisionId": "",
      "prompt": "..."
    }
  ],
  "handoff": {
    "sequencerUse": "optional",
    "requiresMediaEffects": true,
    "artifactRefs": []
  }
}
```

## Designer Responsibilities

`designer_dialog` should:

- synthesize the song identity, audio analysis, user direction, director profile, and display metadata into a visual theme
- generate an inspiration-board prompt that explicitly avoids showing the actual xLights display/layout
- generate or request one main inspiration board image
- select the canonical xLights sequencing palette as an intentional Designer decision before image generation
- derive a reference image palette with named roles and hex colors from the generated image output for validation/diagnostics only
- improve derived color names/roles for readability while preserving exact derived hex values for xLights
- respect the xLights palette limit of 8 colors; fewer colors are acceptable when the design only needs them
- preserve the palette as required design state and keep the board coordinated with it
- revise/regenerate the image when it does not coordinate with the approved Designer palette
- record image/palette coordination validation as diagnostics; validation must never rewrite the Designer palette
- expose palette coordination warnings as actionable revision state in the app and automation layer so the Designer agent can request a targeted image revision that preserves the approved palette
- do not render palette strips, labeled swatches, legends, or color chips inside the inspiration image
- edit the current inspiration board for conversational tweaks when possible instead of regenerating the board from scratch
- record each board change as an immutable `imageRevisions[]` entry with parent revision, prompt, source provider/model, user request, palette lock/change status, and output path
- rotate live validation across different available sequences instead of repeatedly using one sequence, so visual design, handoff, and artifact lookup behavior is exercised across multiple project contexts
- optionally generate an asset-pack plan with candidate images/videos and intended sequencing use
- keep planned media assets separate from generated file-backed `sequenceAssets` until files actually exist
- save generated files and manifest under the project app folder
- add artifact references to the creative brief, proposal bundle, and sequencing design handoff

## Sequencer Responsibilities

`sequence_agent` should:

- treat `visual_design_asset_pack_v1` as optional enhancement context
- use palette roles and motifs immediately for effect selection and color choices
- use image/video file assets only when picture/video effects are available and the media asset is compatible with the target model/effect
- never require generated media assets to complete a normal sequence pass
- include selected media assets in Review so the user can see which generated files will be placed

## Handoff Additions

`creative_brief_v1` should gain optional references:

- `visualInspiration.artifactId`
- `visualInspiration.displayAssetRef`
- `visualInspiration.currentRevisionId`
- `visualInspiration.palette[]` / `visualInspiration.lightingPalette[]`
- `visualInspiration.imagePalette[]`
- `visualInspiration.paletteDisplayMode`
- `visualInspiration.paletteCoordinationRule`

`proposal_bundle_v1` should gain optional references:

- `visualAssets.assetPackId`
- `visualAssets.summary`
- `visualAssets.sequenceAssetCount`

`sequencing_design_handoff_v2` should gain optional references:

- `visualAssetPackRef`
- `paletteRoles[]`
- `motifDirectives[]`
- `mediaAssetDirectives[]`
- `mediaAssetPlanDirectives[]`

The handoff should pass compact references and summaries, not base64 image data or full binary payloads.
`mediaAssetDirectives[]` are file-backed generated assets. `mediaAssetPlanDirectives[]` are future generation/use intentions and must not be treated as available xLights media files until promoted to `sequenceAssets[]`.

## UI Behavior

Design screen:

- show the inspiration board for the active song/sequence
- show palette swatches and motif labels
- always show the palette when an inspiration board exists
- show whether the visible board revision preserved the prior palette or intentionally changed it
- show board revision history and allow previewing prior revisions without changing the manifest current revision
- show generation status, warnings, and retry/regenerate controls
- support conversational board edits as revision updates without losing prior board versions
- make clear that this is a creative inspiration board, not a physical display render

Review screen:

- show any media assets the sequencer intends to use
- show the target sections/models/effects where those assets will be placed
- allow the user to approve sequencing use separately from simply accepting the design theme

## Validation

Initial validation should not require live OpenAI calls.

Required local tests:

- artifact contract validation for `visual_design_asset_pack_v1`
- project artifact storage writes under `<app-root>/projects/<project-name>/artifacts/visual-design/`
- image revision lineage, including edit vs regenerate mode and current revision pointer
- required palette display/coordination state
- Designer result can reference a visual asset pack without breaking existing contract validation
- Sequencer handoff compaction passes only refs/summaries, not binary payloads
- native Design/Review automation can display a stored inspiration board fixture and verify handoff references
- assistant-chat validation blocks design/image generation when no song/sequence is selected

Live validation is opt-in because it incurs provider cost:

- generate one inspiration board using `gpt-image-1.5`
- write files and manifest into the project app folder
- show the board in native Design UI
- pass the artifact reference through Designer -> Sequencer -> Review

Provider access can vary by account. On 2026-04-26 the local OpenAI organization returned an organization verification requirement for the earlier `gpt-image-2` target. Current OpenAI docs identify `gpt-image-1.5` as the state-of-the-art GPT Image model; the app should target `gpt-image-1.5`, surface provider access failures clearly, and may fall back to `gpt-image-1` so the user can still generate a board while preserving model/source metadata in the manifest.

Current script:

```bash
XLD_ENABLE_LIVE_VISUAL_IMAGE_GENERATION=1 OPENAI_API_KEY=... \
  node scripts/native/validate-live-visual-image-generation.mjs \
  --project-file /path/to/project.xdproj
```

The script refuses to run unless `XLD_ENABLE_LIVE_VISUAL_IMAGE_GENERATION=1` is set. It generates one board, edits it once, and writes both revisions plus `visual-design-manifest.json` under the app project artifact folder.

## Implementation Order

1. Add `visual_design_asset_pack_v1` contract, storage routing, fixtures, and tests.
2. Extend Designer contract builders and validators with optional visual inspiration refs.
3. Extend `sequencing_design_handoff_v2` with compact asset-pack refs, palette roles, and motif directives.
4. Add native Design UI support for showing a stored inspiration board and palette.
5. Add conversational board revision controls and fixture validation for edit lineage. Done: the native generator supports `revisionRequest`, loads the current board image, calls the provider edit path, appends `board-r###` lineage, and writes the revised manifest/files under the same app-owned artifact folder. The macOS Design screen exposes a revision request field, explicit revise action, revision history, and read-only prior-revision preview.
6. Add a provider adapter for OpenAI image generation/editing with `gpt-image-1.5`, disabled unless configured. Done: adapter request/response construction and fixture tests are in `apps/xlightsdesigner-ui/agent/designer-dialog/openai-visual-image-provider.js`.
7. Add live opt-in validation that generates one board, edits it once, and stores both revisions in the project folder. Done: `scripts/native/validate-live-visual-image-generation.mjs`.
8. Wire visual asset generation into the Designer -> Sequencer handoff path behind explicit user intent. Done: proposal generation now calls an injectable visual asset generator only when the user explicitly asks for an inspiration board/image/asset pack, then attaches compact refs to `creative_brief_v1`, `proposal_bundle_v1`, and `sequencing_design_handoff_v2`.
9. Add native generator entry point for bridge use. Done: `scripts/designer/native/generate-visual-design-asset-pack.mjs` generates one board through the configured image provider, writes `inspiration-board.png`, and writes `visual-design-manifest.json` under the app project artifact folder.
10. Add native Design screen generation action. Done: the macOS Design screen exposes an explicit `Generate Visual Inspiration` action backed by `LocalVisualDesignAssetGenerationService`; it uses the stored agent API key/base URL, runs the native generator, and writes only to the app-owned project artifact folder.
11. Add sequence-agent use of palette/motif context immediately. Done: `sequence_agent` now carries `paletteRoles` and `motifDirectives` into planning metadata, uses motifs as effect-selection context, and applies palette-role hex values to generated xLights palette params when no explicit prompt color overrides them.
12. Add media asset plan metadata for future Picture/Video use. Done: generated visual manifests now distinguish generated file-backed `sequenceAssets[]` from planned `mediaAssetPlans[]`, and the Designer -> Sequencer handoff carries compact `mediaAssetPlanDirectives[]` without binary payloads.
13. Require selected song/sequence context before Designer song-design or image generation starts. Done: team-chat design/image prompts now block without selected song context, native visual generation no longer falls back to project name, and `scripts/native/validate-design-chat-song-gate.mjs` validates the no-song chat path.
14. Trigger native visual generation from explicit Designer chat image/board requests. Done: app-assistant action requests now include `generate_visual_inspiration`, and the macOS app routes that action to the same Design-screen generator.
15. Add picture/video effect placement later when xLights media effect support is implemented.

## Open Questions

- Should the user explicitly approve generation cost before each live image/video generation, or can project settings allow automatic generation?
- Should inspiration boards be regenerated per design revision or versioned as immutable snapshots?
- How many sequence assets should be generated by default for a song?
- Should video generation be a separate explicit action because of latency and cost?
- What file formats should be preferred for xLights picture/video compatibility once media effects are implemented?
