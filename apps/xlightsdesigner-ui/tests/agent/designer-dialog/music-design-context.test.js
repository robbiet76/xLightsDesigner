import test from "node:test";
import assert from "node:assert/strict";

import { buildMusicDesignContext } from "../../../agent/designer-dialog/music-design-context.js";

test("buildMusicDesignContext derives section arc and design cues", () => {
  const context = buildMusicDesignContext({
    analysisArtifact: {
      mediaId: "media-1",
      capabilities: {
        structure: {
          sections: [
            { label: "Intro" },
            { label: "Verse" },
            { label: "Chorus" },
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
});
