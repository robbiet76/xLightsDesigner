#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--observation", action="append", default=[])
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def read_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def classify_band(value, low=0.33, high=0.66, labels=("low", "medium", "high")):
    if value < low:
        return labels[0]
    if value < high:
        return labels[1]
    return labels[2]


def avg(values):
    values = list(values)
    return sum(values) / len(values) if values else 0.0


def strv(value):
    return str(value or "").strip()


def macro(observation):
    return (observation or {}).get("macro") or {}


def section(observation):
    return (observation or {}).get("section") or {}


def density_variety_score(series):
    values = [strv(item) for item in (series or []) if strv(item)]
    if not values:
        return 0.0
    unique = len(set(values))
    return clamp((unique - 1) / 2.0)


def classify_attention_profile(share):
    share = float(share or 0.0)
    if share >= 0.55:
        return "concentrated"
    if share >= 0.28:
        return "weighted"
    if share >= 0.12:
        return "distributed"
    return "diffuse"


def derive_temporal_variation_score(row):
    spread_shift = clamp(abs(float(row.get("maxSpread") or row.get("spread") or 0.0) - float(row.get("spread") or 0.0)) * 2.0)
    node_shift = clamp((float(row.get("nodeCountDeltaMean") or 0.0) / 1500.0) + (float(row.get("nodeCountDeltaStddev") or 0.0) / 2000.0))
    brightness_shift = clamp((float(row.get("brightnessDeltaMean") or 0.0) * 4.0) + (float(row.get("brightnessDeltaStddev") or 0.0) * 3.0))
    motion_shift = clamp(float(row.get("centroidMotionMean") or 0.0) / 120.0)
    density_shift = density_variety_score(row.get("densitySeries") or [])
    color_shift = clamp(float(row.get("dominantColorTransitions") or 0.0) / 2.0)
    pulse_shift = clamp((float(row.get("pulsePeakCount") or 0.0) / 2.0) + float(row.get("burstFrameRatio") or 0.0))
    return clamp(avg([
        spread_shift,
        node_shift,
        brightness_shift,
        motion_shift,
        density_shift,
        color_shift,
        pulse_shift,
    ]))


def classify_temporal_profile(row, variation_score):
    pulse_peaks = float(row.get("pulsePeakCount") or 0.0)
    burst_ratio = float(row.get("burstFrameRatio") or 0.0)
    hold_ratio = float(row.get("holdFrameRatio") or 0.0)
    color_transitions = int(row.get("dominantColorTransitions") or 0)
    density_shift = density_variety_score(row.get("densitySeries") or [])
    if pulse_peaks >= 1 or burst_ratio >= 0.15:
        return "pulsing"
    if variation_score >= 0.55 or color_transitions >= 2 or density_shift >= 0.5:
        return "evolving"
    if hold_ratio >= 0.45 and variation_score < 0.2:
        return "steady"
    if variation_score >= 0.25:
        return "modulated"
    return "steady"


def build_section_slice_windows(observation, source_ref):
    rows = []
    slices = section(observation).get("slices") or []
    for idx, item in enumerate(slices):
        rows.append({
            "windowId": f"{source_ref}#slice:{idx}",
            "sourceRef": source_ref,
            "kind": "section_slice",
            "label": strv(item.get("label")) or f"slice_{idx}",
            "leadModel": strv(item.get("leadModel")),
            "leadModelShare": float(item.get("leadModelShare") or 0.0),
            "densityBucket": strv(item.get("dominantDensityBucket")),
            "spread": float(item.get("meanSceneSpreadRatio") or 0.0),
            "maxSpread": float(item.get("maxSceneSpreadRatio") or item.get("meanSceneSpreadRatio") or 0.0),
            "activeNodeCount": float(item.get("meanActiveNodeCount") or 0.0),
            "activeModelCount": float(item.get("meanActiveModelCount") or 0.0),
            "activeFamilyCount": len(item.get("activeFamilyTotals") or {}),
        })
    for row in rows:
        row["attentionProfile"] = classify_attention_profile(row.get("leadModelShare"))
        row["temporalVariationScore"] = derive_temporal_variation_score(row)
        row["temporalProfile"] = classify_temporal_profile(row, row["temporalVariationScore"])
    return rows


