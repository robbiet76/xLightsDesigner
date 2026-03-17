import test from "node:test";
import assert from "node:assert/strict";

import { buildMusicDesignContext } from "../../../agent/designer-dialog/music-design-context.js";

test("buildMusicDesignContext derives section arc and design cues", () => {
  const context = buildMusicDesignContext({
    analysisArtifact: {
      mediaId: "media-1",
      timing: {
        beats: [
          { startMs: 2000, endMs: 2500, label: "1" },
          { startMs: 2500, endMs: 3000, label: "2" },
          { startMs: 3000, endMs: 3500, label: "3" }
        ]
      },
      harmonic: {
        chords: [
          { startMs: 1000, endMs: 2200, label: "C" },
          { startMs: 2200, endMs: 4000, label: "G" }
        ]
      },
      lyrics: {
        lines: [
          { startMs: 2100, endMs: 3200, label: "Lift phrase" }
        ]
      },
      capabilities: {
        structure: {
          sections: [
            { label: "Intro", startMs: 0, endMs: 1000 },
            { label: "Verse", startMs: 1000, endMs: 2000 },
            { label: "Chorus", startMs: 2000, endMs: 4000 },
            { label: "Outro" }
          ]
        }
      }
    },
    analysisHandoff: {
      lyrics: {
        sections: [{ label: "Chorus" }]
      }
    }
  });

  assert.equal(context.artifactType, "music_design_context_v1");
  assert.equal(context.mediaId, "media-1");
  assert.deepEqual(
    context.sectionArc.map((row) => [row.label, row.energy, row.density]),
    [
      ["Intro", "low", "sparse"],
      ["Verse", "medium", "moderate"],
      ["Chorus", "high", "dense"],
      ["Outro", "low", "sparse"]
    ]
  );
  assert.ok(context.designCues.revealMoments.includes("Verse->Chorus"));
  assert.ok(context.designCues.holdMoments.includes("Intro"));
  assert.ok(context.designCues.lyricFocusMoments.includes("Chorus"));
  assert.equal(context.designCues.cueWindowsBySection.Chorus.beat[0].trackName, "XD: Beat Grid");
  assert.equal(context.designCues.cueWindowsBySection.Chorus.chord[0].trackName, "XD: Chord Changes");
  assert.equal(context.designCues.cueWindowsBySection.Chorus.phrase[0].trackName, "XD: Phrase Cues");
});
