# Runtime Modularization Checklist

## Stage 1
- [ ] Extract xLights refresh/health/revision sync into `xlights-runtime.js`
- [ ] Add unit tests for refresh and revision-staleness handling

## Stage 2
- [ ] Extract audio analysis orchestration into `audio-runtime.js`
- [ ] Add tests for media selection, persisted analysis hydrate, and rerun policy

## Stage 3
- [ ] Extract designer generation flow into `design-runtime.js`
- [ ] Add scenario tests for Mira/Patch/Lyric routing handoffs

## Stage 4
- [ ] Extract apply/review flow into `review-runtime.js`
- [ ] Add tests for apply readiness, timing dependency, and verification outcomes

## Gate
Do not remove the old in-app path until the extracted runtime path and existing page-state tests are both green.
