# xLights Sequencing Functionality Corpus Initial Audit

## Purpose

This audit captures xLights functionality observed in a small real-sequence corpus for
`sequence_agent` training and evaluation. The intent is to document what xLights features
are exercised in mature sequences without treating any one sequence as a preferred artistic
style.

Use this corpus for:

- effect and settings vocabulary
- timing-track taxonomy
- layer and transition setting coverage
- model group and submodel targeting patterns
- validation of real xLights feature combinations

Do not use this corpus for:

- default visual style
- preferred pacing or color taste
- prop-specific artistic bias

## Source Corpus

Read-only local inspection on March 11, 2026:

- `/Users/robterry/Documents/Lights/Current/Christmas/Show/BeginningToLookXmas/BeginningToLookXmas.xsq`
- `/Users/robterry/Documents/Lights/Current/Christmas/Show/JingleBells - Sinatra/JingleBells_Sinatra.xsq`
- `/Users/robterry/Documents/Lights/Current/Christmas/Show/WinterWonderland/WinterWonderland.xsq`

Expanded live-corpus scan:

- root: `/Users/robterry/Documents/Lights/Current/Christmas/Show`
- live `.xsq` files scanned for corpus use: `63`
- excluded from corpus counts:
  - `Backup/...` snapshots
  - `Props_Setup.xsq`
  - `RGBW Test.xsq`
  - `Test_Flood.xsq`

Scope note:

- This corpus should be treated as production-ready 2D sequencing coverage.
- It should not be treated as 3D sequencing coverage.
- `Static/...` sequences are valid corpus inputs for non-audio/static display sequencing mechanics.
- Static sequences are likely more useful to `designer` than `sequence_agent`, but they still represent real xLights effect usage.

## Official Manual Cross-Check

The xLights user manual supports the same core areas observed in the corpus:

- Sequencer Layers: xLights documents up to 200 layers per model and explains that layers can be additive, subtractive, or masking-based.
- Layer Blending: xLights documents blending modes, morph, mix slider behavior, canvas mode, and a larger transition vocabulary than any single local sequence will show.
- Layer Settings: xLights documents per-effect render style, camera selection for `Per Preview`, transform, blur, sub-buffer, and persistent buffer behavior.
- Timing Tracks: xLights documents multiple timing tracks per sequence, fixed vs variable timing tracks, add/remove, rename, import/export, and note import.
- Value Curves: xLights documents nonlinear parameter control over time and import/export of `.xvc` files.

Manual references:

- `https://manual.xlights.org/xlights/chapters/chapter-four-sequencer/layers`
- `https://manual.xlights.org/xlights/chapters/chapter-four-sequencer/layers/layer-blending`
- `https://manual.xlights.org/xlights/chapters/chapter-four-sequencer/layers/layer-settings`
- `https://manual.xlights.org/xlights/chapters/chapter-four-sequencer/timing-tracks`
- `https://manual.xlights.org/xlights/chapters/chapter-four-sequencer/value-curves`

## Cross-Corpus Findings

### Timing Tracks

Observed timing elements across the three sequences:

- `BeginningToLookXmas`: `New Timing`, `Special Timings`, `Beat Count`, `Special`, `Piano`, `Lyrics`
- `JingleBells_Sinatra`: `Backup`, `Beats`, `JingleBellsFrankSinatra`, `Mark`, `Note Onsets`
- `WinterWonderland`: `New Beats`, `Broad Strokes`, `Notes`, `Beats`, `Specials`, `Lyrics 1`

Implications:

- Real sequences use multiple timing-track roles in parallel.
- Naming is user-defined and inconsistent across projects.
- `sequence_agent` should not assume one canonical naming scheme for beats, notes, or lyrics.
- The manual also confirms that timing tracks are sequence-local, can be renamed, and can be imported/exported independently of effects.

### Effect Breadth

Observed effect families include:

