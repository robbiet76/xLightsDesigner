# Learning and Freshness Loop Spec

Status: Draft  
Date: 2026-03-04  
Scope: Agent adaptation behavior for iterative sequence design in xLightsDesigner

## 1) Purpose
Define how the agent improves over time by learning user preferences while preserving creative variety and avoiding repetitive sequencing patterns.

## 2) Goals
- Improve proposal relevance as user feedback accumulates.
- Preserve novelty so accepted patterns are not overused.
- Keep adaptation transparent, controllable, and reversible.
- Avoid black-box drift and style lock-in.

## 3) Non-Goals
- Unbounded autonomous style mutation without user review.
- Opaque model fine-tuning workflows during active design sessions.
- Replacing explicit user constraints with inferred assumptions.

## 4) Core Principles
1. Learn preferences, not exact outputs.
2. Optimize for "fit + freshness", not repetition.
3. Adapt gradually; avoid overfitting to single interactions.
4. Keep user in control with explicit exploration settings.
5. Every adaptive decision must be explainable in proposal summaries.

## 5) Memory Model

## 5.1 Long-Term Memory: User Preference Profile
Persistent profile across projects:
- style weights (punchy/smooth/cinematic/etc.),
- motion preference,
- palette preference,
- effect archetype affinity,
- pacing/timing affinity,
- sensitivity/avoidance constraints (for example strobe intensity).

## 5.2 Short-Term Memory: Project Creative State
Per-sequence/session memory:
- recently used techniques,
- section-level pattern usage,
- accepted/rejected change sets,
- locked regions and preserved areas,
- local novelty budget consumption.

## 5.3 Separation Requirement
Long-term profile should influence proposals globally.  
Project state should prevent repetitive local reuse within a sequence.

## 6) Feedback Capture Contract

## 6.1 Explicit Signals
- `like`, `dislike`, `keep`, `change`, `more`, `less`.
- UI option ratings (for alternative proposals).
- Direct textual feedback mapped to feature tags.

## 6.2 Implicit Signals
- approve/reject frequency,
- undo shortly after apply,
- repeated preservation of specific sections/effects,
- abandonment of proposed variants.

## 6.3 Feedback Event Shape
```json
{
  "eventId": "fb-uuid",
  "sessionId": "session-uuid",
  "changeSetId": "cs-uuid",
  "signalType": "explicit_like",
  "features": ["high_contrast", "downbeat_emphasis"],
  "strength": 0.8,
  "context": {
    "section": "chorus",
    "timeRangeMs": { "start": 45000, "end": 73000 }
  },
  "timestamp": "2026-03-04T00:00:00Z"
}
```

## 7) Feature Taxonomy (Learning Units)
The agent should learn against normalized feature tags, not opaque text:
- style (`punchy`, `smooth`, `cinematic`, ...),
- motion (`low_motion`, `mid_motion`, `high_motion`),
- color (`warm`, `cool`, `mixed`, palette families),
- energy shape (`ramp_up`, `steady`, `drop_then_lift`),
- effect archetypes (`pulse`, `wash`, `sparkle`, `chase`, ...),
- timing tightness (`quantized`, `loose_sync`),
- complexity/density (`sparse`, `moderate`, `dense`).

## 8) Candidate Scoring Model
Each candidate proposal is scored using:
- `preferenceScore`: fit to user profile,
- `noveltyScore`: dissimilarity from recent accepted local patterns,
- `contextFitScore`: fit to audio section and current design constraints,
- `safetyScore`: compliance with user constraints/locked regions.

Example combined score:
`total = w1*preference + w2*novelty + w3*context + w4*safety`

Weights must be configurable per exploration mode.

## 9) Exploration and Freshness Policy

## 9.1 Exploration Modes
- `safe`: prioritize preference fit, minimal novelty.
- `balanced`: moderate novelty budget (default).
- `adventurous`: high novelty budget with guarded constraints.

## 9.2 Exploration Budget
Within a proposal cycle, at most one bounded "fresh variant" should be introduced unless user explicitly asks for experimentation.

## 9.3 Anti-Repetition Controls
- Penalize repeated archetype usage within nearby sections.
- Apply cooldown windows for recently used pattern families.
- Enforce diversity floors across major sections (verse/chorus/drop).

## 10) Update Rules
- Positive reinforcement: increase feature weights for accepted patterns.
- Negative reinforcement: decrease weights for rejected/undone patterns.
- Strong penalty for "applied then immediate undo".
- Use smoothing/decay to prevent abrupt profile swings.

## 11) Transparency Requirements
Proposal summaries must include:
- why this proposal fits user preferences,
- what fresh element was introduced (if any),
- how constraints/locks were respected.

Example explanation:
"Using your preference for strong downbeat accents while introducing one new transition style to keep chorus visuals fresh."

## 12) User Controls
UI must expose:
- exploration slider (`safe`/`balanced`/`adventurous`),
- freshness bias toggle (`favor consistency` vs `favor novelty`),
- "avoid repeating recent techniques" toggle,
- session reset / profile reset controls,
- view/edit of learned preference tags.

## 13) Safety and Boundaries
- Learning cannot bypass explicit constraints.
- Learning cannot mutate locked regions.
- Learning updates must be reversible (audit trail of profile changes).
- Apply remains approval-gated; no silent auto-applies.

## 14) Metrics
Track at minimum:
- proposal approval rate,
- immediate undo rate,
- repetition index per sequence,
- novelty acceptance rate,
- average iterations-to-approval.

Metrics should be inspectable and used for tuning default weights.

## 15) Rollout Plan
1. Phase A: deterministic feature tagging + explicit feedback capture.
2. Phase B: weighted preference scoring + manual exploration modes.
3. Phase C: novelty budget and anti-repetition enforcement.
4. Phase D: adaptive tuning from implicit signals with explainability outputs.

## 16) Acceptance Criteria
1. Agent proposals improve in acceptance rate over repeated sessions for same user.
2. Repetition index stays below configured threshold in long sequences.
3. Users can request style consistency without losing novelty entirely.
4. Users can request novelty without violating constraints/locks.
5. Learned preferences can be inspected, adjusted, and reset.
