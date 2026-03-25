import unittest
from unittest import mock

import numpy as np

import main


class AnalysisServiceHeuristicsTests(unittest.TestCase):
    def test_normalize_analysis_profile_fast_disables_remote_and_heavy_features(self):
        profile = main._normalize_analysis_profile("fast")
        self.assertEqual(profile["mode"], "fast")
        self.assertFalse(profile["enableRemoteIdentity"])
        self.assertFalse(profile["enableWebTempo"])
        self.assertFalse(profile["enableLyrics"])
        self.assertFalse(profile["enableMadmomChords"])
        self.assertFalse(profile["enableMadmomDownbeatCrosscheck"])

    def test_build_numbered_sections_normalizes_existing_suffixes(self):
        rows = [
            {"startMs": 0, "endMs": 10, "label": "Verse 1"},
            {"startMs": 10, "endMs": 20, "label": "Verse"},
            {"startMs": 20, "endMs": 30, "label": "Chorus 1"},
            {"startMs": 30, "endMs": 40, "label": "Chorus 2"},
            {"startMs": 40, "endMs": 50, "label": "Outro"},
        ]
        out = main._build_numbered_sections(rows)
        self.assertEqual(
            [row["label"] for row in out],
            ["Verse 1", "Verse 2", "Chorus 1", "Chorus 2", "Outro"],
        )

    def test_label_song_sections_preserves_exposition_before_dominant_repetition(self):
        segments = [
            {"startMs": 0, "endMs": 10},
            {"startMs": 10, "endMs": 20},
            {"startMs": 20, "endMs": 30},
            {"startMs": 30, "endMs": 40},
            {"startMs": 40, "endMs": 50},
            {"startMs": 50, "endMs": 60},
        ]
        a = np.array([1.0, 0.0, 0.0])
        b = np.array([0.0, 1.0, 0.0])
        c = np.array([0.0, 0.0, 1.0])
        section_chroma = [a, a, a, a, b, c]
        section_energy = [0.8, 0.82, 0.81, 0.83, 0.45, 0.3]
        out = main._label_song_sections(segments, section_chroma, section_energy, 60)
        self.assertEqual(
            [row["label"] for row in out],
            ["Intro", "Refrain 1", "Refrain 2", "Refrain 3", "Instrumental", "Outro"],
        )

    def test_label_song_sections_uses_chorus_when_repeated_material_arrives_later(self):
        segments = [
            {"startMs": 0, "endMs": 20000},
            {"startMs": 20000, "endMs": 40000},
            {"startMs": 40000, "endMs": 60000},
            {"startMs": 60000, "endMs": 80000},
            {"startMs": 80000, "endMs": 100000},
        ]
        a = np.array([1.0, 0.0, 0.0])
        b = np.array([0.0, 1.0, 0.0])
        c = np.array([0.0, 0.0, 1.0])
        section_chroma = [a, b, c, b, c]
        section_energy = [0.25, 0.55, 0.45, 0.6, 0.4]
        out = main._label_song_sections(segments, section_chroma, section_energy, 100000)
        self.assertEqual(
            [row["label"] for row in out],
            ["Verse 1", "Chorus 1", "Verse 2", "Chorus 2", "Outro"],
        )

    def test_build_section_recurrence_backbone_emits_family_sequence(self):
        segments = [
            {"startMs": 0, "endMs": 10},
            {"startMs": 10, "endMs": 20},
            {"startMs": 20, "endMs": 30},
            {"startMs": 30, "endMs": 40},
        ]
        a = np.array([1.0, 0.0, 0.0])
        b = np.array([0.0, 1.0, 0.0])
        section_chroma = [a, b, a, b]
        backbone = main._build_section_recurrence_backbone(segments, section_chroma)
        self.assertEqual(backbone["sequence"], ["A", "B", "A", "B"])
        self.assertEqual([row["label"] for row in backbone["families"]], ["A", "B"])
        self.assertEqual(backbone["segments"][2]["familyLabel"], "A")

    def test_infer_beats_per_bar_prefers_four_when_two_is_nearly_tied(self):
        with mock.patch.object(
            main,
            "_best_accent_phase",
            side_effect=[(0, 0.206), (0, 0.089), (1, 0.189)],
        ):
            beats_per_bar, offset, scores = main._infer_beats_per_bar_from_accent(
                [0, 500, 1000, 1500, 2000, 2500],
                np.zeros(10, dtype=float),
                22050,
                4,
            )
        self.assertEqual(beats_per_bar, 4)
        self.assertEqual(offset, 1)
        self.assertAlmostEqual(scores[2], 0.206)
        self.assertAlmostEqual(scores[4], 0.189)

    def test_should_probe_fast_triple_meter_only_for_close_triple_quad_ambiguity(self):
        self.assertTrue(
            main._should_probe_fast_triple_meter(
                4,
                {2: 0.1056, 3: 0.0521, 4: 0.1360},
            )
        )
        self.assertFalse(
            main._should_probe_fast_triple_meter(
                4,
                {2: 0.2060, 3: 0.0894, 4: 0.1889},
            )
        )
        self.assertFalse(
            main._should_probe_fast_triple_meter(
                4,
                {2: 0.0502, 3: 0.0261, 4: 0.1453},
            )
        )

    def test_build_rhythm_provider_agreement_flags_meter_disagreement(self):
        agreement = main._build_rhythm_provider_agreement(
            primary_provider="librosa",
            primary_beats_per_bar=4,
            primary_time_signature="4/4",
            primary_bpm=112.36,
            secondary_summary={
                "enabled": True,
                "available": True,
                "provider": "madmom_downbeat",
                "beatsPerBar": 3,
                "timeSignature": "3/4",
                "bpm": 95.24,
            },
        )
        self.assertTrue(agreement["enabled"])
        self.assertTrue(agreement["available"])
        self.assertFalse(agreement["agreedOnBeatsPerBar"])
        self.assertFalse(agreement["agreedOnTimeSignature"])
        self.assertAlmostEqual(agreement["bpmDelta"], 17.12)

    def test_should_prefer_secondary_meter_only_for_measured_triple_override_case(self):
        self.assertTrue(
            main._should_prefer_secondary_meter(
                primary_beats_per_bar=4,
                primary_beat_count=242,
                primary_bpm=95.69,
                secondary_candidate={
                    "available": True,
                    "beatsPerBar": 3,
                    "beatCount": 236,
                    "bpm": 95.24,
                },
            )
        )

    def test_cached_rhythm_payload_extracts_reusable_rows(self):
        payload = main._cached_rhythm_payload(
            {
                "rhythm": {
                    "data": {
                        "bpm": 128,
                        "timeSignature": "4/4",
                        "beats": [{"startMs": 0, "endMs": 500, "label": "1"}],
                        "bars": [{"startMs": 0, "endMs": 2000, "label": "1"}],
                        "providerAgreement": {"primary": {"beatsPerBar": 4}},
                        "providerResults": {"selectedProvider": "librosa"},
                    }
                }
            },
            120000,
        )
        self.assertIsNotNone(payload)
        self.assertEqual(payload["beatsPerBar"], 4)
        self.assertEqual(payload["timeSignature"], "4/4")
        self.assertEqual(payload["providerResults"]["selectedProvider"], "librosa")
        self.assertEqual(len(payload["beats"]), 1)

    def test_cached_structure_segments_extracts_reusable_boundaries(self):
        rows = main._cached_structure_segments(
            {
                "structureBackbone": {
                    "data": {
                        "segments": [
                            {"startMs": 0, "endMs": 1000, "label": "Section 1"},
                            {"startMs": 1000, "endMs": 2000, "label": "Section 2"},
                        ]
                    }
                }
            },
            5000,
        )
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["label"], "Section 1")
        self.assertEqual(rows[1]["startMs"], 1000)
        self.assertFalse(
            main._should_prefer_secondary_meter(
                primary_beats_per_bar=4,
                primary_beat_count=445,
                primary_bpm=112.36,
                secondary_candidate={
                    "available": True,
                    "beatsPerBar": 4,
                    "beatCount": 442,
                    "bpm": 113.21,
                },
            )
        )

    def test_refine_audio_sections_promotes_weak_audio_labels_from_lyrics(self):
        audio_sections = [
            {"startMs": 0, "endMs": 1000, "label": "Theme 1"},
            {"startMs": 1000, "endMs": 2000, "label": "Refrain 1"},
            {"startMs": 2000, "endMs": 3000, "label": "Contrast 1"},
        ]
        lyric_sections = [
            {"startMs": 0, "endMs": 1000, "label": "Verse"},
            {"startMs": 1000, "endMs": 2000, "label": "Chorus"},
            {"startMs": 2000, "endMs": 3000, "label": "Bridge"},
        ]
        out = main._refine_audio_sections_with_semantic_spans(audio_sections, lyric_sections)
        self.assertEqual(
            [row["label"] for row in out],
            ["Verse", "Chorus", "Bridge"],
        )

    def test_refine_audio_sections_keeps_specific_pop_labels_when_lyrics_disagree(self):
        audio_sections = [
            {"startMs": 0, "endMs": 1000, "label": "Verse 1"},
            {"startMs": 1000, "endMs": 2000, "label": "Chorus 1"},
        ]
        lyric_sections = [
            {"startMs": 0, "endMs": 1000, "label": "Chorus"},
            {"startMs": 1000, "endMs": 2000, "label": "Verse"},
        ]
        out = main._refine_audio_sections_with_semantic_spans(audio_sections, lyric_sections)
        self.assertEqual(
            [row["label"] for row in out],
            ["Verse", "Chorus"],
        )

    def test_refine_audio_sections_splits_coarse_audio_section_by_lyric_boundaries(self):
        audio_sections = [
            {"startMs": 0, "endMs": 5000, "label": "Chorus 1"},
        ]
        lyric_sections = [
            {"startMs": 0, "endMs": 2200, "label": "Verse"},
            {"startMs": 2200, "endMs": 5000, "label": "Chorus"},
        ]
        out = main._refine_audio_sections_with_semantic_spans(audio_sections, lyric_sections)
        self.assertEqual(
            [row["label"] for row in out],
            ["Verse", "Chorus"],
        )

    def test_refine_audio_sections_split_preserves_uncovered_gaps(self):
        audio_sections = [
            {"startMs": 0, "endMs": 6000, "label": "Theme 1"},
        ]
        lyric_sections = [
            {"startMs": 1000, "endMs": 2500, "label": "Verse"},
            {"startMs": 3500, "endMs": 6000, "label": "Chorus"},
        ]
        out = main._refine_audio_sections_with_semantic_spans(audio_sections, lyric_sections)
        self.assertEqual(
            [(row["startMs"], row["endMs"], row["label"]) for row in out],
            [
                (0, 1000, "Theme 1"),
                (1000, 2500, "Verse"),
                (2500, 3500, "Theme 2"),
                (3500, 6000, "Chorus"),
            ],
        )

    def test_refine_audio_sections_merges_adjacent_same_label_after_split(self):
        audio_sections = [
            {"startMs": 0, "endMs": 2000, "label": "Theme 1"},
            {"startMs": 2000, "endMs": 4000, "label": "Theme 1"},
        ]
        lyric_sections = [
            {"startMs": 0, "endMs": 4000, "label": "Verse"},
        ]
        out = main._refine_audio_sections_with_semantic_spans(audio_sections, lyric_sections)
        self.assertEqual(
            [(row["startMs"], row["endMs"], row["label"]) for row in out],
            [(0, 4000, "Verse")],
        )

    def test_merge_adjacent_same_label_sections_merges_numbered_variants(self):
        out = main._merge_adjacent_same_label_sections([
            {"startMs": 0, "endMs": 1000, "label": "Verse 4"},
            {"startMs": 1000, "endMs": 2200, "label": "Verse 5"},
            {"startMs": 2200, "endMs": 3000, "label": "Outro"},
        ])
        self.assertEqual(
            out,
            [
                {"startMs": 0, "endMs": 2200, "label": "Verse 4"},
                {"startMs": 2200, "endMs": 3000, "label": "Outro"},
            ],
        )

    def test_refine_audio_sections_keeps_short_contrastive_lyric_span_inside_long_section(self):
        audio_sections = [
            {"startMs": 0, "endMs": 10000, "label": "Chorus 1"},
        ]
        lyric_sections = [
            {"startMs": 0, "endMs": 4000, "label": "Chorus"},
            {"startMs": 4000, "endMs": 6000, "label": "Verse"},
            {"startMs": 6000, "endMs": 10000, "label": "Chorus"},
        ]
        out = main._refine_audio_sections_with_semantic_spans(audio_sections, lyric_sections)
        self.assertEqual(
            [(row["startMs"], row["endMs"], row["label"]) for row in out],
            [
                (0, 4000, "Chorus 1"),
                (4000, 6000, "Verse"),
                (6000, 10000, "Chorus 2"),
            ],
        )

    def test_infer_sections_from_lyrics_detects_similar_repeated_stanzas(self):
        lyrics_marks = [
            {"startMs": 0, "endMs": 1000, "label": "I got this feeling inside my bones"},
            {"startMs": 1100, "endMs": 2100, "label": "It goes electric wavy when I turn it on"},
            {"startMs": 6000, "endMs": 7000, "label": "Cause I got that sunshine in my pocket"},
            {"startMs": 7100, "endMs": 8100, "label": "Got that good soul in my feet"},
            {"startMs": 8200, "endMs": 9200, "label": "I feel that hot blood in my body"},
            {"startMs": 15000, "endMs": 16000, "label": "I got this feeling inside my bones"},
            {"startMs": 16100, "endMs": 17100, "label": "It goes electric baby when I turn it on"},
            {"startMs": 22000, "endMs": 23000, "label": "Cause I got that sunshine in my pocket"},
            {"startMs": 23100, "endMs": 24100, "label": "Got that good soul in my feet"},
            {"startMs": 24200, "endMs": 25200, "label": "I feel that hot blood in my body"},
        ]
        out = main._infer_sections_from_lyrics(lyrics_marks, 26000)
        self.assertEqual(
            [row["label"] for row in out],
            ["Verse 1", "Chorus 1", "Verse 2", "Chorus 2", "Outro"],
        )

    def test_infer_sections_from_lyrics_handles_no_repeated_chorus_evidence(self):
        lyrics_marks = [
            {"startMs": 1000, "endMs": 2500, "label": "first snow is falling"},
            {"startMs": 2500, "endMs": 4000, "label": "children gather by the fire"},
            {"startMs": 9000, "endMs": 10500, "label": "silver bells keep ringing"},
            {"startMs": 10500, "endMs": 12000, "label": "families sing into the night"},
        ]
        out = main._infer_sections_from_lyrics(lyrics_marks, 15000)
        self.assertEqual(
            [row["label"] for row in out],
            ["Intro", "Verse", "Outro"],
        )

    def test_infer_sections_from_lyrics_uses_repeated_lines_when_single_stanza(self):
        lyrics_marks = [
            {"startMs": 1000, "endMs": 2500, "label": "Out of all the reindeer you know you're the mastermind"},
            {"startMs": 3000, "endMs": 4500, "label": "Run run Rudolph Randolph's not too far behind"},
            {"startMs": 5000, "endMs": 6500, "label": "Santa's got to make it to town"},
            {"startMs": 8200, "endMs": 9700, "label": "Said Santa to a boy child what have you been longing for"},
            {"startMs": 10200, "endMs": 11700, "label": "Run run Rudolph Santa's got to make it to town"},
            {"startMs": 12200, "endMs": 13700, "label": "Tell him he can take the freeway down"},
        ]
        out = main._infer_sections_from_lyrics(lyrics_marks, 22000)
        labels = [row["label"] for row in out]
        self.assertEqual(labels[0], "Intro")
        self.assertIn("Chorus 1", labels)
        self.assertIn("Chorus 2", labels)
        self.assertEqual(labels[-1], "Outro")

    def test_lyric_window_looks_like_outro_for_repeated_hook_tail(self):
        rows = [
            {"startMs": 0, "endMs": 1000, "label": "Holiday Road"},
            {"startMs": 1000, "endMs": 2000, "label": "Holiday Road"},
            {"startMs": 2000, "endMs": 3000, "label": "(Oh-oh-oh-oh-oh)"},
            {"startMs": 3000, "endMs": 4000, "label": "(Oh-oh-oh-oh-oh)"},
        ]
        self.assertTrue(main._lyric_window_looks_like_outro(rows))

    def test_lyric_window_looks_like_outro_for_hook_variants(self):
        rows = [
            {"startMs": 0, "endMs": 1000, "label": "It's the most wonderful time"},
            {"startMs": 1000, "endMs": 2000, "label": "Yes the most wonderful time"},
            {"startMs": 2000, "endMs": 3000, "label": "Oh the most wonderful time"},
            {"startMs": 3000, "endMs": 4000, "label": "Of the year"},
        ]
        self.assertTrue(main._lyric_window_looks_like_outro(rows))

    def test_infer_sections_from_lyrics_marks_short_post_chorus_tail_as_outro(self):
        lyrics_marks = [
            {"startMs": 0, "endMs": 1000, "label": "it's the most wonderful time of the year"},
            {"startMs": 1000, "endMs": 2000, "label": "there'll be much mistletoeing"},
            {"startMs": 2000, "endMs": 3000, "label": "and hearts will be glowing"},
            {"startMs": 3000, "endMs": 4000, "label": "when loved ones are near"},
            {"startMs": 5000, "endMs": 6000, "label": "it's the most wonderful time"},
            {"startMs": 6000, "endMs": 7000, "label": "yes the most wonderful time"},
            {"startMs": 7000, "endMs": 8000, "label": "oh the most wonderful time"},
            {"startMs": 8000, "endMs": 9000, "label": "of the year"},
        ]
        out = main._infer_sections_from_lyrics(lyrics_marks, 10000)
        self.assertEqual(out[-1]["label"], "Outro")


if __name__ == "__main__":
    unittest.main()
