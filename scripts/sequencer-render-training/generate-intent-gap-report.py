#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


TARGETS = {
    ("SingleStrand", "single_line"): {
        "intentTags": ["clean", "directional", "bouncy", "texture_heavy", "patterned", "dense", "sparse", "readable"],
        "lookFamilies": ["chase_pattern", "skip_pattern", "fx_texture"],
        "motionFamilies": ["single_direction_chase", "bounce_motion", "left_motion", "right_motion"],
        "coverageFamilies": ["dense_sampled_motion", "sparse_sampled_motion"],
    },
    ("SingleStrand", "cane"): {
        "intentTags": ["clean", "directional", "bouncy", "texture_heavy", "patterned", "dense", "sparse", "readable"],
        "lookFamilies": ["chase_pattern", "skip_pattern", "fx_texture"],
        "motionFamilies": ["single_direction_chase", "bounce_motion", "left_motion", "right_motion"],
        "coverageFamilies": ["dense_sampled_motion", "sparse_sampled_motion"],
    },
    ("SingleStrand", "tree_360"): {
        "intentTags": ["clean", "directional", "bouncy", "texture_heavy", "patterned", "dense", "sparse", "readable"],
        "lookFamilies": ["chase_pattern", "skip_pattern", "fx_texture"],
        "motionFamilies": ["single_direction_chase", "bounce_motion", "left_motion", "right_motion"],
        "coverageFamilies": ["dense_sampled_motion", "sparse_sampled_motion"],
    },
    ("Shimmer", "outline"): {
        "intentTags": ["restrained", "texture_heavy", "dense", "sparse", "readable", "busy", "bold"],
        "lookFamilies": ["sparkle_texture"],
        "motionFamilies": ["unclassified_motion"],
        "coverageFamilies": ["dense_sampled_motion", "sparse_sampled_motion"],
    },
    ("Shimmer", "tree_flat"): {
        "intentTags": ["restrained", "texture_heavy", "dense", "sparse", "readable", "busy", "bold"],
        "lookFamilies": ["sparkle_texture"],
        "motionFamilies": ["unclassified_motion"],
        "coverageFamilies": ["dense_sampled_motion", "sparse_sampled_motion"],
    },
    ("Shimmer", "star"): {
        "intentTags": ["restrained", "texture_heavy", "dense", "sparse", "readable", "busy", "bold"],
        "lookFamilies": ["sparkle_texture"],
        "motionFamilies": ["unclassified_motion"],
        "coverageFamilies": ["dense_sampled_motion", "sparse_sampled_motion"],
    },
    ("Color Wash", "matrix"): {
        "intentTags": ["fill", "steady", "animated", "clean", "restrained", "bold", "full", "sparse", "readable"],
        "lookFamilies": ["wash_fill"],
        "motionFamilies": ["steady_wash", "shimmer_wash"],
        "coverageFamilies": ["full_coverage", "partial_coverage"],
    },
}


def values(items, key):
    return [item[key] for item in items]


def missing(expected, observed):
    observed_set = set(observed)
    return [item for item in expected if item not in observed_set]


def extra(expected, observed):
    expected_set = set(expected)
    return [item for item in observed if item not in expected_set]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    summary_doc = json.loads(Path(args.summary).read_text())
    reports = []
    for summary in summary_doc["summaries"]:
        key = (summary["effectName"], summary["modelType"])
        target = TARGETS.get(key, {})

        report = {
            "effectName": summary["effectName"],
            "modelType": summary["modelType"],
            "renderStyle": summary["renderStyle"],
            "distinctLookCount": summary["distinctLookCount"],
            "targetMode": "seed_coverage_not_closed_taxonomy",
            "missingIntentTags": missing(target.get("intentTags", []), values(summary.get("intentVocabulary", []), "tag")),
            "missingLookFamilies": missing(target.get("lookFamilies", []), values(summary.get("lookFamilies", []), "lookFamily")),
            "missingMotionFamilies": missing(target.get("motionFamilies", []), values(summary.get("motionFamilies", []), "motionFamily")),
            "missingCoverageFamilies": missing(target.get("coverageFamilies", []), values(summary.get("coverageFamilies", []), "coverageFamily")),
            "extraIntentTags": extra(target.get("intentTags", []), values(summary.get("intentVocabulary", []), "tag")),
            "extraLookFamilies": extra(target.get("lookFamilies", []), values(summary.get("lookFamilies", []), "lookFamily")),
            "extraMotionFamilies": extra(target.get("motionFamilies", []), values(summary.get("motionFamilies", []), "motionFamily")),
            "extraCoverageFamilies": extra(target.get("coverageFamilies", []), values(summary.get("coverageFamilies", []), "coverageFamily")),
        }
        reports.append(report)

    payload = {
        "summaryPath": args.summary,
        "reportCount": len(reports),
        "reports": reports,
    }
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
