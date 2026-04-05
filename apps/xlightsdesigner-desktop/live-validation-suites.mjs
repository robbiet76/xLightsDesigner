import fs from "node:fs";
import path from "node:path";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function backupSiblingPathForSequence(sequencePath = "") {
  const file = str(sequencePath);
  if (!file) return "";
  const dir = path.dirname(file);
  const ext = path.extname(file);
  const name = path.basename(file, ext || undefined);
  return path.join(dir, `${name}.xbkp`);
}

function removeFileIfExists(filePath = "") {
  const file = str(filePath);
  if (!file) return;
  try {
    fs.rmSync(file, { force: true });
  } catch {
    // ignore cleanup failures
  }
}

function inferRequiredCueTypesFromText(text = "") {
  const lower = str(text).toLowerCase();
  const out = new Set();
  if (!lower) return out;
  if (/\b(beat grid|beat-driven|beats|pulse)\b/.test(lower) && !/\bignore (the )?(beat grid|beats|pulse)\b/.test(lower)) {
    out.add("beat");
  }
  if (/\b(chord|harmonic|cadence|pivot)\b/.test(lower) && !/\bignore (the )?(chord|chords|harmonic|cadence)\b/.test(lower)) {
    out.add("chord");
  }
  if (/\b(phrase|release|lift|breath)\b/.test(lower) && !/\bignore (the )?(phrase|release|lift|breath)\b/.test(lower)) {
    out.add("phrase");
  }
  return out;
}

function inferRequiredCueTypesFromScenario(scenario = {}) {
  const required = new Set();
  for (const text of [
    scenario?.analyzePrompt,
    scenario?.strongPrompt,
    scenario?.weakPrompt,
    scenario?.prompt
  ]) {
    for (const cueType of inferRequiredCueTypesFromText(text)) {
      required.add(cueType);
    }
  }
  return required;
}

function buildSequencerGapReport({
  suiteName = "",
  suiteContract = "",
  scenarioCount = 0,
  results = []
} = {}) {
  const safeResults = arr(results).filter((row) => row && typeof row === "object");
  const issues = [];
  const counts = {
    designer_gap: 0,
    sequencer_gap: 0,
    apply_gap: 0,
    validation_gap: 0
  };

  function pushIssue(issue) {
    if (!issue || typeof issue !== "object") return;
    const category = str(issue.category);
    if (counts[category] != null) counts[category] += 1;
    issues.push(issue);
  }

  for (const result of safeResults) {
    const scenarioName = str(result?.name || "");
    const practicalValidation = result?.practicalValidation || null;
    const hasGenerateResponse = Object.prototype.hasOwnProperty.call(result, "generateResponse");
    const hasApplyResponse = Object.prototype.hasOwnProperty.call(result, "applyResponse");
    const generateResponse = hasGenerateResponse ? (result?.generateResponse || null) : null;
    const applyResponse = hasApplyResponse ? (result?.applyResponse || null) : null;
    const assertions = arr(result?.assertions);
    const failedAssertions = assertions.filter((row) => row?.ok === false);

    if (hasGenerateResponse && generateResponse?.ok !== true) {
      pushIssue({
        category: "designer_gap",
        scenarioName,
        detail: str(generateResponse?.error || generateResponse?.status?.text || "Proposal generation failed."),
        artifactHint: "generateResponse"
      });
    }

    if (hasGenerateResponse && generateResponse?.ok === true && !generateResponse?.planHandoff && !generateResponse?.hasDraftProposal) {
      pushIssue({
        category: "designer_gap",
        scenarioName,
        detail: "Proposal generation completed without a usable plan handoff.",
        artifactHint: "generateResponse.planHandoff"
      });
    }

    if (applyResponse && applyResponse?.ok !== true) {
      pushIssue({
        category: "apply_gap",
        scenarioName,
        detail: str(
          applyResponse?.applyOutcome?.message
          || applyResponse?.status?.text
          || applyResponse?.error
          || "Apply failed."
        ),
        artifactHint: "applyResponse"
      });
    }

    if (practicalValidation && practicalValidation?.overallOk !== true) {
      const readbackFailureCount = arr(practicalValidation?.failures?.readback).length;
      const designFailureCount = arr(practicalValidation?.failures?.design).length;
      pushIssue({
        category: readbackFailureCount > 0 ? "apply_gap" : "validation_gap",
        scenarioName,
        detail: readbackFailureCount > 0
          ? `Practical validation failed with ${readbackFailureCount} readback failure(s).`
          : `Practical validation failed with ${designFailureCount} design failure(s).`,
        artifactHint: "practicalValidation"
      });
    }

    for (const assertion of failedAssertions) {
      const kind = str(assertion?.kind);
      let category = "validation_gap";
      if (kind === "practical_validation") category = "validation_gap";
      else if (kind.startsWith("section_") || kind === "section_effect_contrast") category = "sequencer_gap";
      else if (kind === "effect_match_count" || kind === "preferred_effect_alignment" || kind === "forbidden_effects") category = "sequencer_gap";
      else if (kind === "required_targets" || kind === "focus_coverage") category = "apply_gap";
      pushIssue({
        category,
        scenarioName,
        detail: `${kind}: expected ${str(assertion?.expected || "")} but saw ${str(assertion?.actual || "")}`.trim(),
        artifactHint: `assertions.${kind}`
      });
    }
  }

  return {
    artifactType: "sequencer_gap_report_v1",
    artifactVersion: "1.0",
    createdAt: new Date().toISOString(),
    suiteName: str(suiteName),
    suiteContract: str(suiteContract),
    scenarioCount: Number.isFinite(Number(scenarioCount)) ? Number(scenarioCount) : safeResults.length,
    issueCount: issues.length,
    issueCounts: counts,
    issues
  };
}

function parseDesignRevisionLabel(value = "") {
  const match = str(value).match(/^D(\d+)\.(\d+)$/i);
  if (!match) return { designOrdinal: null, designRevision: null };
  return {
    designOrdinal: Number.parseInt(match[1], 10),
    designRevision: Number.parseInt(match[2], 10)
  };
}

function extractObservedEffectNamesFromRevisionRun({
  practicalValidation = null,
  applyResponse = null,
  latestSnapshot = null,
  expectedTargets = []
} = {}) {
  const targetSet = new Set(uniqueStrings(expectedTargets));
  const fromPractical = arr(practicalValidation?.designAlignment?.observedEffectNames);
  const fromApplyPractical = arr(applyResponse?.applyOutcome?.applyResult?.practicalValidation?.designAlignment?.observedEffectNames);
  const fromLatestApply = arr(applyResponse?.latestApply?.verification?.designAlignment?.observedEffectNames);
  const sequenceRows = arr(latestSnapshot?.pageStates?.sequence?.data?.rows);
  const fromRows = sequenceRows
    .filter((row) => !targetSet.size || targetSet.has(str(row?.target)))
    .flatMap((row) => arr(row?.effectNames || row?.effects || []))
    .map((row) => str(row))
    .filter(Boolean);
  return uniqueStrings([
    ...fromPractical,
    ...fromApplyPractical,
    ...fromLatestApply,
    ...fromRows
  ]);
}

function extractPracticalValidationArtifact(applyResponse = null, latestSnapshot = null) {
  return applyResponse?.latestPracticalValidation
    || applyResponse?.applyOutcome?.applyResult?.practicalValidation
    || latestSnapshot?.latestPracticalValidation
    || null;
}

function findMatchingSectionPlan(sectionPlans = [], { section = "", targets = [] } = {}) {
  const normalizedSection = str(section);
  const normalizedTargets = uniqueStrings(targets);
  const normalizedTargetSet = new Set(normalizedTargets);
  return arr(sectionPlans).find((row) => {
    if (normalizedSection && str(row?.section) !== normalizedSection) return false;
    const rowTargets = uniqueStrings(arr(row?.targetIds));
    if (!normalizedTargetSet.size) return rowTargets.length > 0;
    return normalizedTargets.every((targetId) => rowTargets.includes(targetId));
  }) || null;
}