def build_observation_windows(paths):
    observations = [(path, read_json(path)) for path in paths]
    if len(observations) == 1:
        only_path, only_obs = observations[0]
        slice_rows = build_section_slice_windows(only_obs, only_path)
        if len(slice_rows) >= 2:
            return observations, slice_rows, "section_window"
    windows = []
    for idx, (path, obs) in enumerate(observations):
        m = macro(obs)
        windows.append({
            "windowId": f"{path}#window:{idx}",
            "sourceRef": path,
            "kind": "ordered_window",
            "label": f"window_{idx + 1}",
            "leadModel": strv(m.get("leadModel")),
            "leadModelShare": float(m.get("leadModelShare") or 0.0),
            "densityBucket": strv(m.get("densityBucketSeries", [None])[0]),
            "spread": float(m.get("meanSceneSpreadRatio") or 0.0),
            "maxSpread": float(m.get("maxSceneSpreadRatio") or m.get("meanSceneSpreadRatio") or 0.0),
            "activeNodeCount": float(m.get("maxActiveNodeCount") or 0.0),
            "activeModelCount": float(m.get("maxActiveModelCount") or 0.0),
            "activeFamilyCount": len(m.get("activeFamilyTotals") or {}),
            "temporalRead": strv(m.get("temporalRead")),
            "dominantColorRole": strv(m.get("dominantColorRole")),
            "energyVariation": float(m.get("energyVariation") or 0.0),
            "brightnessDeltaMean": float(m.get("brightnessDeltaMean") or 0.0),
            "burstFrameRatio": float(m.get("burstFrameRatio") or 0.0),
            "holdFrameRatio": float(m.get("holdFrameRatio") or 0.0),
            "multicolorFrameRatio": float(m.get("multicolorFrameRatio") or 0.0),
            "dominantColorTransitions": int(m.get("dominantColorTransitions") or 0),
            "brightnessDeltaStddev": float(m.get("brightnessDeltaStddev") or 0.0),
            "nodeCountDeltaMean": float(m.get("nodeCountDeltaMean") or 0.0),
            "nodeCountDeltaStddev": float(m.get("nodeCountDeltaStddev") or 0.0),
            "pulsePeakCount": int(m.get("pulsePeakCount") or 0),
            "centroidMotionMean": float(m.get("centroidMotionMean") or 0.0),
            "densitySeries": m.get("densityBucketSeries") or [],
        })
    for row in windows:
        row["attentionProfile"] = classify_attention_profile(row.get("leadModelShare"))
        row["temporalVariationScore"] = derive_temporal_variation_score(row)
        row["temporalProfile"] = strv(row.get("temporalRead")) or classify_temporal_profile(row, row["temporalVariationScore"])
    return observations, windows, "sequence_slice" if len(windows) > 2 else "target_transition"


