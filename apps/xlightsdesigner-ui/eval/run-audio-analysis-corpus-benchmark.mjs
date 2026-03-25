import fs from "node:fs";
import path from "node:path";

import { buildAnalysisArtifactFromPipelineResult } from "../agent/audio-analyst/audio-analyst-runtime.js";
import { buildAudioAnalysisQualityReport } from "../agent/audio-analyst/audio-analysis-quality.js";

function str(value = "") {
  return String(value || "").trim();
}

function parseArgs(argv = []) {
  const options = {
    folder: "",
    baseUrl: "http://127.0.0.1:5055",
    provider: "librosa",
    out: "",
    limit: 0,
    include: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    if (token === "--folder") {
      options.folder = str(argv[index + 1] || "");
      index += 1;
    } else if (token === "--base-url") {
      options.baseUrl = str(argv[index + 1] || options.baseUrl) || options.baseUrl;
      index += 1;
    } else if (token === "--provider") {
      options.provider = str(argv[index + 1] || options.provider) || options.provider;
      index += 1;
    } else if (token === "--out") {
      options.out = str(argv[index + 1] || "");
      index += 1;
    } else if (token === "--limit") {
      options.limit = Number(argv[index + 1] || 0) || 0;
      index += 1;
    } else if (token === "--include") {
      options.include.push(str(argv[index + 1] || ""));
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (!options.folder) {
    throw new Error("--folder is required");
  }
  return options;
}

function collectAudioFiles(folder = "") {
  return fs.readdirSync(folder)
    .map((name) => path.join(folder, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .filter((filePath) => /\.(mp3|wav|m4a|flac)$/i.test(filePath))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

async function postAnalyze({ filePath = "", baseUrl = "", provider = "" } = {}) {
  const form = new FormData();
  form.append("provider", provider);
  form.append("fileName", path.basename(filePath));
  form.append("file", new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/analyze`, {
    method: "POST",
    body: form
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(str(payload?.detail || payload?.error || text || `HTTP ${response.status}`));
  }
  const data = payload?.data || payload;
  if (!data || typeof data !== "object") {
    throw new Error("Unexpected analyze response format");
  }
  return data;
}

function buildPipelineResult(filePath = "", data = {}, provider = "", baseUrl = "") {
  const beats = Array.isArray(data?.beats) ? data.beats : [];
  const bars = Array.isArray(data?.bars) ? data.bars : [];
  const chords = Array.isArray(data?.chords) ? data.chords : [];
  const lyrics = Array.isArray(data?.lyrics) ? data.lyrics : [];
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  const summaryLines = [
    `Audio source: ${path.basename(filePath)}`,
    `Tempo/time signature: ${Number.isFinite(Number(data?.bpm)) ? Number(data.bpm) : "unknown"} BPM / ${str(data?.timeSignature || "unknown")}`,
    `Song structure: ${sections.map((row) => str(row?.label)).filter(Boolean).join(", ") || "pending"}`
  ];
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
        timeSignature: str(data?.timeSignature || "unknown"),
        hasBeatTrack: beats.length > 0,
        hasBarTrack: bars.length > 0,
        hasLyricsTrack: lyrics.length > 0,
        hasChordTrack: chords.length > 0
      },
      trackIdentity: {
        title: str(data?.meta?.trackIdentity?.title),
        artist: str(data?.meta?.trackIdentity?.artist),
        isrc: str(data?.meta?.trackIdentity?.isrc)
      },
      summaryLines
    },
    raw: {
      bpm: Number.isFinite(Number(data?.bpm)) ? Number(data.bpm) : null,
      timeSignature: str(data?.timeSignature || ""),
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

function scoreReport(report = {}) {
  const issues = Array.isArray(report?.topLevelIssues) ? report.topLevelIssues : [];
  const readiness = report?.readiness?.minimumContract || {};
  const semanticAssessment = report?.semanticAssessment || {};
  const readinessFailures = [
    readiness.beatsPresent === false ? "beats_missing" : null,
    readiness.barsPresent === false ? "bars_missing" : null,
    readiness.semanticSongStructurePresent === false ? "semantic_structure_missing" : null,
    readiness.barsMatchTimeSignature === false ? "bars_time_signature_mismatch" : null
  ].filter(Boolean);
  const missingLyrics = issues.includes("no_synced_lyrics") ? 1 : 0;
  const missingChords = issues.includes("no_chords") ? 1 : 0;
  const genericStructure = issues.includes("generic_structure_labels_present") ? 1 : 0;
  const dupleLock = issues.includes("timing_locked_to_duple_meter") ? 1 : 0;
  const semanticIssueCount = Array.isArray(semanticAssessment?.issues) ? semanticAssessment.issues.length : 0;
  const harmonicPenalty = (() => {
    const n = Number(report?.summary?.harmonicConfidence);
    return Number.isFinite(n) ? (n < 0.2 ? 1 : 0) : 0;
  })();
  const sectionIssueCount = (Array.isArray(report?.sections) ? report.sections : [])
    .reduce((sum, row) => sum + (Array.isArray(row?.issues) ? row.issues.length : 0), 0);
  return {
    score: (readinessFailures.length * 10) + missingLyrics + missingChords + genericStructure + dupleLock + harmonicPenalty + sectionIssueCount + (semanticIssueCount * 3),
    sectionIssueCount,
    semanticIssueCount,
    readinessFailures
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let files = collectAudioFiles(options.folder);
  if (options.include.length) {
    const wanted = options.include.map((row) => row.toLowerCase());
    files = files.filter((filePath) => wanted.some((needle) => path.basename(filePath).toLowerCase().includes(needle)));
  }
  if (options.limit > 0) {
    files = files.slice(0, options.limit);
  }
  const results = [];
  for (const filePath of files) {
    const startedAt = Date.now();
    try {
      const data = await postAnalyze({
        filePath,
        baseUrl: options.baseUrl,
        provider: options.provider
      });
      const pipelineResult = buildPipelineResult(filePath, data, options.provider, options.baseUrl);
      const artifact = buildAnalysisArtifactFromPipelineResult({
        audioPath: filePath,
        mediaId: "",
        result: pipelineResult,
        requestedProvider: options.provider,
        analysisBaseUrl: options.baseUrl,
        generatedAt: new Date().toISOString()
      });
      const report = buildAudioAnalysisQualityReport(artifact);
      const ranking = scoreReport(report);
      results.push({
        filePath,
        fileName: path.basename(filePath),
        ok: true,
        durationMs: Date.now() - startedAt,
        summary: report.summary,
        readiness: report.readiness,
        semanticAssessment: report.semanticAssessment,
        topLevelIssues: report.topLevelIssues,
        serviceAssessment: report.serviceAssessment,
        sections: report.sections,
        score: ranking.score,
        sectionIssueCount: ranking.sectionIssueCount,
        semanticIssueCount: ranking.semanticIssueCount,
        readinessFailures: ranking.readinessFailures
      });
    } catch (error) {
      results.push({
        filePath,
        fileName: path.basename(filePath),
        ok: false,
        durationMs: Date.now() - startedAt,
        error: str(error?.message || error)
      });
    }
  }
  const sorted = results.slice().sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    return Number(a.score || 0) - Number(b.score || 0);
  });
  const report = {
    artifactType: "audio_analysis_corpus_benchmark_v1",
    createdAt: new Date().toISOString(),
    folder: options.folder,
    provider: options.provider,
    baseUrl: options.baseUrl,
    counts: {
      total: results.length,
      ok: results.filter((row) => row.ok).length,
      failed: results.filter((row) => !row.ok).length
    },
    ranking: sorted.map((row, index) => ({
      rank: index + 1,
      fileName: row.fileName,
      ok: row.ok,
      score: row.score,
      topLevelIssues: row.topLevelIssues || [],
      error: row.error || ""
    })),
    results: sorted
  };
  const text = JSON.stringify(report, null, 2);
  if (options.out) {
    fs.writeFileSync(options.out, `${text}\n`);
  } else {
    process.stdout.write(`${text}\n`);
  }
}

await main();
