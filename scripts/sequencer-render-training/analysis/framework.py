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

    def _frames(self, inp: SequenceAnalysisInput) -> List[Dict[str, Any]]:
        frames = inp.decoded_window.get("frames", [])
        return frames if isinstance(frames, list) else []

    def _frame_centroids(self, inp: SequenceAnalysisInput) -> List[float]:
        values: List[float] = []
        for frame in self._frames(inp):
            try:
                values.append(float(frame.get("centroidPosition", 0.0)))
            except (TypeError, ValueError):
                values.append(0.0)
        return values

    def _signed_deltas(self, values: List[float], epsilon: float = 0.0025) -> List[float]:
        deltas: List[float] = []
        for i in range(1, len(values)):
            delta = values[i] - values[i - 1]
            if abs(delta) >= epsilon:
                deltas.append(delta)
        return deltas

    def _signed_direction_summary(self, deltas: List[float], epsilon: float = 0.0025) -> Dict[str, Any]:
        positive = sum(1 for value in deltas if value > epsilon)
        negative = sum(1 for value in deltas if value < -epsilon)
        reversals = 0
        previous_sign = 0
        for value in deltas:
            sign = 1 if value > epsilon else -1 if value < -epsilon else 0
            if sign == 0:
                continue
            if previous_sign != 0 and sign != previous_sign:
                reversals += 1
            previous_sign = sign
        net = sum(deltas)
        return {
            "positiveSteps": positive,
            "negativeSteps": negative,
            "reversals": reversals,
            "netTravel": net,
        }

    def _frame_segments(self, frame: Dict[str, Any]) -> List[Dict[str, int]]:
        active = frame.get("nodeActive", [])
        if not isinstance(active, list):
            return []
        segments: List[Dict[str, int]] = []
        start = None
        for idx, raw in enumerate(active):
            is_on = bool(raw)
            if is_on and start is None:
                start = idx
            elif not is_on and start is not None:
                end = idx - 1
                segments.append({"start": start, "end": end, "length": end - start + 1})
                start = None
        if start is not None:
            end = len(active) - 1
            segments.append({"start": start, "end": end, "length": end - start + 1})
        return segments

    def _symmetry_score(self, frame: Dict[str, Any]) -> float:
        active = frame.get("nodeActive", [])
        if not isinstance(active, list) or not active:
            return 0.0
        matches = 0
        total = len(active)
        for i in range(total):
            if int(bool(active[i])) == int(bool(active[total - 1 - i])):
                matches += 1
        return matches / total

    def _rgb_roles(self, frame: Dict[str, Any]) -> Dict[str, int]:
        rgb = frame.get("nodeRgb", [])
        if not isinstance(rgb, list):
            return {"redDominant": 0, "greenDominant": 0, "blueDominant": 0}
        red = green = blue = 0
        for raw in rgb:
            if not isinstance(raw, list) or len(raw) < 3:
                continue
            r, g, b = int(raw[0]), int(raw[1]), int(raw[2])
            if r == g == b == 0:
                continue
            if r >= g and r >= b:
                red += 1
            elif g >= r and g >= b:
                green += 1
            elif b >= r and b >= g:
                blue += 1
        return {"redDominant": red, "greenDominant": green, "blueDominant": blue}

    def _mean(self, values: List[float]) -> float:
        return sum(values) / len(values) if values else 0.0

    def _lower_setting(self, settings: Dict[str, Any], key: str) -> str:
        value = settings.get(key, "")
        return str(value).strip().lower()

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
        settings = inp.effect_settings
        centroids = self._frame_centroids(inp)
        deltas = self._signed_deltas(centroids)
        direction_summary = self._signed_direction_summary(deltas)
        frames = self._frames(inp)
        segment_counts: List[float] = []
        segment_lengths: List[float] = []
        center_biases: List[float] = []
        symmetry_scores: List[float] = []
        red_roles = green_roles = blue_roles = 0
        edge_origin_frames = 0
        center_origin_frames = 0

        for frame in frames:
            segments = self._frame_segments(frame)
            segment_counts.append(float(len(segments)))
            if segments:
                segment_lengths.append(max(seg["length"] for seg in segments))
                first = min(segments, key=lambda seg: seg["start"])
                last = max(segments, key=lambda seg: seg["end"])
                node_count = max(len(frame.get("nodeActive", [])), 1)
                center_pos = (node_count - 1) / 2.0
                first_mid = (first["start"] + first["end"]) / 2.0
                last_mid = (last["start"] + last["end"]) / 2.0
                midpoint_bias = min(abs(first_mid - center_pos), abs(last_mid - center_pos)) / max(center_pos, 1.0)
                center_biases.append(1.0 - midpoint_bias)
                near_edge = first["start"] <= 1 or last["end"] >= node_count - 2
                near_center = abs(first_mid - center_pos) <= 2 or abs(last_mid - center_pos) <= 2
                if near_edge:
                    edge_origin_frames += 1
                if near_center:
                    center_origin_frames += 1
            else:
                segment_lengths.append(0.0)
                center_biases.append(0.0)
            symmetry_scores.append(self._symmetry_score(frame))
            roles = self._rgb_roles(frame)
            red_roles += roles["redDominant"]
            green_roles += roles["greenDominant"]
            blue_roles += roles["blueDominant"]

        mean_segment_count = self._mean(segment_counts)
        max_segment_length_ratio = (max(segment_lengths) / max(inp.model_metadata.get("nodeCount", 0), 1)) if segment_lengths else 0.0
        mean_center_bias = self._mean(center_biases)
        mean_symmetry = self._mean(symmetry_scores)
        dominant_color_role = "none"
        if max(red_roles, green_roles, blue_roles) > 0:
            if red_roles >= green_roles and red_roles >= blue_roles:
                dominant_color_role = "red"
            elif green_roles >= red_roles and green_roles >= blue_roles:
                dominant_color_role = "green"
            else:
                dominant_color_role = "blue"

        direction = "ambiguous"
        if (
            direction_summary["reversals"] > 0
            and direction_summary["positiveSteps"] >= 3
            and direction_summary["negativeSteps"] >= 3
            and mean_segment_count >= 2.0
        ):
            direction = "bounce"
        elif abs(direction_summary["netTravel"]) >= 0.02:
            direction = "left_to_right" if direction_summary["netTravel"] > 0 else "right_to_left"
        elif direction_summary["positiveSteps"] > 0 and direction_summary["negativeSteps"] == 0:
            direction = "left_to_right"
        elif direction_summary["negativeSteps"] > 0 and direction_summary["positiveSteps"] == 0:
            direction = "right_to_left"
        else:
            if effect == "SingleStrand":
                chase_type = self._lower_setting(settings, "chaseType")
                direction_setting = self._lower_setting(settings, "direction")
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
            elif effect == "Bars":
                direction_setting = self._lower_setting(settings, "direction")
                if direction_setting in {"left", "right", "up", "down"}:
                    direction = direction_setting
                elif direction_setting in {"expand", "compress"}:
                    direction = direction_setting

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
            elif mean_segment_count >= 2.0 and max_segment_length_ratio < 0.35:
                pattern_family = "segmented_chase"
            else:
                pattern_family = "directional_chase"
        elif effect == "Bars":
            bar_count = int(settings.get("barCount", 1) or 1)
            direction_setting = self._lower_setting(settings, "direction")
            if direction_setting == "expand":
                pattern_family = "expanding_bars"
            elif direction_setting == "compress":
                pattern_family = "compressing_bars"
            elif bar_count >= 4:
                pattern_family = "dense_bars"
            elif bar_count >= 2:
                pattern_family = "multi_bars"
            else:
                pattern_family = "single_bar_motion"
        elif effect == "Marquee":
            reverse = bool(settings.get("reverse", False))
            skip_size = int(settings.get("skipSize", 0) or 0)
            band_size = int(settings.get("bandSize", 1) or 1)
            direction = "reverse" if reverse else "forward"
            if reverse:
                pass
            if skip_size >= 4:
                pattern_family = "segmented_marquee"
            elif band_size >= 6:
                pattern_family = "wide_marquee"
            else:
                pattern_family = "marquee_motion"

        base["geometrySignals"] = {
            "centroidMotionMean": centroid_motion,
            "runCountMean": run_count,
            "longestRunRatio": longest_run,
            "directionality": direction,
            "centroidTraceFrameCount": len(centroids),
            "centroidPositiveSteps": direction_summary["positiveSteps"],
            "centroidNegativeSteps": direction_summary["negativeSteps"],
            "centroidDirectionReversals": direction_summary["reversals"],
            "centroidNetTravel": direction_summary["netTravel"],
            "meanSegmentCount": mean_segment_count,
            "maxSegmentLengthRatio": max_segment_length_ratio,
            "meanCenterBias": mean_center_bias,
            "meanSymmetryScore": mean_symmetry,
            "edgeOriginFrames": edge_origin_frames,
            "centerOriginFrames": center_origin_frames,
            "dominantColorRole": dominant_color_role,
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
                "segmentDensity": (
                    "multi_segment" if mean_segment_count >= 2.0 else
                    "single_segment" if mean_segment_count >= 0.9 else
                    "minimal"
                ),
                "originBias": (
                    "center" if center_origin_frames > edge_origin_frames else
                    "edge" if edge_origin_frames > center_origin_frames else
                    "mixed"
                ),
                "symmetryClass": (
                    "high" if mean_symmetry >= 0.85 else
                    "low" if mean_symmetry <= 0.45 else
                    "medium"
                ),
                "dominantColorRole": dominant_color_role,
                "barCountClass": (
                    "dense" if int(settings.get("barCount", 1) or 1) >= 4 else
                    "multi" if int(settings.get("barCount", 1) or 1) >= 2 else
                    "single"
                ) if effect == "Bars" else None,
                "marqueeGapClass": (
                    "wide_gap" if int(settings.get("skipSize", 0) or 0) >= 4 else
                    "tight_gap" if int(settings.get("skipSize", 0) or 0) <= 1 else
                    "medium_gap"
                ) if effect == "Marquee" else None,
            }
        )
        intents = set(base["intentCandidates"])
        if direction in {"left", "right", "left_to_right", "right_to_left"}:
            intents.add("directional")
        if direction in {"up", "down"}:
            intents.add("directional")
        if direction == "bounce":
            intents.add("bouncy")
        if longest_run >= 0.65 or pattern_family in {"directional_chase", "segmented_chase"}:
            intents.add("patterned")
        if mean_segment_count >= 2.0:
            intents.add("segmented")
        if pattern_family == "burst_texture":
            intents.add("texture_heavy")
        if effect == "Bars":
            intents.add("patterned")
            if int(settings.get("barCount", 1) or 1) >= 2:
                intents.add("segmented")
            if direction in {"expand", "compress"}:
                intents.add("animated")
        if effect == "Marquee":
            intents.add("patterned")
            intents.add("directional")
            if int(settings.get("skipSize", 0) or 0) >= 4:
                intents.add("segmented")
        base["intentCandidates"] = sorted(intents)
        return base


