# xLights Live State Checklist

## Phase 1
- [ ] Add `xlights_timing_state_v1`
- [ ] Add `xlights_sequence_state_v1`
- [ ] Add collector function that reads open sequence, revision, media, settings, models, submodels, display elements, timing tracks
- [ ] Add optional timing mark expansion by track
- [ ] Add unit tests for open/closed sequence and timing expansion

## Phase 2
- [ ] Integrate live-state reads into clean-sequence validation harness
- [ ] Use live-state timing summaries in sequence/review validation

## Phase 3
- [ ] Add effect occupancy snapshot for post-apply verification
- [ ] Compare intended plan vs actual occupancy for targeted windows