def score_handoff(windows):
    if len(windows) < 2:
        return {
            "handoffClarity": "medium",
            "continuityAdequacy": "medium",
            "transitionAbruptness": "low",
            "arrivalReadability": "medium",
            "scores": {
                "handoffClarity": 0.5,
                "continuityAdequacy": 0.5,
                "transitionAbruptness": 0.2,
                "arrivalReadability": 0.5,
            },
        }
    handoff_scores = []
    continuity_scores = []
    abruptness_scores = []
    arrival_scores = []
    for left, right in zip(windows, windows[1:]):
        attention_stable = strv(left.get("attentionProfile")) == strv(right.get("attentionProfile")) and strv(left.get("attentionProfile"))
        share_delta = abs(float(left.get("leadModelShare") or 0.0) - float(right.get("leadModelShare") or 0.0))
        density_stable = strv(left.get("densityBucket")) == strv(right.get("densityBucket")) and strv(left.get("densityBucket"))
        temporal_alignment = strv(left.get("temporalProfile")) == strv(right.get("temporalProfile")) and strv(left.get("temporalProfile"))
        handoff = clamp((0.4 if attention_stable else 0.22) + (0.15 if density_stable else 0.0) + (0.15 if temporal_alignment else 0.0) + max(0.0, 0.18 - share_delta))
        continuity = clamp((0.45 if attention_stable else 0.2) + (0.15 if share_delta < 0.12 else 0.0) + (0.15 if abs(float(left.get("spread") or 0.0) - float(right.get("spread") or 0.0)) < 0.08 else 0.0))
        abruptness = clamp((0.45 if share_delta > 0.25 else 0.1) + (0.15 if not density_stable else 0.0) + (0.15 if not temporal_alignment else 0.0))
        arrival = clamp(float(right.get("temporalVariationScore") or 0.0) + (0.2 if float(right.get("activeFamilyCount") or 0.0) >= 1 else 0.0) + (0.1 if strv(right.get("attentionProfile")) in {"concentrated", "weighted"} else 0.0))
        handoff_scores.append(handoff)
        continuity_scores.append(continuity)
        abruptness_scores.append(abruptness)
        arrival_scores.append(arrival)
    handoff_score = avg(handoff_scores)
    continuity_score = avg(continuity_scores)
    abruptness_score = avg(abruptness_scores)
    arrival_score = avg(arrival_scores)
    return {
        "handoffClarity": classify_band(handoff_score),
        "continuityAdequacy": classify_band(continuity_score),
        "transitionAbruptness": classify_band(abruptness_score),
        "arrivalReadability": classify_band(arrival_score),
        "scores": {
            "handoffClarity": round(handoff_score, 4),
            "continuityAdequacy": round(continuity_score, 4),
            "transitionAbruptness": round(abruptness_score, 4),
            "arrivalReadability": round(arrival_score, 4),
        },
    }


def score_development(observations, windows):
    if len(windows) >= 2 and all(w.get("kind") == "section_slice" for w in windows):
        source_obs = observations[0][1]
        contrast = section(source_obs).get("contrast") or {}
        spread_range = float(contrast.get("spreadRange") or 0.0)
        node_range = float(contrast.get("nodeCountRange") or 0.0)
        density_varies = bool(contrast.get("densityVaries"))
        temporal_variation = avg(float(w.get("temporalVariationScore") or 0.0) for w in windows)
        development = clamp((spread_range * 50.0) + (node_range / 120.0) + (0.2 if density_varies else 0.0) + (temporal_variation * 0.5))
    elif len(windows) == 1:
        only = windows[0]
        development = clamp(float(only.get("temporalVariationScore") or 0.0))
    else:
        spreads = [float(w.get("spread") or 0.0) for w in windows]
        nodes = [float(w.get("activeNodeCount") or 0.0) for w in windows]
        family_counts = [float(w.get("activeFamilyCount") or 0.0) for w in windows]
        variations = [float(w.get("temporalVariationScore") or 0.0) for w in windows]
        attention_profiles = [strv(w.get("attentionProfile")) for w in windows if strv(w.get("attentionProfile"))]
        development = clamp(
            ((max(spreads, default=0.0) - min(spreads, default=0.0)) * 1.5)
            + ((max(nodes, default=0.0) - min(nodes, default=0.0)) / 8000.0)
            + (0.15 if len(set(family_counts)) > 1 else 0.0)
            + (0.15 if len(set(attention_profiles)) > 1 else 0.0)
            + (avg(variations) * 0.5)
        )
    stagnation = clamp(1.0 - development)
    first_share = float(windows[0].get("leadModelShare") or 0.0) if windows else 0.0
    last_share = float(windows[-1].get("leadModelShare") or 0.0) if windows else 0.0
    share_delta = last_share - first_share
    escalation = clamp(max(0.0, share_delta) + (0.15 if development > 0.35 else 0.0))
    deescalation = clamp(max(0.0, -share_delta) + (0.15 if development > 0.35 else 0.0))
    return {
        "developmentStrength": classify_band(development),
        "stagnationRisk": classify_band(stagnation),
        "escalationRead": classify_band(escalation),
        "deescalationRead": classify_band(deescalation),
        "scores": {
            "developmentStrength": round(development, 4),
            "stagnationRisk": round(stagnation, 4),
            "escalationRead": round(escalation, 4),
            "deescalationRead": round(deescalation, 4),
        },
    }


