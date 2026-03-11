#!/usr/bin/env python3
import argparse
import json
import re
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", str(text or "").lower())).strip()


def infer_stanzas(
    lyrics: List[Dict[str, Any]],
    duration_ms: int,
    track_title_hint: str,
    max_lines_per_stanza: int,
    max_stanza_ms: int,
    title_min_len: int,
) -> Dict[str, Any]:
    rows = []
    for r in lyrics or []:
        try:
            s = max(0, int(round(float(r.get("startMs", 0)))))
            e = max(0, int(round(float(r.get("endMs", 0)))))
        except Exception:
            continue
        if e <= s:
            continue
        rows.append({"startMs": s, "endMs": e, "label": str(r.get("label", "")).strip()})
    rows.sort(key=lambda x: x["startMs"])
    total_ms = max(1, int(duration_ms or 0))
    if not rows:
        return {"sections": [], "lyricalCount": 0, "titleAwareSplits": 0, "stanzaGapMs": 6000}

    gaps = []
    for i in range(1, len(rows)):
        gap = rows[i]["startMs"] - rows[i - 1]["endMs"]
        if gap > 0:
            gaps.append(gap)
    stanza_gap_ms = 6000
    if gaps:
        sorted_g = sorted(gaps)
        mid = len(sorted_g) // 2
        med = sorted_g[mid] if len(sorted_g) % 2 == 1 else (sorted_g[mid - 1] + sorted_g[mid]) / 2.0
        p75 = sorted_g[int((len(sorted_g) - 1) * 0.75)]
        stanza_gap_ms = max(2500, min(12000, int(round(max(p75 * 1.35, med * 2.1)))))

    stanzas: List[Tuple[int, int]] = []
    a = 0
    for i in range(1, len(rows)):
        gap = rows[i]["startMs"] - rows[i - 1]["endMs"]
        line_count = i - a
        stanza_span = rows[i - 1]["endMs"] - rows[a]["startMs"]
        should_break = gap >= stanza_gap_ms or line_count >= int(max_lines_per_stanza) or stanza_span >= int(max_stanza_ms)
        if should_break:
            stanzas.append((a, i))
            a = i
    stanzas.append((a, len(rows)))

    title_norm = normalize(track_title_hint)
    should_use_title = len(title_norm) >= int(title_min_len)
    refined: List[Tuple[int, int]] = []
    title_splits = 0

    for s_idx, e_idx in stanzas:
        line_count = max(0, e_idx - s_idx)
        if line_count < 5:
            refined.append((s_idx, e_idx))
            continue
        split_at = -1
        if should_use_title:
            hit_offsets = []
            for k in range(s_idx, e_idx):
                ln = normalize(rows[k].get("label", ""))
                if ln and title_norm in ln:
                    hit_offsets.append(k - s_idx)
            if len(hit_offsets) >= 2:
                first_hit = hit_offsets[0]
                lines_after = line_count - first_hit
                if first_hit >= 2 and lines_after >= 2:
                    split_at = s_idx + first_hit

        if split_at < 0:
            seen = {}
            for k in range(s_idx, e_idx):
                ln = normalize(rows[k].get("label", ""))
                if not ln:
                    continue
                if ln in seen:
                    offset = k - s_idx
                    lines_after = line_count - offset
                    if offset >= 2 and lines_after >= 2:
                        split_at = k
                        break
                else:
                    seen[ln] = k

        if split_at > s_idx and split_at < e_idx:
            refined.append((s_idx, split_at))
            refined.append((split_at, e_idx))
            title_splits += 1
        else:
            refined.append((s_idx, e_idx))

    sections = []
    first_start = rows[0]["startMs"]
    if first_start > 500:
        sections.append({"startMs": 0, "endMs": first_start, "label": "Intro"})
    prev_end = first_start
    lyrical_count = 0
    for s_idx, e_idx in refined:
        start_ms = rows[s_idx]["startMs"]
        end_ms = rows[e_idx - 1]["endMs"]
        if start_ms - prev_end >= stanza_gap_ms:
            sections.append({"startMs": prev_end, "endMs": start_ms, "label": "Instrumental"})
        sections.append({"startMs": start_ms, "endMs": end_ms, "label": "Lyrical"})
        lyrical_count += 1
        prev_end = end_ms
    if total_ms - prev_end >= 500:
        tail_label = "Outro" if (total_ms - prev_end) <= max(12000, stanza_gap_ms * 2) else "Instrumental"
        sections.append({"startMs": prev_end, "endMs": total_ms, "label": tail_label})

    return {
        "sections": sections,
        "lyricalCount": lyrical_count,
        "titleAwareSplits": title_splits,
        "stanzaGapMs": stanza_gap_ms,
    }


