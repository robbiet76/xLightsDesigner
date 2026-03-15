export function sanitizeDesignerAssistantMessage(text = "") {
  let next = String(text || "").trim();
  if (!next) return "";

  const reviewableProposalLine = "If that direction feels right, I can turn it into a reviewable design proposal next.";

  const replacements = [
    [/\bWould you like me to automatically add[^?]*\?/gi, reviewableProposalLine],
    [/\bWould you like me to produce[^?]*\?/gi, reviewableProposalLine],
    [/\bWould you like me to implement[^?]*\?/gi, reviewableProposalLine],
    [/\bWould you like me to apply[^?]*\?/gi, reviewableProposalLine],
    [/\bShould I proceed to apply[^?]*\?/gi, reviewableProposalLine],
    [/\bWould you like me to create[^?]*\?/gi, reviewableProposalLine],
    [/\bOr should we first identify[^?]*\?/gi, ""],
    [/\bIf yes, I can update[^.?!]*(?:\.|$)/gi, reviewableProposalLine],
    [/\bI can update[^.?!]*sequence(?:\.|$)/gi, reviewableProposalLine],
    [/\bStarting this adjustment[^.?!]*(?:\.|$)/gi, "I’ve captured that direction for the next design pass."],
    [/\bNext, I(?:'|’)?ll:\s*/gi, "The next design pass should:\n"],
    [/\bI(?:'|’)?ll proceed now to:\s*/gi, "The next design pass should:\n"],
    [/\bI(?:'|’)?ll set\b/gi, "The design should keep"],
    [/\bI(?:'|’)?ll simplify\b/gi, "The design should simplify"],
    [/\bI(?:'|’)?ll reduce\b/gi, "The design should reduce"],
    [/\bI(?:'|’)?ll tighten\b/gi, "The design should tighten"],
    [/\bI(?:'|’)?ll enhance\b/gi, "The design should enhance"],
    [/\bI(?:'|’)?ll highlight\b/gi, "The design should highlight"],
    [/\bI(?:'|’)?ll assign\b/gi, "The design should keep"],
    [/\bI(?:'|’)?ll plan\b/gi, "The design should plan"],
    [/\bI(?:'|’)?ll identify\b/gi, "The next pass should identify"],
    [/\bI(?:'|’)?ll proceed\b/gi, "The next pass should proceed"],
    [/\bI(?:'|’)?ll\b/gi, "The design should"],
    [/\bWould you like me to[^?]*\?/gi, reviewableProposalLine],
    [/\bShould I[^?]*\?/gi, reviewableProposalLine]
  ];

  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }

  next = next
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  if (!next) return reviewableProposalLine;
  return next;
}
