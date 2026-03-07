export function buildGuidedQuestions({ normalizedIntent, targets = [] } = {}) {
  const questions = [];
  const intent = normalizedIntent || {};

  if (!String(intent.goal || "").trim()) {
    questions.push("What is the primary goal for this pass (energy, clarity, emotion, or story)?");
  }
  if (!Array.isArray(intent.sections) || !intent.sections.length) {
    questions.push("Which section should lead this pass (intro, verse, chorus, bridge, outro, or full song)?");
  }
  if (!targets.length) {
    questions.push("Should I prioritize focal props first or apply a balanced full-yard pass?");
  }

  return questions.slice(0, 3);
}
