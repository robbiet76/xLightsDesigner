import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGenerativeSummaryFromMetadata,
  buildReviewDashboardState
} from "../../../app-ui/page-state/review-dashboard-state.js";

function buildHelpers(overrides = {}) {
  return {
    getSelectedSections: () => ["Chorus 1"],
    hasAllSectionsSelected: () => false,
    getSectionName: (line = "") => String(line).split("/")[0].trim(),
    selectedProposedLinesForApply: () => [],
    summarizeImpactForLines: (lines = []) => ({
      targetCount: lines.length ? 1 : 0,
      sectionWindows: lines.length ? ["Chorus 1"] : []
    }),
    buildDesignerPlanCommands: (lines = []) => lines.map((line, idx) => ({ id: idx + 1, line })),
    applyReadyForApprovalGate: () => false,
    applyDisabledReason: () => "Apply is not currently allowed.",
    buildCurrentReviewSnapshotSummary: () => ({
      designSummary: { title: "Current design", goals: ["Warm focal chorus"] },
      sequenceSummary: { proposalLines: ["Chorus 1 / Snowman / add Color Wash"] },
      applySummary: { status: "pending" }
    }),
    ...overrides
  };
}

test("review dashboard state reports idle when no draft exists", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: [],
      ui: { proposedSelection: [], applyApprovalChecked: false },
      flags: {}
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.page, "review");
  assert.equal(dashboard.status, "idle");
  assert.equal(dashboard.readiness.ok, false);
  assert.match(dashboard.validationIssues[0].code, /no_pending_review_changes/);
});

test("review dashboard state prefers compact generative summary when available", () => {
  const summary = buildGenerativeSummaryFromMetadata({
    generativeSummary: {
      artifactType: "plan_generative_summary_v1",
      intent: { attentionProfile: "weighted" },
      candidates: { count: 2, candidateIds: ["candidate-compact"] },
      selection: { mode: "bounded_exploration", selectedBandIds: ["candidate-compact"] },
      choice: { chosenCandidateId: "candidate-compact" },
      delta: { introducedEffectNames: ["Color Wash"], introducedTargetIds: ["Snowman"] },
      retry: { signals: ["low_change_retry"] },
      feedback: { status: "revise_required" }
    },
    realizationCandidates: {
      candidates: [
        { candidateId: "candidate-expanded" }
      ]
    },
    candidateSelection: {
      policy: { mode: "deterministic_preview" }
    }
  });

  assert.equal(summary.artifactType, "plan_generative_summary_v1");
  assert.deepEqual(summary.candidates.candidateIds, ["candidate-compact"]);
  assert.equal(summary.selection.mode, "bounded_exploration");
  assert.equal(summary.choice.chosenCandidateId, "candidate-compact");
});

test("review dashboard state reports blocked when draft exists but approval gate is not ready", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: ["Chorus 1 / Snowman / add Color Wash"],
      directorProfile: {
        preferences: {
          palettePreference: "warm_cinematic",
          motionPreference: "smooth",
          focusPreference: "hero-prop-first"
        }
      },
      creative: {
        proposalBundle: {
          executionPlan: {
            sectionPlans: [
              {
                designId: "DES-001",
                designAuthor: "designer",
                section: "Chorus 1",
                intentSummary: "Warm focal chorus change.",
                targetIds: ["Snowman"]
              }
            ]
          }
        }
      },
      agentPlan: {
        handoff: {
          commands: [
            { cmd: "effects.create", designId: "DES-001", params: { effectName: "Color Wash" }, intent: { designId: "DES-001", designAuthor: "designer" } }
          ]
        }
      },
      ui: { proposedSelection: [0], applyApprovalChecked: false },
      flags: { applyInProgress: false, proposalStale: false }
    },
    helpers: buildHelpers({
      applyReadyForApprovalGate: () => false,
      applyDisabledReason: () => "Connect to xLights to apply."
    })
  });

  assert.equal(dashboard.status, "blocked");
  assert.equal(dashboard.readiness.ok, false);
  assert.match(dashboard.validationIssues.map((issue) => issue.code).join(","), /apply_not_ready/);
  assert.equal(dashboard.data.apply.canApplyAll, false);
  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].designId, "DES-001");
  assert.equal(dashboard.data.rows[0].designLabel, "D1.0");
  assert.equal(dashboard.data.rows[0].designAuthor, "designer");
  assert.equal(dashboard.data.rows[0].preferenceCue, "warm cinematic / smooth / hero-prop-first");
  assert.equal(dashboard.data.rows[0].effectCount, 1);
});

