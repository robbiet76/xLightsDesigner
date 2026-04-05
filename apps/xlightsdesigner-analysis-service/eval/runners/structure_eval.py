#!/usr/bin/env python3
import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

LABEL_MAP = {
    "intro": "Intro",
    "verse": "Verse",
    "chorus": "Chorus",
    "prechorus": "Pre-Chorus",
    "pre-chorus": "Pre-Chorus",
    "postchorus": "Post-Chorus",
    "post-chorus": "Post-Chorus",
    "bridge": "Bridge",
    "instrumental": "Instrumental",
    "outro": "Outro",
    "refrain": "Refrain",
    "hook": "Hook",
    "solo": "Solo",
    "interlude": "Interlude",
    "breakdown": "Breakdown",
    "tag": "Tag",
    "section": "Section",
}


def normalize_label(label: str) -> str:
    text = str(label or "").strip().lower()
    if not text:
        return "Unknown"
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s*\d+$", "", text)
    text = text.replace("_", "-")
    compact = text.replace(" ", "")
    if compact in LABEL_MAP:
        return LABEL_MAP[compact]
    if text in LABEL_MAP:
        return LABEL_MAP[text]
    return text.title()


def sanitize_marks(rows: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        try:
            s = int(round(float(row.get("startMs", 0))))
        except Exception:
            continue
        try:
            e = int(round(float(row.get("endMs", s + 1))))
        except Exception:
            e = s + 1
        if e <= s:
            e = s + 1
        out.append({"startMs": max(0, s), "endMs": max(1, e), "label": str(row.get("label", "")).strip()})
    out.sort(key=lambda r: (int(r["startMs"]), int(r["endMs"])))
    return out


def section_at(ms: int, rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    for row in rows:
        if int(row["startMs"]) <= ms < int(row["endMs"]):
            return row
    return rows[-1] if rows else None


def pair_by_midpoint(expected: List[Dict[str, Any]], predicted: List[Dict[str, Any]]) -> List[Tuple[Dict[str, Any], Optional[Dict[str, Any]]]]:
    pairs = []
    for exp in expected:
        mid = int((int(exp["startMs"]) + int(exp["endMs"])) / 2)
        pred = section_at(mid, predicted)
        pairs.append((exp, pred))
    return pairs


def mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def median(values: List[float]) -> float:
    if not values:
        return 0.0
    vals = sorted(values)
    m = len(vals) // 2
    if len(vals) % 2 == 1:
        return vals[m]
    return (vals[m - 1] + vals[m]) / 2.0


def _build_multipart_body(fields: Dict[str, str], file_field: str, file_name: str, file_bytes: bytes, file_content_type: str) -> Tuple[bytes, str]:
    boundary = "----xld-structure-eval-boundary"
    lines: List[bytes] = []
    for key, value in fields.items():
        lines.append(f"--{boundary}\r\n".encode("utf-8"))
        lines.append(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8"))
        lines.append(f"{value}\r\n".encode("utf-8"))
    lines.append(f"--{boundary}\r\n".encode("utf-8"))
    lines.append(
        f'Content-Disposition: form-data; name="{file_field}"; filename="{file_name}"\r\n'.encode("utf-8")
    )
    lines.append(f"Content-Type: {file_content_type}\r\n\r\n".encode("utf-8"))
    lines.append(file_bytes)
    lines.append(b"\r\n")
    lines.append(f"--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(lines)
    return body, boundary


def analyze_via_service(base_url: str, provider: str, audio_path: Path, timeout_s: float) -> Dict[str, Any]:
    fields = {
        "provider": provider,
        "fileName": audio_path.name,
    }
    file_bytes = audio_path.read_bytes()
    body, boundary = _build_multipart_body(fields, "file", audio_path.name, file_bytes, "application/octet-stream")
    req = urllib.request.Request(
        url=f"{base_url.rstrip('/')}/analyze",
        method="POST",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="ignore") if hasattr(err, "read") else ""
        raise RuntimeError(f"HTTP {err.code}: {raw or err.reason}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"Connection failed: {err.reason}") from err

    data = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(data, dict):
        raise RuntimeError("Unexpected analyze response format")
    return data


def run_case(base_url: str, provider: str, case: Dict[str, Any], timeout_s: float) -> Dict[str, Any]:
    audio_path = Path(str(case.get("audioPath", "")).strip())
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    result = analyze_via_service(base_url, provider, audio_path, timeout_s)
    predicted = sanitize_marks(result.get("sections") or [])
    expected = sanitize_marks(case.get("expectedSections") or [])

    if not expected:
        raise ValueError("Case missing expectedSections")

    pairs = pair_by_midpoint(expected, predicted)
    label_hits = 0
    total = len(pairs)
    start_errs: List[float] = []
    end_errs: List[float] = []
    mismatches = []

    for exp, pred in pairs:
        exp_label = normalize_label(exp.get("label", ""))
        pred_label = normalize_label((pred or {}).get("label", "")) if pred else "Unknown"
        if exp_label == pred_label:
            label_hits += 1
        else:
            mismatches.append({
                "expected": exp_label,
                "predicted": pred_label,
                "expectedStartMs": int(exp["startMs"]),
                "expectedEndMs": int(exp["endMs"]),
                "predictedStartMs": int((pred or {}).get("startMs", -1)),
                "predictedEndMs": int((pred or {}).get("endMs", -1)),
            })
        if pred:
            start_errs.append(abs(int(exp["startMs"]) - int(pred["startMs"])))
            end_errs.append(abs(int(exp["endMs"]) - int(pred["endMs"])))

    label_acc = (label_hits / total) if total else 0.0
    return {
        "id": str(case.get("id", audio_path.name)),
        "title": str(case.get("title", "")).strip(),
        "provider": provider,
        "expectedCount": len(expected),
        "predictedCount": len(predicted),
        "labelAccuracy": round(label_acc, 4),
        "startMaeMs": round(mean(start_errs), 2),
        "endMaeMs": round(mean(end_errs), 2),
        "startMedianAbsErrMs": round(median(start_errs), 2),
        "endMedianAbsErrMs": round(median(end_errs), 2),
        "mismatches": mismatches[:20],
        "predictedSections": predicted,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Evaluate section labels against expected references.")
    ap.add_argument("--cases", required=True, help="Path to JSON file containing eval cases")
    ap.add_argument("--base-url", default="http://127.0.0.1:5055", help="Analysis service base URL")
    ap.add_argument("--provider", default="beatnet", choices=["beatnet", "librosa", "auto"], help="Provider sent to /analyze")
    ap.add_argument("--timeout", type=float, default=180.0, help="HTTP timeout seconds")
    ap.add_argument("--out", default="", help="Optional output JSON report path")
    args = ap.parse_args()

    cases_path = Path(args.cases)
    payload = json.loads(cases_path.read_text(encoding="utf-8"))
    cases = payload.get("cases") if isinstance(payload, dict) else None
    if not isinstance(cases, list) or not cases:
        print("No cases found. Expected JSON object with non-empty 'cases' array.", file=sys.stderr)
        return 2

    reports = []
    for case in cases:
        case_id = str(case.get("id", "unknown"))
        try:
            rep = run_case(args.base_url, args.provider, case, args.timeout)
            reports.append(rep)
            print(
                f"[case] {rep['id']}: labelAcc={rep['labelAccuracy']:.3f} "
                f"startMAE={rep['startMaeMs']:.1f}ms endMAE={rep['endMaeMs']:.1f}ms "
                f"expected={rep['expectedCount']} predicted={rep['predictedCount']}"
            )
        except Exception as err:
            print(f"[case] {case_id}: ERROR: {err}", file=sys.stderr)

    if not reports:
        print("No successful case results.", file=sys.stderr)
        return 3

    aggregate = {
        "caseCount": len(reports),
        "provider": args.provider,
        "baseUrl": args.base_url,
        "meanLabelAccuracy": round(mean([float(r.get("labelAccuracy", 0.0)) for r in reports]), 4),
        "meanStartMaeMs": round(mean([float(r.get("startMaeMs", 0.0)) for r in reports]), 2),
        "meanEndMaeMs": round(mean([float(r.get("endMaeMs", 0.0)) for r in reports]), 2),
    }
    out_obj = {"aggregate": aggregate, "cases": reports}
    print("\n[aggregate]", json.dumps(aggregate, indent=2))

    if args.out:
        out_path = Path(args.out)
        out_path.write_text(json.dumps(out_obj, indent=2), encoding="utf-8")
        print(f"[report] wrote {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