def summarize_temporal_profile(windows):
    profiles = [strv(w.get("temporalProfile")) for w in windows if strv(w.get("temporalProfile"))]
    if not profiles:
        return "unknown"
    if len(set(profiles)) == 1:
        return profiles[0]
    return "mixed"


def score_repetition(windows):
    if len(windows) == 1:
        only = windows[0]
        pattern_reuse = clamp(0.75 - (float(only.get("temporalVariationScore") or 0.0) * 0.7))
        temporal_reuse = clamp(0.7 if strv(only.get("temporalProfile")) == "steady" else 0.3)
        palette_reuse = clamp(0.6 if float(only.get("dominantColorTransitions") or 0.0) <= 0 and float(only.get("multicolorFrameRatio") or 0.0) in {0.0, 1.0} else 0.3)
        staleness = clamp(avg([pattern_reuse, temporal_reuse, palette_reuse]))
    else:
        density_reuse = clamp(0.65 if len({strv(w.get("densityBucket")) for w in windows if strv(w.get("densityBucket"))}) <= 1 else 0.2)
        attention_reuse = clamp(0.65 if len({strv(w.get("attentionProfile")) for w in windows if strv(w.get("attentionProfile"))}) <= 1 else 0.2)
        temporal_reuse = clamp(0.65 if len({strv(w.get("temporalProfile")) for w in windows if strv(w.get("temporalProfile"))}) <= 1 else 0.2)
        palette_reuse = clamp(0.65 if len({strv(w.get("dominantColorRole")) for w in windows if strv(w.get("dominantColorRole"))}) <= 1 and any(strv(w.get("dominantColorRole")) for w in windows) else 0.25)
        staleness = clamp(avg([density_reuse, attention_reuse, temporal_reuse, palette_reuse]))
        pattern_reuse = avg([density_reuse, attention_reuse])
    return {
        "patternReuseLevel": classify_band(pattern_reuse),
        "motionReuseLevel": classify_band(temporal_reuse),
        "paletteReuseLevel": classify_band(palette_reuse),
        "stalenessRisk": classify_band(staleness),
        "scores": {
            "patternReuseLevel": round(pattern_reuse, 4),
            "motionReuseLevel": round(temporal_reuse, 4),
            "paletteReuseLevel": round(palette_reuse, 4),
            "stalenessRisk": round(staleness, 4),
        },
    }


def score_energy_arc(observations, windows):
    if len(windows) == 1:
        row = windows[0]
        energy_shape = float(row.get("temporalVariationScore") or 0.0)
        burst = float(row.get("burstFrameRatio") or 0.0)
        hold = float(row.get("holdFrameRatio") or 0.0)
        pulse = clamp(float(row.get("pulsePeakCount") or 0.0) / 2.0)
        arc = clamp((energy_shape * 0.7) + pulse + abs(burst - hold) * 0.25)
    else:
        shares = [float(w.get("leadModelShare") or 0.0) for w in windows]
        nodes = [float(w.get("activeNodeCount") or 0.0) for w in windows]
        spreads = [float(w.get("spread") or 0.0) for w in windows]
        variations = [float(w.get("temporalVariationScore") or 0.0) for w in windows]
        share_range = max(shares, default=0.0) - min(shares, default=0.0)
        node_range = max(nodes, default=0.0) - min(nodes, default=0.0)
        spread_range = max(spreads, default=0.0) - min(spreads, default=0.0)
        arc = clamp((share_range * 0.8) + (spread_range * 0.8) + (node_range / 8000.0) + (avg(variations) * 0.35))
    coherence = clamp((0.75 if arc >= 0.2 else 0.35) - (0.15 if len(windows) >= 3 and abs(float(windows[-1].get("leadModelShare") or 0.0) - float(windows[0].get("leadModelShare") or 0.0)) < 0.03 and arc < 0.2 else 0.0))
    peak = clamp(max(float(w.get("temporalVariationScore") or 0.0) for w in windows) + 0.1 if windows else 0.0)
    release = clamp((0.65 if len(windows) >= 2 and float(windows[-1].get("temporalVariationScore") or 0.0) < max(float(w.get("temporalVariationScore") or 0.0) for w in windows) else 0.25))
    return {
        "energyShapeClarity": classify_band(arc),
        "arcCoherence": classify_band(coherence),
        "peakPlacementRead": classify_band(peak),
        "releaseRead": classify_band(release),
        "scores": {
            "energyShapeClarity": round(arc, 4),
            "arcCoherence": round(coherence, 4),
            "peakPlacementRead": round(peak, 4),
            "releaseRead": round(release, 4),
        },
    }