- motion/pattern: `Shockwave`, `Ripple`, `Morph`, `Spirals`, `Pinwheel`, `Fan`, `Warp`, `Bars`, `Wave`, `Lines`, `Plasma`, `Kaleidoscope`, `Butterfly`, `Meteors`, `Twinkle`
- static/control: `On`, `Off`, `Color Wash`, `SingleStrand`
- object/media/text: `Shape`, `Text`, `Pictures`, `Video`, `Liquid`, `Circles`

Implications:

- The corpus already covers a broad practical effect surface.
- `JingleBells_Sinatra` is the strongest single example for effect diversity.
- Repeated rhythmic placement of one effect family is common and should not be treated as anomalous.

Whole corpus counts confirm broad 2D coverage. Most common effect names observed:

- `SingleStrand`: `16879`
- `On`: `11579`
- `Shockwave`: `7987`
- `Color Wash`: `4847`
- `Pinwheel`: `3663`
- `Spirals`: `3340`
- `Marquee`: `2894`
- `Ripple`: `2777`
- `Morph`: `2468`
- `Curtain`: `2023`
- `Text`: `1574`
- `VU Meter`: `1490`
- `Fan`: `1238`
- `Bars`: `1197`
- `Off`: `1178`
- `Pictures`: `1136`
- `Wave`: `894`

Additional effect families present in the live corpus include:

- `Video`
- `Shader`
- `Fireworks`
- `Faces`
- `Tree`
- `Lines`
- `Kaleidoscope`
- `Life`

Manual cross-check:

- The xLights manual built-in effects index includes the major families seen in the live corpus, including `Bars`, `Circles`, `Color Wash`, `Curtain`, `Faces`, `Fan`, `Fire`, `Fireworks`, `Galaxy`, `Garlands`, `Kaleidoscope`, `Lines`, `Liquid`, `Marquee`, `Meteors`, `Morph`, `Pictures`, `Pinwheel`, `Plasma`, `Ripple`, `Shader`, `Shape`, `Shockwave`, `Single Strand`, `Snowflakes`, `Spirals`, `Strobe`, `Text`, `Tree`, `Twinkle`, `Video`, `VU Meter`, `Warp`, and `Wave`.

### Layering and Transitions

Observed transition settings:

- `T_CHOICE_In_Transition_Type`
- `T_CHOICE_Out_Transition_Type`
- `T_SLIDER_In_Transition_Adjust`
- `T_SLIDER_Out_Transition_Adjust`
- `T_CHECKBOX_In_Transition_Reverse`
- `T_CHECKBOX_Out_Transition_Reverse`
- `T_CHECKBOX_LayerMorph`

Observed transition values include:

- `Wipe`
- `Circle Explode`
- `From Middle`
- `Dissolve`
- `Blend`

Observed layer methods include:

- `Layered`
- `Max`
- `Average`
- `Normal`
- `1 is Mask`
- `1 is Unmask`
- `1 is True Unmask`
- `2 is Unmask`
- `2 is True Unmask`

Implications:

- Layer blending and transitions are active real-sequence functionality, not edge cases.
- The training package should treat shared timing/layer keys as first-class sequencing controls.

Whole corpus counts show substantial blend/layer-method variety. Most common observed values:

- `T_CHOICE_LayerMethod=Layered`: `661`
- `T_CHOICE_LayerMethod=Average`: `172`
- `T_CHOICE_Out_Transition_Type=Circle Explode`: `133`
- `T_CHOICE_In_Transition_Type=Wipe`: `115`
- `T_CHOICE_In_Transition_Type=Circle Explode`: `106`
- `T_CHOICE_LayerMethod=1 reveals 2`: `97`
- `T_CHECKBOX_LayerMorph=1`: `74`
- `T_CHOICE_LayerMethod=2 is Mask`: `57`
- `T_CHOICE_LayerMethod=1 is Unmask`: `55`
- `T_CHOICE_LayerMethod=1 is Mask`: `50`

Less common but present values include:

- `Additive`
- `Subtractive`
- `Brightness`
- `Left-Right`
- `Shadow 1 on 2`
- `Shadow 2 on 1`
- `Clock`
- `Swap`
- `Doorway`
- `Circular Swirl`
- `Blinds`
- `Star`
- `Square Explode`
- `Slide Bars`

