#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildAnalysisArtifactFromPipelineResult } from '../../../apps/xlightsdesigner-ui/agent/audio-analyst/audio-analyst-runtime.js';
import { buildAudioAnalysisQualityReport } from '../../../apps/xlightsdesigner-ui/agent/audio-analyst/audio-analysis-quality.js';
import { writeAnalysisArtifactToLibrary } from '../../../apps/xlightsdesigner-ui/storage/analysis-artifact-store.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const SERVICE_DIR = path.join(ROOT, 'apps', 'xlightsdesigner-analysis-service');
const SERVICE_PYTHON = path.join(SERVICE_DIR, '.venv310', 'bin', 'python');
const DEFAULT_APP_ROOT = path.join(os.homedir(), 'Documents', 'Lights', 'xLightsDesigner');

function str(value = '') {
  return String(value || '').trim();
}

function parseArgs(argv = []) {
  const out = {
    file: '',
    appRoot: DEFAULT_APP_ROOT,
    mode: 'deep'
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--file') out.file = path.resolve(str(argv[++i] || out.file));
    else if (token === '--app-root') out.appRoot = path.resolve(str(argv[++i] || out.appRoot));
    else if (token === '--mode') out.mode = str(argv[++i] || out.mode).toLowerCase();
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!out.file) throw new Error('--file is required');
  if (!fs.existsSync(out.file)) throw new Error('Audio file not found');
  return out;
}

function selectPython() {
  return fs.existsSync(SERVICE_PYTHON) ? SERVICE_PYTHON : 'python3';
}

function pythonAnalyze(trackPath = '', mode = 'deep') {
  const childCode = String.raw`
import json, sys
from pathlib import Path
service_dir = Path(sys.argv[1])
track_path = Path(sys.argv[2])
mode = sys.argv[3]
sys.path.insert(0, str(service_dir))
import main
profile = main._normalize_analysis_profile(mode)
if mode == 'deep':
    profile['enableRemoteIdentity'] = False
    profile['enableLyrics'] = True
    profile['enableWebTempo'] = False
    profile['enableMadmomChords'] = False
    profile['enableMadmomDownbeatCrosscheck'] = False
payload = main._analyze_with_librosa(str(track_path), profile)
print(json.dumps(payload))
`;
  const res = spawnSync(selectPython(), ['-c', childCode, SERVICE_DIR, trackPath, mode], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50
  });
  if (res.status !== 0) {
    throw new Error(str(res.stderr || res.stdout || `analysis failed with code ${res.status}`));
  }
  const stdout = str(res.stdout);
  if (!stdout) throw new Error('analysis returned no JSON');
  return JSON.parse(stdout);
}

function buildPipelineResult(filePath = '', data = {}, provider = 'librosa', baseUrl = 'direct-python') {
  const beats = Array.isArray(data?.beats) ? data.beats : [];
  const bars = Array.isArray(data?.bars) ? data.bars : [];
  const chords = Array.isArray(data?.chords) ? data.chords : [];
  const lyrics = Array.isArray(data?.lyrics) ? data.lyrics : [];
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  return {
    summary: `Audio analysis complete for ${path.basename(filePath)}.`,
    pipeline: {
      analysisServiceSucceeded: true,
      structureDerived: sections.length > 0,
      timingDerived: beats.length > 0 || bars.length > 0,
      lyricsDetected: lyrics.length > 0,
      webContextDerived: false,
      mediaMetadataRead: Number.isFinite(Number(data?.durationMs))
    },
    diagnostics: [],
    details: {
      trackName: path.basename(filePath),
      media: {
        durationMs: Number.isFinite(Number(data?.durationMs)) ? Number(data.durationMs) : null,
        sampleRate: null,
        channels: null
      },
      timing: {
        tempoEstimate: Number.isFinite(Number(data?.bpm)) ? Number(data.bpm) : null,
        timeSignature: str(data?.timeSignature || 'unknown'),
        hasBeatTrack: beats.length > 0,
        hasBarTrack: bars.length > 0,
        hasLyricsTrack: lyrics.length > 0,
        hasChordTrack: chords.length > 0
      },
      trackIdentity: {
        title: str(data?.meta?.trackIdentity?.title),
        artist: str(data?.meta?.trackIdentity?.artist),
        album: str(data?.meta?.trackIdentity?.album),
        isrc: str(data?.meta?.trackIdentity?.isrc),
        provider: str(data?.meta?.trackIdentity?.provider)
      },
      summaryLines: [
        `Audio source: ${path.basename(filePath)}`,
        `Tempo/time signature: ${Number.isFinite(Number(data?.bpm)) ? Number(data.bpm) : 'unknown'} BPM / ${str(data?.timeSignature || 'unknown')}`,
        `Song structure: ${sections.map((row) => str(row?.label)).filter(Boolean).join(', ') || 'pending'}`
      ]
    },
    raw: {
      bpm: Number.isFinite(Number(data?.bpm)) ? Number(data.bpm) : null,
      timeSignature: str(data?.timeSignature || ''),
      beats,
      bars,
      chords,
      lyrics,
      sections,
      meta: {
        ...(data?.meta || {}),
        engine: str(data?.meta?.engine || provider)
      }
    },
    requestedProvider: provider,
    analysisBaseUrl: baseUrl
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const data = pythonAnalyze(options.file, options.mode === 'fast' ? 'fast' : 'deep');
  const pipelineResult = buildPipelineResult(options.file, data);
  const artifact = buildAnalysisArtifactFromPipelineResult({
    audioPath: options.file,
    mediaId: '',
    result: pipelineResult,
    requestedProvider: 'librosa',
    analysisBaseUrl: 'direct-python',
    generatedAt: new Date().toISOString()
  });
  const quality = buildAudioAnalysisQualityReport(artifact);
  const writeRes = writeAnalysisArtifactToLibrary({
    appRootPath: options.appRoot,
    mediaFilePath: options.file,
    artifact
  });
  if (!writeRes?.ok) throw new Error(str(writeRes?.error || 'Failed to write artifact to library'));
  const output = {
    ok: true,
    filePath: options.file,
    appRootPath: options.appRoot,
    mode: options.mode,
    quality,
    recordPath: writeRes.recordPath,
    contentFingerprint: writeRes.contentFingerprint,
    trackRecord: writeRes.trackRecord
  };
  process.stdout.write(JSON.stringify(output));
}

try {
  main();
} catch (error) {
  process.stderr.write(String(error?.stack || error?.message || error));
  process.exit(1);
}