test("review dashboard state reports ready when apply gate and approval are satisfied", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: ["Chorus 1 / Snowman / add Color Wash"],
      creative: {
        proposalBundle: {
          executionPlan: {
            sectionPlans: [
              {
                designId: "DES-001",
                designAuthor: "designer",
                section: "Chorus 1",
                intentSummary: "Warm focal chorus change.",
                targetIds: ["Snowman"]
              }
            ]
          }
        }
      },
      ui: { proposedSelection: [0], applyApprovalChecked: true },
      flags: { applyInProgress: false, proposalStale: false },
      lastApplyBackupPath: "/tmp/backup.xsq"
    },
    helpers: buildHelpers({
      applyReadyForApprovalGate: () => true,
      applyDisabledReason: () => ""
    })
  });

  assert.equal(dashboard.status, "ready");
  assert.equal(dashboard.readiness.ok, true);
  assert.equal(dashboard.data.apply.canApplyAll, true);
  assert.equal(dashboard.data.backupReady, true);
  assert.equal(dashboard.data.counts.designGroups, 1);
});

test("review dashboard state carries last applied snapshot when loaded", () => {
  const state = {
    proposed: ["Chorus 1 / Snowman / add Color Wash"],
    ui: {
      proposedSelection: [],
      applyApprovalChecked: false,
      reviewHistorySnapshot: {
        historyEntryId: "history-123",
        creativeBrief: { summary: "Applied design" },
        proposalBundle: { proposalLines: ["Applied line"] },
        applyResult: { status: "completed" },
        planHandoff: {
          metadata: {
            priorPassMemory: { unresolvedSignals: ["weak_section_contrast"] },
            intentEnvelope: {
              artifactType: "intent_envelope_v1",
              attention: { profile: "weighted" },
              temporal: { profile: "modulated" },
              spatial: { footprint: "moderate" },
              texture: { profile: "mixed" }
            },
            realizationCandidates: {
              artifactType: "realization_candidates_v1",
              candidates: [
                { candidateId: "candidate-base", summary: "Base seeded candidate." },
                { candidateId: "candidate-focused", summary: "Focused alternate." }
              ]
            },
            candidateSelection: {
              artifactType: "candidate_selection_v1",
              policy: { mode: "bounded_exploration", phase: "review" },
              primaryCandidateId: "candidate-focused",
              scoredCandidates: [
                { candidateId: "candidate-focused", oscillationRisk: "low" },
                { candidateId: "candidate-base", oscillationRisk: "high" }
              ],
              selectedBand: {
                candidateIds: ["candidate-focused", "candidate-base"],
                size: 2
              }
            },
            candidateChoice: {
              chosenCandidateId: "candidate-focused",
              selectionMode: "bounded_exploration",
              selectedFromBand: true
            },
            effectStrategy: {
              selectedCandidateId: "candidate-focused",
              selectedCandidateSummary: "Focused alternate.",
              seedRecommendations: [
                {
                  effectName: "Color Wash",
                  targetIds: ["Snowman"]
                }
              ]
            },
            revisionDelta: {
              artifactType: "revision_delta_v1",
              current: {
                effectNames: ["Color Wash"],
                targetIds: ["Snowman"]
              },
              previous: {
                effectNames: [],
                targetIds: []
              },
              introduced: {
                effectNames: ["Color Wash"],
                targetIds: ["Snowman"]
              }
            },
            revisionRetryPressure: {
              artifactType: "revision_retry_pressure_v1",
              artifactId: "retry-1",
              signals: ["low_change_retry"],
              oscillation: {
                candidateIds: ["candidate-base"]
              }
            },
            revisionFeedback: {
              artifactType: "revision_feedback_v1",
              artifactId: "feedback-1",
              status: "revise_required",
              rejectionReasons: ["lead_mismatch", "low_change_retry"],
              nextDirection: {
                artisticCorrection: "Restore MegaTree as the dominant lead.",
                executionObjective: "Strengthen MegaTree lead and reduce competing support."
              }
            },
            candidateSelectionContext: {
              phase: "review",
              unresolvedSignals: ["weak_section_contrast"],
              retryPressureSignals: ["low_change_retry"]
            }
          }
        },
        analysisArtifact: { trackIdentity: { title: "Song" } },
        designSceneContext: { layoutMode: "2d" },
        musicDesignContext: { sectionArc: ["Intro", "Chorus 1"] },
        renderObservation: { artifactType: "render_observation_v1", macro: { leadModel: "MegaTree" } },
        renderCritiqueContext: {
          artifactType: "sequence_render_critique_context_v1",
          expected: {
            requestedScope: {
              mode: "section_target_refinement",
              reviewStartLevel: "section",
              sectionScopeKind: "timing_track_windows"
            },
            musicSections: [{ label: "Chorus 1", energy: "high", density: "dense" }]
          },
          comparison: {
            leadMatchesPrimaryFocus: true,
            renderHasDisplayGaps: true,
            renderHasProblematicGaps: false,
            localizedFocusExpected: true
          }
        },
        sequenceArtisticGoal: {
          artifactType: "sequence_artistic_goal_v1",
          scope: { goalLevel: "section" },
          evaluationLens: {
            comparisonQuestions: ["Does the next pass resolve the rendered focus problem?"],
            mustImprove: ["Rendered lead does not match the intended primary focus."]
          }
        },
        sequenceRevisionObjective: {
          artifactType: "sequence_revision_objective_v1",
          ladderLevel: "section",
          scope: { nextOwner: "shared", revisionTargets: ["MegaTree"] },
          designerDirection: { artisticCorrection: "Restore MegaTree as the dominant lead." },
          sequencerDirection: { executionObjective: "Strengthen MegaTree lead and reduce competing support." }
        }
      }
    },
    applyHistory: [
      {
        historyEntryId: "history-123",
        artifactRefs: { analysisArtifactId: "analysis-1" }
      }
    ],
    flags: { applyInProgress: false, proposalStale: false }
  };

  const dashboard = buildReviewDashboardState({
    state,
    helpers: buildHelpers()
  });

  assert.ok(dashboard.data.lastAppliedSnapshot);
  assert.equal(dashboard.data.lastAppliedSnapshot.brief.summary, "Applied design");
  assert.equal(dashboard.data.lastAppliedSnapshot.proposalLines[0], "Applied line");
  assert.equal(dashboard.data.lastAppliedSnapshot.renderObservation.macro.leadModel, "MegaTree");
  assert.deepEqual(dashboard.data.lastAppliedSnapshot.planHandoff.metadata.priorPassMemory.unresolvedSignals, ["weak_section_contrast"]);
  assert.equal(dashboard.data.lastAppliedSnapshot.generativeSummary.intent.attentionProfile, "weighted");
  assert.equal(dashboard.data.lastAppliedSnapshot.generativeSummary.selection.mode, "bounded_exploration");
  assert.equal(dashboard.data.lastAppliedSnapshot.generativeSummary.choice.chosenCandidateId, "candidate-focused");
  assert.equal(dashboard.data.lastAppliedSnapshot.generativeSummary.delta.artifactType, "revision_delta_v1");
  assert.equal(dashboard.data.lastAppliedSnapshot.generativeSummary.retry.artifactType, "revision_retry_pressure_v1");
  assert.equal(dashboard.data.lastAppliedSnapshot.generativeSummary.feedback.artifactType, "revision_feedback_v1");
  assert.deepEqual(dashboard.data.lastAppliedSnapshot.generativeSummary.selection.selectedBandIds, ["candidate-focused", "candidate-base"]);
  assert.deepEqual(dashboard.data.lastAppliedSnapshot.generativeSummary.choice.retryPressureSignals, ["low_change_retry"]);
  assert.deepEqual(dashboard.data.lastAppliedSnapshot.generativeSummary.retry.oscillatingCandidateIds, ["candidate-base"]);
  assert.equal(dashboard.data.lastAppliedSnapshot.generativeSummary.feedback.status, "revise_required");
  assert.deepEqual(dashboard.data.lastAppliedSnapshot.generativeSummary.feedback.rejectionReasons, ["lead_mismatch", "low_change_retry"]);
  assert.equal(dashboard.data.lastAppliedSnapshot.generativeSummary.feedback.executionObjective, "Strengthen MegaTree lead and reduce competing support.");
  assert.equal(dashboard.data.lastAppliedSnapshot.processSummary.status, "revise_required");
  assert.equal(dashboard.data.lastAppliedSnapshot.processSummary.focus, "weighted");
  assert.equal(dashboard.data.lastAppliedSnapshot.processSummary.nextMove, "Strengthen MegaTree lead and reduce competing support.");
  assert.deepEqual(dashboard.data.lastAppliedSnapshot.generativeSummary.delta.currentEffectNames, ["Color Wash"]);
  assert.deepEqual(dashboard.data.lastAppliedSnapshot.generativeSummary.delta.currentTargetIds, ["Snowman"]);
  assert.deepEqual(dashboard.data.lastAppliedSnapshot.generativeSummary.delta.introducedEffectNames, ["Color Wash"]);
  assert.deepEqual(dashboard.data.lastAppliedSnapshot.generativeSummary.delta.introducedTargetIds, ["Snowman"]);
  assert.equal(dashboard.data.lastAppliedSnapshot.renderCritiqueContext.comparison.leadMatchesPrimaryFocus, true);
  assert.equal(dashboard.data.lastAppliedSnapshot.renderCritiqueContext.expected.requestedScope.mode, "section_target_refinement");
  assert.equal(dashboard.data.lastAppliedSnapshot.sequenceArtisticGoal.scope.goalLevel, "section");
  assert.equal(dashboard.data.lastAppliedSnapshot.sequenceRevisionObjective.ladderLevel, "section");
});

