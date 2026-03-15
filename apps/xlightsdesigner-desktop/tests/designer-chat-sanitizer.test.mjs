import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDesignerAssistantMessage } from '../designer-chat-sanitizer.mjs';

test('replaces apply question with reviewable proposal language', () => {
  const input = 'Perfect—calm intro to set a peaceful mood. Should I proceed to apply this dynamic transition in the sequence now?';
  const output = sanitizeDesignerAssistantMessage(input);
  assert.match(output, /reviewable design proposal next/i);
  assert.doesNotMatch(output, /apply this dynamic transition/i);
});

test('removes execution-start language', () => {
  const input = 'Starting this adjustment—please hold on a moment.';
  const output = sanitizeDesignerAssistantMessage(input);
  assert.match(output, /captured that direction/i);
  assert.doesNotMatch(output, /Starting this adjustment/i);
});

test('rewrites execution-forward follow-up menu', () => {
  const input = 'Would you like me to automatically add these effects and adjust the sequence now, or do you prefer a preview plan first?';
  const output = sanitizeDesignerAssistantMessage(input);
  assert.equal(output, 'If that direction feels right, I can turn it into a reviewable design proposal next.');
});

test('rewrites next-step execution bullets into design-pass language', () => {
  const input = 'Next, I\'ll: 1. Mark all chorus sections in the timeline. 2. Plan warm and bright effects for the Snowman.';
  const output = sanitizeDesignerAssistantMessage(input);
  assert.match(output, /The next design pass should:/);
  assert.doesNotMatch(output, /I\'ll/);
});
