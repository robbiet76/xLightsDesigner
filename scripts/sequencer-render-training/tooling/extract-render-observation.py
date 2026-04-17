#!/usr/bin/env python3
import argparse
import json
import math
from collections import Counter


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--window", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def bounds_union(bounds_list):
    bounds_list = [b for b in bounds_list if b]
    if not bounds_list:
        return None
    return {
        "min": {
            "x": min(b["min"]["x"] for b in bounds_list),
            "y": min(b["min"]["y"] for b in bounds_list),
            "z": min(b["min"]["z"] for b in bounds_list),
        },
        "max": {
            "x": max(b["max"]["x"] for b in bounds_list),
            "y": max(b["max"]["y"] for b in bounds_list),
            "z": max(b["max"]["z"] for b in bounds_list),
        },
    }


def bounds_area_2d(bounds):
    if not bounds:
        return 0.0
    width = max(0.0, bounds["max"]["x"] - bounds["min"]["x"])
    height = max(0.0, bounds["max"]["y"] - bounds["min"]["y"])
    return width * height


def centroid_delta(a, b):
    if not a or not b:
        return None
    dx = b["x"] - a["x"]
    dy = b["y"] - a["y"]
    dz = b["z"] - a["z"]
    return {
        "dx": dx,
        "dy": dy,
        "dz": dz,
        "magnitude": math.sqrt((dx * dx) + (dy * dy) + (dz * dz)),
    }


def density_bucket(ratio):
    if ratio <= 0.02:
        return "very_sparse"
    if ratio <= 0.10:
        return "sparse"
    if ratio <= 0.30:
        return "moderate"
    if ratio <= 0.60:
        return "dense"
    return "very_dense"


def region_label(x_norm, y_norm):
    horizontal = "left" if x_norm < 1.0 / 3.0 else "center" if x_norm < 2.0 / 3.0 else "right"
    vertical = "bottom" if y_norm < 1.0 / 3.0 else "middle" if y_norm < 2.0 / 3.0 else "top"
    return f"{vertical}_{horizontal}"


def dominant_bucket(items):
    if not items:
        return "unknown"
    return Counter(items).most_common(1)[0][0]


def mean(values):
    return sum(values) / len(values) if values else 0.0


def stddev(values):
    if len(values) < 2:
        return 0.0
    avg = mean(values)
    return math.sqrt(sum((value - avg) ** 2 for value in values) / len(values))


def dominant_rgb_role(rgb, threshold=16):
    if not isinstance(rgb, dict):
        return "none"
    r = int(rgb.get("r", 0) or 0)
    g = int(rgb.get("g", 0) or 0)
    b = int(rgb.get("b", 0) or 0)
    peak = max(r, g, b)
    if peak < threshold:
        return "none"
    ordered = sorted([("red", r), ("green", g), ("blue", b)], key=lambda row: row[1], reverse=True)
    if ordered[1][1] >= peak * 0.6:
        return "mixed"
    return ordered[0][0]


def color_stats(active_nodes):
    role_counter = Counter()
    brightness_total = 0.0
    for node in active_nodes:
        rgb = node.get("rgb") or {}
        role = dominant_rgb_role(rgb)
        if role == "none":
            continue
        brightness = float(node.get("brightness", 0.0) or 0.0)
        role_counter[role] += brightness if brightness > 0 else 1.0
        brightness_total += brightness if brightness > 0 else 1.0
    if not role_counter:
        return {
            "dominantColorRole": "none",
            "colorRoleTotals": {},
            "activeColorRoleCount": 0,
            "colorSpread": 0.0,
            "multicolor": False,
        }
    dominant_role, dominant_weight = role_counter.most_common(1)[0]
    spread = 1.0 - (dominant_weight / brightness_total if brightness_total > 0 else 1.0)
    return {
        "dominantColorRole": dominant_role,
        "colorRoleTotals": dict(role_counter),
        "activeColorRoleCount": len(role_counter),
        "colorSpread": spread,
        "multicolor": len(role_counter) > 1,
    }


