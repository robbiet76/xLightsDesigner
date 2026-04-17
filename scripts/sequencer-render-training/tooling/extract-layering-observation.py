#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--proof", required=True)
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


def distinct_count(values):
    return len({str(v).strip() for v in values if str(v).strip()})


def macro(observation):
    return (observation or {}).get("macro") or {}


def analysis(observation):
    return (observation or {}).get("analysis") or {}


def temporal_read(observation):
    return str(macro(observation).get("temporalRead") or "").strip()


def coverage_read(observation):
    return str(macro(observation).get("coverageRead") or "").strip()


def dominant_color(observation):
    return str(macro(observation).get("dominantColorRole") or "").strip()


def color_spread(observation):
    return float(macro(observation).get("meanColorSpread") or 0.0)


def multicolor_ratio(observation):
    return float(macro(observation).get("multicolorFrameRatio") or 0.0)


def pulse_count(observation):
    return float(macro(observation).get("pulsePeakCount") or 0.0)


def burst_ratio(observation):
    return float(macro(observation).get("burstFrameRatio") or 0.0)


def hold_ratio(observation):
    return float(macro(observation).get("holdFrameRatio") or 0.0)


def pattern_family(observation):
    return str(analysis(observation).get("patternFamily") or "").strip()


def avg(values):
    values = list(values)
    return sum(values) / len(values) if values else 0.0


def load_isolated_observations(proof):
    rows = []
    for ref in proof.get("isolatedElementRefs") or []:
        obs_ref = str(ref.get("renderObservationRef") or "").strip()
        rows.append({
            "placementId": str(ref.get("placementId") or "").strip(),
            "renderObservationRef": obs_ref,
            "observation": read_json(obs_ref) if obs_ref else None,
        })
    return rows


def score_separation(isolated):
    observations = [row["observation"] for row in isolated if row.get("observation")]
    texture_sep = clamp((distinct_count(pattern_family(obs) for obs in observations) - 1) / 1.5)
    coverage_sep = clamp((distinct_count(coverage_read(obs) for obs in observations) - 1) / 1.5)
    color_sep = clamp(
        ((distinct_count(dominant_color(obs) for obs in observations) - 1) / 1.5)
        + min(0.4, avg(color_spread(obs) for obs in observations))
    )
    cadence_sep = clamp((distinct_count(temporal_read(obs) for obs in observations) - 1) / 1.5)
    identity = clamp(avg([texture_sep, coverage_sep, color_sep, cadence_sep]))
    return {
        "layerRoleSeparation": classify_band(identity),
        "textureSeparation": classify_band(texture_sep),
        "coverageSeparation": classify_band(coverage_sep),
        "identityClarity": classify_band(identity),
        "scores": {
            "layerRoleSeparation": round(identity, 4),
            "textureSeparation": round(texture_sep, 4),
            "coverageSeparation": round(coverage_sep, 4),
            "identityClarity": round(identity, 4),
        },
    }


def score_masking(proof, isolated, composite):
    observations = [row["observation"] for row in isolated if row.get("observation")]
    composite_obs = composite or {}
    composite_family = pattern_family(composite_obs)
    isolated_families = [pattern_family(obs) for obs in observations]
    family_collapse = 1.0 if composite_family and composite_family in isolated_families and distinct_count(isolated_families) > 1 else 0.35
    low_separation = 1.0 - score_separation(isolated)["scores"]["identityClarity"]
    dominant_loss = 0.2 if distinct_count(dominant_color(obs) for obs in observations) <= 1 else 0.0
    masking = clamp(avg([family_collapse, low_separation, dominant_loss]))
    support_obscuration = clamp(masking + (0.15 if len(observations) > 1 else 0.0))
    return {
        "attentionCompetition": classify_band(clamp(masking * 0.85)),
        "elementObscuration": classify_band(support_obscuration),
        "frontLayerLoss": classify_band(clamp(masking * 0.75)),
        "maskingRisk": classify_band(masking),
        "dominanceConflict": classify_band(clamp(masking * 0.85)),
        "supportObscuration": classify_band(support_obscuration),
        "foregroundLoss": classify_band(clamp(masking * 0.75)),
        "scores": {
            "attentionCompetition": round(clamp(masking * 0.85), 4),
            "elementObscuration": round(support_obscuration, 4),
            "frontLayerLoss": round(clamp(masking * 0.75), 4),
            "maskingRisk": round(masking, 4),
            "dominanceConflict": round(clamp(masking * 0.85), 4),
            "supportObscuration": round(support_obscuration, 4),
            "foregroundLoss": round(clamp(masking * 0.75), 4),
        },
    }


