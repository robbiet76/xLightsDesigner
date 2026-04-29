# xLights 2026.07 API Impact Audit

Date: 2026-04-29

## User Prompt

> I'd like you to examine the latest xlights release that came out yesterday.  It is version 2026.07 and there is mention of enhancements to the AI services backed which is interesting.  Please audit the changes since our current 2026.06 version and see if there is anything that should impact how our API functions.
>
> https://github.com/xLightsSequencer/xLights/releases/tag/2026.07

Follow-up clarification:

> our xLightsDesigner folder has not been released as part of xlights so you will not see it there.

## Scope

This audit compares upstream xLights `2026.06` to upstream xLights `2026.07`, then evaluates impact on the owned xLightsDesigner API folder carried in the local `xld-2026.06-migration` branch.

The upstream release does not include `src-ui-wx/xLightsDesigner`; that folder remains owned by the xLightsDesigner fork. The relevant question is whether upstream code movement, behavior changes, or build-system changes affect the xLights core/UI APIs our owned layer calls.

## Release Items That Matter

Source: upstream release notes for `2026.07`.

- AI services backend moved to `src-core/ai`, with declarative `ServiceProperty` schema and injectable `IServiceSettingsStore`.
- New audio-derived timing features: Audio Tempo, Audio Onsets, Audio Chords, spectrogram, pitch contour, LUFS, stem separation, and sound classification.
- Render progress now self-signals completion through `RenderProgressInfo` atomic completion state.
- Picture/Video media handling changed, especially animated GIF behavior and path-resolution logging.
- Effect metadata changed for Lines, Shape, Shockwave, Shader, Warp, and shared metadata files.
- Large source tree reorganization moved many `src-ui-wx/ui/...` files into shorter `src-ui-wx/...` paths.

## Direct Impact On Owned API

No upstream file directly modifies `src-ui-wx/xLightsDesigner`.

Current direct API risk is moderate, not critical:

- The owned render route calls `xLightsFrame::RenderAll()` and then polls `GetRenderEngine().IsRenderDone()`. 2026.07 improves render completion signaling internally but keeps `IsRenderDone()` present. The owned API should still work, but render waiting should be revalidated after migration because upstream changed completion mechanics.
- The owned timing routes call `AddTimingElement`, `GetTimingElement`, and `EffectLayer::AddEffect`. These APIs remain available. 2026.07 adds useful detector-backed timing tracks but implements them in UI `RowHeading.cpp` handlers, not as a clean API service.
- The owned effect write path should continue to work for existing effects, but effect metadata changed and should be re-imported before any 2026.07-based training/catalog work.
- The owned media route is not directly broken, but Picture/Video/GIF behavior changed in ways that matter for the planned generated image/video sequence assets.
- The built-in xLights AI services backend is separate from the xLightsDesigner cloud/agent backend. It is useful reference architecture, not something the current app should depend on.

## Merge And Build Risk

Local non-mutating merge check from `xld-2026.06-migration` to `2026.07` found:

- one content conflict in `src-ui-wx/app-shell/TabSetup.cpp`
- auto-merge activity in `src-ui-wx/xLightsApp.cpp`
- auto-merge activity in `src-ui-wx/xLightsApp.h`
- no direct conflict reported in `src-ui-wx/xLightsDesigner`

There is one current uncommitted local xLights change:

- `src-ui-wx/xLightsDesigner/DesignerApiHost.h`

Migration should not start until that change is either committed or intentionally preserved.

## Specific Findings

### AI Services Backend

Upstream moved AI service implementation from `src-ui-wx/ai` into wx-free `src-core/ai`.

New/changed core concepts:

- `ServiceManager(IServiceSettingsStore* store, const std::string& pluginDir)`
- `IServiceSettingsStore` for plain settings and secrets
- `ServiceProperty` declarative settings schema
- built-in services loaded in core: OpenAI/chatGPT, Claude, Ollama, Gemini, GenericClient
- desktop wx layer now supplies `WxServiceSettingsStore`

Impact:

- No direct xLightsDesigner API change is required unless we intentionally integrate with xLights built-in AI services.
- This does validate our broader architecture direction: AI provider configuration belongs behind a service boundary, and secrets should not be mixed into ordinary metadata.
- If we later expose xLights native AI services through the owned API, the API should wrap the `src-core/ai` abstractions rather than the wx dialogs.

Recommendation:

- Do not couple the xLightsDesigner agent backend to upstream xLights AI services right now.
- Capture this as a possible future adapter only.

