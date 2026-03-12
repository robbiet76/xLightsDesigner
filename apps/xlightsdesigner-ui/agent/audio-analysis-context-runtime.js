function str(value = "") {
  return String(value || "").trim();
}

export async function runAudioAnalysisContextPass({
  audioPath = "",
  sections = [],
  detectedTrackIdentity = null,
  detectedTimeSignature = "",
  detectedTempoBpm = null,
  serviceWebTempoEvidence = null,
  runSongContextResearch,
  runSongContextWebFallback,
  buildWebValidationFromServiceEvidence,
  areMetersCompatible,
  beatsPerBarFromSignature,
  extractNumericCandidates,
  medianNumber
} = {}) {
  const diagnostics = [];
  const addDiag = (message) => {
    const text = str(message);
    if (text) diagnostics.push(text);
  };

  const songContextResearch = typeof runSongContextResearch === "function"
    ? await runSongContextResearch({ audioPath, sections, trackIdentity: detectedTrackIdentity })
    : null;
  const songContextSummary = str(songContextResearch?.summary);
  const webFallbackContext = songContextSummary || typeof runSongContextWebFallback !== "function"
    ? ""
    : str(await runSongContextWebFallback(audioPath));
  const effectiveSongContext = songContextSummary || webFallbackContext || "";
  if (!effectiveSongContext) addDiag("Song context unavailable from cloud agent and web fallback.");
  if (songContextResearch?.confidence) addDiag(`Track research confidence: ${songContextResearch.confidence}`);

  const webValidation = typeof buildWebValidationFromServiceEvidence === "function"
    ? buildWebValidationFromServiceEvidence({
      evidence: serviceWebTempoEvidence,
      trackIdentity: detectedTrackIdentity
    })
    : null;

  let nextDetectedTempoBpm = Number.isFinite(detectedTempoBpm) ? Number(detectedTempoBpm) : null;
  if (webValidation) {
    if (webValidation.ignored) {
      if (webValidation.reason === "non-informational-sources") {
        addDiag("Web validation ignored: non-informational sources (streaming/catalog links).");
      } else if (webValidation.reason === "unverifiable-sources") {
        addDiag("Web validation ignored: returned sources are not track-specific to fingerprinted title/artist.");
      } else if (webValidation.reason === "low-confidence") {
        addDiag("Web validation ignored: low-confidence web evidence.");
      } else {
        addDiag("Web validation ignored: non-exact track match.");
        if (webValidation.matchedTitle || webValidation.matchedArtist) {
          addDiag(`Web matched track candidate: ${webValidation.matchedTitle || "?"} / ${webValidation.matchedArtist || "?"}`);
        }
      }
    } else {
      const wsig = str(webValidation.timeSignature || "unknown");
      const wbpm = Number(webValidation.tempoBpm);
      const wconf = str(webValidation.confidence || "low");
      const wsources = Array.isArray(webValidation.sources)
        ? webValidation.sources.map((s) => str(s)).filter(Boolean).slice(0, 3)
        : [];
      const wSourceBpms = typeof extractNumericCandidates === "function"
        ? extractNumericCandidates(webValidation.sourceBpmValues).slice(0, 8)
        : [];
      const wSourceBars = typeof extractNumericCandidates === "function"
        ? extractNumericCandidates(webValidation.sourceBarsValues).slice(0, 8)
        : [];
      const wsrc = wsources.length;
      let hasConflict = false;
      const hasNumericEvidence =
        Number.isFinite(Number(webValidation.tempoBpm)) ||
        Number.isFinite(Number(webValidation.chosenBeatBpm)) ||
        wSourceBpms.length > 0 ||
        wSourceBars.length > 0;
      const strongEvidence = wconf === "high" && wsrc > 0 && hasNumericEvidence;
      if (!strongEvidence) {
        webValidation.ignored = true;
        webValidation.reason = "low-confidence";
        webValidation.conflict = false;
        addDiag(
          `Web validation ignored: low-confidence or insufficient evidence (${wconf}${wsrc ? `, sources=${wsrc}` : ""}).`
        );
      } else {
        addDiag(`Web validation: ${wsig}${Number.isFinite(wbpm) ? ` / ${wbpm} BPM` : ""} (${wconf})${wsrc ? `, sources=${wsrc}` : ""}`);
        if (detectedTimeSignature && wsig !== "unknown" && typeof areMetersCompatible === "function" && !areMetersCompatible(detectedTimeSignature, wsig)) {
          addDiag(`Meter mismatch: service=${detectedTimeSignature}, web=${wsig}`);
          hasConflict = true;
        }
        if (Number.isFinite(nextDetectedTempoBpm) && nextDetectedTempoBpm > 0) {
          const bpb = typeof beatsPerBarFromSignature === "function" ? beatsPerBarFromSignature(detectedTimeSignature || wsig) : 4;
          const serviceTempo = Number(nextDetectedTempoBpm);
          const relErr = (a, b) => Math.abs((a - b) / Math.max(1e-9, b));
          const chosenBeatBpm = Number(webValidation.chosenBeatBpm);
          const evidenceBeatCandidates = [];
          if (Number.isFinite(chosenBeatBpm) && chosenBeatBpm > 0) evidenceBeatCandidates.push(chosenBeatBpm);
          evidenceBeatCandidates.push(...wSourceBpms);
          evidenceBeatCandidates.push(wbpm);
          const webBeatBpm = typeof medianNumber === "function"
            ? medianNumber(evidenceBeatCandidates.filter((n) => Number.isFinite(n) && n > 0))
            : NaN;
          const medianBars = typeof medianNumber === "function" ? medianNumber(wSourceBars) : NaN;
          const webBarsPerMinute = Number.isFinite(medianBars)
            ? medianBars
            : (Number.isFinite(webBeatBpm) ? (webBeatBpm / Math.max(1, bpb)) : NaN);
          const errVsBeats = Number.isFinite(webBeatBpm) ? relErr(serviceTempo, webBeatBpm) : Number.POSITIVE_INFINITY;
          const errVsBars = Number.isFinite(webBarsPerMinute) ? relErr(serviceTempo, webBarsPerMinute) : Number.POSITIVE_INFINITY;
          const altNums = typeof extractNumericCandidates === "function" ? extractNumericCandidates(webValidation.alternates) : [];
          const altNearService = altNums.some((n) => relErr(n, serviceTempo) <= 0.12);

          let bestScale = 1;
          let bestErr = errVsBeats;
          let forcedScale = false;
          if (altNearService && bpb > 1) {
            bestScale = bpb;
            bestErr = Math.min(bestErr, errVsBars);
          } else if (errVsBars + 0.01 < errVsBeats) {
            bestScale = bpb;
            bestErr = errVsBars;
          } else {
            const candidates = [1, 0.5, 2];
            for (const scale of candidates) {
              const scaled = serviceTempo * scale;
              const err = Number.isFinite(webBeatBpm) ? relErr(scaled, webBeatBpm) : Number.POSITIVE_INFINITY;
              if (err < bestErr) {
                bestErr = err;
                bestScale = scale;
              }
            }
          }
          const scaledErrCandidates = [1, 0.5, 2]
            .map((scale) => {
              const scaled = serviceTempo * scale;
              return Number.isFinite(webBeatBpm) ? relErr(scaled, webBeatBpm) : Number.POSITIVE_INFINITY;
            })
            .filter((n) => Number.isFinite(n));
          const minScaledErr = scaledErrCandidates.length ? Math.min(...scaledErrCandidates) : Number.POSITIVE_INFINITY;
          if (!altNearService && Math.min(errVsBeats, errVsBars) > 0.20 && minScaledErr > 0.12) {
            addDiag("Tempo compare: web evidence is incoherent with service tempo; skipping automatic tempo correction.");
            bestScale = 1;
          }
          if (Math.round(bpb) === 3 && Math.abs(bestScale - 3) < 0.01) {
            bestScale = 2;
            forcedScale = true;
            bestErr = 0;
            addDiag("Tempo correction normalization: forcing 2x for triple-meter half-time adjustment.");
          }

          if ((bestErr <= 0.08 || forcedScale) && Math.abs(bestScale - 1) > 0.01) {
            nextDetectedTempoBpm = Math.round(serviceTempo * bestScale * 100) / 100;
            addDiag(
              `Tempo correction suggested by factor ${bestScale.toFixed(2)} using meter-aware web validation (${serviceTempo} -> ${nextDetectedTempoBpm} BPM, beatsPerBar=${bpb}).`
            );
            webValidation.correctionApplied = false;
          } else if (bestErr > 0.08) {
            addDiag(
              `Tempo mismatch: service=${nextDetectedTempoBpm} BPM, web=${Number.isFinite(webBeatBpm) ? webBeatBpm : (Number.isFinite(wbpm) ? wbpm : "n/a")}`
            );
            hasConflict = true;
          }
        }
        webValidation.conflict = hasConflict;
      }
    }
  } else {
    if (detectedTrackIdentity && detectedTrackIdentity.title && detectedTrackIdentity.artist) {
      addDiag("Web validation unavailable for exact track lookup.");
    } else {
      addDiag("Web validation skipped: fingerprinted title+artist not available.");
    }
  }

  return {
    diagnostics,
    songContextSummary,
    effectiveSongContext,
    webValidation,
    detectedTempoBpm: nextDetectedTempoBpm,
    webContextDerived: Boolean(effectiveSongContext)
  };
}
