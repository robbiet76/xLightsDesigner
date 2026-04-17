#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import sys


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--proof-plan", required=True)
    parser.add_argument("--placement-evidence", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def read_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        detail = (result.stderr or "").strip() or (result.stdout or "").strip() or f"command exited {result.returncode}"
        raise RuntimeError(detail)
    return result


def normalize_path(value):
    text = str(value or "").strip()
    return os.path.abspath(text) if text else ""


def build_maps(evidence):
    placements = {}
    groups = {}
    blocked = {}
    for row in evidence.get("placements") or []:
        placement_id = str(row.get("placementId") or "").strip()
        if not placement_id:
            continue
        placements[placement_id] = row
    for row in evidence.get("groups") or []:
        group_id = str(row.get("groupId") or "").strip()
        if not group_id:
            continue
        groups[group_id] = row
    for row in evidence.get("blocked") or []:
        group_id = str(row.get("groupId") or "").strip()
        if not group_id:
            continue
        blocked[group_id] = row
    return placements, groups, blocked


def ensure_render_observation(window_ref, out_dir, stem):
    observation_out = os.path.join(out_dir, f"{stem}.render-observation.json")
    run([
        sys.executable,
        "scripts/sequencer-render-training/tooling/extract-render-observation.py",
        "--window",
        window_ref,
        "--out",
        observation_out,
    ])
    return observation_out


def ensure_composite_window(window_refs, out_dir, stem):
    composite_out = os.path.join(out_dir, f"{stem}.preview-window.json")
    cmd = [
        sys.executable,
        "scripts/sequencer-render-training/tooling/compose-preview-scene-window.py",
    ]
    for ref in window_refs:
        cmd.extend(["--window", ref])
    cmd.extend(["--out", composite_out])
    run(cmd)
    return composite_out


def resolve_isolated_refs(placement_refs, placement_map):
    isolated = []
    missing = []
    for ref in placement_refs:
        placement_id = str(ref.get("placementId") or "").strip()
        evidence = placement_map.get(placement_id) or {}
        window_ref = normalize_path(evidence.get("previewSceneWindowRef"))
        observation_ref = normalize_path(evidence.get("renderObservationRef"))
        if not window_ref:
            missing.append(f"{placement_id}:previewSceneWindowRef")
        isolated.append({
            "placementId": placement_id,
            "previewSceneWindowRef": window_ref,
            "renderObservationRef": observation_ref,
        })
    return isolated, missing


def main():
    args = parse_args()
    proof_plan = read_json(args.proof_plan)
    evidence = read_json(args.placement_evidence)
    placement_map, group_map, blocked_group_map = build_maps(evidence)

    out_root = os.path.abspath(args.out)
    os.makedirs(out_root, exist_ok=True)

    proofs_out = []
    blocked_out = []

    for proof in proof_plan.get("proofs") or []:
        group_id = str(proof.get("groupId") or "").strip()
        taxonomy = str(proof.get("taxonomy") or "").strip()
        placement_refs = proof.get("placementRefs") or []
        isolated, missing = resolve_isolated_refs(placement_refs, placement_map)
        group_evidence = group_map.get(group_id) or {}

        proof_dir = os.path.join(out_root, group_id.replace(":", "_").replace("|", "_"))
        os.makedirs(proof_dir, exist_ok=True)

        composite_window_ref = ""
        composite_observation_ref = ""
        handoff_window_ref = normalize_path(group_evidence.get("handoffWindowRef"))
        handoff_observation_ref = normalize_path(group_evidence.get("handoffObservationRef"))
        ownership_window_ref = normalize_path(group_evidence.get("ownershipWindowRef"))
        ownership_observation_ref = normalize_path(group_evidence.get("ownershipObservationRef"))

        if taxonomy in {"same_target_layer_stack", "parent_submodel_overlap"} and not missing:
            composite_window_ref = ensure_composite_window(
                [row["previewSceneWindowRef"] for row in isolated],
                proof_dir,
                "composite",
            )
            composite_observation_ref = ensure_render_observation(
                composite_window_ref,
                proof_dir,
                "composite",
            )

        if taxonomy == "same_target_transition" and handoff_window_ref and not handoff_observation_ref:
            handoff_observation_ref = ensure_render_observation(
                handoff_window_ref,
                proof_dir,
                "handoff",
            )

        if taxonomy == "parent_submodel_overlap" and ownership_window_ref and not ownership_observation_ref:
            ownership_observation_ref = ensure_render_observation(
                ownership_window_ref,
                proof_dir,
                "ownership",
            )

        blocked_reasons = list(missing)
        if taxonomy == "same_target_transition" and not handoff_window_ref and not handoff_observation_ref:
            blocked_reasons.append("group:handoffWindowRef")
        if taxonomy == "parent_submodel_overlap" and not ownership_window_ref and not ownership_observation_ref:
            blocked_reasons.append("group:ownershipWindowRef")

        proof_artifact = {
            "artifactType": "layering_render_proof_v1",
            "artifactVersion": 1,
            "groupId": group_id,
            "taxonomy": taxonomy,
            "scope": proof.get("scope") or {},
            "placementRefs": placement_refs,
            "isolatedElementRefs": isolated,
            "compositeWindowRef": composite_window_ref,
            "compositeObservationRef": composite_observation_ref,
            "handoffWindowRef": handoff_window_ref,
            "handoffObservationRef": handoff_observation_ref,
            "ownershipWindowRef": ownership_window_ref,
            "ownershipObservationRef": ownership_observation_ref,
            "blocked": bool(blocked_reasons),
            "blockedReasons": blocked_reasons,
            "critiqueEnabled": not blocked_reasons and bool(proof.get("critiqueEnabled")),
        }
        write_json(os.path.join(proof_dir, "layering-render-proof.json"), proof_artifact)
        if proof_artifact["blocked"]:
            blocked_out.append(proof_artifact)
        else:
            proofs_out.append(proof_artifact)

    for blocked in proof_plan.get("blocked") or []:
        blocked_group = blocked_group_map.get(str(blocked.get("groupId") or "").strip()) or {}
        reasons = []
        if blocked_group.get("blockedReason"):
            reasons.append(blocked_group.get("blockedReason"))
        if blocked.get("unresolvedReason"):
            reasons.append(blocked.get("unresolvedReason"))
        if not reasons:
            reasons.append("blocked by proof plan")
        blocked_out.append({
            "artifactType": "layering_render_proof_v1",
            "artifactVersion": 1,
            "groupId": blocked.get("groupId"),
            "taxonomy": blocked.get("taxonomy"),
            "blocked": True,
            "blockedReasons": reasons,
            "critiqueEnabled": False,
        })

    bundle = {
        "artifactType": "layering_render_proof_bundle_v1",
        "artifactVersion": 1,
        "source": {
            "proofPlanRef": os.path.abspath(args.proof_plan),
            "placementEvidenceRef": os.path.abspath(args.placement_evidence),
        },
        "proofs": proofs_out,
        "blocked": blocked_out,
    }
    write_json(os.path.join(out_root, "layering-render-proof-bundle.json"), bundle)
    print(json.dumps({
        "ok": True,
        "out": os.path.join(out_root, "layering-render-proof-bundle.json"),
        "proofCount": len(proofs_out),
        "blockedCount": len(blocked_out),
    }, indent=2))


if __name__ == "__main__":
    main()
