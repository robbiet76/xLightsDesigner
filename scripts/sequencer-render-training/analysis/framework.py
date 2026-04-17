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

    def _shockwave_signals(self, settings: Dict[str, Any]) -> Dict[str, Any]:
        center_x = float(settings.get("centerX", 50) or 50)
        center_y = float(settings.get("centerY", 50) or 50)
        start_radius = float(settings.get("startRadius", 1) or 1)
        end_radius = float(settings.get("endRadius", 10) or 10)
        start_width = float(settings.get("startWidth", 5) or 5)
        end_width = float(settings.get("endWidth", 10) or 10)
        accel = float(settings.get("accel", 0) or 0)
        cycles = float(settings.get("cycles", 1) or 1)
        blend_edges = bool(settings.get("blendEdges", True))
        scale = bool(settings.get("scale", True))

        span = max(0.0, end_radius - start_radius)
        avg_width = (start_width + end_width) / 2.0
        center_dx = abs(center_x - 50.0)
        center_dy = abs(center_y - 50.0)

        if center_dx <= 5 and center_dy <= 5:
            center_class = "centered"
        elif center_dx > 5 and center_dy > 5:
            center_class = "offset_xy"
        elif center_dx > 5:
            center_class = "offset_x"
        else:
            center_class = "offset_y"

        if span >= 40:
            span_class = "large"
        elif span >= 20:
            span_class = "medium"
        else:
            span_class = "compact"

        if avg_width >= 10:
            width_class = "wide"
        elif avg_width >= 5:
            width_class = "medium"
        else:
            width_class = "thin"

        if accel >= 2:
            accel_class = "accelerating"
        elif accel <= -2:
            accel_class = "decelerating"
        else:
            accel_class = "neutral"

        if cycles >= 4:
            cycle_class = "repeating_dense"
        elif cycles >= 2:
            cycle_class = "repeating"
        else:
            cycle_class = "single"

        return {
            "centerX": center_x,
            "centerY": center_y,
            "startRadius": start_radius,
            "endRadius": end_radius,
            "startWidth": start_width,
            "endWidth": end_width,
            "accel": accel,
            "cycles": cycles,
            "blendEdges": blend_edges,
            "scale": scale,
            "span": span,
            "avgWidth": avg_width,
            "centerClass": center_class,
            "spanClass": span_class,
            "widthClass": width_class,
            "edgeClass": "soft" if blend_edges else "hard",
            "accelClass": accel_class,
            "cycleClass": cycle_class,
        }

    def _shockwave_intents(self, settings: Dict[str, Any]) -> List[str]:
        shock = self._shockwave_signals(settings)
        intents = {"animated", "patterned"}
        if shock["centerClass"] == "centered":
            intents.add("fill")
        else:
            intents.add("directional")
        if shock["spanClass"] == "compact" and shock["widthClass"] != "wide":
            intents.add("restrained")
        if shock["spanClass"] == "large" or shock["widthClass"] == "wide":
            intents.add("bold")
        if shock["widthClass"] == "thin" and shock["edgeClass"] == "soft":
            intents.add("clean")
        if shock["cycleClass"] == "repeating_dense":
            intents.add("busy")
        return sorted(intents)

    def _twinkle_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        count = int(settings.get("count", 5) or 5)
        steps = int(settings.get("steps", 50) or 50)
        strobe = bool(settings.get("strobe", False))
        rerandomize = bool(settings.get("reRandomize", False))
        style = str(settings.get("style", "New Render Method") or "New Render Method").lower()

        if strobe and count >= 7:
            name = "strobe_twinkle"
        elif strobe:
            name = "punchy_twinkle"
        elif count >= 7 and steps <= 20:
            name = "surging_twinkle"
        elif count >= 7:
            name = "dense_twinkle"
        elif "old" in style and rerandomize:
            name = "classic_random_twinkle"
        elif "old" in style:
            name = "classic_twinkle"
        elif count <= 2 and steps >= 70:
            name = "restrained_twinkle"
        else:
            name = "soft_twinkle"
        return f"{prefix}{name}" if prefix else name

    def _shimmer_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        cycles = float(settings.get("cycles", 1) or 1)
        duty = int(settings.get("dutyFactor", 50) or 50)
        use_all_colors = bool(settings.get("useAllColors", False))

        if use_all_colors:
            name = "multicolor_shimmer"
        elif duty <= 25:
            name = "sparse_shimmer"
        elif duty >= 70 and cycles >= 30:
            name = "rapid_dense_shimmer"
        elif duty >= 65:
            name = "dense_shimmer"
        elif cycles >= 30:
            name = "rapid_shimmer"
        else:
            name = "shimmer_texture"
        return f"{prefix}{name}" if prefix else name

    def _color_wash_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        shimmer = bool(settings.get("shimmer", False))
        circular = bool(settings.get("circularPalette", False))
        reverse = bool(settings.get("reverseFades", False))

        if circular and shimmer:
            name = "circular_shimmer_wash"
        elif circular:
            name = "circular_wash"
        elif reverse:
            name = "reverse_fade_wash"
        elif shimmer:
            name = "shimmer_wash"
        else:
            name = "color_wash"
        return f"{prefix}{name}" if prefix else name

    def _marquee_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        reverse = bool(settings.get("reverse", False))
        skip_size = int(settings.get("skipSize", 0) or 0)
        band_size = int(settings.get("bandSize", 1) or 1)

        if skip_size >= 4:
            name = "segmented_marquee"
        elif band_size >= 6:
            name = "wide_marquee"
        elif reverse:
            name = "reverse_marquee"
        else:
            name = "marquee_motion"
        return f"{prefix}{name}" if prefix else name

    def _pinwheel_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        arms = int(settings.get("arms", 3) or 3)
        rotation = bool(settings.get("rotation", False))
        mode_3d = self._lower_setting(settings, "3DMode")

        if rotation and arms >= 6:
            name = "dense_rotating_pinwheel"
        elif rotation:
            name = "rotating_pinwheel"
        elif "sweep" in mode_3d:
            name = "sweep_pinwheel"
        else:
            name = "pinwheel"
        return f"{prefix}{name}" if prefix else name

    def _spiral_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        movement = float(settings.get("movement", 0) or 0)
        rotation = float(settings.get("rotation", 0) or 0)
        count = int(settings.get("count", 1) or 1)

        if abs(movement) > 0 and abs(rotation) > 0:
            name = "spiral_flow"
        elif abs(rotation) > 0:
            name = "spiral_rotation"
        elif abs(movement) > 0:
            name = "spiral_drift"
        elif count >= 3:
            name = "dense_spiral_bands"
        else:
            name = "spiral_bands"
        return f"{prefix}{name}" if prefix else name

    def _single_strand_family(
        self,
        settings: Dict[str, Any],
        prefix: str = "",
        mean_segment_count: float = 0.0,
        max_segment_length_ratio: float = 1.0,
    ) -> str:
        mode = str(settings.get("mode", "") or "")
        direction = self._lower_setting(settings, "direction")
        chase_type = self._lower_setting(settings, "chaseType")

        if mode == "FX":
            name = "fx_texture"
        elif mode == "Skips":
            name = "skip_bands"
        elif "bounce" in chase_type:
            name = "bounce_chase"
        elif direction in {"left", "right"}:
            name = "directional_chase"
        elif mean_segment_count >= 2.0 and max_segment_length_ratio < 0.35:
            name = "segmented_chase"
        else:
            name = "chase_motion"
        return f"{prefix}{name}" if prefix else name

    def _bars_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        bar_count = int(settings.get("barCount", 1) or 1)
        direction_setting = self._lower_setting(settings, "direction")

        if direction_setting == "expand":
            name = "expanding_bars"
        elif direction_setting == "compress":
            name = "compressing_bars"
        elif bar_count >= 4:
            name = "dense_bars"
        elif bar_count >= 2:
            name = "multi_bars"
        else:
            name = "single_bar_motion"
        return f"{prefix}{name}" if prefix else name

    def _butterfly_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        style = int(settings.get("style", 1) or 1)
        chunks = int(settings.get("chunks", 1) or 1)
        speed = float(settings.get("speed", 10) or 10)
        direction = self._lower_setting(settings, "direction")

        if chunks >= 4:
            name = "layered_butterfly"
        elif style >= 4 and speed >= 15:
            name = "rapid_butterfly"
        elif direction == "reverse":
            name = "reverse_butterfly"
        elif style >= 3:
            name = "textured_butterfly"
        else:
            name = "butterfly_motion"
        return f"{prefix}{name}" if prefix else name

    def _circles_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        count = int(settings.get("count", 8) or 8)
        size = float(settings.get("size", 25) or 25)
        speed = float(settings.get("speed", 10) or 10)
        bounce = bool(settings.get("bounce", False))
        radial = bool(settings.get("radial", False))

        if bounce:
            name = "bouncing_circles"
        elif radial:
            name = "radial_circles"
        elif count >= 16:
            name = "dense_circles"
        elif size >= 50 and speed >= 15:
            name = "burst_circles"
        else:
            name = "circles_motion"
        return f"{prefix}{name}" if prefix else name

    def _fire_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        height = float(settings.get("height", 50) or 50)
        hue_shift = float(settings.get("hueShift", 0) or 0)
        growth_cycles = float(settings.get("growthCycles", 0) or 0)
        location = self._lower_setting(settings, "location")

        if growth_cycles >= 3:
            name = "surging_fire"
        elif location in {"bottom", "ground"} and height >= 70:
            name = "towering_fire"
        elif hue_shift >= 25:
            name = "shifting_fire"
        else:
            name = "fire_texture"
        return f"{prefix}{name}" if prefix else name

    def _fireworks_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        explosions = int(settings.get("explosions", 4) or 4)
        velocity = float(settings.get("velocity", 50) or 50)
        gravity = float(settings.get("gravity", 50) or 50)
        fade = float(settings.get("fade", 50) or 50)

        if explosions >= 8:
            name = "dense_fireworks"
        elif velocity >= 65 and gravity <= 35:
            name = "soaring_fireworks"
        elif fade >= 70:
            name = "lingering_fireworks"
        else:
            name = "fireworks_burst"
        return f"{prefix}{name}" if prefix else name

    def _lightning_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        bolts = int(settings.get("numberBolts", 3) or 3)
        segments = int(settings.get("numberSegments", 6) or 6)
        forked = bool(settings.get("forked", True))
        width = float(settings.get("width", 50) or 50)
        direction = self._lower_setting(settings, "direction")

        if forked and bolts >= 4:
            name = "forked_lightning"
        elif width >= 65:
            name = "broad_lightning"
        elif direction in {"left", "right", "down", "up"} and segments >= 8:
            name = "directional_lightning"
        else:
            name = "lightning_strike"
        return f"{prefix}{name}" if prefix else name

    def _snowflakes_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        count = int(settings.get("count", 20) or 20)
        flake_type = self._lower_setting(settings, "type")
        speed = float(settings.get("speed", 10) or 10)
        falling = bool(settings.get("falling", True))

        if falling and speed >= 15:
            name = "falling_snow"
        elif "spiral" in flake_type or "spin" in flake_type:
            name = "spiral_snowflakes"
        elif count >= 40:
            name = "dense_snowflakes"
        else:
            name = "snowflake_drift"
        return f"{prefix}{name}" if prefix else name

    def _strobe_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        number_strobes = int(settings.get("numberStrobes", 5) or 5)
        duration = float(settings.get("duration", 50) or 50)
        strobe_type = self._lower_setting(settings, "type")

        if "random" in strobe_type:
            name = "random_strobe"
        elif number_strobes >= 10:
            name = "dense_strobe"
        elif duration <= 20:
            name = "rapid_strobe"
        else:
            name = "strobe_pulse"
        return f"{prefix}{name}" if prefix else name

    def _wave_family(self, settings: Dict[str, Any], prefix: str = "") -> str:
        wave_type = self._lower_setting(settings, "type")
        fill_colors = bool(settings.get("fillColors", False))
        number_waves = int(settings.get("numberWaves", 1) or 1)
        wave_speed = float(settings.get("waveSpeed", 10) or 10)
        wave_height = float(settings.get("waveHeight", 50) or 50)
        direction = self._lower_setting(settings, "direction")

        if number_waves >= 3:
            name = "layered_wave"
        elif fill_colors:
            name = "filled_wave"
        elif "sine" in wave_type and wave_speed >= 15:
            name = "fast_sine_wave"
        elif wave_height >= 65 or direction in {"up", "down"}:
            name = "cresting_wave"
        else:
            name = "wave_motion"
        return f"{prefix}{name}" if prefix else name

    def _on_family(
        self,
        settings: Dict[str, Any],
        prefix: str = "",
        static_name: str = "static_fill",
    ) -> str:
        shimmer = bool(settings.get("shimmer", False))
        cycles = float(settings.get("cycles", 1) or 1)
        start = int(settings.get("startLevel", 100) or 100)
        end = int(settings.get("endLevel", 100) or 100)
        delta = end - start

        if shimmer:
            name = "shimmer_hold"
        elif abs(delta) >= 15 and cycles > 1:
            name = "pulsing_level_ramp"
        elif delta >= 15:
            name = "rising_level_ramp"
        elif delta <= -15:
            name = "falling_level_ramp"
        else:
            name = static_name
        return f"{prefix}{name}" if prefix else name

    def _shockwave_variant(self, shock: Dict[str, Any]) -> str | None:
        if shock["centerClass"] != "centered":
            return None
        if shock["spanClass"] == "compact" and shock["accelClass"] == "decelerating":
            return "compact"
        if shock["widthClass"] == "wide" and shock["edgeClass"] == "soft":
            return "diffuse"
        if shock["widthClass"] == "thin" and shock["edgeClass"] == "hard":
            return "crisp"
        if shock["spanClass"] == "large" and shock["accelClass"] == "accelerating":
            return "surging"
        return None

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
            pattern_family = self._on_family(settings, static_name="static_hold")
        elif effect == "Shimmer":
            pattern_family = self._shimmer_family(settings, "linear_")
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
            pattern_family = self._bars_family(settings)
        elif effect == "Color Wash":
            pattern_family = self._color_wash_family(settings, "linear_")
        elif effect == "Marquee":
            reverse = bool(settings.get("reverse", False))
            direction = "reverse" if reverse else "forward"
            pattern_family = self._marquee_family(settings)
        elif effect == "Pinwheel":
            pattern_family = self._pinwheel_family(settings, "linear_")
        elif effect == "Shockwave":
            shock = self._shockwave_signals(settings)
            variant = self._shockwave_variant(shock)
            if shock["centerClass"] != "centered":
                pattern_family = "linear_offcenter_shockwave"
            elif variant == "compact":
                pattern_family = "linear_compact_shockwave"
            elif variant == "diffuse":
                pattern_family = "linear_diffuse_shockwave"
            elif variant == "crisp":
                pattern_family = "linear_crisp_shockwave"
            elif variant == "surging":
                pattern_family = "linear_surging_shockwave"
            else:
                pattern_family = "linear_shockwave"
        elif effect == "Spirals":
            pattern_family = self._spiral_family(settings, "linear_")
        elif effect == "Twinkle":
            pattern_family = self._twinkle_family(settings, "linear_")
        elif effect == "Butterfly":
            pattern_family = self._butterfly_family(settings, "linear_")
        elif effect == "Circles":
            pattern_family = self._circles_family(settings, "linear_")
        elif effect == "Fire":
            pattern_family = self._fire_family(settings, "linear_")
        elif effect == "Fireworks":
            pattern_family = self._fireworks_family(settings, "linear_")
        elif effect == "Lightning":
            pattern_family = self._lightning_family(settings, "linear_")
        elif effect == "Snowflakes":
            pattern_family = self._snowflakes_family(settings, "linear_")
        elif effect == "Strobe":
            pattern_family = self._strobe_family(settings, "linear_")
        elif effect == "Wave":
            pattern_family = self._wave_family(settings, "linear_")

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
                "twinkleDensityClass": (
                    "dense" if int(settings.get("count", 5) or 5) >= 7 else
                    "sparse" if int(settings.get("count", 5) or 5) <= 2 else
                    "medium"
                ) if effect == "Twinkle" else None,
                "twinkleCadenceClass": (
                    "fast" if int(settings.get("steps", 50) or 50) <= 20 else
                    "slow" if int(settings.get("steps", 50) or 50) >= 70 else
                    "medium"
                ) if effect == "Twinkle" else None,
                "twinkleStyleClass": (
                    "classic" if "old" in str(settings.get("style", "New Render Method") or "New Render Method").lower() else
                    "modern"
                ) if effect == "Twinkle" else None,
                "twinkleRandomizeClass": (
                    "rerandomized" if bool(settings.get("reRandomize", False)) else "stable"
                ) if effect == "Twinkle" else None,
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
        if effect == "Twinkle":
            intents = {"animated", "patterned"}
            if bool(settings.get("strobe", False)):
                intents.add("bold")
            if int(settings.get("count", 5) or 5) >= 7:
                intents.add("busy")
            else:
                intents.add("restrained")
            if int(settings.get("steps", 50) or 50) >= 70:
                intents.add("steady")
            if bool(settings.get("reRandomize", False)):
                intents.add("varied")
        base["intentCandidates"] = sorted(intents)
        return base