test("review dashboard state exposes current generative sequencing summary from active plan metadata", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: ["Chorus 1 / Snowman / add Color Wash"],
      agentPlan: {
        metadata: {
          priorPassMemory: {
            previousEffectNames: ["Shimmer"],
            previousTargetIds: ["MegaTree"]
          },
          intentEnvelope: {
            artifactType: "intent_envelope_v1",
            attention: { profile: "concentrated" },
            temporal: { profile: "evolving" },
            spatial: { footprint: "narrow" },
            texture: { profile: "sparkle" }
          },
          realizationCandidates: {
            artifactType: "realization_candidates_v1",
            candidates: [
              { candidateId: "candidate-base", summary: "Base seeded candidate." },
              { candidateId: "candidate-alternate", summary: "Alternate candidate." }
            ]
          },
          candidateSelection: {
            artifactType: "candidate_selection_v1",
            policy: { mode: "deterministic_preview", phase: "plan" },
            primaryCandidateId: "candidate-base",
            scoredCandidates: [
              { candidateId: "candidate-base", oscillationRisk: "low" },
              { candidateId: "candidate-alternate", oscillationRisk: "high" }
            ],
            selectedBand: {
              candidateIds: ["candidate-base"],
              size: 1
            }
          },
          candidateChoice: {
            chosenCandidateId: "candidate-base",
            selectionMode: "deterministic_preview",
            selectedFromBand: true
          },
          effectStrategy: {
            selectedCandidateId: "candidate-base",
            selectedCandidateSummary: "Base seeded candidate.",
            seedRecommendations: [
              {
                effectName: "Color Wash",
                targetIds: ["Snowman"]
              }
            ]
          },
          revisionDelta: {
            artifactType: "revision_delta_v1",
            current: {
              effectNames: ["Color Wash"],
              targetIds: ["Snowman"]
            },
            previous: {
              effectNames: ["Shimmer"],
              targetIds: ["MegaTree"]
            },
            introduced: {
              effectNames: ["Color Wash"],
              targetIds: ["Snowman"]
            }
          },
          revisionRetryPressure: {
            artifactType: "revision_retry_pressure_v1",
            artifactId: "retry-2",
            signals: ["low_change_retry"],
            oscillation: {
              candidateIds: ["candidate-alternate"]
            }
          },
          revisionFeedback: {
            artifactType: "revision_feedback_v1",
            artifactId: "feedback-2",
            status: "revise_required",
            rejectionReasons: ["weak_section_contrast"],
            nextDirection: {
              executionObjective: "Increase contrast between lead and support."
            }
          },
          candidateSelectionContext: {
            phase: "plan",
            retryPressureSignals: ["low_change_retry"]
          }
        }
      },
      ui: { proposedSelection: [0], applyApprovalChecked: false },
      flags: { applyInProgress: false, proposalStale: false }
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.currentGenerativeSummary.intent.attentionProfile, "concentrated");
  assert.equal(dashboard.data.currentGenerativeSummary.selection.mode, "deterministic_preview");
  assert.equal(dashboard.data.currentGenerativeSummary.choice.chosenSummary, "Base seeded candidate.");
  assert.equal(dashboard.data.currentGenerativeSummary.delta.artifactType, "revision_delta_v1");
  assert.equal(dashboard.data.currentGenerativeSummary.retry.artifactType, "revision_retry_pressure_v1");
  assert.equal(dashboard.data.currentGenerativeSummary.feedback.artifactType, "revision_feedback_v1");
  assert.deepEqual(dashboard.data.currentGenerativeSummary.candidates.candidateIds, ["candidate-base", "candidate-alternate"]);
  assert.deepEqual(dashboard.data.currentGenerativeSummary.choice.retryPressureSignals, ["low_change_retry"]);
  assert.deepEqual(dashboard.data.currentGenerativeSummary.retry.oscillatingCandidateIds, ["candidate-alternate"]);
  assert.equal(dashboard.data.currentGenerativeSummary.feedback.status, "revise_required");
  assert.deepEqual(dashboard.data.currentGenerativeSummary.feedback.rejectionReasons, ["weak_section_contrast"]);
  assert.equal(dashboard.data.currentGenerativeSummary.feedback.executionObjective, "Increase contrast between lead and support.");
  assert.equal(dashboard.data.currentProcessSummary.status, "revise_required");
  assert.equal(dashboard.data.currentProcessSummary.focus, "concentrated");
  assert.equal(dashboard.data.currentProcessSummary.nextMove, "Increase contrast between lead and support.");
  assert.deepEqual(dashboard.data.currentGenerativeSummary.delta.introducedEffectNames, ["Color Wash"]);
  assert.deepEqual(dashboard.data.currentGenerativeSummary.delta.introducedTargetIds, ["Snowman"]);
});

