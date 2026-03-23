import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeIntent } from '../../../agent/designer-dialog/intent-normalizer.js';
import { buildClarificationPlan } from '../../../agent/designer-dialog/guided-dialog.js';
import { resolveTargets } from '../../../agent/sequence-agent/target-resolver.js';
import { buildProposalFromIntent } from '../../../agent/designer-dialog/planner.js';

const models = [
  { id: 'MegaTree', name: 'MegaTree', type: 'Model' },
  { id: 'Roofline', name: 'Roofline', type: 'Model' },
  { id: 'Arches', name: 'Arches', type: 'Model' }
];

const submodels = [
  { id: 'MegaTree/TopHalf', name: 'TopHalf', parentId: 'MegaTree' },
  { id: 'Roofline/Left', name: 'Left', parentId: 'Roofline' }
];

const metadataAssignments = [
  { targetId: 'MegaTree', tags: ['focal', 'hero'] },
  { targetId: 'MegaTree/TopHalf', tags: ['rhythm-driver'], semanticHints: ['top-half', 'crown'] },
  { targetId: 'Roofline', tags: ['ambient-fill'] }
];

const displayElements = [
  { id: 'MegaTree', name: 'MegaTree', type: 'model' },
  { id: 'Roofline', name: 'Roofline', type: 'model' },
  { id: 'Arches', name: 'Arches', type: 'model' }
];

test('normalizeIntent extracts high-level sequencing intent and explicit overrides', () => {
  const normalized = normalizeIntent({
    promptText: 'Make chorus punchy with higher energy and use twinkle + bars accents',
    selectedSections: ['Chorus'],
    selectedTagNames: ['focal'],
    selectedTargetIds: ['MegaTree/TopHalf']
  });

  assert.equal(normalized.tempoIntent, 'increase');
  assert.equal(normalized.mode, 'revise');
  assert.equal(normalized.motionIntent, 'punchy');
  assert.equal(normalized.styleDirection, 'punchy');
  assert.deepEqual(normalized.sections, ['Chorus']);
  assert.deepEqual(normalized.tags, ['focal']);
  assert.deepEqual(normalized.targetIds, ['MegaTree/TopHalf']);
  assert.equal(normalized.changeTolerance, 'moderate');
  assert.equal(normalized.focusHierarchy, 'explicit_targets');
  assert.ok(normalized.effectOverrides.includes('twinkle'));
  assert.ok(normalized.effectOverrides.includes('bars'));
});

test('normalizeIntent carries bounded assumptions for broad but usable prompts', () => {
  const normalized = normalizeIntent({
    promptText: 'Give the song a smoother, cooler feel',
    creativeBrief: {
      paletteIntent: 'cool'
    }
  });

  assert.equal(normalized.motionIntent, 'smooth');
  assert.equal(normalized.colorDirection, 'cool');
  assert.equal(normalized.focusHierarchy, 'balanced_full_yard');
  assert.ok(normalized.assumptions.some((line) => /balanced full-yard/i.test(line)));
  assert.ok(normalized.assumptions.some((line) => /cool palette direction/i.test(line)));
});

test('normalizeIntent drops generic section labels when semantic labels are present', () => {
  const normalized = normalizeIntent({
    promptText: 'Design a single Chorus 1 concept with beat accents',
    selectedSections: ['Section 1', 'Section 2', 'Section 3'],
    availableSectionNames: ['Intro', 'Verse 1', 'Chorus 1', 'Bridge']
  });

  assert.deepEqual(normalized.sections, ['Chorus 1']);
});

test('normalizeIntent keeps whole-song rewrite permission when named sections are part of a global prompt', () => {
  const normalized = normalizeIntent({
    promptText: 'Shape the full song so the Bridge becomes the biggest atmospheric peak, and let the final chorus resolve rather than simply getting bigger again.',
    availableSectionNames: ['Intro', 'Verse 1', 'Chorus 1', 'Bridge', 'Final Chorus', 'Outro']
  });

  assert.equal(normalized.preservationConstraints.allowGlobalRewrite, true);
  assert.deepEqual(normalized.sections, ['Bridge', 'Final Chorus']);
});

test('normalizeIntent does not narrow whole-song scope from a single narrative section mention', () => {
  const normalized = normalizeIntent({
    promptText: 'Shape the full song with smooth connected transitions, broader cinematic motion, and a more flowing rise into the final chorus.',
    availableSectionNames: ['Intro', 'Verse 1', 'Bridge', 'Final Chorus', 'Outro']
  });

  assert.equal(normalized.preservationConstraints.allowGlobalRewrite, true);
  assert.deepEqual(normalized.sections, []);
});