def score_cadence(isolated, handoff=None):
    observations = [row["observation"] for row in isolated if row.get("observation")]
    if handoff:
        signals = handoff.get("signals") or {}
        alignment = 0.8 if signals.get("temporalReadStable") else 0.35
        conflict = 0.2 if signals.get("temporalReadStable") else 0.65
        pulse = 0.15 if signals.get("patternFamilyChanged") and signals.get("temporalReadStable") else 0.45
        return {
            "cadenceAlignment": classify_band(alignment),
            "phaseClashRisk": classify_band(conflict),
            "motionConflict": classify_band(conflict),
            "pulseCompetition": classify_band(pulse),
            "scores": {
                "cadenceAlignment": round(alignment, 4),
                "phaseClashRisk": round(conflict, 4),
                "motionConflict": round(conflict, 4),
                "pulseCompetition": round(pulse, 4),
            },
        }

    temporal_sep = distinct_count(temporal_read(obs) for obs in observations)
    pulse_spread = max([pulse_count(obs) for obs in observations], default=0.0) - min([pulse_count(obs) for obs in observations], default=0.0)
    burst_hold_mix = avg(abs(burst_ratio(obs) - hold_ratio(obs)) for obs in observations)
    alignment = clamp((0.7 if temporal_sep <= 1 else 0.35) + (0.15 if pulse_spread < 2 else 0.0))
    conflict = clamp((0.2 if temporal_sep <= 1 else 0.6) + min(0.2, pulse_spread / 10.0))
    pulse = clamp((0.25 if burst_hold_mix < 0.15 else 0.55))
    return {
        "cadenceAlignment": classify_band(alignment),
        "phaseClashRisk": classify_band(conflict),
        "motionConflict": classify_band(conflict),
        "pulseCompetition": classify_band(pulse),
        "scores": {
            "cadenceAlignment": round(alignment, 4),
            "phaseClashRisk": round(conflict, 4),
            "motionConflict": round(conflict, 4),
            "pulseCompetition": round(pulse, 4),
        },
    }