def calibrate_development_block(development, repetition, energy_arc, windows):
    development_score = float((development.get("scores") or {}).get("developmentStrength") or 0.0)
    raw_stagnation_score = float((development.get("scores") or {}).get("stagnationRisk") or 0.0)
    repetition_staleness_score = float((repetition.get("scores") or {}).get("stalenessRisk") or 0.0)
    energy_shape_score = float((energy_arc.get("scores") or {}).get("energyShapeClarity") or 0.0)
    arc_coherence_score = float((energy_arc.get("scores") or {}).get("arcCoherence") or 0.0)
    temporal_profile = summarize_temporal_profile(windows)
    variation_adequacy = clamp((development_score * 0.6) + (energy_shape_score * 0.25) + ((1.0 - repetition_staleness_score) * 0.15))

    if len(windows) == 1:
        steady_validity = 0.0
        development_credit = clamp((development_score - 0.3) / 0.3)
        if temporal_profile in {"steady", "modulated", "pulsing"}:
            steady_validity += 0.08
        if arc_coherence_score >= 0.66:
            steady_validity += 0.12
        if energy_shape_score >= 0.66:
            steady_validity += 0.08
        if repetition_staleness_score <= 0.5:
            steady_validity += 0.07
        calibrated_stagnation = clamp(((raw_stagnation_score * 0.65) + (repetition_staleness_score * 0.35)) - (steady_validity * development_credit))
    else:
        calibrated_stagnation = clamp((raw_stagnation_score * 0.55) + (repetition_staleness_score * 0.45))

    updated = dict(development or {})
    updated["stagnationRisk"] = classify_band(calibrated_stagnation)
    updated["temporalProfile"] = temporal_profile
    updated["variationAdequacy"] = classify_band(variation_adequacy)
    scores = dict(updated.get("scores") or {})
    scores["stagnationRisk"] = round(calibrated_stagnation, 4)
    scores["variationAdequacy"] = round(variation_adequacy, 4)
    updated["scores"] = scores
    return updated


def main():
    args = parse_args()
    if not args.observation:
        raise RuntimeError("At least one --observation is required")
    observations, windows, scope_level = build_observation_windows(args.observation)
    handoff = score_handoff(windows)
    development = score_development(observations, windows)
    repetition = score_repetition(windows)
    energy_arc = score_energy_arc(observations, windows)
    development = calibrate_development_block(development, repetition, energy_arc, windows)

    payload = {
        "artifactType": "progression_observation_v1",
        "artifactVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "renderObservationRefs": [path for path, _ in observations],
        },
        "scope": {
            "scopeLevel": scope_level,
            "windowCount": len(windows),
        },
        "windowRefs": [
            {
                "windowId": row["windowId"],
                "targetId": row.get("leadModel") or "",
                "sectionName": row.get("label") or "",
                "roleHint": "window_focus",
            }
            for row in windows
        ],
        "handoff": handoff,
        "development": development,
        "repetition": repetition,
        "energyArc": energy_arc,
        "notes": [
            "progression_observation_v1 is derived from ordered render observation windows only.",
            "Scores are temporal evidence, not composition or layering scores.",
        ],
    }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "scopeLevel": scope_level,
        "developmentStrength": development["developmentStrength"],
        "stalenessRisk": repetition["stalenessRisk"],
    }, indent=2))


if __name__ == "__main__":
    main()