Manual cross-check:

- The manual explicitly documents transition families including `Fade`, `Wipe`, `Clock`, `From Middle`, `Square Explode`, `Circle Explode`, `Blinds`, `Blend`, `Slide Checks`, `Slide Bars`, `Fold`, `Dissolve`, `Circular Swirl`, `Bow Tie`, `Zoom`, `Doorway`, `Blobs`, `Pinwheel`, and `Star`.
- The manual also documents morph, suppress-until-frame, freeze-at-frame, mix slider, and canvas mode as part of the layer blending system.

### Buffer and Render Settings

Observed per-effect buffer settings include:

- `B_CHOICE_BufferStyle`
- `B_CHOICE_BufferTransform`
- `B_CHOICE_PerPreviewCamera`
- `B_CUSTOM_SubBuffer`
- `B_SLIDER_XRotation`
- `B_SLIDER_Rotation`
- `B_SLIDER_Zoom`
- `B_SLIDER_ZoomQuality`
- `B_VALUECURVE_XRotation`
- `B_VALUECURVE_Rotation`
- `B_VALUECURVE_Zoom`
- `B_VALUECURVE_Blur`

Observed buffer styles and transforms include:

- `Per Preview`
- `Per Model Default`
- `Per Model Per Preview`
- `Per Model Single Line`
- `Single Line`
- `Horizontal Per Model/Strand`
- `Horizontal Stack`
- `Overlay - Centered`
- `Overlay - Scaled`
- `Vertical Stack - Scaled`
- `Flip Horizontal`
- `Flip Vertical`
- `Rotate CC 90`
- `Rotate 180`

Implications:

- Per-effect buffer behavior is materially used in real sequences.
- The corpus supports keeping these settings under effect-level sequencing control rather than treating them as global state.

Whole corpus counts show these settings are routine, not isolated:

- `B_CHOICE_BufferStyle=Per Preview`: `976`
- `B_CHOICE_BufferStyle=Per Model Default`: `889`
- `B_CHOICE_BufferStyle=Default`: `795`
- `B_CHOICE_BufferStyle=Per Model Per Preview`: `507`
- `B_CHOICE_BufferStyle=Single Line`: `472`
- `B_CHOICE_BufferTransform=Flip Horizontal`: `452`
- `B_CHOICE_PerPreviewCamera=2D`: `400`
- `B_CHOICE_BufferTransform=Rotate CC 90`: `379`

This corpus confirms strong 2D buffer/render coverage. It does not provide meaningful 3D camera coverage.

Manual cross-check:

- The manual confirms that render style is per-effect, camera selection applies when using `Per Preview`, transform is the standard way to rotate/flip an effect, blur is adjustable or curve-driven, and sub-buffer selection redefines the active region for that effect.
- The manual also documents `Persistent`, which is a per-effect buffer behavior not yet surfaced in the current corpus summary and should remain on the backlog for compatibility review.

### Palette and Color Controls

Observed color controls include:

- palette button values: `C_BUTTON_Palette*`
- palette toggles: `C_CHECKBOX_Palette*`
- effect sparkle controls: `C_SLIDER_SparkleFrequency`, `C_CHECKBOX_MusicSparkles`
- brightness controls: `C_SLIDER_Brightness`, `C_VALUECURVE_Brightness`

Implications:

- Palette and brightness modulation are real per-effect settings in active use.
- Brightness/value curves should remain part of compatibility validation and future sequence synthesis.

Whole corpus counts show common reuse of effect-level color modifiers:

- `C_CHECKBOX_MusicSparkles=1`: `118`
- `C_SLIDER_SparkleFrequency=0`: `66`
- `C_SLIDER_Brightness=100`: `62`
- `C_SLIDER_SparkleFrequency=100`: `39`
- `C_SLIDER_Brightness=70`: `180`
- `C_SLIDER_Brightness=60`: `78`
- `C_SLIDER_Brightness=80`: `69`
- `C_SLIDER_Brightness=90`: `39`

