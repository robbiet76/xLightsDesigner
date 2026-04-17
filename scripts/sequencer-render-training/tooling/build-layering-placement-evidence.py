#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--records-root", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def walk_records(root: Path):
    return sorted(root.rglob("*.record.json"))


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    args = parse_args()
    root = Path(args.records_root)
    records = walk_records(root)

    placements = []
    skipped = []

    for record_path in records:
        data = read_json(record_path)
        placement_id = str(data.get("placementId") or "").strip()
        artifact = data.get("artifact") or {}
        preview_ref = str(artifact.get("previewSceneWindowRef") or "").strip()
        observation_ref = str(artifact.get("renderObservationRef") or "").strip()
        if not placement_id:
            skipped.append({
                "recordPath": str(record_path),
                "reason": "missing placementId",
            })
            continue
        placements.append({
            "placementId": placement_id,
            "sampleId": str(data.get("sampleId") or "").strip(),
            "recordPath": str(record_path),
            "previewSceneWindowRef": os.path.abspath(preview_ref) if preview_ref else "",
            "renderObservationRef": os.path.abspath(observation_ref) if observation_ref else "",
        })

    payload = {
        "artifactType": "layering_placement_evidence_v1",
        "artifactVersion": 1,
        "source": {
            "recordsRoot": str(root.resolve()),
            "recordCount": len(records),
        },
        "placements": placements,
        "groups": [],
        "skipped": skipped,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "ok": True,
        "out": str(out_path),
        "placementCount": len(placements),
        "skippedCount": len(skipped),
    }, indent=2))


if __name__ == "__main__":
    main()