def temporal_stats(frame_observations, centroid_motions):
    if not frame_observations:
        return {
            "brightnessDeltaSeries": [],
            "nodeCountDeltaSeries": [],
            "brightnessDeltaMean": 0.0,
            "brightnessDeltaMax": 0.0,
            "brightnessDeltaStddev": 0.0,
            "nodeCountDeltaMean": 0.0,
            "nodeCountDeltaMax": 0.0,
            "nodeCountDeltaStddev": 0.0,
            "pulsePeakCount": 0,
            "pulseIntervalMeanFrames": 0.0,
            "pulseIntervalStddevFrames": 0.0,
            "burstFrameRatio": 0.0,
            "holdFrameRatio": 0.0,
            "transitionSharpnessMax": 0.0,
            "transitionSharpnessMean": 0.0,
            "motionToBrightnessCoupling": 0.0,
        }

    brightness_series = [float(frame.get("averageNodeBrightness", 0.0) or 0.0) for frame in frame_observations]
    node_count_series = [float(frame.get("activeNodeCount", 0.0) or 0.0) for frame in frame_observations]
    brightness_deltas = [abs(brightness_series[i] - brightness_series[i - 1]) for i in range(1, len(brightness_series))]
    node_count_deltas = [abs(node_count_series[i] - node_count_series[i - 1]) for i in range(1, len(node_count_series))]

    peak_indices = []
    for idx in range(1, len(brightness_series) - 1):
        current = brightness_series[idx]
        if current <= 0:
            continue
        if current >= brightness_series[idx - 1] and current > brightness_series[idx + 1]:
            peak_indices.append(idx)
    pulse_intervals = [peak_indices[i] - peak_indices[i - 1] for i in range(1, len(peak_indices))]

    brightness_delta_mean = mean(brightness_deltas)
    brightness_delta_std = stddev(brightness_deltas)
    burst_threshold = brightness_delta_mean + brightness_delta_std
    hold_threshold = max(0.005, brightness_delta_mean * 0.25)
    burst_frames = sum(1 for value in brightness_deltas if value > burst_threshold)
    hold_frames = sum(1 for value in brightness_deltas if value <= hold_threshold)

    transition_sharpness = []
    for idx in range(1, len(brightness_deltas)):
        transition_sharpness.append(abs(brightness_deltas[idx] - brightness_deltas[idx - 1]))

    coupled = []
    for idx, brightness_delta in enumerate(brightness_deltas):
        motion = centroid_motions[idx]["magnitude"] if idx < len(centroid_motions) else 0.0
        coupled.append(brightness_delta * motion)

    return {
        "brightnessDeltaSeries": brightness_deltas,
        "nodeCountDeltaSeries": node_count_deltas,
        "brightnessDeltaMean": brightness_delta_mean,
        "brightnessDeltaMax": max(brightness_deltas, default=0.0),
        "brightnessDeltaStddev": brightness_delta_std,
        "nodeCountDeltaMean": mean(node_count_deltas),
        "nodeCountDeltaMax": max(node_count_deltas, default=0.0),
        "nodeCountDeltaStddev": stddev(node_count_deltas),
        "pulsePeakCount": len(peak_indices),
        "pulseIntervalMeanFrames": mean(pulse_intervals),
        "pulseIntervalStddevFrames": stddev(pulse_intervals),
        "burstFrameRatio": (burst_frames / len(brightness_deltas)) if brightness_deltas else 0.0,
        "holdFrameRatio": (hold_frames / len(brightness_deltas)) if brightness_deltas else 0.0,
        "transitionSharpnessMax": max(transition_sharpness, default=0.0),
        "transitionSharpnessMean": mean(transition_sharpness),
        "motionToBrightnessCoupling": mean(coupled),
    }