test('normalizeIntent keeps explicit selected sections even when the prompt references another section narratively', () => {
  const normalized = normalizeIntent({
    promptText: 'Shape the Pre-Chorus like a lift that holds tension before Chorus 1 opens up.',
    selectedSections: ['Pre-Chorus'],
    availableSectionNames: ['Verse 1', 'Pre-Chorus', 'Chorus 1']
  });

  assert.deepEqual(normalized.sections, ['Pre-Chorus']);
});

test('normalizeIntent does not widen create requests when explicit section and target scope is present', () => {
  const normalized = normalizeIntent({
    promptText: 'Create a Final Chorus concept for Star as a strong pinwheel-style radial spin.',
    selectedSections: ['Final Chorus'],
    selectedTargetIds: ['Star'],
    availableSectionNames: ['Intro', 'Verse 1', 'Final Chorus', 'Outro']
  });

  assert.deepEqual(normalized.sections, ['Final Chorus']);
  assert.deepEqual(normalized.targetIds, ['Star']);
  assert.equal(normalized.preservationConstraints.allowGlobalRewrite, false);
});

test('resolveTargets honors explicit target ids and metadata tags', () => {
  const normalizedIntent = normalizeIntent({
    promptText: 'Bring up energy on focal rhythm-driver elements',
    selectedTagNames: ['focal', 'rhythm-driver'],
    selectedTargetIds: ['Roofline/Left']
  });

  const targets = resolveTargets({
    normalizedIntent,
    models,
    submodels,
    metadataAssignments,
    displayElements
  });

  const ids = targets.map((t) => t.id);
  assert.ok(ids.includes('Roofline/Left'));
  assert.ok(ids.includes('MegaTree'));
  assert.ok(ids.includes('MegaTree/TopHalf'));
});

test('resolveTargets honors submodel metadata hints as scoped metadata terms', () => {
  const normalizedIntent = normalizeIntent({
    promptText: 'Focus the crown detail with a tighter local pattern',
    selectedTagNames: ['crown']
  });

  const targets = resolveTargets({
    normalizedIntent,
    models,
    submodels,
    metadataAssignments,
    displayElements
  });

  assert.deepEqual(targets.map((t) => t.id), ['MegaTree/TopHalf']);
});

test('planner produces concrete first-pass sequencing lines from director-level prompt', () => {
  const result = buildProposalFromIntent({
    promptText: 'I want chorus 2 to feel bigger and more energetic',
    selectedSections: ['Chorus 2'],
    selectedTagNames: ['focal'],
    models,
    submodels,
    metadataAssignments,
    displayElements
  });

  assert.ok(result.targets.length > 0);
  assert.ok(result.proposalLines.length > 0);
  assert.ok(result.proposalLines.every((line) => line.includes('/')));
  assert.ok(
    result.proposalLines.some((line) =>
      /increase pulse contrast|accelerate motion pacing|punchy accents/i.test(line)
    )
  );
});

test('planner includes explicit low-level effect preferences as override constraints', () => {
  const result = buildProposalFromIntent({
    promptText: 'Keep it smooth but use twinkle and bars for key hits',
    selectedSections: ['Bridge'],
    selectedTargetIds: ['MegaTree'],
    models,
    submodels,
    metadataAssignments,
    displayElements
  });

  const combined = result.proposalLines.join('\n').toLowerCase();
  assert.ok(combined.includes('honor explicit user effect preferences'));
  assert.ok(combined.includes('twinkle'));
  assert.ok(combined.includes('bars'));
});

test('planner includes submodel metadata hints in planning guidance', () => {
  const result = buildProposalFromIntent({
    promptText: 'Keep the crown area precise during the chorus',
    selectedSections: ['Chorus'],
    selectedTagNames: ['crown'],
    models,
    submodels,
    metadataAssignments,
    displayElements
  });

  const combined = result.proposalLines.join('\n').toLowerCase();
  assert.ok(combined.includes('prop hints'));
  assert.ok(combined.includes('crown'));
});

test('planner output is deterministic for same input', () => {
  const input = {
    promptText: 'Increase chorus energy on focal elements with cleaner transitions',
    selectedSections: ['Chorus'],
    selectedTagNames: ['focal'],
    models,
    submodels,
    metadataAssignments,
    displayElements
  };

  const a = buildProposalFromIntent(input);
  const b = buildProposalFromIntent(input);
  assert.deepEqual(a, b);
});

