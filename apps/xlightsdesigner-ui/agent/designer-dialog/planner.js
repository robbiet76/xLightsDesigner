import { normalizeIntent } from "./intent-normalizer.js";
import { resolveTargetSelection } from "../sequence-agent/target-resolver.js";
import { buildSequencingStrategy } from "../sequence-agent/sequencing-strategy.js";

export function buildProposalFromIntent(input = {}) {
  const normalizedIntent = normalizeIntent(input);
  const selection = resolveTargetSelection({
    normalizedIntent,
    models: input.models,
    submodels: input.submodels,
    metadataAssignments: input.metadataAssignments,
    displayElements: input.displayElements
  });
  const targets = selection.targets;
  const proposalLines = buildSequencingStrategy(normalizedIntent, targets);

  return {
    normalizedIntent,
    targets,
    proposalLines,
    unresolvedTargets: selection.unresolvedTargets
  };
}
