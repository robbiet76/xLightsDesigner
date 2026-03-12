import { normalizeIntent } from "./intent-normalizer.js";
import { resolveTargets } from "../sequence-agent/target-resolver.js";
import { buildSequencingStrategy } from "../sequence-agent/sequencing-strategy.js";

export function buildProposalFromIntent(input = {}) {
  const normalizedIntent = normalizeIntent(input);
  const targets = resolveTargets({
    normalizedIntent,
    models: input.models,
    submodels: input.submodels,
    metadataAssignments: input.metadataAssignments
  });
  const proposalLines = buildSequencingStrategy(normalizedIntent, targets);

  return {
    normalizedIntent,
    targets,
    proposalLines
  };
}
