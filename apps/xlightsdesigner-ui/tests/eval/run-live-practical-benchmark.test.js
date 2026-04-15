import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBehaviorAssertions, evaluateScenario } from '../../eval/run-live-practical-benchmark.mjs';
import { resolveDirectCueEffectCandidates } from '../../agent/shared/effect-semantics-registry.js';

function makeSnapshot({ translationIntent, plan, applyResult } = {}) {
  return {
    result: {
      latestIntentHandoff: translationIntent ? { executionStrategy: { translationIntent } } : null,
      latestPlanHandoff: plan || null,
      latestApplyResult: applyResult || null,
      latestGuidanceCoverage: { effectCreateCount: 1 },
      ownedRenderFeedbackCapabilities: null,
      reviewHistorySnapshotAvailable: true
    }
  };
}

test('evaluateBehaviorAssertions matches expected and contradictory behavior dimensions', () => {
  const evaluation = evaluateBehaviorAssertions({
    scenario: {
      expectedBehaviors: { primaryMotion: ['shimmer'], energyLevel: ['restrained'] },
      contradictoryBehaviors: { primaryMotion: ['burst'] }
    },
    translationIntent: {
      behaviorTargets: [
        {
          motion: { primaryMotion: 'shimmer' },
          texture: { primaryTexture: 'sparkling' },
          energy: { energyLevel: 'restrained' },
          coverage: { coverageLevel: 'focused' },
          transitions: { entryCharacter: 'gentle', exitCharacter: 'gentle' }
        }
      ],
      targetRoles: [{ role: 'lead' }],
      sectionRoles: [{ role: 'release' }]
    }
  });

  assert.deepEqual(evaluation.matched.primaryMotion, ['shimmer']);
  assert.deepEqual(evaluation.matched.energyLevel, ['restrained']);
  assert.deepEqual(evaluation.contradictory.primaryMotion, []);
  assert.deepEqual(evaluation.issues, []);
});

test('evaluateScenario reports behavior issues alongside coarse plan checks', () => {
  const translationIntent = {
    artifactType: 'translation_intent_v1',
    artifactId: 'translation_intent_v1-test',
    behaviorTargets: [
      {
        motion: { primaryMotion: 'burst' },
        texture: { primaryTexture: 'banded' },
        energy: { energyLevel: 'aggressive' },
        coverage: { coverageLevel: 'focused' },
        transitions: { entryCharacter: 'hard', exitCharacter: 'hard' }
      }
    ],
    targetRoles: [{ targetId: 'Spinners', role: 'lead' }],
    sectionRoles: [{ section: 'Bridge', role: 'release' }]
  };
  const plan = {
    artifactId: 'plan_handoff_v1-test',
    planId: 'plan_handoff_v1-test',
    summary: 'test',
    executionLines: [],
    warnings: [],
    stageTelemetry: [],
    commands: [
      { cmd: 'effects.create', params: { effectName: 'Shockwave', modelName: 'Spinners', startMs: 0, endMs: 1000 } }
    ]
  };
  const applyResult = {
    artifactId: 'apply_result_v1-test',
    planId: 'plan_handoff_v1-test',
    currentRevision: '/tmp/test.xsq#1',
    nextRevision: '/tmp/test.xsq#2'
  };
  const result = evaluateScenario({
    suiteKey: 'section',
    scenario: {
      scenarioId: 'section_case_002',
      scenarioLabel: 'spinner-bridge-soft-twinkle',
      expectedEffects: ['Twinkle', 'Shimmer'],
      forbiddenEffects: ['Shockwave'],
      requiredObservedTargets: ['Spinners'],
      expectedBehaviors: { primaryMotion: ['shimmer'], energyLevel: ['restrained'] },
      contradictoryBehaviors: { primaryMotion: ['burst'] },
      minimumMatchedEffects: 1
    },
    promptSnapshot: makeSnapshot({ translationIntent, plan, applyResult }),
    applySnapshot: makeSnapshot({ translationIntent, plan, applyResult }),
    workingSequencePath: '/tmp/test.xsq'
  });

  assert.equal(result.scenarioId, 'section_case_002');
  assert.equal(result.scenarioLabel, 'spinner-bridge-soft-twinkle');
  assert.equal(result.ok, false);
  assert.match(result.issues.join(','), /expected_effect_missing/);
  assert.match(result.issues.join(','), /forbidden_effect_present/);
  assert.match(result.issues.join(','), /expected_behavior_missing:primaryMotion/);
  assert.match(result.issues.join(','), /contradictory_behavior_present:primaryMotion/);
});


test('resolveDirectCueEffectCandidates ignores negative ring and spin clauses for soft twinkle prompts', () => {
  const result = resolveDirectCueEffectCandidates({
    goalText: 'In the Bridge, keep Spinners restrained and texture-led with a softer twinkle read rather than a bold ring or spin. Prefer twinkle or shimmer family behavior and avoid a large directional pass.',
    smoothBias: false
  });

  assert.deepEqual(result, ['Shimmer', 'Twinkle']);
});