test("review dashboard state exposes compact current pass outcome from snapshot summary", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: ["Chorus 1 / Snowman / add Color Wash"],
      ui: { proposedSelection: [0], applyApprovalChecked: false },
      flags: { applyInProgress: false, proposalStale: false }
    },
    helpers: buildHelpers({
      applyReadyForApprovalGate: () => true,
      applyDisabledReason: () => "",
      buildCurrentReviewSnapshotSummary: () => ({
        designSummary: { title: "Current design" },
        sequenceSummary: {
          proposalLines: ["Chorus 1 / Snowman / add Color Wash"],
          passOutcome: {
            status: "retry_pressure",
            hasRetryPressure: true
          }
        },
        applySummary: { status: "pending" }
      })
    })
  });

  assert.equal(dashboard.data.currentPassOutcome.status, "retry_pressure");
  assert.equal(dashboard.data.currentPassOutcome.hasRetryPressure, true);
  assert.equal(dashboard.data.currentPassOutcomeLabel, "retry_pressure / retry pressure");
  assert.equal(dashboard.data.mobileStatusText, "Awaiting approval / retry_pressure / retry pressure");
});

test("review dashboard state falls back to intent handoff execution strategy for grouped rows", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: [
        "Chorus 1 / Snowman / warm focal lift"
      ],
      creative: {
        intentHandoff: {
          executionStrategy: {
            sectionPlans: [
              {
                designId: "DES-001",
                designAuthor: "user",
                section: "Chorus 1",
                intentSummary: "User-directed chorus change.",
                targetIds: ["Snowman"]
              }
            ]
          }
        }
      },
      agentPlan: {
        handoff: {
          commands: [
            { cmd: "effects.create", designId: "DES-001", params: { effectName: "Color Wash" }, intent: { designId: "DES-001", designAuthor: "user" } }
          ]
        }
      },
      ui: { proposedSelection: [0], applyApprovalChecked: false },
      flags: { applyInProgress: false, proposalStale: false }
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].designId, "DES-001");
  assert.equal(dashboard.data.rows[0].designLabel, "D1.0");
  assert.equal(dashboard.data.rows[0].designAuthor, "user");
  assert.equal(dashboard.data.rows[0].effectCount, 1);
});

