#!/usr/bin/env python3
import argparse
import json


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--observation", required=True)
    parser.add_argument("--composition-observation")
    parser.add_argument("--interaction-observation")
    parser.add_argument("--layering-observation")
    parser.add_argument("--progression-observation")
    parser.add_argument("--ladder-level", choices=["macro", "section"], default="macro")
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    with open(args.observation, "r", encoding="utf-8") as handle:
        obs = json.load(handle)
    composition_ref = args.composition_observation or args.interaction_observation
    composition = None
    if composition_ref:
        with open(composition_ref, "r", encoding="utf-8") as handle:
            composition = json.load(handle)
    layering = None
    if args.layering_observation:
        with open(args.layering_observation, "r", encoding="utf-8") as handle:
            layering = json.load(handle)
    progression = None
    if args.progression_observation:
        with open(args.progression_observation, "r", encoding="utf-8") as handle:
            progression = json.load(handle)

    macro = obs["macro"]
    section = obs.get("section")
    active_models = macro.get("activeModelNames", [])
    active_families = macro.get("activeFamilyTotals", {})
    spread = macro.get("meanSceneSpreadRatio", 0.0)
    density_series = macro.get("densityBucketSeries", [])
    motion = macro.get("centroidMotionMean", 0.0)
    lead_model = macro.get("leadModel")
    lead_model_share = macro.get("leadModelShare", 0.0)
    composition_contrast = ((composition or {}).get("contrast") or {})
    composition_hierarchy = ((composition or {}).get("hierarchy") or {})
    composition_motion = ((composition or {}).get("motionInteraction") or {})
    composition_color = ((composition or {}).get("colorInteraction") or {})
    composition_novelty = ((composition or {}).get("novelty") or {})
    layering_separation = ((layering or {}).get("separation") or {})
    layering_masking = ((layering or {}).get("masking") or {})
    layering_cadence = ((layering or {}).get("cadence") or {})
    layering_color = ((layering or {}).get("color") or {})
    progression_handoff = ((progression or {}).get("handoff") or {})
    progression_development = ((progression or {}).get("development") or {})
    progression_repetition = ((progression or {}).get("repetition") or {})
    progression_energy = ((progression or {}).get("energyArc") or {})

    designer_strengths = []
    designer_weaknesses = []
    sequencer_strengths = []
    sequencer_weaknesses = []
    next_moves = []

    coherent_support_case = (
        len(active_models) == 2
        and len(active_families) >= 2
        and lead_model_share >= 0.7
        and spread >= 0.01
    )

    if len(active_models) == 1:
        designer_strengths.append("The section reads as a single focused idea.")
        sequencer_strengths.append("Active content is concentrated enough to make the lead target legible.")
    elif coherent_support_case:
        designer_strengths.append(f"The section still reads with a clear weighted center around {lead_model}.")
        sequencer_strengths.append("Model balance is weighted enough to keep attention concentrated instead of diffuse.")
    else:
        designer_strengths.append("Attention is distributed across multiple structures rather than collapsing into one focal cluster.")
        sequencer_strengths.append("Activity is spread across multiple structures at this checkpoint.")

    if spread < 0.01:
        designer_strengths.append("The visual footprint stays intentionally narrow relative to the full scene.")
        sequencer_strengths.append("Scene spread is tightly bounded in this checkpoint.")
    else:
        designer_strengths.append("The active footprint is broad enough to register at scene scale.")
        sequencer_strengths.append("Scene spread is large enough to support broader composition.")

    if density_series and len(set(density_series)) == 1:
        designer_strengths.append(f"Density is consistent across the sampled window ({density_series[0]}).")
        sequencer_strengths.append("Frame-to-frame density remains stable through the sampled checkpoint.")

    if len(active_families) == 1:
        family_name = next(iter(active_families))
        designer_strengths.append(f"The section is carried by a single family ({family_name}).")
        sequencer_strengths.append(f"Family usage is intentionally narrow around {family_name}.")
    elif coherent_support_case:
        designer_strengths.append("Multiple families are present, but the support family does not overpower the lead.")
        sequencer_strengths.append("Family spread is broad enough without losing the lead-target hierarchy.")

    if motion > 0:
        sequencer_strengths.append("Centroid motion indicates the active content is evolving, not frozen.")
    else:
        sequencer_weaknesses.append("Active centroid is static across the sampled frames.")

    if composition:
        attention_separation = composition_hierarchy.get("attentionSeparation") or composition_hierarchy.get("leadSupportSeparation")
        attention_competition = composition_hierarchy.get("attentionCompetition") or composition_hierarchy.get("dominanceConflict")
        occlusion_risk = composition_hierarchy.get("occlusionRisk") or composition_hierarchy.get("maskingRisk")
        secondary_subordination = composition_hierarchy.get("secondarySubordination") or composition_hierarchy.get("supportSubordination")

        if attention_separation == "high":
            designer_strengths.append("The composition maintains clear attention separation across the active structures.")
            sequencer_strengths.append("Rendered attention remains differentiated across the active structures.")
        if attention_competition == "high":
            designer_weaknesses.append("Multiple structures are drawing comparable attention, which makes the hierarchy less clear.")
            sequencer_weaknesses.append("Rendered attention is contested across several structures.")
            next_moves.append({
                "priority": 1,
                "owner": "sequencer",
                "level": "section",
                "instruction": "Redistribute intensity or coverage so the intended attention structure reads more clearly."
            })
        if occlusion_risk == "high":
            designer_weaknesses.append("Some active structures are crowding or occluding each other in the scene read.")
            sequencer_weaknesses.append("Cross-structure visibility is crowded enough to reduce compositional clarity.")
        if secondary_subordination == "low" and attention_competition != "high":
            designer_weaknesses.append("Secondary structures are not differentiating their visual role clearly enough yet.")
            sequencer_weaknesses.append("Rendered secondary behavior is too similar to the dominant read.")

        if composition_contrast.get("contrastAdequacy") == "low":
            designer_weaknesses.append("The composition does not separate its elements strongly enough yet.")
            sequencer_weaknesses.append("Rendered contrast is too weak across coverage, texture, color, or timing.")
            next_moves.append({
                "priority": 2,
                "owner": "designer",
                "level": "section",
                "instruction": "Clarify which element should differentiate by coverage, texture, color, or timing instead of letting all elements read similarly."
            })

        if composition_color.get("paletteConflict") == "high":
            designer_weaknesses.append("Palette behavior is fighting itself instead of reinforcing the section read.")
            sequencer_weaknesses.append("Color interaction is too conflicted; palette behaviors are competing in the render.")

        if composition_motion.get("phaseClashRisk") == "high":
            designer_weaknesses.append("Motion timing is clashing enough to muddy the section rhythm.")
            sequencer_weaknesses.append("Rendered cadence conflict is too high for a clean section read.")

        if composition_novelty.get("noveltyAdequacy") == "low":
            designer_weaknesses.append("The section is too similar to its own recent behavior to feel progressive.")
            sequencer_weaknesses.append("Local novelty is underpowered; the rendered pass is reusing too much of the same pattern behavior.")

    if layering:
        layering_attention_competition = layering_masking.get("attentionCompetition") or layering_masking.get("dominanceConflict")
        layering_element_obscuration = layering_masking.get("elementObscuration") or layering_masking.get("supportObscuration")
        layering_color_conflict = layering_color.get("colorConflict") or layering_color.get("paletteConflict")

        if layering_separation.get("identityClarity") == "high":
            designer_strengths.append("Same-structure layers remain visually distinct enough to read cleanly.")
            sequencer_strengths.append("Layered elements preserve readable separation on the shared structure.")

        if layering_masking.get("maskingRisk") == "high":
            designer_weaknesses.append("Layering on the same structure is masking one element too aggressively.")
            sequencer_weaknesses.append("Same-target layering is obscuring one realized element in the render.")
            next_moves.append({
                "priority": 1,
                "owner": "sequencer",
                "level": "layering",
                "instruction": "Reduce same-target layering conflict by lowering overlap, coverage, or complexity in one layered realization."
            })

        if layering_element_obscuration == "high":
            designer_weaknesses.append("Same-structure layers are no longer separating their visual roles clearly.")
            sequencer_weaknesses.append("One layered element is obscuring another within the same-target stack.")

        if layering_attention_competition == "high" and layering_masking.get("maskingRisk") != "high":
            designer_weaknesses.append("Layered elements are competing for attention on the same structure.")
            sequencer_weaknesses.append("Same-target layering is producing contested attention rather than clear separation.")

        if layering_cadence.get("phaseClashRisk") == "high":
            designer_weaknesses.append("Layered cadence is clashing on the same structure instead of reinforcing a clear same-target read.")
            sequencer_weaknesses.append("Same-target timing behaviors are conflicting in the rendered layer stack.")
            next_moves.append({
                "priority": 2,
                "owner": "sequencer",
                "level": "layering",
                "instruction": "Align or simplify layered cadence so stacked realizations do not compete on the same structure."
            })

        if layering_color_conflict == "high":
            designer_weaknesses.append("Layered color behavior is muddying the shared structure instead of reinforcing it.")
            sequencer_weaknesses.append("Same-target color interaction is conflicting inside the layer stack.")
            next_moves.append({
                "priority": 2,
                "owner": "designer",
                "level": "layering",
                "instruction": "Clarify whether same-target layers should reinforce one palette role or intentionally separate by color."
            })

    if progression:
        if progression_handoff.get("handoffClarity") == "high":
            designer_strengths.append("The temporal handoff reads cleanly across the scoped window.")
            sequencer_strengths.append("Adjacent windows hand off cleanly without losing the read.")

        if progression_development.get("developmentStrength") == "high":
            designer_strengths.append("The scoped passage changes measurably over time instead of holding one static treatment.")
            sequencer_strengths.append("Rendered progression shows measurable temporal variation across the sampled windows.")

        if progression_development.get("stagnationRisk") == "high":
            designer_weaknesses.append("The scoped passage maintains a very similar temporal profile across the sampled window.")
            sequencer_weaknesses.append("Over-time variation is limited; the render stays too similar across the sampled window.")
            next_moves.append({
                "priority": 1,
                "owner": "designer",
                "level": "progression",
                "instruction": "Clarify whether this passage should hold, pulse, shift focus, or otherwise change over time."
            })
            next_moves.append({
                "priority": 2,
                "owner": "sequencer",
                "level": "progression",
                "instruction": "Introduce a bounded temporal change in density, attention distribution, color behavior, or motion so the passage does not stay overly uniform."
            })

        if progression_repetition.get("stalenessRisk") == "high":
            designer_weaknesses.append("Local reuse is strong enough that adjacent windows read very similarly.")
            sequencer_weaknesses.append("Recent window-to-window reuse is strong; variation is underpowered.")

        if progression_energy.get("arcCoherence") == "low":
            designer_weaknesses.append("The local energy arc is not reading coherently yet.")
            sequencer_weaknesses.append("Temporal energy shaping is unclear across the sampled window.")
            next_moves.append({
                "priority": 2,
                "owner": "designer",
                "level": "progression",
                "instruction": "Clarify whether this passage should build, hold, or release so the local energy arc reads intentionally."
            })

    ladder_level = args.ladder_level
    if ladder_level == "section" and not section:
        raise RuntimeError("section ladder requested but observation has no section data")

    if ladder_level == "section":
        slices = section["slices"]
        contrast = section["contrast"]
        if not contrast["densityVaries"] and contrast["spreadRange"] < 0.005:
            designer_weaknesses.append("Section slices maintain a very similar temporal and spatial profile from opening to closing.")
            sequencer_weaknesses.append("Section contrast is limited; the pass changes very little over time.")
            next_moves.append({
                "priority": 1,
                "owner": "designer",
                "level": "section",
                "instruction": "Clarify whether the section should stay intentionally steady or show a more visible shift from opening to closing."
            })
            next_moves.append({
                "priority": 2,
                "owner": "sequencer",
                "level": "section",
                "instruction": "Introduce a bounded section-level change in spread, density, attention distribution, or timing across the sampled window."
            })
        else:
            designer_strengths.append("The section shows measurable development across the sampled window.")
            sequencer_strengths.append("Section-level change is visible across the sampled slices.")
        if len(active_models) > 1 and lead_model_share >= 0.7:
            designer_strengths.append("The section keeps a readable lead target even while support is present.")
            sequencer_strengths.append("Lead-target hierarchy remains intact across the section.")

    critique = {
        "artifactType": "sequence_critique_v1",
        "artifactVersion": 1,
        "createdAt": None,
        "source": {
            "renderObservationRef": args.observation,
            "compositionObservationRef": composition_ref,
            "interactionObservationRef": args.interaction_observation,
            "layeringObservationRef": args.layering_observation,
            "progressionObservationRef": args.progression_observation,
        },
        "ladderLevel": ladder_level,
        "designerSummary": {
            "intentRead": "focused_attention" if (len(active_models) == 1 or coherent_support_case) else "distributed_attention",
            "focusRead": "narrow" if spread < 0.01 else "broad_enough",
            "contrastRead": density_series[0] if density_series else "unknown",
            "compositionRead": "concentrated" if (len(active_models) == 1 or coherent_support_case) else "distributed",
            "strengths": designer_strengths,
            "weaknesses": designer_weaknesses,
            "designAdjustmentSuggestions": [m["instruction"] for m in next_moves if m["owner"] == "designer"],
        },
        "sequencerSummary": {
            "executionRead": "stable_sparse_pass",
            "spreadRead": "too_narrow" if spread < 0.01 else "acceptable",
            "densityRead": density_series[0] if density_series else "unknown",
            "familyBalanceRead": "single_family" if len(active_families) == 1 else "multi_family",
            "motionRead": "moving" if motion > 0 else "static",
            "strengths": sequencer_strengths,
            "weaknesses": sequencer_weaknesses,
            "revisionSuggestions": [m["instruction"] for m in next_moves if m["owner"] == "sequencer"],
        },
        "nextMoves": next_moves,
    }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(critique, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "ladderLevel": critique["ladderLevel"],
        "designerWeaknesses": critique["designerSummary"]["weaknesses"],
        "sequencerWeaknesses": critique["sequencerSummary"]["weaknesses"],
    }, indent=2))


if __name__ == "__main__":
    main()