def section_at(ms: int, rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    for r in rows:
        if int(r.get("startMs", 0)) <= ms < int(r.get("endMs", 0)):
            return r
    return rows[-1] if rows else None


def score_sections(pred: List[Dict[str, Any]], expected: List[Dict[str, Any]]) -> Dict[str, float]:
    start_errs = []
    end_errs = []
    for e in expected:
        s = int(e.get("startMs", 0))
        ee = int(e.get("endMs", s + 1))
        mid = int((s + ee) / 2)
        p = section_at(mid, pred)
        if not p:
            continue
        start_errs.append(abs(s - int(p.get("startMs", 0))))
        end_errs.append(abs(ee - int(p.get("endMs", ee))))
    def mean(vals: List[float]) -> float:
        return (sum(vals) / len(vals)) if vals else 0.0
    return {
        "startMaeMs": round(mean(start_errs), 2),
        "endMaeMs": round(mean(end_errs), 2),
        "countError": float(abs(len(pred) - len(expected))),
    }


def call_analyze(base_url: str, provider: str, audio_path: Path, timeout: float) -> Dict[str, Any]:
    boundary = "----xld-opt-boundary"
    file_bytes = audio_path.read_bytes()
    parts: List[bytes] = []
    def add_field(name: str, value: str):
        parts.append(f"--{boundary}\r\n".encode())
        parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        parts.append(f"{value}\r\n".encode())
    add_field("provider", provider)
    add_field("fileName", audio_path.name)
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(f'Content-Disposition: form-data; name="file"; filename="{audio_path.name}"\r\n'.encode())
    parts.append(b"Content-Type: application/octet-stream\r\n\r\n")
    parts.append(file_bytes)
    parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)

    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/analyze",
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="ignore"))


def main() -> int:
    ap = argparse.ArgumentParser(description="Grid-search stanza-splitting parameters against reference section maps.")
    ap.add_argument("--cases", required=True)
    ap.add_argument("--base-url", default="http://127.0.0.1:5055")
    ap.add_argument("--provider", default="beatnet", choices=["beatnet", "librosa", "auto"])
    ap.add_argument("--timeout", type=float, default=180.0)
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    cases_data = json.loads(Path(args.cases).read_text(encoding="utf-8"))
    cases = cases_data.get("cases") if isinstance(cases_data, dict) else []
    if not isinstance(cases, list) or not cases:
        print("No cases in --cases", file=sys.stderr)
        return 2

    analyses = []
    for c in cases:
        audio_path = Path(str(c.get("audioPath", "")).strip())
        expected = c.get("expectedSections") or []
        if not audio_path.exists() or not expected:
            continue
        payload = call_analyze(args.base_url, args.provider, audio_path, args.timeout)
        data = payload.get("data") if isinstance(payload, dict) else payload
        if not isinstance(data, dict):
            continue
        title = str((data.get("meta") or {}).get("trackIdentity", {}).get("title", "")).strip() or str(c.get("title", "")).strip()
        analyses.append({
            "id": str(c.get("id", audio_path.name)),
            "title": title,
            "durationMs": int(round(float(data.get("durationMs", 0)))) if data.get("durationMs") is not None else 0,
            "lyrics": data.get("lyrics") or [],
            "expected": expected,
        })

    if not analyses:
        print("No runnable cases after validation.", file=sys.stderr)
        return 3

    configs = []
    for max_lines in [4, 5, 6, 7]:
        for max_span in [16000, 18000, 22000, 26000, 28000]:
            for title_min_len in [6, 8, 10]:
                total_start = 0.0
                total_end = 0.0
                total_count_err = 0.0
                total_lyrical = 0.0
                total_title_splits = 0.0
                case_rows = []
                for row in analyses:
                    pred = infer_stanzas(
                        row["lyrics"],
                        row["durationMs"],
                        row["title"],
                        max_lines,
                        max_span,
                        title_min_len,
                    )
                    sc = score_sections(pred["sections"], row["expected"])
                    total_start += sc["startMaeMs"]
                    total_end += sc["endMaeMs"]
                    total_count_err += sc["countError"]
                    total_lyrical += float(pred["lyricalCount"])
                    total_title_splits += float(pred["titleAwareSplits"])
                    case_rows.append({
                        "id": row["id"],
                        "startMaeMs": sc["startMaeMs"],
                        "endMaeMs": sc["endMaeMs"],
                        "countError": sc["countError"],
                        "lyricalCount": pred["lyricalCount"],
                        "titleAwareSplits": pred["titleAwareSplits"],
                    })
                n = float(len(analyses))
                mean_start = total_start / n
                mean_end = total_end / n
                mean_count_err = total_count_err / n
                # Objective: weighted boundary + count alignment.
                objective = (mean_start * 1.0) + (mean_end * 0.55) + (mean_count_err * 3500.0)
                configs.append({
                    "params": {
                        "maxLinesPerStanza": max_lines,
                        "maxStanzaMs": max_span,
                        "titleMinLen": title_min_len,
                    },
                    "objective": round(objective, 3),
                    "meanStartMaeMs": round(mean_start, 2),
                    "meanEndMaeMs": round(mean_end, 2),
                    "meanCountError": round(mean_count_err, 3),
                    "meanLyricalCount": round(total_lyrical / n, 2),
                    "meanTitleAwareSplits": round(total_title_splits / n, 2),
                    "cases": case_rows,
                })

    configs.sort(key=lambda x: (x["objective"], x["meanCountError"], x["meanStartMaeMs"]))
    out_obj = {
        "baseUrl": args.base_url,
        "provider": args.provider,
        "caseCount": len(analyses),
        "best": configs[:5],
    }
    print(json.dumps(out_obj, indent=2))
    if args.out:
        Path(args.out).write_text(json.dumps(out_obj, indent=2), encoding="utf-8")
        print(f"[report] wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
