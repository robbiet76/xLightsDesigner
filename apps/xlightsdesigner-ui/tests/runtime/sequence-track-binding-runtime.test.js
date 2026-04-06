import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSequenceTrackBindingFromArtifact,
  normalizeSequenceTrackBinding
} from "../../runtime/sequence-track-binding-runtime.js";

test("buildSequenceTrackBindingFromArtifact captures fingerprint, display name, and preferred audio path", () => {
  const binding = buildSequenceTrackBindingFromArtifact({
    audioPath: "/show/Audio/Candy Cane Lane.mp3",
    artifact: {
      media: { contentFingerprint: "ABC123" },
      identity: {
        title: "Candy Cane Lane",
        artist: "Sia"
      }
    }
  });

  assert.deepEqual(binding, {
    preferredAudioPath: "/show/Audio/Candy Cane Lane.mp3",
    contentFingerprint: "abc123",
    title: "Candy Cane Lane",
    artist: "Sia",
    displayName: "Candy Cane Lane - Sia"
  });
});

test("normalizeSequenceTrackBinding drops empty values and derives display name", () => {
  const binding = normalizeSequenceTrackBinding({
    preferredAudioPath: "/library/audio/grinch.mp3",
    contentFingerprint: " F00D ",
    title: "Grinch",
    artist: ""
  });

  assert.deepEqual(binding, {
    preferredAudioPath: "/library/audio/grinch.mp3",
    contentFingerprint: "f00d",
    title: "Grinch",
    artist: "",
    displayName: "Grinch"
  });
});

test("normalizeSequenceTrackBinding returns null for empty bindings", () => {
  assert.equal(normalizeSequenceTrackBinding({}), null);
  assert.equal(normalizeSequenceTrackBinding(null), null);
});
