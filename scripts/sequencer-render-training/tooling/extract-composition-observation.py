#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--observation", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def classify_band(value, low=0.33, high=0.66, labels=("low", "medium", "high")):
    if value < low:
        return labels[0]
    if value < high:
        return labels[1]
    return labels[2]


def main():
    args = parse_args()
    with open(args.observation, "r", encoding="utf-8") as handle:
        observation = json.load(handle)

    macro = observation.get("macro") or {}
    section = observation.get("section") or {}
    slices = section.get("slices") or []
    contrast = section.get("contrast") or {}

    active_models = macro.get("activeModelNames") or []
    active_families = macro.get("activeFamilyTotals") or {}
    lead_model = macro.get("leadModel")
    lead_share = float(macro.get("leadModelShare") or 0.0)
    max_active_model_ratio = float(macro.get("maxActiveModelRatio") or 0.0)
    mean_scene_spread_ratio = float(macro.get("meanSceneSpreadRatio") or 0.0)
    distinct_leads = int(macro.get("distinctLeadModelCount") or 0)
    energy_variation = float(macro.get("energyVariation") or 0.0)
    brightness_delta_mean = float(macro.get("brightnessDeltaMean") or 0.0)
    burst_ratio = float(macro.get("burstFrameRatio") or 0.0)
    hold_ratio = float(macro.get("holdFrameRatio") or 0.0)
    transition_sharpness = float(macro.get("transitionSharpnessMean") or 0.0)
    motion_coupling = float(macro.get("motionToBrightnessCoupling") or 0.0)
    multicolor_ratio = float(macro.get("multicolorFrameRatio") or 0.0)
    color_spread = float(macro.get("meanColorSpread") or 0.0)
    color_transitions = int(macro.get("dominantColorTransitions") or 0)
    coverage_read = str(macro.get("coverageRead") or "unknown")
    temporal_read = str(macro.get("temporalRead") or "unknown")

    spread_range = float(contrast.get("spreadRange") or 0.0)
    node_count_range = float(contrast.get("nodeCountRange") or 0.0)
    density_varies = bool(contrast.get("densityVaries"))

    opening = slices[0] if len(slices) >= 1 else {}
    closing = slices[-1] if len(slices) >= 2 else opening
    opening_color = str(opening.get("dominantColorRole") or "none")
    closing_color = str(closing.get("dominantColorRole") or "none")
    slice_density = [str(row.get("dominantDensityBucket") or "") for row in slices if str(row.get("dominantDensityBucket") or "")]

    coverage_contrast_score = clamp((spread_range * 40.0) + (0.35 if coverage_read == "balanced" else 0.15 if coverage_read == "partial" else 0.0))
    density_contrast_score = clamp((node_count_range / 500.0) + (0.35 if density_varies else 0.0))
    texture_contrast_score = clamp((len(active_families) / 4.0) + (0.25 if len(set(slice_density)) > 1 else 0.0))
    color_contrast_score = clamp(color_spread + (multicolor_ratio * 0.4) + min(0.3, color_transitions * 0.08) + (0.15 if opening_color and closing_color and opening_color != closing_color and closing_color != "none" else 0.0))
    timing_contrast_score = clamp((brightness_delta_mean * 4.0) + (burst_ratio * 0.4) + (0.25 if temporal_read == "evolving" else 0.1 if temporal_read == "modulated" else 0.0))
    contrast_adequacy_score = clamp((coverage_contrast_score + density_contrast_score + texture_contrast_score + color_contrast_score + timing_contrast_score) / 5.0)

    lead_support_separation_score = clamp((lead_share * 1.2) - (max_active_model_ratio * 0.2))
    dominance_conflict_score = clamp((1.0 - lead_share) + (0.2 if distinct_leads > 1 else 0.0))
    focus_stability_score = clamp((0.8 if distinct_leads <= 1 else 0.45 if distinct_leads == 2 else 0.2) + (lead_share * 0.2))
    compactness = clamp(1.0 - min(1.0, mean_scene_spread_ratio))
    masking_risk_score = clamp((compactness * 0.55) + (max_active_model_ratio * 0.35) + (0.15 if distinct_leads > 2 and compactness > 0.5 else 0.0))
    support_subordination_score = clamp(lead_share - (0.2 if len(active_families) > 3 else 0.0))

    motion_conflict_score = clamp((0.35 if temporal_read == "evolving" else 0.15 if temporal_read == "modulated" else 0.05) + (0.25 if burst_ratio > 0.35 and hold_ratio > 0.35 else 0.0) + min(0.25, transition_sharpness * 10.0))
    motion_reinforcement_score = clamp((0.45 if temporal_read in {"evolving", "modulated"} else 0.2) + min(0.25, motion_coupling * 8.0) + (0.15 if burst_ratio > 0 and hold_ratio < 0.5 else 0.0))
    cadence_alignment_score = clamp((0.7 if temporal_read == "modulated" else 0.55 if temporal_read == "evolving" else 0.3) - (0.15 if burst_ratio > 0.5 and hold_ratio > 0.5 else 0.0))
    phase_clash_risk_score = clamp((0.25 if burst_ratio > 0.45 else 0.05) + (0.2 if transition_sharpness > 0.08 else 0.0) + (0.15 if distinct_leads > 1 else 0.0))

    palette_reinforcement_score = clamp((0.55 if multicolor_ratio < 0.35 else 0.35) + (0.2 if color_transitions <= 1 else 0.0) + (0.15 if opening_color == closing_color and opening_color != "none" else 0.0))
    palette_conflict_score = clamp((0.3 if multicolor_ratio > 0.6 else 0.1) + min(0.35, color_transitions * 0.1) + (0.2 if opening_color != closing_color and opening_color != "none" and closing_color != "none" else 0.0))
    color_dominance_conflict_score = clamp((0.45 if color_spread > 0.55 else 0.1) + (0.2 if multicolor_ratio > 0.5 else 0.0))
    color_role_separation_score = clamp(color_spread + (0.2 if multicolor_ratio > 0.25 else 0.0))
    multicolor_competition_score = clamp((multicolor_ratio * 0.7) + (0.2 if color_transitions > 2 else 0.0))

    recent_pattern_reuse_score = clamp((0.55 if len(active_families) <= 1 else 0.25 if len(active_families) == 2 else 0.1) + (0.15 if len(set(slice_density)) <= 1 else 0.0))
    recent_motion_reuse_score = clamp((0.6 if temporal_read == "flat" else 0.3 if temporal_read == "modulated" else 0.15) + (0.15 if hold_ratio > 0.7 else 0.0))
    recent_palette_reuse_score = clamp((0.55 if color_transitions == 0 else 0.3 if color_transitions == 1 else 0.1) + (0.15 if multicolor_ratio < 0.1 else 0.0))
    recent_role_reuse_score = clamp((0.2 if distinct_leads <= 1 else 0.45 if distinct_leads == 2 else 0.65) + (0.15 if lead_share > 0.85 else 0.0))
    novelty_adequacy_score = clamp(1.0 - ((recent_pattern_reuse_score + recent_motion_reuse_score + recent_palette_reuse_score + recent_role_reuse_score) / 4.0))

    composition = {
        "artifactType": "composition_observation_v1",
        "artifactVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "renderObservationRef": args.observation,
            "renderObservationArtifactType": str(observation.get("artifactType") or ""),
            "renderObservationArtifactVersion": observation.get("artifactVersion"),
        },
        "scope": {
            "scopeLevel": "section_window" if slices else "sequence_slice",
            "leadModel": lead_model,
            "activeModelCount": len(active_models),
            "activeFamilyCount": len(active_families),
        },
        "elementRefs": [
            {
                "targetId": name,
                "roleHint": "dominant" if name == lead_model else "secondary",
            }
            for name in active_models
        ],
        "contrast": {
            "coverageContrast": classify_band(coverage_contrast_score),
            "densityContrast": classify_band(density_contrast_score),
            "textureContrast": classify_band(texture_contrast_score),
            "colorContrast": classify_band(color_contrast_score),
            "timingContrast": classify_band(timing_contrast_score),
            "contrastAdequacy": classify_band(contrast_adequacy_score),
            "scores": {
                "coverageContrast": round(coverage_contrast_score, 4),
                "densityContrast": round(density_contrast_score, 4),
                "textureContrast": round(texture_contrast_score, 4),
                "colorContrast": round(color_contrast_score, 4),
                "timingContrast": round(timing_contrast_score, 4),
                "contrastAdequacy": round(contrast_adequacy_score, 4),
            },
        },
        "hierarchy": {
            "attentionSeparation": classify_band(lead_support_separation_score),
            "attentionCompetition": classify_band(dominance_conflict_score),
            "attentionStability": classify_band(focus_stability_score),
            "occlusionRisk": classify_band(masking_risk_score),
            "secondarySubordination": classify_band(support_subordination_score),
            "leadSupportSeparation": classify_band(lead_support_separation_score),
            "dominanceConflict": classify_band(dominance_conflict_score),
            "focusStability": classify_band(focus_stability_score),
            "maskingRisk": classify_band(masking_risk_score),
            "supportSubordination": classify_band(support_subordination_score),
            "scores": {
                "attentionSeparation": round(lead_support_separation_score, 4),
                "attentionCompetition": round(dominance_conflict_score, 4),
                "attentionStability": round(focus_stability_score, 4),
                "occlusionRisk": round(masking_risk_score, 4),
                "secondarySubordination": round(support_subordination_score, 4),
                "leadSupportSeparation": round(lead_support_separation_score, 4),
                "dominanceConflict": round(dominance_conflict_score, 4),
                "focusStability": round(focus_stability_score, 4),
                "maskingRisk": round(masking_risk_score, 4),
                "supportSubordination": round(support_subordination_score, 4),
            },
        },
        "motionInteraction": {
            "motionConflict": classify_band(motion_conflict_score),
            "motionReinforcement": classify_band(motion_reinforcement_score),
            "cadenceAlignment": classify_band(cadence_alignment_score),
            "directionalAgreement": "not_observed",
            "phaseClashRisk": classify_band(phase_clash_risk_score),
            "scores": {
                "motionConflict": round(motion_conflict_score, 4),
                "motionReinforcement": round(motion_reinforcement_score, 4),
                "cadenceAlignment": round(cadence_alignment_score, 4),
                "phaseClashRisk": round(phase_clash_risk_score, 4),
            },
        },
        "colorInteraction": {
            "paletteReinforcement": classify_band(palette_reinforcement_score),
            "paletteConflict": classify_band(palette_conflict_score),
            "colorDominanceConflict": classify_band(color_dominance_conflict_score),
            "colorRoleSeparation": classify_band(color_role_separation_score),
            "multicolorCompetition": classify_band(multicolor_competition_score),
            "scores": {
                "paletteReinforcement": round(palette_reinforcement_score, 4),
                "paletteConflict": round(palette_conflict_score, 4),
                "colorDominanceConflict": round(color_dominance_conflict_score, 4),
                "colorRoleSeparation": round(color_role_separation_score, 4),
                "multicolorCompetition": round(multicolor_competition_score, 4),
            },
        },
        "novelty": {
            "recentPatternReuse": classify_band(recent_pattern_reuse_score),
            "recentMotionReuse": classify_band(recent_motion_reuse_score),
            "recentPaletteReuse": classify_band(recent_palette_reuse_score),
            "recentRoleReuse": classify_band(recent_role_reuse_score),
            "noveltyAdequacy": classify_band(novelty_adequacy_score),
            "scores": {
                "recentPatternReuse": round(recent_pattern_reuse_score, 4),
                "recentMotionReuse": round(recent_motion_reuse_score, 4),
                "recentPaletteReuse": round(recent_palette_reuse_score, 4),
                "recentRoleReuse": round(recent_role_reuse_score, 4),
                "noveltyAdequacy": round(novelty_adequacy_score, 4),
            },
        },
        "notes": [
            "composition_observation_v1 derives compact compositional evidence from render_observation_v1.",
            "Scores are realization-window evidence, not effect-level rankings.",
        ],
    }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(composition, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "scopeLevel": composition["scope"]["scopeLevel"],
        "contrastAdequacy": composition["contrast"]["contrastAdequacy"],
        "attentionSeparation": composition["hierarchy"]["attentionSeparation"],
        "noveltyAdequacy": composition["novelty"]["noveltyAdequacy"],
    }, indent=2))


if __name__ == "__main__":
    main()