test("review dashboard sorts grouped rows numerically and exposes superseded revision counts", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: [
        "Bridge / Tree / bars accent",
        "Chorus 1 / Snowman / warm focal lift"
      ],
      creative: {
        supersededConcepts: [
          { designId: "DES-002", designRevision: 0 }
        ],
        proposalBundle: {
          executionPlan: {
            sectionPlans: [
              { designId: "DES-010", designRevision: 0, designAuthor: "designer", section: "Bridge", intentSummary: "Bridge concept.", targetIds: ["Tree"] },
              { designId: "DES-002", designRevision: 1, designAuthor: "designer", section: "Chorus 1", intentSummary: "Chorus concept.", targetIds: ["Snowman"] }
            ]
          }
        }
      },
      agentPlan: {
        handoff: {
          commands: [
            { cmd: "effects.create", designId: "DES-010", params: { effectName: "Bars" }, intent: { designId: "DES-010", designAuthor: "designer" } },
            { cmd: "effects.create", designId: "DES-002", params: { effectName: "Color Wash" }, intent: { designId: "DES-002", designAuthor: "designer" } }
          ]
        }
      },
      ui: { proposedSelection: [0, 1], applyApprovalChecked: false },
      flags: { applyInProgress: false, proposalStale: false }
    },
    helpers: buildHelpers({
      hasAllSectionsSelected: () => true
    })
  });

  assert.deepEqual(dashboard.data.rows.map((row) => row.designLabel), ["D2.1", "D10.0"]);
  assert.equal(dashboard.data.rows[0].supersededRevisionCount, 1);
  assert.equal(dashboard.data.rows[0].revisionState, "current");
  assert.equal(dashboard.data.rows[0].previousRevision.designLabel, "D2.0");
  assert.equal(dashboard.data.rows[0].previousRevision.summary, "Previous revision");
});