def score_color(isolated, handoff=None):
    observations = [row["observation"] for row in isolated if row.get("observation")]
    if handoff:
        signals = handoff.get("signals") or {}
        reinforce = 0.75 if signals.get("dominantColorStable") else 0.35
        conflict = 0.2 if signals.get("dominantColorStable") else 0.65
        competition = 0.2 if signals.get("dominantColorStable") else 0.55
        dominant_loss = 0.15 if signals.get("dominantColorStable") else 0.5
        return {
            "colorReinforcement": classify_band(reinforce),
            "colorConflict": classify_band(conflict),
            "colorCompetition": classify_band(competition),
            "colorRoleLoss": classify_band(dominant_loss),
            "paletteReinforcement": classify_band(reinforce),
            "paletteConflict": classify_band(conflict),
            "colorCompetition": classify_band(competition),
            "dominantRoleLoss": classify_band(dominant_loss),
            "scores": {
                "colorReinforcement": round(reinforce, 4),
                "colorConflict": round(conflict, 4),
                "colorCompetition": round(competition, 4),
                "colorRoleLoss": round(dominant_loss, 4),
                "paletteReinforcement": round(reinforce, 4),
                "paletteConflict": round(conflict, 4),
                "colorCompetition": round(competition, 4),
                "dominantRoleLoss": round(dominant_loss, 4),
            },
        }

    dominant_roles = distinct_count(dominant_color(obs) for obs in observations)
    spread = avg(color_spread(obs) for obs in observations)
    multicolor = avg(multicolor_ratio(obs) for obs in observations)
    reinforce = clamp((0.7 if dominant_roles <= 1 else 0.35) + (0.15 if multicolor < 0.3 else 0.0))
    conflict = clamp((0.2 if dominant_roles <= 1 else 0.55) + (0.2 if multicolor > 0.5 else 0.0))
    competition = clamp((0.15 if spread < 0.25 else 0.45) + (0.2 if dominant_roles > 1 else 0.0))
    dominant_loss = clamp((0.15 if dominant_roles <= 1 else 0.5) + min(0.2, spread))
    return {
        "colorReinforcement": classify_band(reinforce),
        "colorConflict": classify_band(conflict),
        "colorCompetition": classify_band(competition),
        "colorRoleLoss": classify_band(dominant_loss),
        "paletteReinforcement": classify_band(reinforce),
        "paletteConflict": classify_band(conflict),
        "colorCompetition": classify_band(competition),
        "dominantRoleLoss": classify_band(dominant_loss),
        "scores": {
            "colorReinforcement": round(reinforce, 4),
            "colorConflict": round(conflict, 4),
            "colorCompetition": round(competition, 4),
            "colorRoleLoss": round(dominant_loss, 4),
            "paletteReinforcement": round(reinforce, 4),
            "paletteConflict": round(conflict, 4),
            "colorCompetition": round(competition, 4),
            "dominantRoleLoss": round(dominant_loss, 4),
        },
    }


def main():
    args = parse_args()
    proof = read_json(args.proof)
    isolated = load_isolated_observations(proof)
    composite_ref = str(proof.get("compositeObservationRef") or "").strip()
    handoff_ref = str(proof.get("handoffObservationRef") or "").strip()
    ownership_ref = str(proof.get("ownershipObservationRef") or "").strip()
    composite = read_json(composite_ref) if composite_ref else None
    handoff = read_json(handoff_ref) if handoff_ref else None
    ownership = read_json(ownership_ref) if ownership_ref else None

    separation = score_separation(isolated)
    masking = score_masking(proof, isolated, composite)
    cadence = score_cadence(isolated, handoff=handoff)
    color = score_color(isolated, handoff=handoff)

    element_refs = []
    for idx, ref in enumerate(proof.get("placementRefs") or []):
        element_refs.append({
            "targetId": str(ref.get("targetId") or "").strip(),
            "layerIndex": int(ref.get("layerIndex") or 0),
            "effectName": str(ref.get("effectName") or "").strip(),
            "realizationId": str(ref.get("placementId") or "").strip(),
            "roleHint": "primary" if idx == 0 else "secondary",
        })

    notes = [
        "layering_observation_v1 is derived from supported layering proof artifacts only.",
        "Scores are same-structure evidence, not effect-level rankings.",
    ]
    if handoff:
        notes.append("Continuity signals were derived from handoff_observation_v1.")
    if ownership:
        notes.append("Parent/submodel structural evidence was derived from ownership_observation_v1.")
    if composite:
        notes.append("Composite same-structure render evidence was available.")

    payload = {
        "artifactType": "layering_observation_v1",
        "artifactVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "layeringRenderProofRef": args.proof,
            "renderObservationRefs": [row["renderObservationRef"] for row in isolated if row.get("renderObservationRef")],
            "compositeObservationRef": composite_ref or None,
            "handoffObservationRef": handoff_ref or None,
            "ownershipObservationRef": ownership_ref or None,
            "placementRefs": [row.get("placementId") for row in proof.get("placementRefs") or []],
        },
        "scope": proof.get("scope") or {},
        "elementRefs": element_refs,
        "separation": separation,
        "masking": masking,
        "cadence": cadence,
        "color": color,
        "notes": notes,
    }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "scopeLevel": (payload.get("scope") or {}).get("scopeLevel"),
        "identityClarity": payload["separation"]["identityClarity"],
        "maskingRisk": payload["masking"]["maskingRisk"],
    }, indent=2))


if __name__ == "__main__":
    main()