function buildRevisionTargetFromSectionPlan(sectionPlan = null) {
  const plan = sectionPlan && typeof sectionPlan === "object" ? sectionPlan : null;
  if (!plan) return null;
  const designId = str(plan?.designId);
  if (!designId) return null;
  const priorDesignRevision = Number.isInteger(Number(plan?.designRevision)) ? Number(plan.designRevision) : 0;
  const nextDesignRevision = priorDesignRevision + 1;
  return {
    designId,
    designRevision: nextDesignRevision,
    priorDesignRevision,
    designAuthor: str(plan?.designAuthor || "designer") || "designer",
    sections: uniqueStrings([plan?.section]),
    targetIds: uniqueStrings(arr(plan?.targetIds)),
    summary: str(plan?.intentSummary),
    designLabel: `D${String(designId).replace(/^DES-0*/i, "") || designId}.${nextDesignRevision}`,
    requestedAt: new Date().toISOString()
  };
}

export function createLiveValidationSuites({
  invokeRendererAutomation,
  getRendererAgentRuntimeSnapshot,
  runComparativeLiveDesignValidationFromDesktop,
  runWholeSequenceApplyValidationFromDesktop,
  validateDesignConceptState,
  logStartup,
  nowMs
}) {
  async function canReuseCurrentAnalysis({ sequencePath = "", analyzePrompt = "", requiredCueTypes = new Set() } = {}) {
    const prompt = str(analyzePrompt);
    if (!prompt) return false;
    try {
      const runtime = await getRendererAgentRuntimeSnapshot();
      const currentPath = str(runtime?.sequencePathInput);
      const currentAudioPath = str(runtime?.audioPathInput);
      const lastAnalysisPrompt = str(runtime?.lastAnalysisPrompt);
      const analysisHandoff = runtime?.handoffs?.analysis_handoff_v1 || null;
      const handoffAudioPath = str(analysisHandoff?.context?.audioPath);
      const analysisValid = Boolean(analysisHandoff?.valid);
      const sameSequence = !str(sequencePath) || currentPath === str(sequencePath);
      const sameAudio = Boolean(currentAudioPath) && currentAudioPath === handoffAudioPath;
      if (!(sameSequence && analysisValid && sameAudio && lastAnalysisPrompt === prompt)) {
        return false;
      }
      const availableCueTypes = new Set(arr(runtime?.musicDesignContextSummary?.availableCueTypes).map((value) => str(value).toLowerCase()).filter(Boolean));
      for (const cueType of requiredCueTypes) {
        if (!availableCueTypes.has(str(cueType).toLowerCase())) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async function openSequenceFromDesktop(sequencePath = "") {
    const file = str(sequencePath);
    if (!file) {
      throw new Error("sequencePath is required.");
    }
    async function waitForOpenSync(targetPath) {
      const deadline = nowMs() + 8000;
      let lastRuntime = null;
      while (nowMs() < deadline) {
        try {
          const runtime = await getRendererAgentRuntimeSnapshot();
          lastRuntime = runtime;
          const currentPath = str(runtime?.sequencePathInput);
          const activeLoaded = Boolean(runtime?.activeSequenceLoaded || runtime?.sequenceOpen);
          if (currentPath === targetPath && activeLoaded) {
            return runtime;
          }
        } catch {
          // best effort only
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return lastRuntime;
    }
    try {
      const runtime = await getRendererAgentRuntimeSnapshot();
      const currentPath = str(runtime?.sequencePathInput);
      const activeLoaded = Boolean(runtime?.activeSequenceLoaded || runtime?.sequenceOpen);
      if (currentPath && currentPath === file && activeLoaded) {
        return {
          ok: true,
          skipped: true,
          activeSequence: str(runtime?.activeSequence),
          sequencePath: file
        };
      }
    } catch {
      // best-effort precheck only
    }
    const opened = await invokeRendererAutomation("openSequence", {
      sequencePath: file
    });
    const synced = await waitForOpenSync(file);
    return {
      ok: true,
      activeSequence: str(synced?.activeSequence || opened?.activeSequence),
      sequencePath: file
    };
  }

  async function restoreValidationSequenceFromBaseline({
    sequencePath = "",
    baselineSequencePath = ""
  } = {}) {
    const workingPath = str(sequencePath);
    const baselinePath = str(baselineSequencePath);
    if (!workingPath || !baselinePath) {
      return { ok: false, restored: false, reason: "missing_paths" };
    }
    if (!fs.existsSync(baselinePath)) {
      throw new Error(`Validation baseline does not exist: ${baselinePath}`);
    }
    fs.mkdirSync(path.dirname(workingPath), { recursive: true });
    fs.copyFileSync(baselinePath, workingPath);
    removeFileIfExists(backupSiblingPathForSequence(workingPath));
    return { ok: true, restored: true, sequencePath: workingPath, baselineSequencePath: baselinePath };
  }

  async function restoreSuiteSequencesToBaseline(sequencePairs = []) {
    for (const row of arr(sequencePairs)) {
      const sequencePath = str(row?.sequencePath);
      const baselineSequencePath = str(row?.baselineSequencePath);
      if (!sequencePath || !baselineSequencePath) continue;
      await restoreValidationSequenceFromBaseline({ sequencePath, baselineSequencePath });
    }
  }

  async function runLiveDesignCanaryValidationFromDesktop(expected = {}) {
    const runStartedAtMs = nowMs();
    const prompt = str(expected?.prompt || expected?.strongPrompt);
    const sequencePath = str(expected?.sequencePath);
    if (!prompt) {
      throw new Error("Live canary validation requires a prompt.");
    }
    const timings = {};
    if (sequencePath) {
      const openStartedAtMs = nowMs();
      await openSequenceFromDesktop(sequencePath);
      timings.openSequenceMs = nowMs() - openStartedAtMs;
    }
    if (expected?.refreshFirst !== false) {
      const refreshStartedAtMs = nowMs();
      await invokeRendererAutomation("refreshFromXLights", {});
      timings.refreshMs = nowMs() - refreshStartedAtMs;
    }
    if (str(expected?.analyzePrompt)) {
      const analyzeStartedAtMs = nowMs();
      await invokeRendererAutomation("analyzeAudio", { prompt: str(expected.analyzePrompt) });
      timings.analyzeMs = nowMs() - analyzeStartedAtMs;
    }

    const generateStartedAtMs = nowMs();
    await invokeRendererAutomation("generateProposal", {
      prompt,
      requestedRole: "designer_dialog",
      selectedSections: arr(expected?.sections),
      selectedTargetIds: arr(expected?.targets),
      selectedTagNames: arr(expected?.tagNames)
    });
    const snapshot = await invokeRendererAutomation("getComparativeValidationSnapshot", {});
    const validation = validateDesignConceptState({
      expected: {
        sequenceName: expected?.sequenceName,
        designLabel: expected?.designLabel,
        anchor: expected?.anchor || arr(expected?.sections)[0] || expected?.section,
        section: expected?.section || arr(expected?.sections)[0] || expected?.anchor,
        targets: arr(expected?.targets),
        effectFamilies: arr(expected?.effectFamilies),
        applied: false
      },
      pageStates: snapshot?.pageStates || {}
    });

    return {
      contract: "live_design_canary_validation_run_v1",
      version: "1.0",
      ok: validation?.ok === true,
      timings: {
        totalMs: nowMs() - runStartedAtMs,
        openSequenceMs: Number(timings.openSequenceMs || 0),
        refreshMs: Number(timings.refreshMs || 0),
        analyzeMs: Number(timings.analyzeMs || 0),
        generateMs: nowMs() - generateStartedAtMs
      },
      snapshot,
      validation
    };
  }

  async function runLiveDesignValidationSuiteFromDesktop(expected = {}) {
    const suiteStartedAtMs = nowMs();
    const scenarios = arr(expected?.scenarios).filter((row) => row && typeof row === "object");
    if (!scenarios.length) {
      throw new Error("Live design validation suite requires at least one scenario.");
    }
    const suiteBaselineSequencePath = str(expected?.baselineSequencePath);
    const results = [];
    let activeSequencePath = "";
    const refreshedSequences = new Set();
    const analyzedContexts = new Set();
    const suiteRestorePairs = new Map();
    try {
    for (const scenario of scenarios) {
      const scenarioStartedAtMs = nowMs();
      const name = str(scenario?.name || `scenario-${results.length + 1}`);
      const sequencePath = str(scenario?.sequencePath);
      const baselineSequencePath = str(scenario?.baselineSequencePath || suiteBaselineSequencePath);
      const timings = {};
      logStartup(`automation:live-suite:scenario:start name=${name} index=${results.length + 1}/${scenarios.length} sequence=${sequencePath || "__current__"}`);
      if (sequencePath && baselineSequencePath) {
        suiteRestorePairs.set(sequencePath, { sequencePath, baselineSequencePath });
        const restoreStartedAtMs = nowMs();
        await restoreValidationSequenceFromBaseline({ sequencePath, baselineSequencePath });
        timings.restoreBaselineMs = nowMs() - restoreStartedAtMs;
        activeSequencePath = "";
        refreshedSequences.delete(sequencePath);
      }
      if (sequencePath && sequencePath !== activeSequencePath) {
        const openStartedAtMs = nowMs();
        await openSequenceFromDesktop(sequencePath);
        timings.openSequenceMs = nowMs() - openStartedAtMs;
        activeSequencePath = sequencePath;
      }

      const sequenceContextKey = sequencePath || activeSequencePath || "__current__";
      if (!refreshedSequences.has(sequenceContextKey) && scenario?.refreshFirst !== false) {
        const refreshStartedAtMs = nowMs();
        await invokeRendererAutomation("refreshFromXLights", {});
        timings.refreshMs = nowMs() - refreshStartedAtMs;
        refreshedSequences.add(sequenceContextKey);
      }

      const analyzePrompt = str(scenario?.analyzePrompt);
      const analysisContextKey = `${sequenceContextKey}::${analyzePrompt}`;
      if (analyzePrompt && !analyzedContexts.has(analysisContextKey)) {
        const requiredCueTypes = inferRequiredCueTypesFromScenario(scenario);
        const reuse = await canReuseCurrentAnalysis({
          sequencePath: sequenceContextKey === "__current__" ? "" : sequenceContextKey,
          analyzePrompt,
          requiredCueTypes
        });
        if (reuse) {
          timings.analyzeMs = 0;
        } else {
          const analyzeStartedAtMs = nowMs();
          await invokeRendererAutomation("analyzeAudio", { prompt: analyzePrompt });
          timings.analyzeMs = nowMs() - analyzeStartedAtMs;
        }
        analyzedContexts.add(analysisContextKey);
      }

      const comparison = await runComparativeLiveDesignValidationFromDesktop({
        ...scenario,
        __timings: timings,
        refreshFirst: false,
        analyzePrompt: ""
      });
      results.push({
        name,
        sequencePath,
        timings: {
          totalMs: nowMs() - scenarioStartedAtMs,
          restoreBaselineMs: Number(comparison?.timings?.restoreBaselineMs || timings.restoreBaselineMs || 0),
          openSequenceMs: Number(comparison?.timings?.openSequenceMs || timings.openSequenceMs || 0),
          refreshMs: Number(comparison?.timings?.refreshMs || timings.refreshMs || 0),
          analyzeMs: Number(comparison?.timings?.analyzeMs || timings.analyzeMs || 0),
          strongGenerateMs: Number(comparison?.timings?.strongGenerateMs || 0),
          weakGenerateMs: Number(comparison?.timings?.weakGenerateMs || 0)
        },
        validation: comparison?.validation || null,
        metrics: comparison?.validation?.metrics || null,
        strong: comparison?.strong || null,
        weak: comparison?.weak || null
      });
      logStartup(`automation:live-suite:scenario:finish name=${name} ok=${comparison?.validation?.ok === true ? "true" : "false"} totalMs=${nowMs() - scenarioStartedAtMs}`);
    }
    } finally {
      await restoreSuiteSequencesToBaseline([...suiteRestorePairs.values()]);
    }

    const failed = results.filter((row) => row?.validation?.ok !== true);
    const gapReport = buildSequencerGapReport({
      suiteName: str(expected?.name || "live_design_validation_suite"),
      suiteContract: "live_design_validation_suite_run_v1",
      scenarioCount: results.length,
      results: results.map((row) => {
        const validation = row?.validation || null;
        const metrics = validation?.metrics && typeof validation.metrics === "object"
          ? validation.metrics
          : {};
        const comparison = row?.comparison && typeof row.comparison === "object"
          ? row.comparison
          : {};
        const assertions = [];
        if (validation) {
          assertions.push({
            kind: "practical_validation",
            ok: validation?.ok === true,
            expected: "overallOk=true",
            actual: validation?.ok === true ? "overallOk=true" : "overallOk=false"
          });
        }
        if (Number.isFinite(Number(metrics?.strongScore)) && Number.isFinite(Number(metrics?.weakScore))) {
          assertions.push({
            kind: "comparative_preference",
            ok: Number(metrics.strongScore) > Number(metrics.weakScore),
            expected: "strongScore>weakScore",
            actual: `strong=${Number(metrics.strongScore)} weak=${Number(metrics.weakScore)}`
          });
        } else if (str(comparison?.preferred)) {
          assertions.push({
            kind: "comparative_preference",
            ok: str(comparison.preferred) === "strong",
            expected: "preferred=strong",
            actual: `preferred=${str(comparison.preferred)}`
          });
        }
        return {
          name: row?.name,
          assertions,
          practicalValidation: validation
            ? {
                overallOk: validation?.ok === true,
                failures: {
                  readback: arr(validation?.failures),
                  design: []
                }
              }
            : null
        };
      })
    });
    return {
      contract: "live_design_validation_suite_run_v1",
      version: "1.0",
      ok: failed.length === 0,
      summary: failed.length === 0
        ? `Live validation suite passed ${results.length}/${results.length} scenarios.`
        : `Live validation suite passed ${results.length - failed.length}/${results.length} scenarios.`,
      timings: {
        totalMs: nowMs() - suiteStartedAtMs
      },
      scenarioCount: results.length,
      failedScenarioCount: failed.length,
      failedScenarioNames: failed.map((row) => row.name),
      results,
      gapReport
    };
  }

  async function runLiveRevisionPracticalSequenceValidationSuiteFromDesktop(expected = {}) {
    const suiteStartedAtMs = nowMs();
    const scenarios = arr(expected?.scenarios).filter((row) => row && typeof row === "object");
    if (!scenarios.length) {
      throw new Error("Live revision practical sequence validation suite requires at least one scenario.");
    }
    const suiteBaselineSequencePath = str(expected?.baselineSequencePath);
    const results = [];
    let activeSequencePath = "";
    const analyzedContexts = new Set();
    const suiteRestorePairs = new Map();

    try {
    for (const scenario of scenarios) {
      const scenarioStartedAtMs = nowMs();
      const name = str(scenario?.name || `scenario-${results.length + 1}`);
      const sequencePath = str(scenario?.sequencePath);
      const baselineSequencePath = str(scenario?.baselineSequencePath || suiteBaselineSequencePath);
      const timings = {};
      logStartup(`automation:live-revision-suite:scenario:start name=${name} index=${results.length + 1}/${scenarios.length} sequence=${sequencePath || "__current__"}`);
      if (sequencePath && baselineSequencePath) {
        suiteRestorePairs.set(sequencePath, { sequencePath, baselineSequencePath });
        const restoreStartedAtMs = nowMs();
        await restoreValidationSequenceFromBaseline({ sequencePath, baselineSequencePath });
        timings.restoreBaselineMs = nowMs() - restoreStartedAtMs;
        activeSequencePath = "";
      }
      if (sequencePath && sequencePath !== activeSequencePath) {
        const openStartedAtMs = nowMs();
        await openSequenceFromDesktop(sequencePath);
        timings.openSequenceMs = nowMs() - openStartedAtMs;
        activeSequencePath = sequencePath;
      }

      const sequenceContextKey = sequencePath || activeSequencePath || "__current__";
      if (scenario?.refreshFirst !== false) {
        const refreshStartedAtMs = nowMs();
        await invokeRendererAutomation("refreshFromXLights", {});
        timings.refreshMs = nowMs() - refreshStartedAtMs;
      }

      const analyzePrompt = str(scenario?.analyzePrompt);
      const analysisContextKey = `${sequenceContextKey}::${analyzePrompt}`;
      if (analyzePrompt && !analyzedContexts.has(analysisContextKey)) {
        const requiredCueTypes = inferRequiredCueTypesFromScenario(scenario);
        const reuse = await canReuseCurrentAnalysis({
          sequencePath: sequenceContextKey === "__current__" ? "" : sequenceContextKey,
          analyzePrompt,
          requiredCueTypes
        });
        if (reuse) {
          timings.analyzeMs = 0;
        } else {
          const analyzeStartedAtMs = nowMs();
          await invokeRendererAutomation("analyzeAudio", { prompt: analyzePrompt });
          timings.analyzeMs = nowMs() - analyzeStartedAtMs;
        }
        analyzedContexts.add(analysisContextKey);
      }

      const seedGenerateStartedAtMs = nowMs();
      const seedGenerateResponse = await invokeRendererAutomation("generateProposal", {
        prompt: str(scenario?.seedPrompt),
        requestedRole: "designer_dialog",
        forceFresh: true,
        clearRevisionTarget: true,
        selectedSections: arr(scenario?.sections),
        selectedTargetIds: arr(scenario?.targets),
        selectedTagNames: arr(scenario?.tagNames)
      });
      timings.seedGenerateMs = nowMs() - seedGenerateStartedAtMs;

      let seedApplyResponse = null;
      if (seedGenerateResponse?.planHandoff || seedGenerateResponse?.hasDraftProposal) {
        const seedApplyStartedAtMs = nowMs();
        seedApplyResponse = await invokeRendererAutomation("applyCurrentProposal", {});
        timings.seedApplyMs = nowMs() - seedApplyStartedAtMs;
      }

      const seedSectionPlan = findMatchingSectionPlan(
        arr(seedGenerateResponse?.intentHandoff?.executionStrategy?.sectionPlans),
        {
          section: str(arr(scenario?.sections)[0]),
          targets: arr(scenario?.targets)
        }
      );
      const revisionTarget = buildRevisionTargetFromSectionPlan(seedSectionPlan);

      let revisedGenerateResponse = null;
      let revisedApplyResponse = null;
      let latestSnapshot = null;
      let practicalValidation = null;
      let assertions = [];

      if (revisionTarget) {
        const revisedGenerateStartedAtMs = nowMs();
        revisedGenerateResponse = await invokeRendererAutomation("generateProposal", {
          prompt: str(scenario?.revisionPrompt),
          requestedRole: "designer_dialog",
          revisionTarget,
          revisionDesignId: revisionTarget.designId,
          revisionDesignRevision: revisionTarget.designRevision,
          revisionPriorDesignRevision: revisionTarget.priorDesignRevision,
          revisionDesignAuthor: revisionTarget.designAuthor,
          revisionSections: arr(revisionTarget.sections),
          revisionTargetIds: arr(revisionTarget.targetIds),
          revisionSummary: revisionTarget.summary,
          revisionDesignLabel: revisionTarget.designLabel,
          revisionRequestedAt: revisionTarget.requestedAt,
          selectedSections: arr(scenario?.sections),
          selectedTargetIds: arr(scenario?.targets),
          selectedTagNames: arr(scenario?.tagNames)
        });
        timings.revisionGenerateMs = nowMs() - revisedGenerateStartedAtMs;

        if (revisedGenerateResponse?.planHandoff || revisedGenerateResponse?.hasDraftProposal) {
          const revisedApplyStartedAtMs = nowMs();
          revisedApplyResponse = await invokeRendererAutomation("applyCurrentProposal", {});
          timings.revisionApplyMs = nowMs() - revisedApplyStartedAtMs;
        }

        latestSnapshot = await invokeRendererAutomation("getSequencerValidationSnapshot", {});
        practicalValidation = extractPracticalValidationArtifact(revisedApplyResponse, latestSnapshot);

        const revisedSectionPlan = findMatchingSectionPlan(
          arr(revisedGenerateResponse?.intentHandoff?.executionStrategy?.sectionPlans),
          {
            section: str(arr(scenario?.sections)[0]),
            targets: arr(scenario?.targets)
          }
        );
        const observedTargets = uniqueStrings([
          ...arr(practicalValidation?.designAlignment?.observedTargets),
          ...arr(scenario?.targets)
        ]);
        const observedEffectNames = extractObservedEffectNamesFromRevisionRun({
          practicalValidation,
          applyResponse: revisedApplyResponse,
          latestSnapshot,
          expectedTargets: arr(scenario?.targets)
        });
        const seedPracticalValidation = extractPracticalValidationArtifact(seedApplyResponse, null);
        const seedObservedEffectNames = uniqueStrings([
          ...arr(seedPracticalValidation?.designAlignment?.observedEffectNames),
          ...arr(seedApplyResponse?.applyOutcome?.applyResult?.verification?.designAlignment?.observedEffectNames),
          ...arr(seedApplyResponse?.latestApply?.verification?.designAlignment?.observedEffectNames)
        ]);
        const matchedSeedEffects = uniqueStrings(arr(scenario?.seedExpectedEffects)).filter((row) => seedObservedEffectNames.includes(row));
        const matchedRevisedEffects = uniqueStrings(arr(scenario?.revisedExpectedEffects)).filter((row) => observedEffectNames.includes(row));
        const forbiddenEffects = uniqueStrings(arr(scenario?.forbiddenEffects));
        const presentForbiddenEffects = forbiddenEffects.filter((row) => observedEffectNames.includes(row));
        const requireSeedEffectRemoved = scenario?.requireSeedEffectRemoved === true;
        const currentConceptRow = arr(latestSnapshot?.pageStates?.design?.data?.executionPlan?.conceptRows)
          .find((row) => str(row?.designId) === str(revisionTarget?.designId)) || null;
        const conceptLabelInfo = parseDesignRevisionLabel(currentConceptRow?.designLabel);
        const supersededRevisionCount = Number(currentConceptRow?.supersededRevisionCount || 0);

        assertions = [
          {
            kind: "practical_validation",
            ok: practicalValidation?.overallOk === true,
            expected: "overallOk=true",
            actual: practicalValidation?.overallOk === true ? "overallOk=true" : "overallOk=false"
          },
          {
            kind: "seed_effect_presence",
            ok: matchedSeedEffects.length > 0,
            expected: uniqueStrings(arr(scenario?.seedExpectedEffects)).join(", "),
            actual: observedEffectNames.join(", ")
          },
          {
            kind: "revision_effect_alignment",
            ok: matchedRevisedEffects.length > 0,
            expected: uniqueStrings(arr(scenario?.revisedExpectedEffects)).join(", "),
            actual: observedEffectNames.join(", ")
          },
          {
            kind: "revision_identity_preserved",
            ok: str(revisedSectionPlan?.designId) === str(revisionTarget?.designId)
              && Number(revisedSectionPlan?.designRevision) === Number(revisionTarget?.designRevision),
            expected: `${str(revisionTarget?.designId)}@${Number(revisionTarget?.designRevision)}`,
            actual: `${str(revisedSectionPlan?.designId)}@${Number(revisedSectionPlan?.designRevision)}`
          },
          {
            kind: "revision_scope_preserved",
            ok: arr(scenario?.targets).every((targetId) => observedTargets.includes(str(targetId))),
            expected: uniqueStrings(arr(scenario?.targets)).join(", "),
            actual: observedTargets.join(", ")
          },
          {
            kind: "revision_dashboard_current",
            ok: str(currentConceptRow?.designId) === str(revisionTarget?.designId)
              && (Number(conceptLabelInfo.designRevision) === Number(revisionTarget?.designRevision) || supersededRevisionCount >= 1),
            expected: `${str(revisionTarget?.designId)} current revision ${Number(revisionTarget?.designRevision)}`,
            actual: `${str(currentConceptRow?.designId)} ${str(currentConceptRow?.designLabel)} superseded=${supersededRevisionCount}`
          },
          {
            kind: "forbidden_effects",
            ok: presentForbiddenEffects.length === 0,
            expected: "none",
            actual: presentForbiddenEffects.join(", ")
          }
        ];

        if (requireSeedEffectRemoved) {
          const stillPresentSeedEffects = uniqueStrings(arr(scenario?.seedExpectedEffects)).filter((row) => observedEffectNames.includes(row));
          assertions.push({
            kind: "seed_effect_removed",
            ok: stillPresentSeedEffects.length === 0,
            expected: "none",
            actual: stillPresentSeedEffects.join(", ")
          });
        }
      } else {
        assertions = [
          {
            kind: "revision_target_resolution",
            ok: false,
            expected: "seed section plan resolved",
            actual: "no matching seed section plan"
          }
        ];
      }

      const scenarioResult = {
        name,
        seedGenerateResponse,
        seedApplyResponse,
        generateResponse: revisedGenerateResponse,
        applyResponse: revisedApplyResponse,
        practicalValidation: practicalValidation
          ? {
              overallOk: practicalValidation?.overallOk === true,
              failures: {
                readback: arr(practicalValidation?.failures?.readback),
                design: arr(practicalValidation?.failures?.design)
              }
            }
          : null,
        revisionTarget,
        assertions
      };
      results.push(scenarioResult);
      logStartup(`automation:live-revision-suite:scenario:finish name=${name} ok=${assertions.every((row) => row?.ok !== false) ? "true" : "false"} totalMs=${nowMs() - scenarioStartedAtMs}`);
    }
    } finally {
      await restoreSuiteSequencesToBaseline([...suiteRestorePairs.values()]);
    }

    const failed = results.filter((row) => arr(row?.assertions).some((assertion) => assertion?.ok === false));
    const gapReport = buildSequencerGapReport({
      suiteName: str(expected?.name || "live_revision_practical_sequence_validation_suite"),
      suiteContract: "live_revision_practical_sequence_validation_suite_v1",
      scenarioCount: results.length,
      results
    });
    return {
      contract: "live_revision_practical_sequence_validation_suite_run_v1",
      version: "1.0",
      ok: failed.length === 0,
      summary: failed.length === 0
        ? `Live revision suite passed ${results.length}/${results.length} scenarios.`
        : `Live revision suite passed ${results.length - failed.length}/${results.length} scenarios.`,
      timings: {
        totalMs: nowMs() - suiteStartedAtMs
      },
      scenarioCount: results.length,
      failedScenarioCount: failed.length,
      failedScenarioNames: failed.map((row) => row.name),
      results,
      gapReport
    };
  }

  function extractObservedTargetsForSectionSuite({ practicalValidation = null, applyResponse = null } = {}) {
    const fromPractical = arr(practicalValidation?.designAlignment?.observedTargets);
    const fromApplyPractical = arr(applyResponse?.applyOutcome?.applyResult?.practicalValidation?.designAlignment?.observedTargets);
    const fromLatestApply = arr(applyResponse?.latestApply?.verification?.designAlignment?.observedTargets);
    const fromChecks = arr(applyResponse?.latestApply?.verification?.checks)
      .map((row) => {
        const target = str(row?.target);
        return target.includes("@") ? target.split("@")[0] : target;
      })
      .filter(Boolean);
    return uniqueStrings([
      ...fromPractical,
      ...fromApplyPractical,
      ...fromLatestApply,
      ...fromChecks
    ]);
  }

  function evaluateSectionScenarioAssertions({
    scenario = {},
    practicalValidation = null,
    generateResponse = null,
    observedEffectNames = [],
    matchedExpectedEffects = [],
    observedTargets = []
  } = {}) {
    const assertions = [];
    const designAlignment = practicalValidation?.designAlignment && typeof practicalValidation.designAlignment === "object"
      ? practicalValidation.designAlignment
      : {};
    const sequencingDesignHandoff = generateResponse?.intentHandoff?.sequencingDesignHandoff || null;
    const executionStrategy = generateResponse?.intentHandoff?.executionStrategy || {};
    const sectionPlans = arr(executionStrategy?.sectionPlans);
    const derivedPrimaryFocusTargets = uniqueStrings([
      ...arr(designAlignment?.primaryFocusTargetIds),
      ...arr(sequencingDesignHandoff?.focusPlan?.primaryTargets),
      ...arr(scenario?.targets)
    ]);
    const relevantSectionNames = new Set(arr(scenario?.sections).map((row) => str(row)).filter(Boolean));
    const derivedPreferredEffectHints = uniqueStrings([
      ...arr(designAlignment?.preferredEffectHints),
      ...arr(executionStrategy?.sectionPlans)
        .filter((row) => {
          const section = str(row?.section);
          return !relevantSectionNames.size || relevantSectionNames.has(section);
        })
        .flatMap((row) => arr(row?.effectHints)),
      ...(scenario?.requirePreferredEffectAlignment === true ? arr(scenario?.expectedEffects) : [])
    ]);
    const requiredTargets = uniqueStrings(arr(scenario?.requiredObservedTargets).length
      ? arr(scenario.requiredObservedTargets)
      : arr(scenario?.targets));
    const forbiddenEffects = uniqueStrings(arr(scenario?.forbiddenEffects));
    const requiredFocusTargets = uniqueStrings(arr(scenario?.requiredFocusTargets).length
      ? arr(scenario.requiredFocusTargets)
      : derivedPrimaryFocusTargets);
    const requireFocusCoverage = scenario?.requireFocusCoverage !== false;
    const requirePreferredEffectAlignment = scenario?.requirePreferredEffectAlignment === true;
    const sectionExpectedEffects = scenario?.sectionExpectedEffects && typeof scenario.sectionExpectedEffects === "object"
      ? scenario.sectionExpectedEffects
      : {};
    const sectionForbiddenEffects = scenario?.sectionForbiddenEffects && typeof scenario.sectionForbiddenEffects === "object"
      ? scenario.sectionForbiddenEffects
      : {};
    const requireDistinctPrimarySectionEffects = scenario?.requireDistinctPrimarySectionEffects === true;
    const minimumMatchedEffects = Number.isFinite(Number(scenario?.minimumMatchedEffects))
      ? Math.max(0, Number(scenario.minimumMatchedEffects))
      : (arr(scenario?.expectedEffects).length ? 1 : 0);
    const requirePracticalValidation = scenario?.requirePracticalValidation !== false;

    if (requirePracticalValidation) {
      assertions.push({
        kind: "practical_validation",
        ok: practicalValidation?.overallOk === true,
        expected: "overallOk=true",
        actual: practicalValidation?.overallOk === true ? "overallOk=true" : "overallOk=false"
      });
    }

    if (minimumMatchedEffects > 0) {
      assertions.push({
        kind: "effect_match_count",
        ok: matchedExpectedEffects.length >= minimumMatchedEffects,
        expected: `>=${minimumMatchedEffects}`,
        actual: String(matchedExpectedEffects.length)
      });
    }

    if (requiredTargets.length) {
      const missingTargets = requiredTargets.filter((row) => !observedTargets.includes(row));
      assertions.push({
        kind: "required_targets",
        ok: missingTargets.length === 0,
        expected: requiredTargets.join(", "),
        actual: observedTargets.join(", "),
        missingTargets
      });
    }

    if (requireFocusCoverage && requiredFocusTargets.length) {
      const coveredPrimaryFocusTargetIds = uniqueStrings([
        ...arr(designAlignment?.coveredPrimaryFocusTargetIds),
        ...observedTargets.filter((row) => requiredFocusTargets.includes(row))
      ]);
      const missingFocusTargets = requiredFocusTargets.filter((row) => !coveredPrimaryFocusTargetIds.includes(row));
      assertions.push({
        kind: "focus_coverage",
        ok: missingFocusTargets.length === 0,
        expected: requiredFocusTargets.join(", "),
        actual: coveredPrimaryFocusTargetIds.join(", "),
        missingFocusTargets
      });
    }

    if (requirePreferredEffectAlignment) {
      const matchedPreferredEffects = derivedPreferredEffectHints.filter((row) => observedEffectNames.includes(row));
      assertions.push({
        kind: "preferred_effect_alignment",
        ok: matchedPreferredEffects.length > 0,
        expected: derivedPreferredEffectHints.join(", "),
        actual: matchedPreferredEffects.join(", "),
        matchedPreferredEffects
      });
    }

    if (forbiddenEffects.length) {
      const presentForbiddenEffects = forbiddenEffects.filter((row) => observedEffectNames.includes(row));
      assertions.push({
        kind: "forbidden_effects",
        ok: presentForbiddenEffects.length === 0,
        expected: "none",
        actual: presentForbiddenEffects.join(", "),
        presentForbiddenEffects
      });
    }

    for (const [sectionName, expectedEffectsForSectionRaw] of Object.entries(sectionExpectedEffects)) {
      const expectedEffectsForSection = uniqueStrings(arr(expectedEffectsForSectionRaw));
      if (!expectedEffectsForSection.length) continue;
      const matchingPlan = sectionPlans.find((row) => str(row?.section) === str(sectionName));
      const sectionHints = uniqueStrings(arr(matchingPlan?.effectHints));
      const matchedSectionEffects = expectedEffectsForSection.filter((row) => sectionHints.includes(row));
      assertions.push({
        kind: "section_effect_alignment",
        section: str(sectionName),
        ok: matchedSectionEffects.length > 0,
        expected: expectedEffectsForSection.join(", "),
        actual: sectionHints.join(", "),
        matchedSectionEffects
      });
    }

    for (const [sectionName, forbiddenEffectsForSectionRaw] of Object.entries(sectionForbiddenEffects)) {
      const forbiddenEffectsForSection = uniqueStrings(arr(forbiddenEffectsForSectionRaw));
      if (!forbiddenEffectsForSection.length) continue;
      const matchingPlan = sectionPlans.find((row) => str(row?.section) === str(sectionName));
      const sectionHints = uniqueStrings(arr(matchingPlan?.effectHints));
      const presentSectionForbiddenEffects = forbiddenEffectsForSection.filter((row) => sectionHints.includes(row));
      assertions.push({
        kind: "section_forbidden_effects",
        section: str(sectionName),
        ok: presentSectionForbiddenEffects.length === 0,
        expected: "none",
        actual: presentSectionForbiddenEffects.join(", "),
        presentForbiddenEffects: presentSectionForbiddenEffects
      });
    }

    if (requireDistinctPrimarySectionEffects) {
      const relevantSectionNamesOrdered = arr(scenario?.sections).map((row) => str(row)).filter(Boolean);
      const primaryEffects = relevantSectionNamesOrdered
        .map((sectionName) => {
          const matchingPlan = sectionPlans.find((row) => str(row?.section) === sectionName);
          return {
            sectionName,
            effectName: str(arr(matchingPlan?.effectHints)[0])
          };
        })
        .filter((row) => row.sectionName && row.effectName);
      const distinctCount = new Set(primaryEffects.map((row) => row.effectName)).size;
      assertions.push({
        kind: "section_effect_contrast",
        ok: primaryEffects.length >= 2 ? distinctCount === primaryEffects.length : true,
        expected: "distinct primary effects per scoped section",
        actual: primaryEffects.map((row) => `${row.sectionName}:${row.effectName}`).join(", "),
        distinctCount
      });
    }

    return assertions;
  }

  async function runLiveSectionPracticalSequenceValidationSuiteFromDesktop(expected = {}) {
    const suiteStartedAtMs = nowMs();
    const scenarios = arr(expected?.scenarios).filter((row) => row && typeof row === "object");
    if (!scenarios.length) {
      throw new Error("Live section practical sequence validation suite requires at least one scenario.");
    }
    const suiteBaselineSequencePath = str(expected?.baselineSequencePath);
    const results = [];
    let activeSequencePath = "";
    const refreshedSequences = new Set();
    const analyzedContexts = new Set();
    const suiteRestorePairs = new Map();

    try {
    for (const scenario of scenarios) {
      const scenarioStartedAtMs = nowMs();
      const name = str(scenario?.name || `scenario-${results.length + 1}`);
      const sequencePath = str(scenario?.sequencePath);
      const baselineSequencePath = str(scenario?.baselineSequencePath || suiteBaselineSequencePath);
      const timings = {};
      logStartup(`automation:live-sequencer-suite:scenario:start name=${name} index=${results.length + 1}/${scenarios.length} sequence=${sequencePath || "__current__"}`);
      if (sequencePath && baselineSequencePath) {
        suiteRestorePairs.set(sequencePath, { sequencePath, baselineSequencePath });
        const restoreStartedAtMs = nowMs();
        await restoreValidationSequenceFromBaseline({ sequencePath, baselineSequencePath });
        timings.restoreBaselineMs = nowMs() - restoreStartedAtMs;
        activeSequencePath = "";
        refreshedSequences.delete(sequencePath);
      }
      if (sequencePath && sequencePath !== activeSequencePath) {
        const openStartedAtMs = nowMs();
        await openSequenceFromDesktop(sequencePath);
        timings.openSequenceMs = nowMs() - openStartedAtMs;
        activeSequencePath = sequencePath;
      }
      const sequenceContextKey = sequencePath || activeSequencePath || "__current__";
      if (scenario?.refreshFirst !== false) {
        const refreshStartedAtMs = nowMs();
        await invokeRendererAutomation("refreshFromXLights", {});
        timings.refreshMs = nowMs() - refreshStartedAtMs;
        refreshedSequences.add(sequenceContextKey);
      }
      const analyzePrompt = str(scenario?.analyzePrompt);
      const analysisContextKey = `${sequenceContextKey}::${analyzePrompt}`;
      if (analyzePrompt && !analyzedContexts.has(analysisContextKey)) {
        const requiredCueTypes = inferRequiredCueTypesFromScenario(scenario);
        const reuse = await canReuseCurrentAnalysis({
          sequencePath: sequenceContextKey === "__current__" ? "" : sequenceContextKey,
          analyzePrompt,
          requiredCueTypes
        });
        if (reuse) {
          timings.analyzeMs = 0;
        } else {
          const analyzeStartedAtMs = nowMs();
          await invokeRendererAutomation("analyzeAudio", { prompt: analyzePrompt });
          timings.analyzeMs = nowMs() - analyzeStartedAtMs;
        }
        analyzedContexts.add(analysisContextKey);
      }

      const generateStartedAtMs = nowMs();
      const generateResponse = await invokeRendererAutomation("generateProposal", {
        prompt: str(scenario?.prompt || scenario?.strongPrompt),
        requestedRole: "designer_dialog",
        forceFresh: true,
        selectedSections: arr(scenario?.sections),
        selectedTargetIds: arr(scenario?.targets),
        selectedTagNames: arr(scenario?.tagNames)
      });
      timings.generateMs = nowMs() - generateStartedAtMs;

      let applyResponse = null;
      if (generateResponse?.planHandoff || generateResponse?.hasDraftProposal) {
        const applyStartedAtMs = nowMs();
        applyResponse = await invokeRendererAutomation("applyCurrentProposal", {});
        timings.applyMs = nowMs() - applyStartedAtMs;
      } else {
        timings.applyMs = 0;
      }

      const snapshot = await invokeRendererAutomation("getSequencerValidationSnapshot", {});
      const practicalValidation = snapshot?.latestPracticalValidation
        || applyResponse?.latestPracticalValidation
        || applyResponse?.applyOutcome?.applyResult?.practicalValidation
        || null;
      const observedEffectNames = uniqueStrings([
        ...arr(practicalValidation?.designAlignment?.observedEffectNames),
        ...arr(applyResponse?.applyOutcome?.applyResult?.practicalValidation?.designAlignment?.observedEffectNames),
        ...arr(applyResponse?.latestApply?.verification?.designAlignment?.observedEffectNames)
      ]).map((row) => str(row)).filter(Boolean);
      const observedTargets = extractObservedTargetsForSectionSuite({ practicalValidation, applyResponse });
      const expectedEffects = arr(scenario?.expectedEffects).map((row) => str(row)).filter(Boolean);
      const matchedExpectedEffects = expectedEffects.filter((row) => observedEffectNames.includes(row));
      const assertions = evaluateSectionScenarioAssertions({
        scenario,
        practicalValidation,
        generateResponse,
        observedEffectNames,
        matchedExpectedEffects,
        observedTargets
      });
      const ok = assertions.every((row) => row?.ok === true);

      results.push({
        name,
        sequencePath,
        timings: {
          totalMs: nowMs() - scenarioStartedAtMs,
          restoreBaselineMs: Number(timings.restoreBaselineMs || 0),
          openSequenceMs: Number(timings.openSequenceMs || 0),
          refreshMs: Number(timings.refreshMs || 0),
          analyzeMs: Number(timings.analyzeMs || 0),
          generateMs: Number(timings.generateMs || 0),
          applyMs: Number(timings.applyMs || 0)
        },
        ok,
        expectedEffects,
        observedEffectNames,
        observedTargets,
        matchedExpectedEffects,
        assertions,
        practicalValidation,
        generateResponse,
        applyResponse
      });
      logStartup(`automation:live-sequencer-suite:scenario:finish name=${name} ok=${ok ? "true" : "false"} totalMs=${nowMs() - scenarioStartedAtMs}`);
    }
    } finally {
      await restoreSuiteSequencesToBaseline([...suiteRestorePairs.values()]);
    }

    const failed = results.filter((row) => row?.ok !== true);
    const gapReport = buildSequencerGapReport({
      suiteName: str(expected?.name || "live_section_practical_sequence_validation_suite"),
      suiteContract: "live_section_practical_sequence_validation_suite_run_v1",
      scenarioCount: results.length,
      results
    });
    return {
      contract: "live_section_practical_sequence_validation_suite_run_v1",
      version: "1.0",
      ok: failed.length === 0,
      summary: failed.length === 0
        ? `Live section practical sequence suite passed ${results.length}/${results.length} scenarios.`
        : `Live section practical sequence suite passed ${results.length - failed.length}/${results.length} scenarios.`,
      timings: {
        totalMs: nowMs() - suiteStartedAtMs
      },
      scenarioCount: results.length,
      failedScenarioCount: failed.length,
      failedScenarioNames: failed.map((row) => row.name),
      results,
      gapReport
    };
  }

  async function runLiveWholeSequencePracticalValidationSuiteFromDesktop(expected = {}) {
    const suiteStartedAtMs = nowMs();
    const scenarios = arr(expected?.scenarios).filter((row) => row && typeof row === "object");
    if (!scenarios.length) {
      throw new Error("Live whole-sequence practical validation suite requires at least one scenario.");
    }
    const suiteBaselineSequencePath = str(expected?.baselineSequencePath);
    const results = [];
    let activeSequencePath = "";
    const refreshedSequences = new Set();
    const analyzedContexts = new Set();
    const suiteRestorePairs = new Map();

    try {
    for (const scenario of scenarios) {
      const scenarioStartedAtMs = nowMs();
      const name = str(scenario?.name || `scenario-${results.length + 1}`);
      const sequencePath = str(scenario?.sequencePath);
      const baselineSequencePath = str(scenario?.baselineSequencePath || suiteBaselineSequencePath);
      const timings = {};
      logStartup(`automation:live-wholesequence-suite:scenario:start name=${name} index=${results.length + 1}/${scenarios.length} sequence=${sequencePath || "__current__"}`);
      if (sequencePath && baselineSequencePath) {
        suiteRestorePairs.set(sequencePath, { sequencePath, baselineSequencePath });
        const restoreStartedAtMs = nowMs();
        await restoreValidationSequenceFromBaseline({ sequencePath, baselineSequencePath });
        timings.restoreBaselineMs = nowMs() - restoreStartedAtMs;
        activeSequencePath = "";
        refreshedSequences.delete(sequencePath);
      }
      if (sequencePath && sequencePath !== activeSequencePath) {
        const openStartedAtMs = nowMs();
        await openSequenceFromDesktop(sequencePath);
        timings.openSequenceMs = nowMs() - openStartedAtMs;
        activeSequencePath = sequencePath;
      }

      const sequenceContextKey = sequencePath || activeSequencePath || "__current__";
      if (!refreshedSequences.has(sequenceContextKey) && scenario?.refreshFirst !== false) {
        const refreshStartedAtMs = nowMs();
        await invokeRendererAutomation("refreshFromXLights", {});
        timings.refreshMs = nowMs() - refreshStartedAtMs;
        refreshedSequences.add(sequenceContextKey);
      }

      const audioPathOverride = str(scenario?.audioPathOverride);
      if (audioPathOverride) {
        const setAudioStartedAtMs = nowMs();
        await invokeRendererAutomation("setAudioPath", {
          audioPath: audioPathOverride
        });
        timings.setAudioMs = nowMs() - setAudioStartedAtMs;
      }

      const analyzePrompt = str(scenario?.analyzePrompt);
      const analysisContextKey = `${sequenceContextKey}::${analyzePrompt}`;
      if (analyzePrompt && !analyzedContexts.has(analysisContextKey)) {
        const requiredCueTypes = inferRequiredCueTypesFromScenario(scenario);
        const reuse = await canReuseCurrentAnalysis({
          sequencePath: sequenceContextKey === "__current__" ? "" : sequenceContextKey,
          analyzePrompt,
          requiredCueTypes
        });
        if (reuse) {
          timings.analyzeMs = 0;
        } else {
          const analyzeStartedAtMs = nowMs();
          const analyzePayload = {
            prompt: analyzePrompt
          };
          if (scenario?.analysisProfile && typeof scenario.analysisProfile === "object") {
            analyzePayload.analysisProfile = scenario.analysisProfile;
          }
          if (scenario?.forceFreshAnalysis === true) {
            analyzePayload.forceFresh = true;
          }
          await invokeRendererAutomation("analyzeAudio", analyzePayload);
          timings.analyzeMs = nowMs() - analyzeStartedAtMs;
        }
        analyzedContexts.add(analysisContextKey);
      }

      if (scenario?.seedTimingTracksFromAnalysis === true) {
        const seedTimingStartedAtMs = nowMs();
        await invokeRendererAutomation("seedTimingTracksFromAnalysis", {});
        timings.seedTimingTracksMs = nowMs() - seedTimingStartedAtMs;
      }

      const generateStartedAtMs = nowMs();
      const generateResponse = await invokeRendererAutomation("generateProposal", {
        prompt: str(scenario?.prompt || scenario?.strongPrompt),
        requestedRole: str(scenario?.requestedRole || expected?.requestedRole || "designer_dialog"),
        forceFresh: true,
        clearRevisionTarget: true,
        selectedSections: arr(scenario?.sections),
        selectedTargetIds: arr(scenario?.targets),
        selectedTagNames: arr(scenario?.tagNames)
      });
      timings.generateMs = nowMs() - generateStartedAtMs;

      let applyResponse = null;
      if (generateResponse?.planHandoff || generateResponse?.hasDraftProposal) {
        const applyStartedAtMs = nowMs();
        applyResponse = await invokeRendererAutomation("applyCurrentProposal", {});
        timings.applyMs = nowMs() - applyStartedAtMs;
      } else {
        timings.applyMs = 0;
      }

      const validationStartedAtMs = nowMs();
      const validationRun = await runWholeSequenceApplyValidationFromDesktop({
        sequenceName: scenario?.sequenceName,
        minConceptCount: Number(scenario?.minConceptCount || 8),
        minPlacementCount: Number(scenario?.minPlacementCount || 200)
      });
      timings.validationMs = nowMs() - validationStartedAtMs;
      const validation = validationRun?.validation || null;
      const snapshot = await invokeRendererAutomation("getSequencerValidationSnapshot", {});
      const practicalValidation = snapshot?.latestPracticalValidation
        || applyResponse?.latestPracticalValidation
        || applyResponse?.applyOutcome?.applyResult?.practicalValidation
        || null;
      const observedTargets = uniqueStrings([
        ...arr(practicalValidation?.designAlignment?.observedTargets),
        ...arr(snapshot?.pageStates?.sequence?.data?.rows).map((row) => row?.target)
      ]);
      const observedEffectNames = uniqueStrings([
        ...arr(practicalValidation?.designAlignment?.observedEffectNames),
        ...arr(applyResponse?.applyOutcome?.applyResult?.practicalValidation?.designAlignment?.observedEffectNames),
        ...arr(applyResponse?.latestApply?.verification?.designAlignment?.observedEffectNames)
      ]);

      const assertions = [
        {
          kind: "practical_validation",
          ok: practicalValidation?.overallOk === true,
          expected: "overallOk=true",
          actual: practicalValidation?.overallOk === true ? "overallOk=true" : "overallOk=false"
        },
        {
          kind: "whole_sequence_apply_validation",
          ok: validation?.ok === true,
          expected: "whole_sequence_apply_validation ok",
          actual: validation?.ok === true ? "ok" : arr(validation?.issues).map((row) => str(row?.code)).filter(Boolean).join(", ")
        }
      ];
      const ok = assertions.every((row) => row?.ok === true);

      results.push({
        name,
        sequencePath,
        timings: {
          totalMs: nowMs() - scenarioStartedAtMs,
          restoreBaselineMs: Number(timings.restoreBaselineMs || 0),
          openSequenceMs: Number(timings.openSequenceMs || 0),
          refreshMs: Number(timings.refreshMs || 0),
          setAudioMs: Number(timings.setAudioMs || 0),
          analyzeMs: Number(timings.analyzeMs || 0),
          seedTimingTracksMs: Number(timings.seedTimingTracksMs || 0),
          generateMs: Number(timings.generateMs || 0),
          applyMs: Number(timings.applyMs || 0),
          validationMs: Number(timings.validationMs || 0)
        },
        ok,
        assertions,
        practicalValidation,
        wholeSequenceApplyValidation: validationRun,
        observedTargets,
        observedEffectNames,
        generateResponse,
        applyResponse
      });
      logStartup(`automation:live-wholesequence-suite:scenario:finish name=${name} ok=${ok ? "true" : "false"} totalMs=${nowMs() - scenarioStartedAtMs}`);
    }
    } finally {
      await restoreSuiteSequencesToBaseline([...suiteRestorePairs.values()]);
    }

    const failed = results.filter((row) => row?.ok !== true);
    const gapReport = buildSequencerGapReport({
      suiteName: str(expected?.name || "live_wholesequence_practical_validation_suite"),
      suiteContract: "live_wholesequence_practical_validation_suite_run_v1",
      scenarioCount: results.length,
      results
    });
    return {
      contract: "live_wholesequence_practical_validation_suite_run_v1",
      version: "1.0",
      ok: failed.length === 0,
      summary: failed.length === 0
        ? `Live whole-sequence practical suite passed ${results.length}/${results.length} scenarios.`
        : `Live whole-sequence practical suite passed ${results.length - failed.length}/${results.length} scenarios.`,
      timings: {
        totalMs: nowMs() - suiteStartedAtMs
      },
      scenarioCount: results.length,
      failedScenarioCount: failed.length,
      failedScenarioNames: failed.map((row) => row.name),
      results,
      gapReport
    };
  }

  async function runLiveDesignCanarySuiteFromDesktop(expected = {}) {
    const suiteStartedAtMs = nowMs();
    const scenarios = arr(expected?.scenarios).filter((row) => row && typeof row === "object");
    if (!scenarios.length) {
      throw new Error("Live design canary suite requires at least one scenario.");
    }
    const suiteBaselineSequencePath = str(expected?.baselineSequencePath);
    const results = [];
    let activeSequencePath = "";
    const refreshedSequences = new Set();
    const analyzedContexts = new Set();
    const suiteRestorePairs = new Map();
    try {
    for (const scenario of scenarios) {
      const name = str(scenario?.name || `scenario-${results.length + 1}`);
      const sequencePath = str(scenario?.sequencePath);
      const baselineSequencePath = str(scenario?.baselineSequencePath || suiteBaselineSequencePath);
      const scenarioStartedAtMs = nowMs();
      const timings = {};
      logStartup(`automation:canary-suite:scenario:start name=${name} index=${results.length + 1}/${scenarios.length} sequence=${sequencePath || "__current__"}`);

      if (sequencePath && baselineSequencePath) {
        suiteRestorePairs.set(sequencePath, { sequencePath, baselineSequencePath });
        const restoreStartedAtMs = nowMs();
        await restoreValidationSequenceFromBaseline({ sequencePath, baselineSequencePath });
        timings.restoreBaselineMs = nowMs() - restoreStartedAtMs;
        activeSequencePath = "";
        refreshedSequences.delete(sequencePath);
      }
      if (sequencePath && sequencePath !== activeSequencePath) {
        const openStartedAtMs = nowMs();
        await openSequenceFromDesktop(sequencePath);
        timings.openSequenceMs = nowMs() - openStartedAtMs;
        activeSequencePath = sequencePath;
      }

      const sequenceContextKey = sequencePath || activeSequencePath || "__current__";
      if (!refreshedSequences.has(sequenceContextKey) && scenario?.refreshFirst !== false) {
        const refreshStartedAtMs = nowMs();
        await invokeRendererAutomation("refreshFromXLights", {});
        timings.refreshMs = nowMs() - refreshStartedAtMs;
        refreshedSequences.add(sequenceContextKey);
      }

      const analyzePrompt = str(scenario?.analyzePrompt);
      const analysisContextKey = `${sequenceContextKey}::${analyzePrompt}`;
      if (analyzePrompt && !analyzedContexts.has(analysisContextKey)) {
        const requiredCueTypes = inferRequiredCueTypesFromScenario(scenario);
        const reuse = await canReuseCurrentAnalysis({
          sequencePath: sequenceContextKey === "__current__" ? "" : sequenceContextKey,
          analyzePrompt,
          requiredCueTypes
        });
        if (reuse) {
          timings.analyzeMs = 0;
        } else {
          const analyzeStartedAtMs = nowMs();
          await invokeRendererAutomation("analyzeAudio", { prompt: analyzePrompt });
          timings.analyzeMs = nowMs() - analyzeStartedAtMs;
        }
        analyzedContexts.add(analysisContextKey);
      }

      const run = await runLiveDesignCanaryValidationFromDesktop({
        ...scenario,
        refreshFirst: false,
        analyzePrompt: "",
        sequencePath: "",
        __timings: timings
      });

      results.push({
        name,
        sequencePath,
        timings: {
          totalMs: nowMs() - scenarioStartedAtMs,
          openSequenceMs: Number(timings.openSequenceMs || run?.timings?.openSequenceMs || 0),
          refreshMs: Number(timings.refreshMs || run?.timings?.refreshMs || 0),
          analyzeMs: Number(timings.analyzeMs || run?.timings?.analyzeMs || 0),
          generateMs: Number(run?.timings?.generateMs || 0)
        },
        validation: run?.validation || null
      });
      logStartup(`automation:canary-suite:scenario:finish name=${name} ok=${run?.validation?.ok === true ? "true" : "false"} totalMs=${nowMs() - scenarioStartedAtMs}`);
    }
    } finally {
      await restoreSuiteSequencesToBaseline([...suiteRestorePairs.values()]);
    }

    const failed = results.filter((row) => row?.validation?.ok !== true);
    return {
      contract: "live_design_canary_suite_run_v1",
      version: "1.0",
      ok: failed.length === 0,
      summary: failed.length === 0
        ? `Live canary suite passed ${results.length}/${results.length} scenarios.`
        : `Live canary suite passed ${results.length - failed.length}/${results.length} scenarios.`,
      timings: {
        totalMs: nowMs() - suiteStartedAtMs
      },
      scenarioCount: results.length,
      failedScenarioCount: failed.length,
      failedScenarioNames: failed.map((row) => row.name),
      results
    };
  }

  return {
    buildSequencerGapReport,
    openSequenceFromDesktop,
    restoreValidationSequenceFromBaseline,
    runLiveDesignCanaryValidationFromDesktop,
    runLiveDesignValidationSuiteFromDesktop,
    runLiveRevisionPracticalSequenceValidationSuiteFromDesktop,
    runLiveSectionPracticalSequenceValidationSuiteFromDesktop,
    runLiveWholeSequencePracticalValidationSuiteFromDesktop,
    runLiveDesignCanarySuiteFromDesktop
  };
}