test("review dashboard compares current concept to prior superseded revision details", () => {
  const dashboard = buildReviewDashboardState({
    state: {
      proposed: ["Chorus 1 / Snowman / revised chorus concept"],
      creative: {
        supersededConcepts: [
          {
            designId: "DES-001",
            designRevision: 0,
            summary: "Original chorus concept.",
            sections: ["Chorus 1"],
            targetIds: ["Snowman", "Star"],
            placementCount: 3
          }
        ],
        proposalBundle: {
          executionPlan: {
            sectionPlans: [
              {
                designId: "DES-001",
                designRevision: 1,
                designAuthor: "designer",
                section: "Chorus 1",
                intentSummary: "Revised chorus concept.",
                targetIds: ["Snowman"]
              }
            ]
          }
        }
      },
      agentPlan: {
        handoff: {
          commands: [
            { cmd: "effects.create", designId: "DES-001", params: { effectName: "Color Wash" }, intent: { designId: "DES-001", designAuthor: "designer" } }
          ]
        }
      },
      ui: { proposedSelection: [0], applyApprovalChecked: false },
      flags: { applyInProgress: false, proposalStale: false }
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.rows[0].designLabel, "D1.1");
  assert.equal(dashboard.data.rows[0].previousRevision.designLabel, "D1.0");
  assert.equal(dashboard.data.rows[0].previousRevision.summary, "Original chorus concept.");
  assert.equal(dashboard.data.rows[0].previousRevision.anchor, "Chorus 1");
  assert.equal(dashboard.data.rows[0].previousRevision.targetSummary, "Snowman, Star");
  assert.equal(dashboard.data.rows[0].previousRevision.effectCount, 3);
});
