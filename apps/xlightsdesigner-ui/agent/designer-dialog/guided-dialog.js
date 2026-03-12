function normalizeQuestion(question = {}) {
  return {
    field: String(question.field || "").trim(),
    question: String(question.question || "").trim(),
    options: Array.isArray(question.options) ? question.options.map((row) => String(row || "").trim()).filter(Boolean) : [],
    recommended: String(question.recommended || "").trim()
  };
}

function dedupeLines(lines = []) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const value = String(line || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function buildClarificationPlan({
  normalizedIntent,
  targets = [],
  analysisHandoff = null,
  directorPreferences = null
} = {}) {
  const questions = [];
  const assumptions = Array.isArray(normalizedIntent?.assumptions) ? [...normalizedIntent.assumptions] : [];
  const intent = normalizedIntent || {};
  const hasSections = Array.isArray(intent.sections) && intent.sections.length > 0;
  const hasTargets = Array.isArray(intent.targetIds) && intent.targetIds.length > 0;
  const hasTags = Array.isArray(intent.tags) && intent.tags.length > 0;
  const hasResolvedTargets = Array.isArray(targets) && targets.length > 0;
  const hasAnalysisSections = Array.isArray(analysisHandoff?.structure?.sections) && analysisHandoff.structure.sections.length > 0;

  if (!String(intent.goal || "").trim()) {
    questions.push(normalizeQuestion({
      field: "goal",
      question: "What is the primary goal for this pass?",
      options: ["Increase energy", "Improve clarity", "Build emotion"],
      recommended: "Improve clarity"
    }));
  }

  if (!hasSections && !hasAnalysisSections) {
    questions.push(normalizeQuestion({
      field: "sections",
      question: "Which section should lead this pass?",
      options: ["Intro", "Chorus", "Full song"],
      recommended: "Chorus"
    }));
  }

  if (!hasTargets && !hasTags && !hasResolvedTargets && String(intent.focusHierarchy || "") !== "balanced_full_yard") {
    questions.push(normalizeQuestion({
      field: "focusHierarchy",
      question: "Should I prioritize focal props first or keep this a balanced full-yard pass?",
      options: ["Balanced full-yard", "Focal props first", "Supporting props first"],
      recommended: "Balanced full-yard"
    }));
  }

  if (directorPreferences && typeof directorPreferences === "object") {
    if (String(directorPreferences.motionPreference || "").trim()) {
      assumptions.push(`Bias motion choices toward the director's ${String(directorPreferences.motionPreference).trim()} preference.`);
    }
    if (String(directorPreferences.focusPreference || "").trim()) {
      assumptions.push(`Favor the director's ${String(directorPreferences.focusPreference).trim()} focus preference where it does not conflict with scope.`);
    }
  }
  if (!questions.length && !hasTargets && !hasTags && !hasResolvedTargets) {
    assumptions.push("Proceed with a balanced full-yard pass and add focal overrides only where the music clearly suggests them.");
  }
  if (String(intent.fieldSources?.styleDirection || "") === "inferred" && String(intent.styleDirection || "").trim()) {
    assumptions.push(`Use the inferred ${intent.styleDirection} style direction for the first proposal pass.`);
  }
  if (String(intent.fieldSources?.colorDirection || "") === "inferred" && String(intent.colorDirection || "").trim()) {
    assumptions.push(`Use the inferred ${intent.colorDirection} color direction unless the director overrides it.`);
  }
  if (String(intent.fieldSources?.changeTolerance || "") === "inferred" && String(intent.changeTolerance || "").trim()) {
    assumptions.push(`Keep the first pass within ${intent.changeTolerance} change tolerance.`);
  }

  return {
    questions: questions.slice(0, 3),
    assumptions: dedupeLines(assumptions).slice(0, 6)
  };
}

export function buildGuidedQuestions(input = {}) {
  const plan = buildClarificationPlan(input);
  return plan.questions.map((row) => row.question);
}