def main():
    args = parse_args()
    with open(args.window, "r", encoding="utf-8") as handle:
        window = json.load(handle)
    geometry_path = window["geometryReference"].get("artifactPath") or window["source"].get("geometryArtifactPath")
    geometry = None
    if geometry_path:
        with open(geometry_path, "r", encoding="utf-8") as handle:
            geometry = json.load(handle)

    geometry_model_count = window["geometryReference"].get("modelCount") or 0
    geometry_scene_bounds = None
    if geometry:
        geometry_scene_bounds = bounds_union([m.get("bounds") for m in geometry["scene"]["models"]])
    geometry_scene_area = bounds_area_2d(geometry_scene_bounds)
    frame_observations = []
    active_centroids = []
    family_counter = Counter()
    active_model_names = set()
    model_counter = Counter()
    region_counter = Counter()
    color_role_counter = Counter()
    dominant_color_series = []
    color_spreads = []
    multicolor_frames = 0

    for frame in window["frames"]:
        families = Counter(model["displayAs"] for model in frame["models"])
        family_counter.update(families)
        active_model_names.update(model["modelName"] for model in frame["models"])
        model_counter.update({model["modelName"]: model["activeNodeCount"] for model in frame["models"]})
        bounds = bounds_union([model.get("activeBounds") for model in frame["models"]])
        weighted_centroid = None
        total_brightness = sum(
            model["averageNodeBrightness"] * model["activeNodeCount"]
            for model in frame["models"]
        )
        if total_brightness > 0:
            weighted_centroid = {
                "x": sum((model.get("activeCentroid") or {"x": 0})["x"] * model["averageNodeBrightness"] * model["activeNodeCount"] for model in frame["models"]) / total_brightness,
                "y": sum((model.get("activeCentroid") or {"y": 0})["y"] * model["averageNodeBrightness"] * model["activeNodeCount"] for model in frame["models"]) / total_brightness,
                "z": sum((model.get("activeCentroid") or {"z": 0})["z"] * model["averageNodeBrightness"] * model["activeNodeCount"] for model in frame["models"]) / total_brightness,
            }
        active_centroids.append(weighted_centroid)
        active_model_ratio = 0.0 if geometry_model_count == 0 else frame["activeModelCount"] / float(geometry_model_count)
        active_area = bounds_area_2d(bounds)
        scene_spread_ratio = 0.0 if geometry_scene_area <= 0 else active_area / geometry_scene_area
        region_distribution = Counter()
        frame_active_nodes = []
        if geometry_scene_bounds:
            min_x = geometry_scene_bounds["min"]["x"]
            max_x = geometry_scene_bounds["max"]["x"]
            min_y = geometry_scene_bounds["min"]["y"]
            max_y = geometry_scene_bounds["max"]["y"]
            width = max(max_x - min_x, 1e-9)
            height = max(max_y - min_y, 1e-9)
            for model in frame["models"]:
                for node in model["activeNodes"]:
                    frame_active_nodes.append(node)
                    screen = node.get("screen")
                    if not screen:
                        continue
                    x_norm = (screen["x"] - min_x) / width
                    y_norm = (screen["y"] - min_y) / height
                    region_distribution[region_label(x_norm, y_norm)] += 1
        else:
            for model in frame["models"]:
                frame_active_nodes.extend(model["activeNodes"])
        frame_color = color_stats(frame_active_nodes)
        dominant_color_series.append(frame_color["dominantColorRole"])
        color_spreads.append(frame_color["colorSpread"])
        if frame_color["multicolor"]:
            multicolor_frames += 1
        color_role_counter.update(frame_color["colorRoleTotals"])
        region_counter.update(region_distribution)
        frame_observations.append({
            "frameOffset": frame["frameOffset"],
            "frameTimeMs": frame["frameTimeMs"],
            "activeModelCount": frame["activeModelCount"],
            "activeModelRatio": active_model_ratio,
            "activeNodeCount": frame["activeNodeCount"],
            "averageNodeBrightness": total_brightness / frame["activeNodeCount"] if frame["activeNodeCount"] > 0 else 0.0,
            "familyDistribution": dict(families),
            "sceneActiveBounds": bounds,
            "sceneActiveCentroid": weighted_centroid,
            "sceneSpreadRatio": scene_spread_ratio,
            "densityBucket": density_bucket(active_model_ratio),
            "regionDistribution": dict(region_distribution),
            "dominantColorRole": frame_color["dominantColorRole"],
            "colorRoleTotals": frame_color["colorRoleTotals"],
            "activeColorRoleCount": frame_color["activeColorRoleCount"],
            "colorSpread": frame_color["colorSpread"],
            "multicolor": frame_color["multicolor"],
        })

    centroid_motions = []
    for idx in range(1, len(active_centroids)):
        delta = centroid_delta(active_centroids[idx - 1], active_centroids[idx])
        if delta:
            centroid_motions.append(delta)

    total_model_nodes = sum(model_counter.values())
    model_contribution_shares = {
        name: (count / float(total_model_nodes)) if total_model_nodes > 0 else 0.0
        for name, count in model_counter.items()
    }
    lead_model = None
    lead_model_share = 0.0
    if model_contribution_shares:
        lead_model, lead_model_share = max(model_contribution_shares.items(), key=lambda item: item[1])
    dominant_color_transitions = 0
    previous_color = None
    for role in dominant_color_series:
        if role == "none":
            continue
        if previous_color and role != previous_color:
            dominant_color_transitions += 1
        previous_color = role
    temporal = temporal_stats(frame_observations, centroid_motions)

    observation = {
        "artifactType": "render_observation_v1",
        "artifactVersion": 1,
        "source": {
            "windowArtifactPath": args.window,
            "geometryModelCount": geometry_model_count,
        },
        "macro": {
            "frameCount": len(frame_observations),
            "activeModelNames": sorted(active_model_names),
            "activeFamilyTotals": dict(family_counter),
            "activeModelTotals": dict(model_counter),
            "modelContributionShares": model_contribution_shares,
            "leadModel": lead_model,
            "leadModelShare": lead_model_share,
            "maxActiveModelCount": max((f["activeModelCount"] for f in frame_observations), default=0),
            "maxActiveModelRatio": max((f["activeModelRatio"] for f in frame_observations), default=0.0),
            "maxActiveNodeCount": max((f["activeNodeCount"] for f in frame_observations), default=0),
            "maxSceneSpreadRatio": max((f["sceneSpreadRatio"] for f in frame_observations), default=0.0),
            "meanSceneSpreadRatio": (
                sum(f["sceneSpreadRatio"] for f in frame_observations) / len(frame_observations)
                if frame_observations else 0.0
            ),
            "densityBucketSeries": [f["densityBucket"] for f in frame_observations],
            "dominantColorRoleSeries": dominant_color_series,
            "dominantColorRole": dominant_bucket([role for role in dominant_color_series if role != "none"]),
            "colorRoleTotals": dict(color_role_counter),
            "meanColorSpread": (sum(color_spreads) / len(color_spreads)) if color_spreads else 0.0,
            "multicolorFrameRatio": (multicolor_frames / len(frame_observations)) if frame_observations else 0.0,
            "dominantColorTransitions": dominant_color_transitions,
            "sceneBoundsUnion": bounds_union([f["sceneActiveBounds"] for f in frame_observations]),
            "fullSceneBounds": geometry_scene_bounds,
            "regionTotals": dict(region_counter),
            "centroidMotions": centroid_motions,
            "centroidMotionMax": max((m["magnitude"] for m in centroid_motions), default=0.0),
            "centroidMotionMean": (
                sum(m["magnitude"] for m in centroid_motions) / len(centroid_motions)
                if centroid_motions else 0.0
            ),
            "brightnessDeltaSeries": temporal["brightnessDeltaSeries"],
            "nodeCountDeltaSeries": temporal["nodeCountDeltaSeries"],
            "brightnessDeltaMean": temporal["brightnessDeltaMean"],
            "brightnessDeltaMax": temporal["brightnessDeltaMax"],
            "brightnessDeltaStddev": temporal["brightnessDeltaStddev"],
            "nodeCountDeltaMean": temporal["nodeCountDeltaMean"],
            "nodeCountDeltaMax": temporal["nodeCountDeltaMax"],
            "nodeCountDeltaStddev": temporal["nodeCountDeltaStddev"],
            "pulsePeakCount": temporal["pulsePeakCount"],
            "pulseIntervalMeanFrames": temporal["pulseIntervalMeanFrames"],
            "pulseIntervalStddevFrames": temporal["pulseIntervalStddevFrames"],
            "burstFrameRatio": temporal["burstFrameRatio"],
            "holdFrameRatio": temporal["holdFrameRatio"],
            "transitionSharpnessMax": temporal["transitionSharpnessMax"],
            "transitionSharpnessMean": temporal["transitionSharpnessMean"],
            "motionToBrightnessCoupling": temporal["motionToBrightnessCoupling"],
        },
        "frames": frame_observations,
    }

    if len(frame_observations) >= 6:
        slices = []
        n = len(frame_observations)
        boundaries = [(0, n // 3), (n // 3, (2 * n) // 3), ((2 * n) // 3, n)]
        model_totals = observation["macro"]["activeModelTotals"]
        for label, (start, end) in zip(["opening", "middle", "closing"], boundaries):
            frames = frame_observations[start:end]
            if not frames:
                continue
            family_counter = Counter()
            region_counter = Counter()
            spreads = []
            lead_model_counts = Counter()
            node_counts = []
            densities = []
            model_counts = []
            color_roles = []
            color_spreads = []
            multicolor_count = 0
            brightness_deltas = []
            node_count_deltas = []
            pulse_peaks = 0
            burst_frames = 0
            hold_frames = 0
            for frame in frames:
                family_counter.update(frame["familyDistribution"])
                region_counter.update(frame["regionDistribution"])
                spreads.append(frame["sceneSpreadRatio"])
                node_counts.append(frame["activeNodeCount"])
                densities.append(frame["densityBucket"])
                model_counts.append(frame["activeModelCount"])
                if frame.get("dominantColorRole") and frame["dominantColorRole"] != "none":
                    color_roles.append(frame["dominantColorRole"])
                color_spreads.append(frame.get("colorSpread", 0.0))
                if frame.get("multicolor"):
                    multicolor_count += 1
                for model_name in frame.get("familyDistribution", {}):
                    pass
                # Use whole-window model totals as a proxy for lead hierarchy until per-frame model totals are added.
                for model_name, count in model_totals.items():
                    lead_model_counts[model_name] += count
            slice_temporal = temporal_stats(frames, [])
            lead_model = None
            lead_share = 0.0
            if lead_model_counts:
                total = sum(lead_model_counts.values())
                lead_model, lead_count = lead_model_counts.most_common(1)[0]
                lead_share = lead_count / float(total) if total else 0.0
            slices.append({
                "label": label,
                "frameCount": len(frames),
                "activeFamilyTotals": dict(family_counter),
                "dominantDensityBucket": dominant_bucket(densities),
                "meanSceneSpreadRatio": sum(spreads) / len(spreads),
                "meanActiveNodeCount": sum(node_counts) / len(node_counts),
                "meanActiveModelCount": sum(model_counts) / len(model_counts),
                "dominantColorRole": dominant_bucket(color_roles),
                "meanColorSpread": sum(color_spreads) / len(color_spreads) if color_spreads else 0.0,
                "multicolorFrameRatio": multicolor_count / len(frames),
                "brightnessDeltaMean": slice_temporal["brightnessDeltaMean"],
                "pulsePeakCount": slice_temporal["pulsePeakCount"],
                "burstFrameRatio": slice_temporal["burstFrameRatio"],
                "holdFrameRatio": slice_temporal["holdFrameRatio"],
                "transitionSharpnessMean": slice_temporal["transitionSharpnessMean"],
                "regionTotals": dict(region_counter),
                "leadModel": lead_model,
                "leadModelShare": lead_share,
            })
        spread_values = [s["meanSceneSpreadRatio"] for s in slices]
        node_values = [s["meanActiveNodeCount"] for s in slices]
        observation["section"] = {
            "sliceCount": len(slices),
            "slices": slices,
            "contrast": {
                "spreadRange": (max(spread_values) - min(spread_values)) if spread_values else 0.0,
                "nodeCountRange": (max(node_values) - min(node_values)) if node_values else 0.0,
                "densityVaries": len({s["dominantDensityBucket"] for s in slices}) > 1 if slices else False,
            },
        }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(observation, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "macro": observation["macro"],
    }, indent=2))


if __name__ == "__main__":
    main()
