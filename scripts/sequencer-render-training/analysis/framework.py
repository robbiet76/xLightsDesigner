#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Protocol


@dataclass
class SequenceAnalysisInput:
    model_type: str
    decoded_window: Dict[str, Any]
    model_metadata: Dict[str, Any]
    effect_name: str
    effect_settings: Dict[str, Any]
    shared_settings: Dict[str, Any]


class Analyzer(Protocol):
    def analyze(self, inp: SequenceAnalysisInput) -> Dict[str, Any]:
        ...


class BaseAnalyzer:
    family = "base"

    def _f(self, inp: SequenceAnalysisInput, key: str, default: float = 0.0) -> float:
        value = inp.decoded_window.get(key, default)
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _common_quality(self, inp: SequenceAnalysisInput) -> Dict[str, float]:
        active = self._f(inp, "averageActiveNodeRatio")
        temporal = self._f(inp, "temporalChangeMean")
        longest_run = self._f(inp, "averageLongestRunRatio")
        brightness = self._f(inp, "averageNodeBrightness", self._f(inp, "averageChannelLevel"))
        return {
            "coverage": active,
            "motion": temporal,
            "contiguity": longest_run,
            "brightness": brightness,
        }

    def _common_intents(self, quality: Dict[str, float]) -> List[str]:
        tags: List[str] = []
        if quality["coverage"] >= 0.85:
            tags.extend(["full", "fill"])
        elif quality["coverage"] <= 0.2:
            tags.append("sparse")
        else:
            tags.append("partial")
        if quality["motion"] <= 0.02:
            tags.append("steady")
        else:
            tags.append("animated")
        if quality["contiguity"] >= 0.65:
            tags.append("clean")
        elif quality["contiguity"] <= 0.2:
            tags.append("busy")
        if quality["brightness"] >= 0.6:
            tags.append("bold")
        else:
            tags.append("restrained")
        return sorted(set(tags))

    def analyze(self, inp: SequenceAnalysisInput) -> Dict[str, Any]:
        frames: List[Dict[str, Any]] = inp.decoded_window.get("frames", [])
        quality = self._common_quality(inp)
        return {
            "analyzerFamily": self.family,
            "frameCount": len(frames),
            "supportsPerFrame": bool(frames),
            "qualitySignals": quality,
            "intentCandidates": self._common_intents(quality),
            "patternSignals": {
                "coverageClass": (
                    "full" if quality["coverage"] >= 0.85 else
                    "sparse" if quality["coverage"] <= 0.2 else
                    "partial"
                ),
                "motionClass": "steady" if quality["motion"] <= 0.02 else "animated",
                "structureClass": (
                    "contiguous" if quality["contiguity"] >= 0.65 else
                    "fragmented" if quality["contiguity"] <= 0.2 else
                    "segmented"
                ),
            },
            "notes": [
                "generic framework scaffold",
                "geometry-specific analyzers should replace coarse fallback metrics"
            ]
        }


class LinearAnalyzer(BaseAnalyzer):
    family = "linear"

    def analyze(self, inp: SequenceAnalysisInput) -> Dict[str, Any]:
        base = super().analyze(inp)
        centroid_motion = self._f(inp, "centroidMotionMean")
        longest_run = self._f(inp, "averageLongestRunRatio")
        run_count = self._f(inp, "averageRunCount")
        effect = inp.effect_name

        direction = "ambiguous"
        settings = inp.effect_settings
        if effect == "SingleStrand":
            chase_type = str(settings.get("chaseType", "")).lower()
            direction_setting = str(settings.get("direction", "")).lower()
            if "bounce" in chase_type:
                direction = "bounce"
            elif direction_setting == "left":
                direction = "left"
            elif direction_setting == "right":
                direction = "right"
            elif "left-right" in chase_type:
                direction = "left_to_right"
            elif "right-left" in chase_type:
                direction = "right_to_left"

        pattern_family = "unclassified"
        if effect == "On":
            pattern_family = "static_hold"
        elif effect == "Shimmer":
            pattern_family = "shimmer"
        elif effect == "SingleStrand":
            mode = settings.get("mode", "")
            if mode == "FX":
                pattern_family = "burst_texture"
            elif direction == "bounce":
                pattern_family = "bounce"
            elif mode == "Skips":
                pattern_family = "skips"
            else:
                pattern_family = "directional_chase"

        base["geometrySignals"] = {
            "centroidMotionMean": centroid_motion,
            "runCountMean": run_count,
            "longestRunRatio": longest_run,
            "directionality": direction,
        }
        base["patternFamily"] = pattern_family
        base["patternSignals"].update(
            {
                "directionality": direction,
                "segmentClass": (
                    "long_run" if longest_run >= 0.65 else
                    "fragmented" if longest_run <= 0.2 else
                    "segmented"
                ),
                "motionStrength": (
                    "high" if centroid_motion >= 0.03 else
                    "low" if centroid_motion <= 0.005 else
                    "medium"
                ),
            }
        )
        intents = set(base["intentCandidates"])
        if direction in {"left", "right", "left_to_right", "right_to_left"}:
            intents.add("directional")
        if direction == "bounce":
            intents.add("bouncy")
        if longest_run >= 0.65:
            intents.add("patterned")
        if pattern_family == "burst_texture":
            intents.add("texture_heavy")
        base["intentCandidates"] = sorted(intents)
        return base