class TreeAnalyzer(BaseAnalyzer):
    family = "tree"

    def analyze(self, inp: SequenceAnalysisInput) -> Dict[str, Any]:
        base = super().analyze(inp)
        centroid_motion = self._f(inp, "centroidMotionMean")
        coverage = self._f(inp, "averageActiveNodeRatio")
        temporal = self._f(inp, "temporalChangeMean")
        settings = inp.effect_settings
        centroids = self._frame_centroids(inp)
        deltas = self._signed_deltas(centroids)
        direction_summary = self._signed_direction_summary(deltas)
        geometry_profile = inp.model_type

        pattern_family = "tree_fill"
        if inp.effect_name == "Shimmer":
            pattern_family = "tree_shimmer"
        elif inp.effect_name == "SingleStrand":
            pattern_family = "spiral_travel" if centroid_motion > 0.01 else "tree_band_motion"
        elif inp.effect_name == "Bars":
            direction_setting = self._lower_setting(settings, "direction")
            bar_count = int(settings.get("barCount", 1) or 1)
            if direction_setting == "expand":
                pattern_family = "tree_expanding_bars"
            elif direction_setting == "compress":
                pattern_family = "tree_compressing_bars"
            elif bar_count >= 4:
                pattern_family = "tree_dense_bars"
            else:
                pattern_family = "tree_bar_bands"
        elif inp.effect_name == "Spirals":
            movement = float(settings.get("movement", 0) or 0)
            rotation = float(settings.get("rotation", 0) or 0)
            count = int(settings.get("count", 1) or 1)
            thickness = float(settings.get("thickness", 50) or 50)
            if geometry_profile == "tree_360_spiral":
                if abs(movement) > 0 or abs(rotation) > 0:
                    pattern_family = "helical_spiral_motion"
                else:
                    pattern_family = "helical_spiral_bands"
            elif abs(movement) > 0 or abs(rotation) > 0:
                pattern_family = "spiral_motion"
            elif count >= 3 or thickness >= 65:
                pattern_family = "dense_spiral_fill"
            else:
                pattern_family = "spiral_bands"
        elif inp.effect_name == "Pinwheel":
            arms = int(settings.get("arms", 3) or 3)
            rotation = bool(settings.get("rotation", False))
            if geometry_profile == "tree_360_spiral":
                pattern_family = "helical_pinwheel"
            elif rotation:
                pattern_family = "tree_pinwheel_rotation"
            elif arms >= 6:
                pattern_family = "dense_pinwheel"
            else:
                pattern_family = "tree_pinwheel"
        elif inp.effect_name == "On":
            pattern_family = "static_fill"

        base["geometrySignals"] = {
            "treeCoverage": coverage,
            "treeMotion": temporal,
            "treeCentroidMotion": centroid_motion,
            "treeDirectionReversals": direction_summary["reversals"],
            "treeNetTravel": direction_summary["netTravel"],
            "spiralGeometryProfile": geometry_profile == "tree_360_spiral",
            "configuredSpiralCount": int(settings.get("count", 1) or 1) if inp.effect_name == "Spirals" else None,
            "configuredBarCount": int(settings.get("barCount", 1) or 1) if inp.effect_name == "Bars" else None,
            "configuredPinwheelArms": int(settings.get("arms", 3) or 3) if inp.effect_name == "Pinwheel" else None,
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
                "treeTraversalClass": (
                    "dynamic" if abs(direction_summary["netTravel"]) >= 0.02 or temporal >= 0.03 else
                    "stable"
                ),
                "pinwheelArmDensityClass": (
                    "dense" if int(settings.get("arms", 3) or 3) >= 6 else
                    "multi" if int(settings.get("arms", 3) or 3) >= 4 else
                    "few"
                ) if inp.effect_name == "Pinwheel" else None,
                "pinwheelRotationClass": (
                    "rotating" if bool(settings.get("rotation", False)) else "static"
                ) if inp.effect_name == "Pinwheel" else None,
            }
        )
        intents = set(base["intentCandidates"])
        if coverage >= 0.85:
            intents.add("fill")
        if inp.effect_name == "Shimmer":
            intents.add("texture_heavy")
        if inp.effect_name == "Bars":
            intents.add("patterned")
            if int(settings.get("barCount", 1) or 1) >= 2:
                intents.add("segmented")
        if inp.effect_name == "Spirals":
            intents.add("patterned")
            intents.add("directional")
            if geometry_profile == "tree_360_spiral":
                intents.add("geometry_coupled")
        if inp.effect_name == "Pinwheel":
            intents.add("patterned")
            intents.add("directional")
            if geometry_profile == "tree_360_spiral":
                intents.add("geometry_coupled")
        base["intentCandidates"] = sorted(intents)
        return base