Manual cross-check:

- The manual value-curve documentation reinforces that brightness and other effect settings can vary nonlinearly over time and can be loaded/exported separately as `.xvc` assets.

### Model Groups and Submodels

Observed group-like element targets include:

- `AllModels`, `AllModels_NoFloods`, `AllModels_NoMatrix`, `AllModels_NoSigns`, `AllModels_NoSnowman`
- `FrontHouse`, `FrontProps`, `UpperProps`
- `Outlines`, `Horizontals`, `Greens_All`, `Bulbs_All`
- `CandyCanes`, `CandyCanes_Rows`, `CandyCanes_Diagonals`
- `MiniCanes`, `MiniCanes_Rows`, `MiniCanes_Diagonals`
- `Floods`, `Floods House`, `Floods Trees`
- `Border_Segments`, `Borders`
- `Spirals_wStars`, `SpiralTreeStars`
- `Train_Rings`, `Train_Wheels`, `Train_Matrix`, `Train_NoMatrix`
- `Wreathes_All`

Observed explicit submodel targets include:

- `Arm1-Left`
- `Arm2-Right`
- `Face1-Eyes`
- `Face2-Nose`
- `Face3-Mouth`
- `Snowman Buttons`
- `Snowman Hat Outline`
- `Snowman Hat Beads`
- `TuneTo`
- `Station`

Implications:

- Grouped model targeting is common.
- Submodel targeting is present and should remain part of sequence-agent compatibility and targeting logic.

Whole corpus counts reinforce that grouped targeting is core functionality. Most common observed names:

- groups:
  - `SpiralTreeStars`: `53`
  - `Floods`: `52`
  - `Icicles_All`: `51`
  - `Borders`: `39`
  - `MiniCanes`: `36`
  - `CandyCanes`: `34`
  - `Train_NoMatrix`: `33`
  - `Snowflakes`: `31`
  - `AllModels`: `29`
  - `Wreathes_All`: `28`
- submodels:
  - `Spokes`: `74`
  - `Ribbon`: `60`
  - `Base`: `60`
  - `Snowman Hat Beads`: `57`
  - `Stars`: `45`
  - `TuneTo`: `39`
  - `Station`: `39`
  - `Rings`: `34`
  - `Diagonals`: `34`
  - `Rows`: `33`

Manual cross-check:

- The manual layering documentation explicitly states that layer blending can apply to models, model groups, submodels, and even strands on supported model types.

### Model Blending

Observed sequence-level `ModelBlending` values:

- `BeginningToLookXmas`: `true`
- `JingleBells_Sinatra`: `true`
- `WinterWonderland`: `false`

Implications:

- The corpus already includes both sequence-level blending states.
- Future functionality audits should keep checking whether sequence-level blending changes correlate with effect/layer patterns.

Whole corpus counts:

- `ModelBlending="true"`: `37`
- `ModelBlending="false"`: `26`

## Sequence-Specific Utility

### BeginningToLookXmas

Strongest for:

- timing-track diversity
- repeated rhythmic effect placement
- transition usage
- model groups and a small amount of submodel targeting

### JingleBells_Sinatra

Strongest for:

- broad effect inventory
- per-effect buffer settings
- brightness and value-curve usage
- grouped targeting breadth

### WinterWonderland

Strongest for:

- explicit submodel targeting
- transition coverage with a simpler overall effect inventory
- contrasting `ModelBlending=false` case

## Training Package Guidance

This corpus should feed:

- dataset/source references
- compatibility coverage expansion
- eval cases that assert support for real xLights settings combinations

This corpus should not directly feed:

- aesthetic imitation
- default color choices
- default pacing or density heuristics

## Open Questions For Later Inspection

- 3D-specific render and camera sequencing should be treated as out of scope for this corpus and gathered separately later.
- Layer-out transition combinations are present, but a later focused audit could still isolate the most representative stacked-layer examples.
- The manual documents additional blend/transition behaviors that may not be common in the local corpus, so future eval expansion should include rare-but-documented combinations even if corpus frequency is low.