### Timing Tracks And Audio Analysis

2026.07 adds built-in audio-derived timing tracks:

- Audio Onsets
- Audio Tempo
- Audio Chords

Implementation is in UI row-heading handlers and calls new core detectors:

- `DetectOnsets(AudioManager*)`
- `DetectTempo(AudioManager*)`
- `DetectChords(AudioManager*)`

Impact:

- This is strategically important. It overlaps with our need for better timing substrate before believable sequencing.
- It does not replace our timing API, because the current upstream implementation prompts through UI dialogs and message boxes.
- We should expose detector-backed timing generation through our owned API only after migrating to 2026.07 or cherry-picking the core detector files.

Recommendation:

- Add owned API endpoints after migration:
  - generate timing track from onsets
  - generate timing track from tempo/beats
  - generate timing track from chords
- Keep track names generic and user/agent-chosen. Do not hardcode assumptions like `Song Structure`.
- Ensure created timing tracks are complete, back-to-back section tracks, consistent with current xLightsDesigner timing policy.

### Render Completion

2026.07 adds `RenderProgressInfo::jobsRemaining` and `RenderProgressInfo::completed`, plus `RenderEngine::NotifyJobFinished(RenderProgressInfo*)`.

Impact:

- This likely improves our render automation reliability.
- The owned API render route should still be compatible because `RenderEngine::IsRenderDone()` still exists.
- Our `WaitDesignerRenderComplete` polling should be re-tested after migration, especially long render/training workloads and abort/early-exit paths.

Recommendation:

- After migration, run owned API smoke tests for:
  - render-current
  - render-samples
  - modal-free render execution
  - long unattended training render loops

### Picture, Video, GIF, And Generated Media Assets

2026.07 changes media behavior:

- animated GIFs used as Video effects may be converted to Pictures effects
- Picture effect path resolution and missing-image logging improved
- SequenceMedia adds better image/GIF loading behavior and preview-cache cleanup

Impact:

- This matters for the planned Designer-generated image/video assets.
- The sequencer should prefer Picture effect for generated still images and animated GIFs.
- Video effect should remain for true video files.
- API/media validation should preserve show-relative or app-owned asset references cleanly when xLights can resolve them.

Recommendation:

- When implementing Picture/Video effects, encode asset kind explicitly in the handoff and command builder.
- Add tests for generated app-owned assets referenced by Picture effects.
- Revalidate file path resolution on macOS after 2026.07 migration.

### Effect Metadata

2026.07 changes upstream `resources/effectmetadata`.

Notable changes:

- `Lines_Speed` changed from integer scale to float with `divisor: 10`, min 0, max 100.
- `Shape` now has grouped/tabbed metadata.
- `Shockwave` adds timing-track trigger settings:
  - `Shockwave_TimingTrack`
  - `Shockwave_FilterLabel`
  - `Shockwave_FilterRegex`
  - `Shockwave_Duration`
- `Shader` dynamic params description/schema behavior changed.
- shared `Timing.json` was renamed/reworked as `Blending.json`.

Impact:

- The effectmetadata import pipeline must be refreshed for 2026.07 before claiming 2026.07 support.
- Shockwave timing-track support is immediately relevant to agent sequencing once mapped.
- Lines speed divisor matters because incorrect scaling would produce wrong sequence commands.

Recommendation:

- Run the effectmetadata import against 2026.07 in a controlled migration branch.
- Update the parameter registry aliases/mappings for new Shockwave timing parameters.
- Add regression tests for `Lines_Speed` divisor handling and Shockwave timing-track command serialization.

## Migration Recommendation

Do not switch the active training xLights process mid-run.

Recommended path:

1. Let the current 2026.06-based training run finish.
2. Commit or explicitly preserve the uncommitted `DesignerApiHost.h` change.
3. Create a 2026.07 migration branch from the current API branch.
4. Merge/rebase upstream `2026.07`.
5. Resolve the known `TabSetup.cpp` conflict and review `xLightsApp.*` auto-merge.
6. Build xLights with the owned API folder.
7. Run owned API smoke tests.
8. Re-import effectmetadata from 2026.07.
9. Add detector-backed timing API endpoints if migration is stable.

## Bottom Line

2026.07 does not break the owned xLightsDesigner API on sight, but it is a meaningful upstream release for this project.

The biggest near-term value is not the built-in AI services backend. The biggest value is the new native audio/timing analysis and the render/media reliability improvements. Those should strengthen our agent sequencing pipeline once migrated and wrapped in noninteractive owned API endpoints.