test('goal matching does not resolve unrelated generic submodel names', () => {
  const scopedModels = [
    { id: 'PorchTree', name: 'PorchTree', type: 'Model' },
    { id: 'Train_Gondola', name: 'Train_Gondola', type: 'Model' }
  ];
  const scopedSubmodels = [
    { id: 'Train_Gondola/Tree', name: 'Tree', parentId: 'Train_Gondola' }
  ];
  const scopedDisplayElements = [
    { id: 'PorchTree', name: 'PorchTree', type: 'model' },
    { id: 'Train_Gondola', name: 'Train_Gondola', type: 'model' }
  ];

  const result = buildProposalFromIntent({
    promptText: 'Add a Color Wash effect on PorchTree during Chorus 2.',
    selectedSections: ['Chorus 2'],
    models: scopedModels,
    submodels: scopedSubmodels,
    metadataAssignments: [],
    displayElements: scopedDisplayElements
  });

  const targetIds = result.targets.map((target) => target.id);
  assert.ok(targetIds.includes('PorchTree'));
  assert.ok(!targetIds.includes('Train_Gondola/Tree'));
  assert.ok(result.proposalLines.every((line) => !/\/\s*PorchTree \+ Tree\s*\//i.test(line)));
});

test('planner promotes prompt-matched targets into explicit intent scope for narrow prompts', () => {
  const scopedModels = [
    { id: 'Snowman', name: 'Snowman', type: 'Model' },
    { id: 'Star', name: 'Star', type: 'Model' },
    { id: 'Border_Segments', name: 'Border_Segments', type: 'Model' },
    { id: 'CandyCane-01/Fill', name: 'CandyCane-01/Fill', type: 'Model' }
  ];
  const scopedDisplayElements = scopedModels.map((row) => ({ id: row.id, name: row.name, type: 'model' }));

  const result = buildProposalFromIntent({
    promptText: 'Design a single Chorus 1 concept anchored to the beat grid for Snowman and Star. Do not rewrite the whole show.',
    models: scopedModels,
    submodels: [],
    metadataAssignments: [],
    displayElements: scopedDisplayElements,
    musicDesignContext: {
      sectionArc: [
        { label: 'Verse 1', energy: 'medium', density: 'moderate' },
        { label: 'Chorus 1', energy: 'high', density: 'dense' }
      ]
    }
  });

  assert.deepEqual(result.normalizedIntent.sections, ['Chorus 1']);
  assert.deepEqual(result.normalizedIntent.targetIds.sort(), ['Snowman', 'Star']);
  assert.equal(result.normalizedIntent.focusHierarchy, 'explicit_targets');
  assert.equal(result.resolutionSource, 'goal_match');
  assert.deepEqual(result.targets.map((row) => row.id).sort(), ['Snowman', 'Star']);
});

test('planner goal matching does not widen a submodel prompt to its parent model', () => {
  const scopedModels = [
    { id: 'Border_Segments', name: 'Border_Segments', type: 'Model' },
    { id: 'CandyCane-01', name: 'CandyCane-01', type: 'Model' }
  ];
  const scopedSubmodels = [
    { id: 'CandyCane-01/Fill', name: 'Fill', parentId: 'CandyCane-01' }
  ];
  const scopedDisplayElements = [
    { id: 'Border_Segments', name: 'Border_Segments', type: 'model' },
    { id: 'CandyCane-01', name: 'CandyCane-01', type: 'model' },
    { id: 'CandyCane-01/Fill', name: 'CandyCane-01/Fill', type: 'submodel' }
  ];

  const result = buildProposalFromIntent({
    promptText: 'Design a single Chorus 1 concept anchored to the beat grid for CandyCane-01/Fill and Border_Segments. Keep CandyCane-01/Fill as the focal read and use Border_Segments as support. Do not rewrite the whole show.',
    selectedSections: ['Chorus 1'],
    models: scopedModels,
    submodels: scopedSubmodels,
    metadataAssignments: [],
    displayElements: scopedDisplayElements,
    musicDesignContext: {
      sectionArc: [
        { label: 'Verse 1', energy: 'medium', density: 'moderate' },
        { label: 'Chorus 1', energy: 'high', density: 'dense' }
      ]
    }
  });

  assert.deepEqual(result.normalizedIntent.targetIds.sort(), ['Border_Segments', 'CandyCane-01/Fill']);
  assert.deepEqual(result.targets.map((row) => row.id).sort(), ['Border_Segments', 'CandyCane-01/Fill']);
  assert.ok(!result.targets.map((row) => row.id).includes('CandyCane-01'));
});

test('planner keeps prompt-matched explicit targets even when regenerate wording implies focal tags', () => {
  const scopedModels = [
    { id: 'Snowman', name: 'Snowman', type: 'Model' },
    { id: 'Star', name: 'Star', type: 'Model' },
    { id: 'Border-03', name: 'Border-03', type: 'Model' },
    { id: 'AllModels_NoFloods', name: 'AllModels_NoFloods', type: 'Group' }
  ];
  const scopedDisplayElements = scopedModels.map((row) => ({ id: row.id, name: row.name, type: 'model' }));
  const scopedMetadata = [
    { targetId: 'Snowman', tags: ['focal'] },
    { targetId: 'Star', tags: ['focal'] },
    { targetId: 'Border-03', tags: ['focal'] }
  ];

  const result = buildProposalFromIntent({
    promptText: 'Regenerate a single Chorus 1 concept anchored to the beat grid for Snowman and Star, keeping it more focused than the removed concept.',
    selectedSections: ['Chorus 1'],
    models: scopedModels,
    submodels: [],
    metadataAssignments: scopedMetadata,
    displayElements: scopedDisplayElements,
    musicDesignContext: {
      sectionArc: [
        { label: 'Verse 1', energy: 'medium', density: 'moderate' },
        { label: 'Chorus 1', energy: 'high', density: 'dense' }
      ]
    }
  });

  assert.deepEqual(result.normalizedIntent.targetIds.sort(), ['Snowman', 'Star']);
  assert.equal(result.normalizedIntent.focusHierarchy, 'explicit_targets');
  assert.deepEqual(result.targets.map((row) => row.id).sort(), ['Snowman', 'Star']);
});

test('planner uses scene and music context to shape first-pass proposal lines', () => {
  const result = buildProposalFromIntent({
    promptText: 'Make the chorus feel bigger and more cinematic',
    selectedSections: ['Chorus'],
    models,
    submodels,
    metadataAssignments,
    displayElements,
    designSceneContext: {
      focalCandidates: ['MegaTree', 'Roofline'],
      coverageDomains: {
        broad: ['AllModels'],
        detail: ['MegaTree/TopHalf']
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: 'Intro', energy: 'low', density: 'sparse' },
        { label: 'Chorus', energy: 'high', density: 'dense' }
      ],
      designCues: {
        revealMoments: ['Verse->Chorus'],
        holdMoments: ['Intro']
      }
    }
  });

  const combined = result.proposalLines.join('\n');
  assert.match(combined, /AllModels.*broad base coverage/i);
  assert.match(combined, /MegaTree.*focal clarity|MegaTree.*visual anchor/i);
  assert.match(combined, /Chorus.*stronger visual payoff|Chorus.*impact section/i);
  assert.match(combined, /Intro.*calmer hold section|Intro.*restrained/i);
});

test('planner uses strong director profile signals as soft proposal bias only', () => {
  const result = buildProposalFromIntent({
    promptText: 'Make the chorus feel bigger and more cinematic',
    selectedSections: ['Chorus'],
    models,
    submodels,
    metadataAssignments,
    displayElements,
    directorProfile: {
      preferences: {
        focusBias: { weight: 0.7, confidence: 0.8, evidenceCount: 4 },
        changeTolerance: { weight: -0.5, confidence: 0.7, evidenceCount: 3 },
        complexityTolerance: { weight: -0.6, confidence: 0.75, evidenceCount: 5 }
      }
    }
  });

  const combined = result.proposalLines.join('\n');
  assert.match(combined, /clear focal hierarchy|focal/i);
  assert.match(combined, /incremental|preserve more of the current look/i);
  assert.match(combined, /cleaner readable choices|readable/i);
});

test('clarification plan asks when critical fields are missing', () => {
  const normalized = normalizeIntent({
    promptText: '',
    selectedSections: []
  });

  const plan = buildClarificationPlan({
    normalizedIntent: normalized,
    targets: []
  });

  assert.ok(plan.questions.some((q) => q.field === 'goal'));
  assert.ok(plan.questions.some((q) => q.field === 'sections'));
});

test('clarification plan proceeds with bounded assumptions for broad usable prompts', () => {
  const normalized = normalizeIntent({
    promptText: 'Make it bigger and more cinematic',
    selectedSections: ['Chorus 1']
  });

  const plan = buildClarificationPlan({
    normalizedIntent: normalized,
    targets: [],
    directorPreferences: {
      motionPreference: 'smooth'
    }
  });

  assert.deepEqual(plan.questions, []);
  assert.ok(plan.assumptions.some((line) => /balanced full-yard/i.test(line)));
  assert.ok(plan.assumptions.some((line) => /cinematic style direction/i.test(line)));
  assert.ok(plan.assumptions.some((line) => /motion choices.*smooth|smooth.*preference/i.test(line)));
});

test('planner records unresolved targets when a layout model is not a writable sequencer element', () => {
  const result = buildProposalFromIntent({
    promptText: 'Put a green On effect on MegaTree for 30 seconds from the start',
    models,
    submodels,
    metadataAssignments,
    displayElements: [{ id: 'Roofline', name: 'Roofline', type: 'model' }]
  });

  assert.deepEqual(result.targets, []);
  assert.ok(result.unresolvedTargets.some((row) => row.id === 'MegaTree'));
});
