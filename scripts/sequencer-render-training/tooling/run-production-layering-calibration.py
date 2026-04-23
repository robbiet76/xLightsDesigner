#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import time
import urllib.parse
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]
TOOLING_DIR = ROOT_DIR / "scripts" / "sequencer-render-training" / "tooling"
XLIGHTS_APP = Path("/Applications/xLights.app")
DEFAULT_OWNED_PORT = 49925
DEFAULT_PREFERRED_CASES = [
    ("CozyLittleChristmas", "HiddenTree", ("Lines", "Snowflakes")),
    ("CozyLittleChristmas", "HiddenTreeStar", ("Color Wash", "Strobe")),
    ("CozyLittleChristmas", "Star", ("Twinkle", "Strobe")),
    ("CozyLittleChristmas", "Star", ("Twinkle", "Color Wash")),
    ("HolidayRoad", "SpiralTreeStars", ("Fan", "VU Meter")),
]


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-dir", required=True)
    parser.add_argument("--inventory", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--case-id", action="append", default=[])
    parser.add_argument("--limit", type=int, default=4)
    parser.add_argument("--launch-xlights", action="store_true")
    parser.add_argument("--owned-port", type=int, default=DEFAULT_OWNED_PORT)
    return parser.parse_args()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def strv(value=""):
    return str(value or "").strip()


def run(cmd: list[str], cwd: Path | None = None):
    subprocess.run(cmd, cwd=str(cwd or ROOT_DIR), check=True)


def run_capture_json(cmd: list[str], cwd: Path | None = None):
    result = subprocess.run(cmd, cwd=str(cwd or ROOT_DIR), check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def resolve_xlights_binary():
    derived_root = Path.home() / "Library" / "Developer" / "Xcode" / "DerivedData"
    candidates = []
    if derived_root.exists():
        for binary in derived_root.glob("xLights-*/Build/Products/Debug/xLights.app/Contents/MacOS/xLights"):
            try:
                candidates.append((binary.stat().st_mtime, binary))
            except FileNotFoundError:
                continue
    if candidates:
        candidates.sort(reverse=True)
        return candidates[0][1]
    fallback = XLIGHTS_APP / "Contents" / "MacOS" / "xLights"
    if fallback.exists():
        return fallback
    raise RuntimeError("No xLights binary found in DerivedData or /Applications/xLights.app")


def owned_base_url(port: int):
    return f"http://127.0.0.1:{port}/xlightsdesigner/api"


def read_json_url(url: str, method="GET", body: dict | None = None):
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as response:
        body = response.read().decode("utf-8")
    return json.loads(body)


def owned_health(port: int):
    return read_json_url(f"{owned_base_url(port)}/health")


def owned_ready(port: int):
    try:
        body = owned_health(port)
    except Exception:
        return False
    data = body.get("data") or {}
    return body.get("ok") is True and strv(data.get("state")) == "ready"


def launch_workspace_xlights(port: int):
    binary = resolve_xlights_binary()
    log_path = Path(f"/tmp/xlights-layering-calibration-{port}.log")
    env = {
        **dict(os.environ),
        "XLIGHTS_DESIGNER_ENABLED": "1",
        "XLIGHTS_DESIGNER_PORT": str(port),
        "XLIGHTS_DESIGNER_STARTUP_SETTLE_MS": "30000",
    }
    with log_path.open("wb") as log_file:
        subprocess.Popen(
            [str(binary), "-o"],
            stdout=log_file,
            stderr=log_file,
            start_new_session=True,
            env=env,
        )


def wait_for_owned_ready(port: int, timeout_seconds=180):
    deadline = time.time() + timeout_seconds
    last_health = None
    last_error = None
    while time.time() < deadline:
        try:
            health = owned_health(port)
            last_health = health
            data = health.get("data") or {}
            if health.get("ok") is True and strv(data.get("state")) == "ready":
                return health
        except Exception as error:
            last_error = repr(error)
        time.sleep(2)
    log_path = Path(f"/tmp/xlights-layering-calibration-{port}.log")
    log_tail = ""
    if log_path.exists():
        try:
            lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
            log_tail = "\n".join(lines[-40:])
        except Exception:
            log_tail = ""
    diagnostics = []
    if last_health is not None:
        diagnostics.append(f"lastHealth={json.dumps(last_health, sort_keys=True)}")
    if last_error is not None:
        diagnostics.append(f"lastError={last_error}")
    if log_tail:
        diagnostics.append(f"Log tail:\n{log_tail}")
    detail = "\n".join(diagnostics)
    raise RuntimeError(f"xLightsDesigner owned API did not become ready on port {port}.{(' ' + detail) if detail else ''}")


def ensure_workspace_session(workspace_dir: Path, launch: bool, port: int):
    if owned_ready(port):
        return
    if not launch:
        raise RuntimeError(
            f"xLightsDesigner owned API is not reachable on port {port}. Start a copied-show calibration session, "
            "or rerun with --launch-xlights."
        )
    launch_workspace_xlights(port)
    wait_for_owned_ready(port)


def owned_get(port: int, path: str, params: dict | None = None):
    url = f"{owned_base_url(port)}{path}"
    if params:
        query = urllib.parse.urlencode({key: str(value) for key, value in params.items() if value is not None and value != ""})
        if query:
            url = f"{url}?{query}"
    return read_json_url(url)


def owned_post(port: int, path: str, body: dict | None = None):
    return read_json_url(f"{owned_base_url(port)}{path}", method="POST", body=body or {})


def wait_for_owned_job(port: int, job_id: str, timeout_seconds=180):
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        settled = owned_get(port, "/jobs/get", {"jobId": job_id})
        state = strv(((settled.get("data") or {}).get("state"))).lower()
        if state in {"queued", "running"}:
            time.sleep(1)
            continue
        result = ((settled.get("data") or {}).get("result")) or {}
        if state != "completed" or result.get("ok") is not True:
            raise RuntimeError(f"owned job failed on port {port}: {settled}")
        return result
    raise RuntimeError(f"Timed out waiting for owned xLights job {job_id} on port {port}")


def owned_post_queued(port: int, path: str, body: dict | None = None):
    accepted = owned_post(port, path, body)
    job_id = strv(((accepted.get("data") or {}).get("jobId")))
    if not job_id:
        raise RuntimeError(f"owned route {path} returned no jobId: {accepted}")
    return wait_for_owned_job(port, job_id)


def open_and_render_sequence_owned(xsq_path: Path, port: int):
    open_result = owned_post_queued(port, "/sequence/open", {"file": str(xsq_path), "force": True})
    sequence = (open_result.get("data") or {}).get("sequence") or {}
    if Path(strv(sequence.get("path"))).resolve() != xsq_path.resolve():
        raise RuntimeError(f"owned sequence.open did not open expected file {xsq_path}: {open_result}")
    expected_fseq = xsq_path.with_suffix(".fseq")
    if expected_fseq.exists():
        expected_fseq.unlink()
    owned_post_queued(port, "/sequence/render-current", {})
    deadline = time.time() + 180
    while time.time() < deadline:
        if expected_fseq.exists() and expected_fseq.stat().st_size > 0:
            return expected_fseq
        time.sleep(1)
    raise RuntimeError(f"rendered fseq not found for {xsq_path}: expected {expected_fseq}")


def pick_cases(inventory: dict, requested_case_ids: list[str], limit: int):
    by_id = {strv(row.get("caseId")): row for row in inventory.get("cases") or []}
    if requested_case_ids:
        out = []
        for case_id in requested_case_ids:
            row = by_id.get(strv(case_id))
            if row:
                out.append(row)
        if not out:
            raise RuntimeError("Requested case ids were not found in inventory.")
        return out

    chosen = []
    seen = set()
    for sequence_name, target_id, effect_names in DEFAULT_PREFERRED_CASES:
        effect_set = set(effect_names)
        for row in inventory.get("cases") or []:
            if row.get("calibrationSuitability") != "high":
                continue
            if strv(row.get("sequenceName")) != sequence_name:
                continue
            if strv(row.get("targetId")) != target_id:
                continue
            names = {strv(effect.get("effectName")) for effect in row.get("effects") or []}
            if names != effect_set:
                continue
            case_id = strv(row.get("caseId"))
            if case_id in seen:
                continue
            seen.add(case_id)
            chosen.append(row)
            break
        if len(chosen) >= limit:
            break

    if chosen:
        return chosen[:limit]

    fallback = []
    for row in inventory.get("cases") or []:
        if row.get("calibrationSuitability") != "high":
            continue
        if strv(row.get("suitabilityReason")) == "aggregate_target":
            continue
        fallback.append(row)
        if len(fallback) >= limit:
            break
    return fallback


def copy_show_workspace(show_dir: Path, sequence_name: str, workspace_root: Path):
    workspace_root.mkdir(parents=True, exist_ok=True)
    for file_path in show_dir.glob("xlights*.xml"):
        shutil.copy2(file_path, workspace_root / file_path.name)
    source_sequence_dir = show_dir / sequence_name
    if not source_sequence_dir.exists():
        raise RuntimeError(f"sequence directory not found: {source_sequence_dir}")
    dest_sequence_dir = workspace_root / sequence_name
    if dest_sequence_dir.exists():
        shutil.rmtree(dest_sequence_dir)
    shutil.copytree(source_sequence_dir, dest_sequence_dir)
    xsq_candidates = sorted(dest_sequence_dir.glob("*.xsq"))
    if not xsq_candidates:
        raise RuntimeError(f"no .xsq found in {source_sequence_dir}")
    return dest_sequence_dir, xsq_candidates[0]


def isolate_xsq(source_xsq: Path, target_id: str, keep_effect_ids: set[str], out_path: Path):
    tree = ET.parse(source_xsq)
    root = tree.getroot()
    element_effects = root.find("ElementEffects")
    if element_effects is None:
        raise RuntimeError(f"ElementEffects missing in {source_xsq}")

    for element in element_effects.findall("Element"):
        if strv(element.get("type")) != "model":
            continue
        is_target = strv(element.get("name")) == target_id
        for layer in element.findall("EffectLayer"):
            for effect in list(layer.findall("Effect")):
                effect_id = strv(effect.get("id"))
                keep = is_target and effect_id in keep_effect_ids
                if not keep:
                    layer.remove(effect)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    tree.write(out_path, encoding="utf-8", xml_declaration=True)


def read_fseq_summary(fseq_path: Path):
    return run_capture_json([
        str(TOOLING_DIR / "fseq_window_decoder"),
        "--fseq", str(fseq_path),
        "--start-channel", "0",
        "--channel-count", "1",
        "--window-start-ms", "0",
        "--window-end-ms", "100",
        "--node-count", "1",
        "--channels-per-node", "1",
        "--frame-mode", "full",
    ])


def build_frame_offsets(duration_ms: int, step_time_ms: int):
    frame_count = max(1, int(duration_ms // step_time_ms))
    last_index = max(0, frame_count - 1)
    if frame_count <= 5:
        return list(range(frame_count))
    values = [0.08, 0.28, 0.5, 0.72, 0.92]
    offsets = []
    for ratio in values:
        value = max(0, min(last_index, int(round(last_index * ratio))))
        if value not in offsets:
            offsets.append(value)
    return offsets


def reconstruct_window(geometry_path: Path, fseq_path: Path, start_ms: int, end_ms: int, frame_offsets: list[int], out_path: Path):
    run([
        "python3",
        str(TOOLING_DIR / "reconstruct-preview-scene-window.py"),
        "--geometry", str(geometry_path),
        "--fseq", str(fseq_path),
        "--window-start-ms", str(start_ms),
        "--window-end-ms", str(end_ms),
        "--frame-offsets", ",".join(str(value) for value in frame_offsets),
        "--out", str(out_path),
    ])


def extract_render_observation(window_path: Path, out_path: Path):
    run([
        "python3",
        str(TOOLING_DIR / "extract-render-observation.py"),
        "--window", str(window_path),
        "--out", str(out_path),
    ])


def build_layering_proof(case: dict, isolated_refs: list[dict], composite_window: Path, composite_observation: Path):
    placements = case.get("effects") or []
    placement_refs = []
    for idx, row in enumerate(placements):
        placement_refs.append({
            "placementId": f"{strv(case.get('caseId'))}:p{idx + 1}",
            "targetId": strv(case.get("targetId")),
            "layerIndex": int(row.get("layerIndex") or 0),
            "effectName": strv(row.get("effectName")),
            "startMs": int(row.get("startMs") or 0),
            "endMs": int(row.get("endMs") or 0),
        })
    return {
        "artifactType": "layering_render_proof_v1",
        "artifactVersion": 1,
        "groupId": strv(case.get("caseId")),
        "taxonomy": "same_target_layer_stack",
        "scope": {
            "scopeLevel": "target",
            "targetId": strv(case.get("targetId")),
            "sequenceName": strv(case.get("sequenceName")),
            "windowStartMs": int(case.get("overlapStartMs") or 0),
            "windowEndMs": int(case.get("overlapEndMs") or 0),
        },
        "placementRefs": placement_refs,
        "isolatedElementRefs": isolated_refs,
        "compositeWindowRef": str(composite_window.resolve()),
        "compositeObservationRef": str(composite_observation.resolve()),
        "handoffWindowRef": "",
        "handoffObservationRef": "",
        "ownershipWindowRef": "",
        "ownershipObservationRef": "",
        "blocked": False,
        "blockedReasons": [],
        "critiqueEnabled": True,
    }


def process_case(show_dir: Path, case: dict, out_dir: Path, launch_xlights: bool, owned_port: int):
    sequence_name = strv(case.get("sequenceName"))
    target_id = strv(case.get("targetId"))
    overlap_start = int(case.get("overlapStartMs") or 0)
    overlap_end = int(case.get("overlapEndMs") or 0)
    overlap_duration = overlap_end - overlap_start
    effects = case.get("effects") or []
    if len(effects) != 2:
        raise RuntimeError(f"case requires exactly two effects: {case.get('caseId')}")

    case_dir = out_dir / strv(case.get("caseId")).replace(":", "_").replace("|", "_")
    workspace_dir = case_dir / "show-workspace"
    workspace_sequence_dir, workspace_xsq = copy_show_workspace(show_dir, sequence_name, workspace_dir)
    geometry_path = case_dir / "offline-preview-scene-geometry.json"

    run([
        "python3",
        str(TOOLING_DIR / "export-preview-scene-geometry-offline.py"),
        "--show-dir", str(workspace_dir),
        "--out", str(geometry_path),
    ])

    ensure_workspace_session(workspace_dir, launch_xlights, owned_port)

    variant_specs = [
        ("left", {strv(effects[0].get("effectId"))}),
        ("right", {strv(effects[1].get("effectId"))}),
        ("composite", {strv(effects[0].get("effectId")), strv(effects[1].get("effectId"))}),
    ]

    rendered = {}
    for variant_name, keep_ids in variant_specs:
        xsq_variant = workspace_sequence_dir / f"{variant_name}.xsq"
        isolate_xsq(workspace_xsq, target_id, keep_ids, xsq_variant)
        rendered[variant_name] = {
            "xsq": xsq_variant,
            "fseq": open_and_render_sequence_owned(xsq_variant, owned_port),
        }

    fseq_summary = read_fseq_summary(rendered["composite"]["fseq"])
    step_time_ms = int(fseq_summary.get("stepTimeMs") or 50)
    frame_offsets = build_frame_offsets(overlap_duration, step_time_ms)

    isolated_refs = []
    for idx, variant_name in enumerate(["left", "right"]):
        preview_window = case_dir / f"{variant_name}.preview-window.json"
        render_observation = case_dir / f"{variant_name}.render-observation.json"
        reconstruct_window(
            geometry_path,
            rendered[variant_name]["fseq"],
            overlap_start,
            overlap_end,
            frame_offsets,
            preview_window,
        )
        extract_render_observation(preview_window, render_observation)
        isolated_refs.append({
            "placementId": f"{strv(case.get('caseId'))}:p{idx + 1}",
            "previewSceneWindowRef": str(preview_window.resolve()),
            "renderObservationRef": str(render_observation.resolve()),
        })

    composite_window = case_dir / "composite.preview-window.json"
    composite_observation = case_dir / "composite.render-observation.json"
    reconstruct_window(
        geometry_path,
        rendered["composite"]["fseq"],
        overlap_start,
        overlap_end,
        frame_offsets,
        composite_window,
    )
    extract_render_observation(composite_window, composite_observation)

    proof_path = case_dir / "layering-render-proof.json"
    proof = build_layering_proof(case, isolated_refs, composite_window, composite_observation)
    write_json(proof_path, proof)

    observation_path = case_dir / "layering-observation.json"
    run([
        "python3",
        str(TOOLING_DIR / "extract-layering-observation.py"),
        "--proof", str(proof_path),
        "--out", str(observation_path),
    ])

    observation = read_json(observation_path)
    return {
        "caseId": strv(case.get("caseId")),
        "sequenceName": sequence_name,
        "targetId": target_id,
        "effectNames": [strv(row.get("effectName")) for row in effects],
        "window": {
            "startMs": overlap_start,
            "endMs": overlap_end,
            "durationMs": overlap_duration,
            "stepTimeMs": step_time_ms,
            "frameOffsets": frame_offsets,
        },
        "layeringRead": {
            "identityClarity": ((observation.get("separation") or {}).get("identityClarity")),
            "maskingRisk": ((observation.get("masking") or {}).get("maskingRisk")),
            "cadenceAlignment": ((observation.get("cadence") or {}).get("cadenceAlignment")),
            "colorConflict": ((observation.get("color") or {}).get("colorConflict")),
        },
        "artifactPaths": {
            "geometry": str(geometry_path),
            "proof": str(proof_path),
            "observation": str(observation_path),
            "leftObservation": isolated_refs[0]["renderObservationRef"],
            "rightObservation": isolated_refs[1]["renderObservationRef"],
            "compositeObservation": str(composite_observation),
        },
    }


def main():
    args = parse_args()
    show_dir = Path(args.show_dir).resolve()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    inventory = read_json(Path(args.inventory))
    cases = pick_cases(inventory, args.case_id, args.limit)
    if not cases:
        raise RuntimeError("No calibration cases selected.")

    rows = []
    failures = []
    for case in cases:
        try:
            rows.append(process_case(show_dir, case, out_dir, args.launch_xlights, args.owned_port))
        except Exception as err:
            failures.append({
                "caseId": strv(case.get("caseId")),
                "error": str(err),
            })

    summary = {
        "artifactType": "production_layering_calibration_run_v1",
        "artifactVersion": 1,
        "showDir": str(show_dir),
        "inventoryRef": str(Path(args.inventory).resolve()),
        "ownedPort": args.owned_port,
        "caseCount": len(cases),
        "completedCount": len(rows),
        "failedCount": len(failures),
        "rows": rows,
        "failures": failures,
    }
    summary_path = out_dir / "production-layering-calibration-summary.json"
    write_json(summary_path, summary)
    print(json.dumps({
        "ok": True,
        "out": str(summary_path),
        "completedCount": len(rows),
        "failedCount": len(failures),
    }, indent=2))


if __name__ == "__main__":
    main()