class TreeAnalyzer(BaseAnalyzer):
    family = "tree"

    def analyze(self, inp: SequenceAnalysisInput) -> Dict[str, Any]:
        base = super().analyze(inp)
        centroid_motion = self._f(inp, "centroidMotionMean")
        coverage = self._f(inp, "averageActiveNodeRatio")
        temporal = self._f(inp, "temporalChangeMean")

        pattern_family = "tree_fill"
        if inp.effect_name == "Shimmer":
            pattern_family = "tree_shimmer"
        elif inp.effect_name == "SingleStrand":
            pattern_family = "spiral_travel" if centroid_motion > 0.01 else "tree_band_motion"
        elif inp.effect_name == "On":
            pattern_family = "static_fill"

        base["geometrySignals"] = {
            "treeCoverage": coverage,
            "treeMotion": temporal,
            "treeCentroidMotion": centroid_motion,
        }
        base["patternFamily"] = pattern_family
        base["patternSignals"].update(
            {
                "treeStructure": (
                    "full_fill" if coverage >= 0.85 else
                    "sparse_fill" if coverage <= 0.2 else
                    "banded"
                ),
                "treeMotionClass": "sparkle" if inp.effect_name == "Shimmer" else base["patternSignals"]["motionClass"],
            }
        )
        intents = set(base["intentCandidates"])
        if coverage >= 0.85:
            intents.add("fill")
        if inp.effect_name == "Shimmer":
            intents.add("texture_heavy")
        base["intentCandidates"] = sorted(intents)
        return base


class StarAnalyzer(BaseAnalyzer):
    family = "star"

    def analyze(self, inp: SequenceAnalysisInput) -> Dict[str, Any]:
        base = super().analyze(inp)
        coverage = self._f(inp, "averageActiveNodeRatio")
        temporal = self._f(inp, "temporalChangeMean")

        pattern_family = "star_fill"
        if inp.effect_name == "Shimmer":
            pattern_family = "radial_sparkle"
        elif inp.effect_name == "On":
            pattern_family = "static_fill"

        base["geometrySignals"] = {
            "radialCoverage": coverage,
            "radialMotion": temporal,
        }
        base["patternFamily"] = pattern_family
        base["patternSignals"].update(
            {
                "radialStructure": (
                    "full_fill" if coverage >= 0.85 else
                    "sparse_points" if coverage <= 0.2 else
                    "partial_fill"
                )
            }
        )
        intents = set(base["intentCandidates"])
        if inp.effect_name == "Shimmer":
            intents.add("texture_heavy")
        if coverage >= 0.85:
            intents.add("fill")
        base["intentCandidates"] = sorted(intents)
        return base


ANALYZERS = {
    "outline": LinearAnalyzer(),
    "single_line": LinearAnalyzer(),
    "cane": LinearAnalyzer(),
    "tree_flat": TreeAnalyzer(),
    "tree_360": TreeAnalyzer(),
    "star": StarAnalyzer(),
}


def get_analyzer(model_type: str) -> Analyzer:
    return ANALYZERS.get(model_type, BaseAnalyzer())