class MatrixAnalyzer(BaseAnalyzer):
    family = "matrix"

    def analyze(self, inp: SequenceAnalysisInput) -> Dict[str, Any]:
        base = super().analyze(inp)
        coverage = self._f(inp, "averageActiveNodeRatio")
        temporal = self._f(inp, "temporalChangeMean")
        longest_run = self._f(inp, "averageLongestRunRatio")
        run_count = self._f(inp, "averageRunCount")
        centroid_motion = self._f(inp, "centroidMotionMean")
        settings = inp.effect_settings
        effect = inp.effect_name

        pattern_family = "matrix_fill"
        if effect == "On":
            start = float(settings.get("startLevel", 100) or 100)
            end = float(settings.get("endLevel", 100) or 100)
            shimmer = bool(settings.get("shimmer", False))
            if shimmer:
                pattern_family = "matrix_shimmer_hold"
            elif start != end:
                pattern_family = "matrix_level_ramp"
            else:
                pattern_family = "matrix_static_fill"
        elif effect == "Shimmer":
            duty = float(settings.get("dutyFactor", 50) or 50)
            use_all = bool(settings.get("useAllColors", False))
            if duty <= 25:
                pattern_family = "matrix_sparse_shimmer"
            elif duty >= 75:
                pattern_family = "matrix_dense_shimmer"
            elif use_all:
                pattern_family = "matrix_multicolor_shimmer"
            else:
                pattern_family = "matrix_shimmer_texture"
        elif effect == "Bars":
            pattern_family = self._bars_family(settings, "matrix_")
        elif effect == "Color Wash":
            pattern_family = self._color_wash_family(settings, "matrix_")
        elif effect == "Marquee":
            pattern_family = self._marquee_family(settings, "matrix_")
        elif effect == "Pinwheel":
            pattern_family = self._pinwheel_family(settings, "matrix_")
        elif effect == "Shockwave":
            shock = self._shockwave_signals(settings)
            variant = self._shockwave_variant(shock)
            if shock["centerClass"] != "centered":
                pattern_family = "matrix_offcenter_shockwave"
            elif variant == "compact":
                pattern_family = "matrix_compact_shockwave"
            elif variant == "diffuse":
                pattern_family = "matrix_diffuse_shockwave"
            elif variant == "crisp":
                pattern_family = "matrix_crisp_shockwave"
            elif variant == "surging":
                pattern_family = "matrix_surging_shockwave"
            else:
                pattern_family = "matrix_shockwave_ring"
        elif effect == "SingleStrand":
            mode = str(settings.get("mode", "") or "")
            direction = self._lower_setting(settings, "direction")
            chase_type = self._lower_setting(settings, "chaseType")
            if mode == "FX":
                pattern_family = "matrix_fx_texture"
            elif mode == "Skips":
                pattern_family = "matrix_skip_bands"
            elif "bounce" in chase_type:
                pattern_family = "matrix_bounce_chase"
            elif direction in {"left", "right"}:
                pattern_family = "matrix_directional_chase"
            else:
                pattern_family = "matrix_chase_motion"
        elif effect == "Spirals":
            pattern_family = self._spiral_family(settings, "matrix_")
        elif effect == "Twinkle":
            pattern_family = self._twinkle_family(settings, "matrix_")
        elif effect == "Butterfly":
            pattern_family = self._butterfly_family(settings, "matrix_")
        elif effect == "Circles":
            pattern_family = self._circles_family(settings, "matrix_")
        elif effect == "Fire":
            pattern_family = self._fire_family(settings, "matrix_")
        elif effect == "Fireworks":
            pattern_family = self._fireworks_family(settings, "matrix_")
        elif effect == "Lightning":
            pattern_family = self._lightning_family(settings, "matrix_")
        elif effect == "Snowflakes":
            pattern_family = self._snowflakes_family(settings, "matrix_")
        elif effect == "Strobe":
            pattern_family = self._strobe_family(settings, "matrix_")
        elif effect == "Wave":
            pattern_family = self._wave_family(settings, "matrix_")

        base["geometrySignals"] = {
            "matrixCoverage": coverage,
            "matrixMotion": temporal,
            "matrixCentroidMotion": centroid_motion,
            "matrixRunCount": run_count,
            "matrixContiguity": longest_run,
            "configuredBarCount": int(settings.get("barCount", 1) or 1) if effect == "Bars" else None,
            "configuredMarqueeBandSize": int(settings.get("bandSize", 1) or 1) if effect == "Marquee" else None,
            "configuredMarqueeSkipSize": int(settings.get("skipSize", 0) or 0) if effect == "Marquee" else None,
            "configuredTwinkleCount": int(settings.get("count", 5) or 5) if effect == "Twinkle" else None,
            "configuredTwinkleSteps": int(settings.get("steps", 50) or 50) if effect == "Twinkle" else None,
        }
        base["patternFamily"] = pattern_family
        base["patternSignals"].update(
            {
                "matrixStructure": (
                    "full_fill" if coverage >= 0.85 else
                    "sparse_fill" if coverage <= 0.2 else
                    "partial_fill"
                ),
                "matrixMotionClass": (
                    "dynamic" if temporal >= 0.05 or centroid_motion >= 0.05 else
                    "steady" if temporal <= 0.01 and centroid_motion <= 0.01 else
                    "moderate"
                ),
                "matrixContiguityClass": (
                    "contiguous" if longest_run >= 0.65 else
                    "fragmented" if longest_run <= 0.2 else
                    "segmented"
                ),
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
                "twinkleDensityClass": (
                    "dense" if int(settings.get("count", 5) or 5) >= 7 else
                    "sparse" if int(settings.get("count", 5) or 5) <= 2 else
                    "medium"
                ) if effect == "Twinkle" else None,
            }
        )
        intents = set(base["intentCandidates"])
        if effect in {"Bars", "Marquee", "Pinwheel", "Shockwave", "Spirals", "Twinkle", "SingleStrand"}:
            intents.add("patterned")
        if effect in {"Marquee", "Pinwheel", "Shockwave", "Spirals", "SingleStrand"}:
            intents.add("animated")
        if effect == "Shockwave":
            intents = set(self._shockwave_intents(settings))
        if effect == "Twinkle":
            intents = {"animated", "patterned"}
            if bool(settings.get("strobe", False)):
                intents.add("bold")
            if int(settings.get("count", 5) or 5) >= 7:
                intents.add("busy")
            else:
                intents.add("restrained")
        elif coverage >= 0.85:
            intents.add("fill")
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
            pattern_family = self._shimmer_family(settings, "tree_")
        elif inp.effect_name == "Color Wash":
            pattern_family = self._color_wash_family(settings, "tree_")
        elif inp.effect_name == "Marquee":
            pattern_family = self._marquee_family(settings, "tree_")
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
            movement_class = (
                "reverse_drift" if movement < 0 else
                "forward_drift" if movement > 0 else
                "static_drift"
            )
            rotation_class = (
                "reverse_rotation" if rotation < 0 else
                "forward_rotation" if rotation > 0 else
                "neutral_rotation"
            )
            count_class = (
                "single_spiral" if count <= 1 else
                "multi_spiral" if count <= 2 else
                "dense_spiral"
            )
            thickness_class = (
                "thin_spiral" if thickness <= 20 else
                "medium_spiral" if thickness <= 60 else
                "thick_spiral"
            )
            if geometry_profile == "tree_360_spiral":
                if abs(movement) > 0 and abs(rotation) > 0:
                    pattern_family = "helical_spiral_flow"
                elif abs(movement) > 0:
                    pattern_family = "helical_spiral_drift"
                elif abs(rotation) > 0:
                    pattern_family = "helical_spiral_rotation"
                else:
                    pattern_family = "helical_spiral_bands"
            elif abs(movement) > 0 and abs(rotation) > 0:
                pattern_family = "spiral_flow"
            elif abs(movement) > 0:
                pattern_family = "spiral_drift"
            elif abs(rotation) > 0:
                pattern_family = "spiral_rotation"
            elif count >= 3 or thickness >= 65:
                pattern_family = "dense_spiral_fill"
            else:
                pattern_family = "spiral_bands"
        elif inp.effect_name == "Pinwheel":
            if geometry_profile == "tree_360_spiral":
                pattern_family = self._pinwheel_family(settings, "helical_")
            else:
                pattern_family = self._pinwheel_family(settings, "tree_")
        elif inp.effect_name == "Shockwave":
            shock = self._shockwave_signals(settings)
            variant = self._shockwave_variant(shock)
            if geometry_profile == "tree_360_spiral":
                if variant == "compact":
                    pattern_family = "helical_compact_shockwave"
                elif variant == "diffuse":
                    pattern_family = "helical_diffuse_shockwave"
                elif variant == "crisp":
                    pattern_family = "helical_crisp_shockwave"
                elif variant == "surging":
                    pattern_family = "helical_surging_shockwave"
                else:
                    pattern_family = "helical_shockwave"
            elif shock["centerClass"] != "centered":
                pattern_family = "offcenter_shockwave"
            elif variant == "compact":
                pattern_family = "compact_shockwave_ring"
            elif variant == "diffuse":
                pattern_family = "diffuse_shockwave"
            elif variant == "crisp":
                pattern_family = "crisp_shockwave"
            elif variant == "surging":
                pattern_family = "surging_shockwave"
            elif shock["spanClass"] == "large":
                pattern_family = "expanding_shockwave"
            else:
                pattern_family = "shockwave_ring"
        elif inp.effect_name == "Twinkle":
            pattern_family = self._twinkle_family(settings)
        elif inp.effect_name == "On":
            pattern_family = self._on_family(settings, "tree_")
        elif inp.effect_name == "Butterfly":
            pattern_family = self._butterfly_family(settings, "tree_")
        elif inp.effect_name == "Circles":
            pattern_family = self._circles_family(settings, "tree_")
        elif inp.effect_name == "Fire":
            pattern_family = self._fire_family(settings, "tree_")
        elif inp.effect_name == "Fireworks":
            pattern_family = self._fireworks_family(settings, "tree_")
        elif inp.effect_name == "Lightning":
            pattern_family = self._lightning_family(settings, "tree_")
        elif inp.effect_name == "Snowflakes":
            pattern_family = self._snowflakes_family(settings, "tree_")
        elif inp.effect_name == "Strobe":
            pattern_family = self._strobe_family(settings, "tree_")
        elif inp.effect_name == "Wave":
            pattern_family = self._wave_family(settings, "tree_")

        base["geometrySignals"] = {
            "treeCoverage": coverage,
            "treeMotion": temporal,
            "treeCentroidMotion": centroid_motion,
            "treeDirectionReversals": direction_summary["reversals"],
            "treeNetTravel": direction_summary["netTravel"],
            "spiralGeometryProfile": geometry_profile == "tree_360_spiral",
            "configuredSpiralCount": int(settings.get("count", 1) or 1) if inp.effect_name == "Spirals" else None,
            "configuredSpiralMovement": float(settings.get("movement", 0) or 0) if inp.effect_name == "Spirals" else None,
            "configuredSpiralRotation": float(settings.get("rotation", 0) or 0) if inp.effect_name == "Spirals" else None,
            "configuredSpiralThickness": float(settings.get("thickness", 50) or 50) if inp.effect_name == "Spirals" else None,
            "configuredBarCount": int(settings.get("barCount", 1) or 1) if inp.effect_name == "Bars" else None,
            "configuredPinwheelArms": int(settings.get("arms", 3) or 3) if inp.effect_name == "Pinwheel" else None,
            "configuredShockwaveCenterX": shock["centerX"] if inp.effect_name == "Shockwave" else None,
            "configuredShockwaveCenterY": shock["centerY"] if inp.effect_name == "Shockwave" else None,
            "configuredShockwaveStartRadius": shock["startRadius"] if inp.effect_name == "Shockwave" else None,
            "configuredShockwaveEndRadius": shock["endRadius"] if inp.effect_name == "Shockwave" else None,
            "configuredShockwaveStartWidth": shock["startWidth"] if inp.effect_name == "Shockwave" else None,
            "configuredShockwaveEndWidth": shock["endWidth"] if inp.effect_name == "Shockwave" else None,
            "configuredShockwaveAccel": shock["accel"] if inp.effect_name == "Shockwave" else None,
            "configuredTwinkleCount": int(settings.get("count", 5) or 5) if inp.effect_name == "Twinkle" else None,
            "configuredTwinkleSteps": int(settings.get("steps", 50) or 50) if inp.effect_name == "Twinkle" else None,
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
                "spiralMovementClass": movement_class if inp.effect_name == "Spirals" else None,
                "spiralRotationClass": rotation_class if inp.effect_name == "Spirals" else None,
                "spiralCountClass": count_class if inp.effect_name == "Spirals" else None,
                "spiralThicknessClass": thickness_class if inp.effect_name == "Spirals" else None,
                "pinwheelArmDensityClass": (
                    "dense" if int(settings.get("arms", 3) or 3) >= 6 else
                    "multi" if int(settings.get("arms", 3) or 3) >= 4 else
                    "few"
                ) if inp.effect_name == "Pinwheel" else None,
                "pinwheelRotationClass": (
                    "rotating" if bool(settings.get("rotation", False)) else "static"
                ) if inp.effect_name == "Pinwheel" else None,
                "shockwaveCenterClass": (
                    shock["centerClass"]
                ) if inp.effect_name == "Shockwave" else None,
                "shockwaveSpanClass": shock["spanClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveWidthClass": shock["widthClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveEdgeClass": shock["edgeClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveAccelClass": shock["accelClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveCycleClass": shock["cycleClass"] if inp.effect_name == "Shockwave" else None,
                "twinkleDensityClass": (
                    "dense" if int(settings.get("count", 5) or 5) >= 7 else
                    "sparse" if int(settings.get("count", 5) or 5) <= 2 else
                    "medium"
                ) if inp.effect_name == "Twinkle" else None,
                "twinkleCadenceClass": (
                    "fast" if int(settings.get("steps", 50) or 50) <= 20 else
                    "slow" if int(settings.get("steps", 50) or 50) >= 70 else
                    "medium"
                ) if inp.effect_name == "Twinkle" else None,
                "twinkleStyleClass": (
                    "classic" if "old" in str(settings.get("style", "New Render Method") or "New Render Method").lower() else
                    "modern"
                ) if inp.effect_name == "Twinkle" else None,
                "twinkleRandomizeClass": (
                    "rerandomized" if bool(settings.get("reRandomize", False)) else "stable"
                ) if inp.effect_name == "Twinkle" else None,
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
            if thickness >= 70:
                intents.add("bold")
            if thickness <= 20:
                intents.add("sparse")
            if count >= 3:
                intents.add("busy")
                intents.add("segmented")
            if movement == 0 and rotation == 0:
                intents.add("steady")
            if geometry_profile == "tree_360_spiral":
                intents.add("geometry_coupled")
        if inp.effect_name == "Pinwheel":
            intents.add("patterned")
            intents.add("directional")
            if geometry_profile == "tree_360_spiral":
                intents.add("geometry_coupled")
        if inp.effect_name == "Shockwave":
            intents = set(self._shockwave_intents(settings))
            if geometry_profile == "tree_360_spiral":
                intents.add("geometry_coupled")
        if inp.effect_name == "Twinkle":
            intents = {"animated", "patterned"}
            if int(settings.get("count", 5) or 5) >= 7:
                intents.add("busy")
            else:
                intents.add("restrained")
            if bool(settings.get("strobe", False)):
                intents.add("bold")
            if int(settings.get("steps", 50) or 50) >= 70:
                intents.add("steady")
            if bool(settings.get("reRandomize", False)):
                intents.add("varied")
            if coverage >= 0.85:
                intents.add("fill")
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
            pattern_family = self._shimmer_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Bars":
            pattern_family = self._bars_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Color Wash":
            pattern_family = self._color_wash_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Marquee":
            pattern_family = self._marquee_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Spirals":
            pattern_family = self._spiral_family(inp.effect_settings, "star_")
        elif inp.effect_name == "SingleStrand":
            pattern_family = self._single_strand_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Pinwheel":
            pattern_family = self._pinwheel_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Shockwave":
            shock = self._shockwave_signals(inp.effect_settings)
            variant = self._shockwave_variant(shock)
            if shock["centerClass"] != "centered":
                pattern_family = "offcenter_radial_shockwave"
            elif variant == "compact":
                pattern_family = "radial_compact_shockwave"
            elif variant == "diffuse":
                pattern_family = "radial_diffuse_shockwave"
            elif variant == "crisp":
                pattern_family = "radial_crisp_shockwave"
            elif variant == "surging":
                pattern_family = "radial_surging_shockwave"
            else:
                pattern_family = "radial_shockwave"
        elif inp.effect_name == "Twinkle":
            pattern_family = self._twinkle_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "On":
            pattern_family = self._on_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Butterfly":
            pattern_family = self._butterfly_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Circles":
            pattern_family = self._circles_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Fire":
            pattern_family = self._fire_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Fireworks":
            pattern_family = self._fireworks_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Lightning":
            pattern_family = self._lightning_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Snowflakes":
            pattern_family = self._snowflakes_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Strobe":
            pattern_family = self._strobe_family(inp.effect_settings, "star_")
        elif inp.effect_name == "Wave":
            pattern_family = self._wave_family(inp.effect_settings, "star_")

        base["geometrySignals"] = {
            "radialCoverage": coverage,
            "radialMotion": temporal,
            "radialDirectionReversals": direction_summary["reversals"],
            "radialNetTravel": direction_summary["netTravel"],
            "configuredPinwheelArms": int(inp.effect_settings.get("arms", 3) or 3) if inp.effect_name == "Pinwheel" else None,
            "configuredShockwaveCenterX": shock["centerX"] if inp.effect_name == "Shockwave" else None,
            "configuredShockwaveCenterY": shock["centerY"] if inp.effect_name == "Shockwave" else None,
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
                "shockwaveCenterClass": (
                    shock["centerClass"]
                ) if inp.effect_name == "Shockwave" else None,
                "shockwaveSpanClass": shock["spanClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveWidthClass": shock["widthClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveEdgeClass": shock["edgeClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveAccelClass": shock["accelClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveCycleClass": shock["cycleClass"] if inp.effect_name == "Shockwave" else None,
                "twinkleDensityClass": (
                    "dense" if int(inp.effect_settings.get("count", 5) or 5) >= 7 else
                    "sparse" if int(inp.effect_settings.get("count", 5) or 5) <= 2 else
                    "medium"
                ) if inp.effect_name == "Twinkle" else None,
                "twinkleCadenceClass": (
                    "fast" if int(inp.effect_settings.get("steps", 50) or 50) <= 20 else
                    "slow" if int(inp.effect_settings.get("steps", 50) or 50) >= 70 else
                    "medium"
                ) if inp.effect_name == "Twinkle" else None,
                "twinkleStyleClass": (
                    "classic" if "old" in str(inp.effect_settings.get("style", "New Render Method") or "New Render Method").lower() else
                    "modern"
                ) if inp.effect_name == "Twinkle" else None,
                "twinkleRandomizeClass": (
                    "rerandomized" if bool(inp.effect_settings.get("reRandomize", False)) else "stable"
                ) if inp.effect_name == "Twinkle" else None,
            }
        )
        intents = set(base["intentCandidates"])
        if inp.effect_name == "Shimmer":
            intents.add("texture_heavy")
        if inp.effect_name == "Spirals":
            intents.add("patterned")
            intents.add("directional")
        if inp.effect_name == "SingleStrand":
            intents.add("patterned")
            intents.add("directional")
        if inp.effect_name == "Pinwheel":
            intents.add("patterned")
            intents.add("directional")
        if inp.effect_name == "Shockwave":
            intents = set(self._shockwave_intents(inp.effect_settings))
        if inp.effect_name == "Twinkle":
            intents = {"animated", "patterned"}
            if bool(inp.effect_settings.get("strobe", False)):
                intents.add("bold")
            if int(inp.effect_settings.get("count", 5) or 5) >= 7:
                intents.add("busy")
            else:
                intents.add("restrained")
            if bool(inp.effect_settings.get("reRandomize", False)):
                intents.add("varied")
        elif coverage >= 0.85:
            intents.add("fill")
        base["intentCandidates"] = sorted(intents)
        return base


class RadialAnalyzer(BaseAnalyzer):
    family = "radial"

    def analyze(self, inp: SequenceAnalysisInput) -> Dict[str, Any]:
        base = super().analyze(inp)
        coverage = self._f(inp, "averageActiveNodeRatio")
        temporal = self._f(inp, "temporalChangeMean")
        centroids = self._frame_centroids(inp)
        deltas = self._signed_deltas(centroids)
        direction_summary = self._signed_direction_summary(deltas)

        pattern_family = "radial_fill"
        if inp.effect_name == "Shimmer":
            pattern_family = self._shimmer_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Bars":
            pattern_family = self._bars_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Color Wash":
            pattern_family = self._color_wash_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Marquee":
            pattern_family = self._marquee_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Spirals":
            pattern_family = self._spiral_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "SingleStrand":
            pattern_family = self._single_strand_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Pinwheel":
            pattern_family = self._pinwheel_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Shockwave":
            shock = self._shockwave_signals(inp.effect_settings)
            variant = self._shockwave_variant(shock)
            if shock["centerClass"] != "centered":
                pattern_family = "offcenter_radial_shockwave"
            elif variant == "compact":
                pattern_family = "radial_compact_shockwave"
            elif variant == "diffuse":
                pattern_family = "radial_diffuse_shockwave"
            elif variant == "crisp":
                pattern_family = "radial_crisp_shockwave"
            elif variant == "surging":
                pattern_family = "radial_surging_shockwave"
            else:
                pattern_family = "radial_shockwave"
        elif inp.effect_name == "Twinkle":
            pattern_family = self._twinkle_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "On":
            pattern_family = self._on_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Butterfly":
            pattern_family = self._butterfly_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Circles":
            pattern_family = self._circles_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Fire":
            pattern_family = self._fire_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Fireworks":
            pattern_family = self._fireworks_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Lightning":
            pattern_family = self._lightning_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Snowflakes":
            pattern_family = self._snowflakes_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Strobe":
            pattern_family = self._strobe_family(inp.effect_settings, "radial_")
        elif inp.effect_name == "Wave":
            pattern_family = self._wave_family(inp.effect_settings, "radial_")

        base["geometrySignals"] = {
            "radialCoverage": coverage,
            "radialMotion": temporal,
            "radialDirectionReversals": direction_summary["reversals"],
            "radialNetTravel": direction_summary["netTravel"],
            "configuredPinwheelArms": int(inp.effect_settings.get("arms", 3) or 3) if inp.effect_name == "Pinwheel" else None,
            "configuredShockwaveCenterX": shock["centerX"] if inp.effect_name == "Shockwave" else None,
            "configuredShockwaveCenterY": shock["centerY"] if inp.effect_name == "Shockwave" else None,
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
                "shockwaveCenterClass": (
                    shock["centerClass"]
                ) if inp.effect_name == "Shockwave" else None,
                "shockwaveSpanClass": shock["spanClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveWidthClass": shock["widthClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveEdgeClass": shock["edgeClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveAccelClass": shock["accelClass"] if inp.effect_name == "Shockwave" else None,
                "shockwaveCycleClass": shock["cycleClass"] if inp.effect_name == "Shockwave" else None,
                "twinkleDensityClass": (
                    "dense" if int(inp.effect_settings.get("count", 5) or 5) >= 7 else
                    "sparse" if int(inp.effect_settings.get("count", 5) or 5) <= 2 else
                    "medium"
                ) if inp.effect_name == "Twinkle" else None,
                "twinkleCadenceClass": (
                    "fast" if int(inp.effect_settings.get("steps", 50) or 50) <= 20 else
                    "slow" if int(inp.effect_settings.get("steps", 50) or 50) >= 70 else
                    "medium"
                ) if inp.effect_name == "Twinkle" else None,
                "twinkleStyleClass": (
                    "classic" if "old" in str(inp.effect_settings.get("style", "New Render Method") or "New Render Method").lower() else
                    "modern"
                ) if inp.effect_name == "Twinkle" else None,
                "twinkleRandomizeClass": (
                    "rerandomized" if bool(inp.effect_settings.get("reRandomize", False)) else "stable"
                ) if inp.effect_name == "Twinkle" else None,
            }
        )
        intents = set(base["intentCandidates"])
        if inp.effect_name in ("Spirals", "Pinwheel", "Shockwave"):
            intents.add("patterned")
            intents.add("animated")
        if inp.effect_name == "SingleStrand":
            intents.add("patterned")
            intents.add("animated")
            intents.add("directional")
        if inp.effect_name == "Pinwheel":
            intents.add("directional")
        if inp.effect_name == "Shockwave":
            intents = set(self._shockwave_intents(inp.effect_settings))
        if inp.effect_name == "Twinkle":
            intents = {"animated", "patterned"}
            if bool(inp.effect_settings.get("strobe", False)):
                intents.add("bold")
            if int(inp.effect_settings.get("count", 5) or 5) >= 7:
                intents.add("busy")
            else:
                intents.add("restrained")
            if bool(inp.effect_settings.get("reRandomize", False)):
                intents.add("varied")
        elif coverage >= 0.85:
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
    "matrix": MatrixAnalyzer(),
    "matrix_low_density": MatrixAnalyzer(),
    "matrix_medium_density": MatrixAnalyzer(),
    "matrix_high_density": MatrixAnalyzer(),
    "tree_flat": TreeAnalyzer(),
    "tree_flat_single_layer": TreeAnalyzer(),
    "tree_360": TreeAnalyzer(),
    "tree_360_round": TreeAnalyzer(),
    "tree_360_spiral": TreeAnalyzer(),
    "star": StarAnalyzer(),
    "star_single_layer": StarAnalyzer(),
    "star_multi_layer": StarAnalyzer(),
    "spinner": RadialAnalyzer(),
    "spinner_standard": RadialAnalyzer(),
}


def get_analyzer(model_type: str) -> Analyzer:
    return ANALYZERS.get(model_type, BaseAnalyzer())