class StarAnalyzer(BaseAnalyzer):
    family = "star"

    def analyze(self, inp: SequenceAnalysisInput) -> Dict[str, Any]:
        base = super().analyze(inp)
        coverage = self._f(inp, "averageActiveNodeRatio")
        temporal = self._f(inp, "temporalChangeMean")
        centroids = self._frame_centroids(inp)
        deltas = self._signed_deltas(centroids)
        direction_summary = self._signed_direction_summary(deltas)

        pattern_family = "star_fill"
        if inp.effect_name == "Shimmer":
            pattern_family = "radial_sparkle"
        elif inp.effect_name == "Spirals":
            pattern_family = "radial_spiral_motion"
        elif inp.effect_name == "Pinwheel":
            pattern_family = "radial_pinwheel"
        elif inp.effect_name == "On":
            pattern_family = "static_fill"

        base["geometrySignals"] = {
            "radialCoverage": coverage,
            "radialMotion": temporal,
            "radialDirectionReversals": direction_summary["reversals"],
            "radialNetTravel": direction_summary["netTravel"],
            "configuredPinwheelArms": int(inp.effect_settings.get("arms", 3) or 3) if inp.effect_name == "Pinwheel" else None,
        }
        base["patternFamily"] = pattern_family
        base["patternSignals"].update(
            {
                "radialStructure": (
                    "full_fill" if coverage >= 0.85 else
                    "sparse_points" if coverage <= 0.2 else
                    "partial_fill"
                ),
                "pinwheelArmDensityClass": (
                    "dense" if int(inp.effect_settings.get("arms", 3) or 3) >= 6 else
                    "multi" if int(inp.effect_settings.get("arms", 3) or 3) >= 4 else
                    "few"
                ) if inp.effect_name == "Pinwheel" else None,
                "pinwheelRotationClass": (
                    "rotating" if bool(inp.effect_settings.get("rotation", False)) else "static"
                ) if inp.effect_name == "Pinwheel" else None,
            }
        )
        intents = set(base["intentCandidates"])
        if inp.effect_name == "Shimmer":
            intents.add("texture_heavy")
        if inp.effect_name == "Spirals":
            intents.add("patterned")
            intents.add("directional")
        if inp.effect_name == "Pinwheel":
            intents.add("patterned")
            intents.add("directional")
        if coverage >= 0.85:
            intents.add("fill")
        base["intentCandidates"] = sorted(intents)
        return base


