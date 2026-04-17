#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--group-set", required=True)
    parser.add_argument("--placement-evidence", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def strv(value=""):
    return str(value or "").strip()


def numv(value, fallback=0):
    try:
        out = float(value)
    except (TypeError, ValueError):
        return fallback
    return out


def build_placement_map(placement_evidence):
    out = {}
    for row in placement_evidence.get("placements") or []:
        placement_id = strv(row.get("placementId"))
        if placement_id:
            out[placement_id] = row
    return out


def load_observation(path_text):
    path = Path(strv(path_text))
    if not path.exists():
        return None
    return read_json(path)


def dominant_color(obs):
    return strv(((obs or {}).get("macro") or {}).get("dominantColorRole"))


def temporal_read(obs):
    return strv(((obs or {}).get("macro") or {}).get("temporalRead"))


def coverage_read(obs):
    return strv(((obs or {}).get("macro") or {}).get("coverageRead"))


def pattern_family(obs):
    return strv(((obs or {}).get("analysis") or {}).get("patternFamily"))


def same_text(left, right):
    return bool(left) and left == right


def build_handoff_observation(group, left_row, right_row, left_obs, right_obs):
    left_end = numv((group.get("placements") or [{}])[0].get("endMs"))
    right_start = numv((group.get("placements") or [{}, {}])[1].get("startMs"))
    gap_ms = right_start - left_end
    return {
        "artifactType": "handoff_observation_v1",
        "artifactVersion": 1,
        "groupId": strv(group.get("groupId")),
        "taxonomy": "same_target_transition",
        "scope": {
            "targetId": strv(group.get("targetId")),
            "parentTargetId": strv(group.get("parentTargetId")),
            "timeGapMs": gap_ms,
        },
        "source": {
            "leftPlacementId": strv(left_row.get("placementId")),
            "rightPlacementId": strv(right_row.get("placementId")),
            "leftRenderObservationRef": strv(left_row.get("renderObservationRef")),
            "rightRenderObservationRef": strv(right_row.get("renderObservationRef")),
        },
        "signals": {
            "dominantColorStable": same_text(dominant_color(left_obs), dominant_color(right_obs)),
            "coverageReadStable": same_text(coverage_read(left_obs), coverage_read(right_obs)),
            "temporalReadStable": same_text(temporal_read(left_obs), temporal_read(right_obs)),
            "patternFamilyChanged": pattern_family(left_obs) != pattern_family(right_obs),
        },
        "notes": [
            "handoff_observation_v1 is derived from adjacent isolated realization observations.",
            "It is continuity evidence, not a layered composite judgment.",
        ],
    }


def build_ownership_observation(group, left_row, right_row):
    placements = group.get("placements") or []
    parent_target_id = strv(group.get("parentTargetId"))
    targets = [strv(row.get("targetId")) for row in placements]
    parent_target = next((t for t in targets if t == parent_target_id), "")
    child_target = next((t for t in targets if t and t != parent_target_id), "")
    return {
        "artifactType": "ownership_observation_v1",
        "artifactVersion": 1,
        "groupId": strv(group.get("groupId")),
        "taxonomy": "parent_submodel_overlap",
        "scope": {
            "targetId": strv(group.get("targetId")),
            "parentTargetId": parent_target_id,
            "overlapType": strv(group.get("overlapType")),
        },
        "source": {
            "leftPlacementId": strv(left_row.get("placementId")),
            "rightPlacementId": strv(right_row.get("placementId")),
            "leftPreviewSceneWindowRef": strv(left_row.get("previewSceneWindowRef")),
            "rightPreviewSceneWindowRef": strv(right_row.get("previewSceneWindowRef")),
        },
        "relationship": {
            "parentTargetId": parent_target,
            "childTargetId": child_target,
            "sharedPhysicalStructure": bool(parent_target and child_target),
            "ownershipClass": "parent_submodel",
        },
        "notes": [
            "ownership_observation_v1 is structural evidence derived from parent/submodel ancestry plus isolated render refs.",
            "It does not claim quality by itself.",
        ],
    }


def main():
    args = parse_args()
    group_set = read_json(Path(args.group_set))
    placement_evidence = read_json(Path(args.placement_evidence))
    placement_map = build_placement_map(placement_evidence)
    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)

    groups_out = []
    blocked = []

    for group in group_set.get("groups") or []:
        placements = group.get("placements") or []
        if len(placements) < 2:
            blocked.append({
                "groupId": strv(group.get("groupId")),
                "taxonomy": strv(group.get("taxonomy")),
                "blockedReason": "group requires at least two placements",
            })
            continue
        left = placement_map.get(strv(placements[0].get("placementId"))) or {}
        right = placement_map.get(strv(placements[1].get("placementId"))) or {}
        taxonomy = strv(group.get("taxonomy"))
        group_dir = out_root / strv(group.get("groupId")).replace(":", "_").replace("|", "_")
        group_dir.mkdir(parents=True, exist_ok=True)

        row = {
            "groupId": strv(group.get("groupId")),
            "taxonomy": taxonomy,
        }

        if taxonomy == "same_target_transition":
            left_obs = load_observation(left.get("renderObservationRef"))
            right_obs = load_observation(right.get("renderObservationRef"))
            if left_obs and right_obs:
                artifact = build_handoff_observation(group, left, right, left_obs, right_obs)
                handoff_path = group_dir / "handoff-observation.json"
                write_json(handoff_path, artifact)
                row["handoffObservationRef"] = str(handoff_path.resolve())
            else:
                blocked.append({
                    "groupId": strv(group.get("groupId")),
                    "taxonomy": taxonomy,
                    "blockedReason": "missing isolated renderObservationRef for handoff derivation",
                })
        elif taxonomy == "parent_submodel_overlap":
            if strv(left.get("previewSceneWindowRef")) and strv(right.get("previewSceneWindowRef")):
                artifact = build_ownership_observation(group, left, right)
                ownership_path = group_dir / "ownership-observation.json"
                write_json(ownership_path, artifact)
                row["ownershipObservationRef"] = str(ownership_path.resolve())
            else:
                blocked.append({
                    "groupId": strv(group.get("groupId")),
                    "taxonomy": taxonomy,
                    "blockedReason": "missing isolated previewSceneWindowRef for ownership derivation",
                })

        if len(row.keys()) > 2:
            groups_out.append(row)

    payload = {
        "artifactType": "layering_group_evidence_v1",
        "artifactVersion": 1,
        "source": {
            "groupSetRef": str(Path(args.group_set).resolve()),
            "placementEvidenceRef": str(Path(args.placement_evidence).resolve()),
        },
        "groups": groups_out,
        "blocked": blocked,
    }
    write_json(out_root / "layering-group-evidence.json", payload)
    print(json.dumps({
        "ok": True,
        "out": str((out_root / "layering-group-evidence.json").resolve()),
        "groupCount": len(groups_out),
        "blockedCount": len(blocked),
    }, indent=2))


if __name__ == "__main__":
    main()
