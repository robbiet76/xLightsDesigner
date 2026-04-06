#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildAnalysisArtifactFromPipelineResult } from '../../apps/xlightsdesigner-ui/agent/audio-analyst/audio-analyst-runtime.js';
import { buildAudioAnalysisQualityReport } from '../../apps/xlightsdesigner-ui/agent/audio-analyst/audio-analysis-quality.js';
import { writeAnalysisArtifactToLibrary } from '../../apps/xlightsdesigner-desktop/analysis-artifact-store.mjs';

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.flac']);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const SERVICE_DIR = path.join(ROOT, 'apps', 'xlightsdesigner-analysis-service');
const SERVICE_PYTHON = path.join(SERVICE_DIR, '.venv310', 'bin', 'python');
const DEFAULT_APP_ROOT = path.join(os.homedir(), 'Documents', 'Lights', 'xLightsDesigner');
const DEFAULT_AUDIO_FOLDER = path.join(os.homedir(), 'Documents', 'Lights', 'Current', 'Christmas', 'Show', 'Audio');

function str(value = '') {
  return String(value || '').trim();
}

function parseArgs(argv = []) {
  const out = {
    folder: DEFAULT_AUDIO_FOLDER,
    appRoot: DEFAULT_APP_ROOT,
    outDir: path.join(ROOT, 'var', 'audio-analysis-review', `run-${new Date().toISOString().replace(/[:.]/g, '-')}`),
    mode: 'deep',
    limit: 0,
    include: []
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = str(argv[i]);
    if (token === '--folder') {
      out.folder = path.resolve(str(argv[++i] || out.folder));
    } else if (token === '--app-root') {
      out.appRoot = path.resolve(str(argv[++i] || out.appRoot));
    } else if (token === '--out-dir') {
      out.outDir = path.resolve(str(argv[++i] || out.outDir));
    } else if (token === '--mode') {
      const mode = str(argv[++i] || out.mode).toLowerCase();
      if (!['fast', 'deep', 'smart'].includes(mode)) throw new Error(`Unsupported mode: ${mode}`);
      out.mode = mode;
    } else if (token === '--limit') {
      out.limit = Math.max(0, Number(argv[++i] || 0) || 0);
    } else if (token === '--include') {
      out.include.push(str(argv[++i] || ''));
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return out;
}

function listAudioFiles(folder = '', includes = []) {
  const entries = fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && AUDIO_EXTS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(folder, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  if (!includes.length) return entries;
  const needles = includes.map((row) => row.toLowerCase());
  return entries.filter((filePath) => needles.some((needle) => path.basename(filePath).toLowerCase().includes(needle)));
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

function shouldEscalate(report = {}) {
  const issues = Array.isArray(report?.topLevelIssues) ? report.topLevelIssues : [];
  const readiness = report?.readiness?.minimumContract || {};
  return Boolean(
    readiness.semanticSongStructurePresent === false ||
    issues.includes('generic_structure_labels_present') ||
    issues.includes('rhythm_provider_time_signature_disagreement') ||
    issues.includes('rhythm_provider_bar_grouping_disagreement')
  );
}

function htmlEscape(value = '') {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function trackByName(record = {}, name = '') {
  return (Array.isArray(record?.timingTracks) ? record.timingTracks : []).find((row) => str(row?.name) === name) || null;
}

function colorForKind(kind = '') {
  const lower = str(kind).toLowerCase();
  if (lower.includes('intro')) return '#d9c27a';
  if (lower.includes('verse')) return '#6fa8dc';
  if (lower.includes('chorus')) return '#e69138';
  if (lower.includes('bridge')) return '#8e7cc3';
  if (lower.includes('pre')) return '#93c47d';
  if (lower.includes('outro')) return '#c27ba0';
  if (lower.includes('phrase')) return '#76a5af';
  return '#999999';
}

function buildSegmentSvg(track = null, durationMs = 0, height = 28) {
  const segments = Array.isArray(track?.segments) ? track.segments : [];
  if (!segments.length || !durationMs) return '<div class="muted">none</div>';
  const width = 900;
  const rects = segments.map((seg) => {
    const start = Number(seg.startMs || 0);
    const end = Number(seg.endMs || 0);
    const x = Math.max(0, Math.round((start / durationMs) * width));
    const w = Math.max(2, Math.round(((end - start) / durationMs) * width));
    const label = htmlEscape(seg.label == null ? '' : String(seg.label));
    const fill = colorForKind(seg.label || seg.kind);
    return `<g><rect x="${x}" y="4" width="${w}" height="${height - 8}" rx="3" fill="${fill}" opacity="0.88"></rect>${w >= 42 ? `<text x="${x + 4}" y="${Math.round(height / 2) + 4}" font-size="11" fill="#111">${label}</text>` : ''}</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="timeline-svg">${rects}</svg>`;
}

function buildEventSvg(track = null, durationMs = 0, color = '#444') {
  const segments = Array.isArray(track?.segments) ? track.segments : [];
  if (!segments.length || !durationMs) return '<div class="muted">none</div>';
  const width = 900;
  const height = 20;
  const lines = segments.map((seg) => {
    const start = Number(seg.startMs || 0);
    const x = Math.max(0, Math.min(width, Math.round((start / durationMs) * width)));
    return `<line x1="${x}" y1="2" x2="${x}" y2="18" stroke="${color}" stroke-width="1.2"></line>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="timeline-svg">${lines}</svg>`;
}

function buildRecordCard(row = {}) {
  const record = row.trackRecord || {};
  const durationMs = Number(record?.track?.sourceMedia?.durationMs || row.durationMs || 0);
  const structure = trackByName(record, 'XD: Song Structure');
  const phrases = trackByName(record, 'XD: Phrase Cues');
  const beats = trackByName(record, 'XD: Beats');
  const bars = trackByName(record, 'XD: Bars');
  const issues = Array.isArray(row.quality?.topLevelIssues) ? row.quality.topLevelIssues : [];
  return `
  <section class="card">
    <div class="card-head">
      <div>
        <h2>${htmlEscape(record?.track?.displayName || row.fileName)}</h2>
        <div class="meta">${htmlEscape(row.fileName)} | ${htmlEscape(row.modeUsed)} | ${htmlEscape(path.basename(row.recordPath || ''))}</div>
      </div>
      <div class="chips">
        <span class="chip">sections ${Number(structure?.segmentCount || 0)}</span>
        <span class="chip">phrases ${Number(phrases?.segmentCount || 0)}</span>
        <span class="chip">beats ${Number(beats?.segmentCount || 0)}</span>
        <span class="chip">bars ${Number(bars?.segmentCount || 0)}</span>
      </div>
    </div>
    <div class="issues ${issues.length ? 'warn' : 'ok'}">${issues.length ? htmlEscape(issues.join(', ')) : 'no top-level issues'}</div>
    <div class="timeline"><div class="label">Song Structure</div>${buildSegmentSvg(structure, durationMs, 34)}</div>
    <div class="timeline"><div class="label">Phrase Cues</div>${buildSegmentSvg(phrases, durationMs, 24)}</div>
    <div class="timeline"><div class="label">Bars</div>${buildEventSvg(bars, durationMs, '#cc0000')}</div>
    <div class="timeline"><div class="label">Beats</div>${buildEventSvg(beats, durationMs, '#1c4587')}</div>
  </section>`;
}

function buildHtmlReport(results = [], payload = {}) {
  const cards = results.map((row) => buildRecordCard(row)).join('\n');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Track Metadata Review</title>
<style>
body{font-family:Helvetica,Arial,sans-serif;margin:24px;background:#f4f1ea;color:#1b1b1b}
header{margin-bottom:24px}
h1{margin:0 0 8px 0;font-size:28px}
.summary{color:#444}
.card{background:#fff;border:1px solid #d8d2c8;border-radius:10px;padding:16px;margin:0 0 18px 0;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.card-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:10px}
.card-head h2{margin:0 0 4px 0;font-size:20px}
.meta{font-size:12px;color:#666}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{background:#eee7db;border-radius:999px;padding:5px 10px;font-size:12px}
.issues{font-size:13px;margin:10px 0 14px 0}
.issues.warn{color:#8a2d2d}.issues.ok{color:#2d6a4f}
.timeline{display:grid;grid-template-columns:140px 1fr;gap:12px;align-items:center;margin:8px 0}
.label{font-size:12px;color:#444;font-weight:600}
.timeline-svg{width:100%;height:36px;background:#faf8f3;border:1px solid #ece7dc;border-radius:6px}
.muted{font-size:12px;color:#777}
</style>
</head>
<body>
<header>
<h1>Track Metadata Review</h1>
<div class="summary">Folder: ${htmlEscape(payload.folder)} | App root: ${htmlEscape(payload.appRoot)} | Mode: ${htmlEscape(payload.mode)} | Tracks: ${results.length}</div>
</header>
${cards}
</body>
</html>`;
}

function writeOutputs({ outDir = '', payload = {}, results = [] } = {}) {
  const jsonPath = path.join(outDir, 'track-library-review.json');
  const htmlPath = path.join(outDir, 'track-library-review.html');
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.writeFileSync(htmlPath, buildHtmlReport(results.filter((row) => row.ok), payload), 'utf8');
  return { jsonPath, htmlPath };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(options.outDir, { recursive: true });
  fs.mkdirSync(path.join(options.appRoot, 'library', 'tracks'), { recursive: true });
  let files = listAudioFiles(options.folder, options.include);
  if (options.limit > 0) files = files.slice(0, options.limit);
  const results = [];
  let lastPaths = { jsonPath: '', htmlPath: '' };
  for (const filePath of files) {
    const started = Date.now();
    const fileName = path.basename(filePath);
    try {
      const fastData = pythonAnalyze(filePath, options.mode === 'deep' ? 'deep' : 'fast');
      let pipelineResult = buildPipelineResult(filePath, fastData);
      let artifact = buildAnalysisArtifactFromPipelineResult({
        audioPath: filePath,
        result: pipelineResult,
        requestedProvider: 'librosa',
        analysisBaseUrl: 'direct-python',
        analysisProfile: { mode: options.mode === 'deep' ? 'deep' : 'fast', allowEscalation: options.mode === 'smart' }
      });
      let quality = buildAudioAnalysisQualityReport(artifact);
      let modeUsed = options.mode === 'deep' ? 'deep' : 'fast';
      if (options.mode === 'smart' && shouldEscalate(quality)) {
        const deepData = pythonAnalyze(filePath, 'deep');
        pipelineResult = buildPipelineResult(filePath, deepData);
        artifact = buildAnalysisArtifactFromPipelineResult({
          audioPath: filePath,
          result: pipelineResult,
          requestedProvider: 'librosa',
          analysisBaseUrl: 'direct-python',
          analysisProfile: { mode: 'deep', allowEscalation: false }
        });
        quality = buildAudioAnalysisQualityReport(artifact);
        modeUsed = 'deep';
      }
      const writeRes = writeAnalysisArtifactToLibrary({
        appRootPath: options.appRoot,
        mediaFilePath: filePath,
        artifact
      });
      if (!writeRes.ok) throw new Error(str(writeRes.error || 'library write failed'));
      results.push({
        ok: true,
        fileName,
        filePath,
        modeUsed,
        durationMs: Date.now() - started,
        recordPath: writeRes.recordPath,
        trackRecord: writeRes.trackRecord,
        quality: {
          summary: quality.summary,
          topLevelIssues: quality.topLevelIssues,
          readiness: quality.readiness,
          semanticAssessment: quality.semanticAssessment,
          serviceAssessment: quality.serviceAssessment
        }
      });
      console.log(`OK ${modeUsed} ${fileName} -> ${path.basename(writeRes.recordPath)}`);
    } catch (error) {
      results.push({
        ok: false,
        fileName,
        filePath,
        durationMs: Date.now() - started,
        error: str(error?.message || error)
      });
      console.error(`FAIL ${fileName}: ${str(error?.message || error)}`);
    }
    const payload = {
      createdAt: new Date().toISOString(),
      folder: options.folder,
      appRoot: options.appRoot,
      outDir: options.outDir,
      mode: options.mode,
      totalTracks: files.length,
      completedTracks: results.length,
      successfulTracks: results.filter((row) => row.ok).length,
      failedTracks: results.filter((row) => !row.ok).length,
      results
    };
    lastPaths = writeOutputs({ outDir: options.outDir, payload, results });
  }
  const payload = {
    createdAt: new Date().toISOString(),
    folder: options.folder,
    appRoot: options.appRoot,
    outDir: options.outDir,
    mode: options.mode,
    totalTracks: files.length,
    completedTracks: results.length,
    successfulTracks: results.filter((row) => row.ok).length,
    failedTracks: results.filter((row) => !row.ok).length,
    results
  };
  const { jsonPath, htmlPath } = writeOutputs({ outDir: options.outDir, payload, results });
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${htmlPath}`);
  if (payload.failedTracks) process.exitCode = 1;
  process.exit(process.exitCode || 0);
}

main();
