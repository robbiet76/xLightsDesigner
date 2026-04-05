#!/usr/bin/env python3
import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional


def post_cmd(endpoint: str, cmd: str, params: Dict[str, Any]) -> Dict[str, Any]:
    payload = {
        "apiVersion": 2,
        "cmd": cmd,
        "params": params or {},
        "options": {},
    }
    req = urllib.request.Request(
        endpoint,
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as err:
        txt = err.read().decode("utf-8", errors="ignore") if hasattr(err, "read") else ""
        raise RuntimeError(f"{cmd} HTTP {err.code}: {txt or err.reason}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"{cmd} connection failed: {err.reason}") from err

    idx = raw.find("{")
    body = raw[idx:] if idx >= 0 else raw
    try:
        obj = json.loads(body)
    except Exception as err:
        raise RuntimeError(f"{cmd} invalid JSON response: {err}") from err
    if int(obj.get("res", 0)) != 200:
        e = obj.get("error") or {}
        code = str(e.get("code", "UNKNOWN"))
        msg = str(e.get("message", "Command failed"))
        raise RuntimeError(f"{cmd} failed ({code}): {msg}")
    return obj


def _as_marks(rows: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        try:
            s = int(round(float(row.get("startMs", 0))))
        except Exception:
            continue
        end_raw = row.get("endMs", None)
        e: Optional[int] = None
        if end_raw is not None:
            try:
                e = int(round(float(end_raw)))
            except Exception:
                e = None
        label = str(row.get("label", "")).strip()
        out.append({"startMs": max(0, s), "endMs": e, "label": label})
    out.sort(key=lambda r: int(r["startMs"]))
    return out


def _with_end_times(marks: List[Dict[str, Any]], duration_ms: Optional[int]) -> List[Dict[str, Any]]:
    rows = [dict(m) for m in marks]
    n = len(rows)
    for i, row in enumerate(rows):
        s = int(row.get("startMs", 0))
        e = row.get("endMs", None)
        if isinstance(e, int) and e > s:
            continue
        nxt = int(rows[i + 1]["startMs"]) if i + 1 < n else None
        if nxt is not None and nxt > s:
            row["endMs"] = nxt
        elif isinstance(duration_ms, int) and duration_ms > s:
            row["endMs"] = duration_ms
        else:
            row["endMs"] = s + 1
    cleaned = []
    for row in rows:
        s = int(row["startMs"])
        e = int(row.get("endMs", s + 1))
        if e <= s:
            e = s + 1
        cleaned.append({"startMs": s, "endMs": e, "label": str(row.get("label", "")).strip()})
    return cleaned


def infer_case_id(sequence_path: str, track_name: str) -> str:
    base = Path(sequence_path).stem if sequence_path else track_name
    slug = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")
    tslug = re.sub(r"[^a-z0-9]+", "-", track_name.lower()).strip("-")
    return f"{slug}-{tslug}" if tslug and tslug not in slug else slug or "xlights-case"


def main() -> int:
    ap = argparse.ArgumentParser(description="Export an xLights timing track into a structure-eval case JSON.")
    ap.add_argument("--endpoint", default="http://127.0.0.1:49914/xlDoAutomation", help="xLights automation endpoint")
    ap.add_argument("--track-name", default="Director Song Structure", help="Timing track name to export")
    ap.add_argument("--audio-path", default="", help="Optional override audio path for eval case")
    ap.add_argument("--title", default="", help="Optional title for case")
    ap.add_argument("--case-id", default="", help="Optional explicit case id")
    ap.add_argument("--out", required=True, help="Output JSON path")
    args = ap.parse_args()

    endpoint = str(args.endpoint).strip()
    track_name = str(args.track_name).strip()
    if not endpoint:
        print("Missing --endpoint", file=sys.stderr)
        return 2
    if not track_name:
        print("Missing --track-name", file=sys.stderr)
        return 2

    open_body = post_cmd(endpoint, "sequence.getOpen", {})
    open_seq = (open_body.get("data") or {}).get("sequence") or {}
    seq_path = str(open_seq.get("path", "")).strip()
    duration_ms = None
    try:
        d = int(round(float(open_seq.get("durationMs", 0))))
        if d > 0:
            duration_ms = d
    except Exception:
        duration_ms = None

    marks_body = post_cmd(endpoint, "timing.getMarks", {"trackName": track_name})
    marks = _as_marks(((marks_body.get("data") or {}).get("marks") or []))
    if not marks:
        print(f"No marks found on track '{track_name}'.", file=sys.stderr)
        return 3
    marks = _with_end_times(marks, duration_ms)

    audio_path = str(args.audio_path).strip()
    if not audio_path:
        try:
            media_body = post_cmd(endpoint, "media.getStatus", {})
            media = (media_body.get("data") or {}).get("media") or {}
            audio_path = str(media.get("path", "")).strip()
        except Exception:
            audio_path = ""

    case_id = str(args.case_id).strip() or infer_case_id(seq_path, track_name)
    title = str(args.title).strip() or (Path(seq_path).stem if seq_path else case_id)
    case_obj = {
        "id": case_id,
        "title": title,
        "audioPath": audio_path,
        "sequencePath": seq_path,
        "trackName": track_name,
        "expectedSections": marks,
    }
    out_obj = {"cases": [case_obj]}

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out_obj, indent=2), encoding="utf-8")

    print(f"Wrote: {out_path}")
    print(f"Case: {case_id}")
    print(f"Track: {track_name}")
    print(f"Marks: {len(marks)}")
    if seq_path:
        print(f"Sequence: {seq_path}")
    if audio_path:
        print(f"Audio: {audio_path}")
    else:
        print("Audio: (missing; provide --audio-path for eval runner)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
