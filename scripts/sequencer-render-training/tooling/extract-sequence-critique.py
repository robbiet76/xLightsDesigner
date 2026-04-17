#!/usr/bin/env python3
import argparse
import json


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--observation", required=True)
    parser.add_argument("--composition-observation")
    parser.add_argument("--interaction-observation")
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
        designer_strengths.append(f"The section still reads as one idea with {lead_model} carrying the lead and restrained support around it.")
        sequencer_strengths.append("Model balance is weighted enough to preserve a clear lead-plus-support hierarchy.")
    else:
        designer_weaknesses.append("The scene is split across too many active models to read as one idea.")
        sequencer_weaknesses.append("Too many models are active at once for this checkpoint.")

    if spread < 0.01:
        designer_weaknesses.append("The visual footprint is very narrow relative to the full scene.")
        sequencer_weaknesses.append("Scene spread is too tight; add restrained support targets before polishing detail.")
        next_moves.append({
            "priority": 1,
            "owner": "sequencer",
            "level": "group",
            "instruction": "Broaden the active footprint with one secondary support family while preserving the lead target."
        })
    else:
        designer_strengths.append("The active footprint is broad enough to register at scene scale.")
        sequencer_strengths.append("Scene spread is large enough to support broader composition.")

    if density_series and len(set(density_series)) == 1:
        designer_strengths.append(f"Density is consistent across the sampled window ({density_series[0]}).")
        sequencer_strengths.append("Frame-to-frame density remains stable through the sampled checkpoint.")

    if len(active_families) == 1:
        family_name = next(iter(active_families))
        designer_weaknesses.append(f"Only one family is carrying the section ({family_name}).")
        sequencer_weaknesses.append(f"Family balance is narrow; current output relies entirely on {family_name}.")
        next_moves.append({
            "priority": 2,
            "owner": "designer",
            "level": "section",
            "instruction": f"Decide whether this section should remain {family_name}-only or intentionally add a support family."
        })
    elif coherent_support_case:
        designer_strengths.append("Multiple families are present, but the support family does not overpower the lead.")
        sequencer_strengths.append("Family spread is broad enough without losing the lead-target hierarchy.")

    if motion > 0:
        sequencer_strengths.append("Centroid motion indicates the active content is evolving, not frozen.")
    else:
        sequencer_weaknesses.append("Active centroid is static across the sampled frames.")

    if composition:
        if composition_hierarchy.get("leadSupportSeparation") == "high":
            designer_strengths.append("Lead and support are separated clearly enough to preserve the focal read.")
            sequencer_strengths.append("Support remains subordinate to the lead target in the rendered window.")
        if composition_hierarchy.get("dominanceConflict") == "high":
            designer_weaknesses.append("Support is competing too strongly with the lead for attention.")
            sequencer_weaknesses.append("Rendered hierarchy is unstable; support is challenging the lead read.")
            next_moves.append({
                "priority": 1,
                "owner": "sequencer",
                "level": "section",
                "instruction": "Reduce support intensity or coverage so the lead remains clearly dominant."
            })

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

    ladder_level = args.ladder_level
    if ladder_level == "section" and not section:
        raise RuntimeError("section ladder requested but observation has no section data")

    if ladder_level == "section":
        slices = section["slices"]
        contrast = section["contrast"]
        if not contrast["densityVaries"] and contrast["spreadRange"] < 0.005:
            designer_weaknesses.append("Section development is too flat across opening, middle, and closing slices.")
            sequencer_weaknesses.append("Section contrast is underdeveloped; the pass is not evolving enough over time.")
            next_moves.append({
                "priority": 1,
                "owner": "designer",
                "level": "section",
                "instruction": "Clarify how the section should evolve from opening to closing instead of holding one static treatment."
            })
            next_moves.append({
                "priority": 2,
                "owner": "sequencer",
                "level": "section",
                "instruction": "Introduce a bounded section-level evolution in spread, density, or support role across the sampled window."
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
        },
        "ladderLevel": ladder_level,
        "designerSummary": {
            "intentRead": "single-idea section read" if (len(active_models) == 1 or coherent_support_case) else "multi-idea section read",
            "focusRead": "narrow" if spread < 0.01 else "broad_enough",
            "contrastRead": density_series[0] if density_series else "unknown",
            "compositionRead": "concentrated" if (len(active_models) == 1 or coherent_support_case) else "split",
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
