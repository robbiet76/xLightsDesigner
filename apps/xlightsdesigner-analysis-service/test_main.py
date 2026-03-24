import unittest
from unittest import mock

import numpy as np

import main


class AnalysisServiceHeuristicsTests(unittest.TestCase):
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
            ["Verse 1", "Verse 2", "Chorus 1", "Chorus 2", "Verse 3", "Outro"],
        )

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


if __name__ == "__main__":
    unittest.main()
