# xLightsDesigner Analysis Service

Cloud-first audio analysis API for xLightsDesigner.  
The desktop app sends audio to this service and expects `beats`, `bars`, `sections`, and optional `lyrics` marks.

Section source strategy is provider-first:
- Fingerprint song with AudD (if configured)
- Optional DSP fallback only when explicitly enabled
- AudD identity results are cached locally by audio-file hash to avoid repeated lookup requests for the same track
- Synced lyric timing marks are fetched from LRCLIB when available

## API

### `GET /health`
Returns service status.

### `POST /analyze`
Multipart form:
- `provider`: `beatnet|librosa`
- `fileName`: optional
- `file`: audio upload

Optional auth header:
- `x-api-key: <token>` (required if `ANALYSIS_API_KEY` is set on server)

Response shape:
```json
{
  "ok": true,
  "data": {
    "bpm": 150.0,
    "timeSignature": "4/4",
    "durationMs": 148000,
    "beats": [{ "startMs": 0, "endMs": 400, "label": "beat-1" }],
    "bars": [{ "startMs": 0, "endMs": 1600, "label": "bar-1" }],
    "sections": [{ "startMs": 0, "endMs": 18000, "label": "Section 1" }],
    "lyrics": [{ "startMs": 1200, "endMs": 2800, "label": "Run run Rudolph" }],
    "meta": {
      "engine": "beatnet",
      "sectionSource": "lyrics-inferred|dsp-fallback|none",
      "trackIdentity": {
        "provider": "audd",
        "title": "Run Run Rudolph",
        "artist": "Chuck Berry"
      },
      "trackIdentityCacheHit": true,
      "sectionSourceError": "",
      "lyricsSource": "lrclib|none",
      "lyricsSourceError": ""
    }
  }
}
```

## Run Locally (Dev)

```bash
cd apps/xlightsdesigner-analysis-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5055
```

## Cloud Deploy Notes

- Set env `ANALYSIS_API_KEY` for shared-secret auth.
- Recommended env:
  - `AUDD_API_TOKEN` (required to fingerprint exact track and populate cached identity metadata)
- Optional lyrics env:
  - `LRCLIB_API_BASE` (default: `https://lrclib.net/api`)
- Optional env for local identity cache:
  - `ANALYSIS_IDENTITY_CACHE_PATH` (default: `apps/xlightsdesigner-analysis-service/.cache/track-identity-cache.json`)
- Optional env:
  - `ENABLE_DSP_SECTION_FALLBACK=true` to allow local DSP section inference when provider lookup fails.
  - Default is disabled to avoid low-confidence structure output.

## BeatNet Notes

- `provider=beatnet` uses BeatNet offline inference for beat/downbeat extraction.
- Bars are derived from detected downbeats when available; otherwise fallback to `beatsPerBar` grouping.
- BeatNet currently depends on older `numba` versions and is not reliably installable on Python 3.11 runtimes.
- This repo marks BeatNet install only for Python `<3.11`; in 3.11 environments `beatnetAvailable` will be `false` in `/health`.
- If BeatNet evaluation is required, run the service in a Python 3.10 environment (or a dedicated BeatNet worker) and re-check `/health`.
- Start command:
  - `uvicorn main:app --host 0.0.0.0 --port ${PORT:-5055}`
- Healthcheck path: `/health`
- For container deploys, ensure ffmpeg/libs for librosa codecs are present.

## App Configuration

In xLightsDesigner Settings:
- `Audio Analysis Service URL` => your deployed base URL (e.g. `https://analysis.example.com`)
- Provider => `BeatNet` (primary)
- Optional `x-api-key` => same as `ANALYSIS_API_KEY`
