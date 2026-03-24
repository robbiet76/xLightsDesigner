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

test("buildMusicDesignContext derives fallback phrase cues from bars when lyric lines are absent", () => {
  const context = buildMusicDesignContext({
    analysisArtifact: {
      mediaId: "media-2",
      timing: {
        beats: [
          { startMs: 2000, endMs: 2500, label: "1" },
          { startMs: 2500, endMs: 3000, label: "2" },
          { startMs: 3000, endMs: 3500, label: "3" },
          { startMs: 3500, endMs: 4000, label: "4" }
        ],
        bars: [
          { startMs: 2000, endMs: 3000, label: "Bar 1" },
          { startMs: 3000, endMs: 4000, label: "Bar 2" }
        ]
      },
      harmonic: {
        chords: []
      },
      lyrics: {
        lines: []
      },
      capabilities: {
        structure: {
          sections: [
            { label: "Bridge", startMs: 2000, endMs: 4000 }
          ]
        }
      }
    },
    analysisHandoff: {
      lyrics: {
        sections: []
      }
    }
  });

  assert.equal(context.designCues.cueWindowsBySection.Bridge.phrase[0].trackName, "XD: Phrase Cues");
  assert.deepEqual(
    context.designCues.cueWindowsBySection.Bridge.phrase.map((row) => [row.label, row.startMs, row.endMs]),
    [
      ["Phrase Hold", 2000, 3000],
      ["Phrase Release", 3000, 4000]
    ]
  );
});

test("buildMusicDesignContext falls back to analysisHandoff timing data when analysisArtifact is absent", () => {
  const context = buildMusicDesignContext({
    analysisArtifact: null,
    analysisHandoff: {
      timing: {
        beats: [
          { startMs: 1000, endMs: 1500, label: "1" },
          { startMs: 1500, endMs: 2000, label: "2" }
        ],
        bars: [
          { startMs: 1000, endMs: 2000, label: "Bar 1" },
          { startMs: 2000, endMs: 3000, label: "Bar 2" }
        ]
      },
      lyrics: {
        lines: [
          { startMs: 1000, endMs: 2000, label: "Phrase One" }
        ],
        sections: [{ label: "Chorus" }]
      },
      harmonic: {
        chords: [
          { startMs: 1000, endMs: 2000, label: "C" }
        ]
      },
      structure: {
        sections: [
          { label: "Chorus", startMs: 1000, endMs: 3000 }
        ]
      }
    }
  });

  assert.equal(context.designCues.cueWindowsBySection.Chorus.beat[0].trackName, "XD: Beat Grid");
  assert.equal(context.designCues.cueWindowsBySection.Chorus.chord[0].trackName, "XD: Chord Changes");
  assert.equal(context.designCues.cueWindowsBySection.Chorus.phrase[0].trackName, "XD: Phrase Cues");
});
