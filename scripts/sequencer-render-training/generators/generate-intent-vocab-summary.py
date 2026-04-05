#!/usr/bin/env python3
import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path


def load_catalog(path: Path) -> dict:
    with path.open() as f:
        return json.load(f)


def group_clusters(clusters):
    groups = defaultdict(list)
    for cluster in clusters:
        key = (
            cluster["effectName"],
            cluster["modelType"],
            cluster["renderStyle"],
        )
        groups[key].append(cluster)
    return groups


def summarize_group(effect_name, model_type, render_style, clusters):
    tag_counts = Counter()
    look_counts = Counter()
    motion_counts = Counter()
    coverage_counts = Counter()
    structure_counts = Counter()

    for cluster in clusters:
        tag_counts.update(cluster.get("intentTags", []))
        look_counts.update([cluster.get("lookFamily", "unclassified_look")])
        motion_counts.update([cluster.get("motionFamily", "unclassified_motion")])
        coverage_counts.update([cluster.get("coverageFamily", "unclassified_coverage")])
        structure_counts.update([cluster.get("structureFamily", "unclassified_structure")])

    representatives = []
    for cluster in sorted(clusters, key=lambda c: (-c["representativeUsefulness"], c["representativeSampleId"])):
        representatives.append(
            {
                "sampleId": cluster["representativeSampleId"],
                "lookFamily": cluster["lookFamily"],
                "motionFamily": cluster["motionFamily"],
                "coverageFamily": cluster["coverageFamily"],
                "structureFamily": cluster["structureFamily"],
                "intentTags": cluster.get("intentTags", []),
                "representativeUsefulness": cluster["representativeUsefulness"],
                "memberCount": cluster["memberCount"],
            }
        )

    return {
        "effectName": effect_name,
        "modelType": model_type,
        "renderStyle": render_style,
        "distinctLookCount": len(clusters),
        "intentVocabulary": [
            {"tag": tag, "clusterCount": count}
            for tag, count in sorted(tag_counts.items(), key=lambda x: (-x[1], x[0]))
        ],
        "lookFamilies": [
            {"lookFamily": name, "clusterCount": count}
            for name, count in sorted(look_counts.items(), key=lambda x: (-x[1], x[0]))
        ],
        "motionFamilies": [
            {"motionFamily": name, "clusterCount": count}
            for name, count in sorted(motion_counts.items(), key=lambda x: (-x[1], x[0]))
        ],
        "coverageFamilies": [
            {"coverageFamily": name, "clusterCount": count}
            for name, count in sorted(coverage_counts.items(), key=lambda x: (-x[1], x[0]))
        ],
        "structureFamilies": [
            {"structureFamily": name, "clusterCount": count}
            for name, count in sorted(structure_counts.items(), key=lambda x: (-x[1], x[0]))
        ],
        "representatives": representatives,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    catalog = load_catalog(Path(args.catalog))
    grouped = group_clusters(catalog["clusters"])

    summaries = []
    for (effect_name, model_type, render_style), clusters in sorted(grouped.items()):
        summaries.append(summarize_group(effect_name, model_type, render_style, clusters))

    payload = {
        "catalogPath": args.catalog,
        "summaryCount": len(summaries),
        "summaries": summaries,
    }
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