ANALYZERS = {
    "single_line": LinearAnalyzer(),
    "single_line_horizontal": LinearAnalyzer(),
    "single_line_vertical": LinearAnalyzer(),
    "single_line_single_node": LinearAnalyzer(),
    "cane": LinearAnalyzer(),
    "cane_single": LinearAnalyzer(),
    "cane_grouped": LinearAnalyzer(),
    "cane_stick_grouped": LinearAnalyzer(),
    "arch": LinearAnalyzer(),
    "arch_single": LinearAnalyzer(),
    "arch_grouped": LinearAnalyzer(),
    "arch_multi_layer": LinearAnalyzer(),
    "icicles": LinearAnalyzer(),
    "icicles_standard": LinearAnalyzer(),
    "icicles_drop_pattern": LinearAnalyzer(),
    "tree_flat": TreeAnalyzer(),
    "tree_flat_single_layer": TreeAnalyzer(),
    "tree_360": TreeAnalyzer(),
    "tree_360_round": TreeAnalyzer(),
    "tree_360_spiral": TreeAnalyzer(),
    "star": StarAnalyzer(),
    "star_single_layer": StarAnalyzer(),
    "star_multi_layer": StarAnalyzer(),
}


def get_analyzer(model_type: str) -> Analyzer:
    return ANALYZERS.get(model_type, BaseAnalyzer())
