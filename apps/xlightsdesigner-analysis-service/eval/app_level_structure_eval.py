#!/usr/bin/env python3
import argparse
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ALLOWED_LABELS = {
    "Intro", "Verse", "Chorus", "Pre-Chorus", "Post-Chorus", "Bridge", "Instrumental", "Outro",
    "Refrain", "Hook", "Solo", "Interlude", "Breakdown", "Tag", "Section"
}


def normalize_text(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", str(s or "").lower())).strip()


def post_multipart(url: str, fields: Dict[str, str], file_field: str, file_name: str, file_bytes: bytes, timeout: float) -> Dict[str, Any]:
    boundary = "----xld-app-eval-boundary"
    parts: List[bytes] = []
    for k, v in fields.items():
        parts.append(f"--{boundary}\r\n".encode())
        parts.append(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode())
        parts.append(f"{v}\r\n".encode())
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(f'Content-Disposition: form-data; name="{file_field}"; filename="{file_name}"\r\n'.encode())
    parts.append(b"Content-Type: application/octet-stream\r\n\r\n")
    parts.append(file_bytes)
    parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="ignore"))


def call_analysis(base_url: str, provider: str, audio_path: Path, timeout: float) -> Dict[str, Any]:
    payload = post_multipart(
        f"{base_url.rstrip('/')}/analyze",
        {"provider": provider, "fileName": audio_path.name},
        "file",
        audio_path.name,
        audio_path.read_bytes(),
        timeout,
    )
    data = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(data, dict):
        raise RuntimeError("Unexpected /analyze response format")
    return data


def infer_lyric_stanza_plan(lyrics: List[Dict[str, Any]], duration_ms: int, track_title_hint: str) -> Dict[str, Any]:
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
        return {"sections": [], "lyricalIndices": [], "titleAwareSplits": 0}

    gaps = []
    for i in range(1, len(rows)):
        g = rows[i]["startMs"] - rows[i - 1]["endMs"]
        if g > 0:
            gaps.append(g)
    stanza_gap_ms = 6000
    if gaps:
        sg = sorted(gaps)
        mid = len(sg) // 2
        med = sg[mid] if len(sg) % 2 == 1 else (sg[mid - 1] + sg[mid]) / 2.0
        p75 = sg[int((len(sg) - 1) * 0.75)]
        stanza_gap_ms = max(2500, min(12000, int(round(max(p75 * 1.35, med * 2.1)))))

    MAX_LINES_PER_STANZA = 6
    MAX_STANZA_MS = 16000
    stanzas: List[Tuple[int, int]] = []
    a = 0
    for i in range(1, len(rows)):
        gap = rows[i]["startMs"] - rows[i - 1]["endMs"]
        line_count = i - a
        stanza_span = rows[i - 1]["endMs"] - rows[a]["startMs"]
        should_break = gap >= stanza_gap_ms or line_count >= MAX_LINES_PER_STANZA or stanza_span >= MAX_STANZA_MS
        if should_break:
            stanzas.append((a, i))
            a = i
    stanzas.append((a, len(rows)))

    title_norm = normalize_text(track_title_hint)
    should_use_title = len(title_norm) >= 8
    refined: List[Tuple[int, int]] = []
    title_splits = 0
    for s_idx, e_idx in stanzas:
        line_count = max(0, e_idx - s_idx)
        if line_count < 5:
            refined.append((s_idx, e_idx))
            continue
        split_at = -1
        if should_use_title:
            hits = []
            for k in range(s_idx, e_idx):
                ln = normalize_text(rows[k]["label"])
                if ln and title_norm in ln:
                    hits.append(k - s_idx)
            if len(hits) >= 2:
                first = hits[0]
                after = line_count - first
                if first >= 2 and after >= 2:
                    split_at = s_idx + first
        if split_at < 0:
            seen = {}
            for k in range(s_idx, e_idx):
                ln = normalize_text(rows[k]["label"])
                if not ln:
                    continue
                if ln in seen:
                    off = k - s_idx
                    after = line_count - off
                    if off >= 2 and after >= 2:
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

    sections: List[Dict[str, Any]] = []
    lyrical_indices: List[int] = []
    first_start = rows[0]["startMs"]
    if first_start > 500:
        sections.append({"startMs": 0, "endMs": first_start, "label": "Intro"})
    prev_end = first_start
    for s_idx, e_idx in refined:
        start_ms = rows[s_idx]["startMs"]
        end_ms = rows[e_idx - 1]["endMs"]
        if start_ms - prev_end >= stanza_gap_ms:
            sections.append({"startMs": prev_end, "endMs": start_ms, "label": "Instrumental"})
        lyrical_indices.append(len(sections))
        sections.append({"startMs": start_ms, "endMs": end_ms, "label": "Lyrical"})
        prev_end = end_ms
    if total_ms - prev_end >= 500:
        tail = "Outro" if (total_ms - prev_end) <= max(12000, stanza_gap_ms * 2) else "Instrumental"
        sections.append({"startMs": prev_end, "endMs": total_ms, "label": tail})

    return {"sections": sections, "lyricalIndices": lyrical_indices, "titleAwareSplits": title_splits}


def build_lyric_ctx(sections: List[Dict[str, Any]], lyrics: List[Dict[str, Any]], lyrical_indices: List[int]) -> List[Dict[str, Any]]:
    allow = set(int(i) for i in lyrical_indices)
    out = []
    for idx, s in enumerate(sections):
        if idx not in allow:
            continue
        st = int(s["startMs"])
        en = int(s["endMs"])
        lines = [str(r.get("label", "")).strip() for r in lyrics if st <= int(r.get("startMs", -1)) < en]
        lines = [x for x in lines if x][:14]
        out.append({"index": idx, "lineCount": len(lines), "stanzaText": " | ".join(lines)})
    return out


def parse_chord_label(label: str) -> Optional[Dict[str, Any]]:
    m = re.match(r"^([A-G](?:#|b)?)(.*)$", str(label or "").replace(":", "").strip())
    if not m:
        return None
    root = m.group(1)
    qual = m.group(2).lower().strip()
    root_pc = {
        "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
        "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
    }.get(root)
    if root_pc is None:
        return None
    is_minor = qual.startswith("m") or "min" in qual
    return {"root": root, "rootPc": root_pc, "quality": "m" if is_minor else "M", "normalized": f"{root}{'m' if is_minor else ''}"}


def rel_token(ch: Dict[str, Any], tonic_pc: int) -> str:
    rel = ((int(ch["rootPc"]) - int(tonic_pc)) % 12 + 12) % 12
    return f"{rel}{ch['quality']}"


def build_chord_ctx(sections: List[Dict[str, Any]], chords: List[Dict[str, Any]], lyrical_indices: List[int]) -> List[Dict[str, Any]]:
    allow = set(int(i) for i in lyrical_indices)
    out = []
    for idx, s in enumerate(sections):
        if idx not in allow:
            continue
        st = int(s["startMs"])
        en = int(s["endMs"])
        overlapping = []
        for r in chords or []:
            rs = int(r.get("startMs", 0))
            re_ = int(r.get("endMs", rs + 1))
            os_ = max(st, rs)
            oe_ = min(en, re_)
            dur = max(0, oe_ - os_)
            if dur <= 0:
                continue
            parsed = parse_chord_label(str(r.get("label", "")))
            if not parsed:
                continue
            overlapping.append({**parsed, "startMs": os_, "endMs": oe_, "durMs": dur})
        overlapping.sort(key=lambda x: x["startMs"])
        active = [r for r in overlapping if int(r["durMs"]) >= 180] or overlapping
        collapsed = []
        for r in active:
            if not collapsed or collapsed[-1]["normalized"] != r["normalized"]:
                collapsed.append(dict(r))
            else:
                collapsed[-1]["endMs"] = r["endMs"]
                collapsed[-1]["durMs"] += r["durMs"]
        by_label = {}
        for r in collapsed:
            by_label[r["normalized"]] = by_label.get(r["normalized"], 0) + int(r["durMs"])
        dominant = sorted(by_label.items(), key=lambda kv: kv[1], reverse=True)[0][0] if by_label else ""
        dom = parse_chord_label(dominant) if dominant else None
        tonic = dom["rootPc"] if dom else (collapsed[0]["rootPc"] if collapsed else 0)
        p_abs = [r["normalized"] for r in collapsed]
        p_rel = [rel_token(r, tonic) for r in collapsed]
        changes = max(0, len(collapsed) - 1)
        sec_ms = max(1, en - st)
        out.append({
            "index": idx,
            "chordCount": len(active),
            "chordSetSize": len(set(p_abs)),
            "progression": "->".join(p_abs[:10]),
            "progressionRelative": "->".join(p_rel[:10]),
            "cadenceRelative": "->".join(p_rel[-3:]),
            "dominantChord": dominant,
            "harmonicRhythmCpm": round(changes / (sec_ms / 60000.0), 2),
            "chordSeconds": round(sum(int(r["durMs"]) for r in active) / 1000.0, 2),
        })
    return out


def jaccard_prog(a: str, b: str) -> float:
    aa = {x.strip() for x in str(a or "").split("->") if x.strip()}
    bb = {x.strip() for x in str(b or "").split("->") if x.strip()}
    if not aa or not bb:
        return 0.0
    return round(len(aa & bb) / float(len(aa | bb)), 3)


def build_evidence(lyric_ctx: List[Dict[str, Any]], chord_ctx: List[Dict[str, Any]], title_hint: str) -> List[Dict[str, Any]]:
    chord_by_idx = {int(r.get("index", -1)): r for r in chord_ctx}
    title_tokens = {t for t in normalize_text(title_hint).split(" ") if len(t) >= 3}
    global_lines: Dict[str, int] = {}
    norm_lines_per = []
    for row in lyric_ctx:
        lines = [normalize_text(x) for x in str(row.get("stanzaText", "")).split("|") if normalize_text(x)]
        norm_lines_per.append(lines)
        for ln in lines:
            global_lines[ln] = global_lines.get(ln, 0) + 1

    seen_lines = set()
    seen_prog = set()
    prev_prog = ""
    out = []
    for i, row in enumerate(lyric_ctx):
        lines_raw = [x.strip() for x in str(row.get("stanzaText", "")).split("|") if x.strip()]
        lines_norm = norm_lines_per[i]
        tokens = [t for t in normalize_text(row.get("stanzaText", "")).split(" ") if t]
        line_set = set(lines_raw)
        rep_lines = sum(1 for ln in line_set if ln in seen_lines)
        for ln in line_set:
            seen_lines.add(ln)
        title_hits = sum(1 for t in tokens if t in title_tokens)
        title_phrase = normalize_text(title_hint)
        title_line_hits = sum(1 for ln in lines_norm if title_phrase and title_phrase in ln)
        global_rep = sum(1 for ln in lines_norm if global_lines.get(ln, 0) >= 2)
        max_overlap = 0
        set_i = set(lines_norm)
        for j, other in enumerate(norm_lines_per):
            if j == i:
                continue
            max_overlap = max(max_overlap, len(set_i & set(other)))

        c = chord_by_idx.get(int(row.get("index", i)), {})
        prog = str(c.get("progression", "")).strip()
        prog_rel = str(c.get("progressionRelative", "")).strip()
        prog_key = prog_rel or prog
        out.append({
            "index": int(row.get("index", i)),
            "lineCount": int(row.get("lineCount", len(lines_raw))),
            "repeatedLineRatio": round(rep_lines / max(1, len(line_set)), 3),
            "uniqueTokenRatio": round(len(set(tokens)) / max(1, len(tokens)), 3),
            "titleTokenRatio": round(title_hits / max(1, len(tokens)), 3),
            "titleLineHits": int(title_line_hits),
            "titleLineRatio": round(title_line_hits / max(1, len(lines_norm)), 3) if lines_norm else 0.0,
            "globallyRepeatedLineRatio": round(global_rep / max(1, len(lines_norm)), 3) if lines_norm else 0.0,
            "maxLineOverlapWithAny": int(max_overlap),
            "chordCount": int(c.get("chordCount", 0)),
            "chordSetSize": int(c.get("chordSetSize", 0)),
            "progression": prog,
            "progressionRelative": prog_rel,
            "cadenceRelative": str(c.get("cadenceRelative", "")).strip(),
            "dominantChord": str(c.get("dominantChord", "")).strip(),
            "harmonicRhythmCpm": float(c.get("harmonicRhythmCpm", 0) or 0),
            "chordSeconds": float(c.get("chordSeconds", 0) or 0),
            "progressionSeenBefore": bool(prog_key and prog_key in seen_prog),
            "progressionSimilarityToPrev": jaccard_prog(prog_key, prev_prog),
        })
        if prog_key:
            seen_prog.add(prog_key)
        prev_prog = prog_key
    enriched: List[Dict[str, Any]] = []
    for i, row in enumerate(out):
        prev = out[i - 1] if i > 0 else None
        nxt = out[i + 1] if i + 1 < len(out) else None
        next_chorus_like = bool(
            nxt and (
                float(nxt.get("titleLineRatio", 0) or 0) >= 0.2
                or float(nxt.get("globallyRepeatedLineRatio", 0) or 0) >= 0.4
                or float(nxt.get("repeatedLineRatio", 0) or 0) >= 0.35
            )
        )
        prev_verse_like = bool(
            prev and (
                float(prev.get("uniqueTokenRatio", 0) or 0) >= 0.72
                and float(prev.get("titleLineRatio", 0) or 0) <= 0.15
            )
        )
        transition_to_hook = round(
            (float((nxt or {}).get("titleLineRatio", 0) or 0) * 0.5)
            + (float((nxt or {}).get("globallyRepeatedLineRatio", 0) or 0) * 0.35)
            + (float((nxt or {}).get("repeatedLineRatio", 0) or 0) * 0.15),
            3,
        )
        enriched.append({
            **row,
            "nextTitleLineRatio": float((nxt or {}).get("titleLineRatio", 0) or 0),
            "nextGloballyRepeatedLineRatio": float((nxt or {}).get("globallyRepeatedLineRatio", 0) or 0),
            "nextRepeatedLineRatio": float((nxt or {}).get("repeatedLineRatio", 0) or 0),
            "nextLikelyChorus": next_chorus_like,
            "prevLikelyVerse": prev_verse_like,
            "transitionToHookScore": transition_to_hook,
        })
    return enriched


def mean_num(rows: List[Dict[str, Any]], key: str) -> float:
    vals = [float(r.get(key, 0)) for r in rows if isinstance(r.get(key, None), (int, float))]
    return (sum(vals) / len(vals)) if vals else 0.0


def profile_song(song: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    st = song.get("stanzas") or []
    if not isinstance(st, list) or not st:
        return None
    labels = [str(x.get("draftLabel", "")).strip().lower() for x in st if isinstance(x, dict)]
    c = sum(1 for x in labels if x == "chorus")
    v = sum(1 for x in labels if x == "verse")
    return {
        "stanzaCount": len(st),
        "chorusCount": c,
        "verseCount": v,
        "chorusRatio": (c / len(st)) if st else 0.0,
        "avgRepeat": mean_num(st, "globallyRepeatedLineRatio"),
        "avgTitle": mean_num(st, "titleLineRatio"),
        "avgLines": mean_num([{"lineCount": len(x.get("lines") or [])} for x in st], "lineCount"),
    }


def select_few_shot(corpus_songs: List[Dict[str, Any]], evidence: List[Dict[str, Any]], track_title: str, max_examples: int = 3) -> List[Dict[str, Any]]:
    current = {
        "stanzaCount": len(evidence),
        "chorusRatio": mean_num([
            {"c": 1 if (float(r.get("titleLineRatio", 0)) >= 0.2 or float(r.get("globallyRepeatedLineRatio", 0)) >= 0.4) else 0}
            for r in evidence
        ], "c"),
        "avgRepeat": mean_num(evidence, "repeatedLineRatio"),
        "avgTitle": mean_num(evidence, "titleLineRatio"),
        "avgLines": mean_num(evidence, "lineCount"),
    }
    tnorm = normalize_text(track_title)
    cand = []
    for song in corpus_songs or []:
        if str(song.get("status", "")).strip() != "ok":
            continue
        stitle = str(song.get("title", "")).strip()
        if tnorm and normalize_text(stitle) == tnorm:
            continue
        p = profile_song(song)
        if not p or p["stanzaCount"] < 3 or p["chorusCount"] < 1 or p["verseCount"] < 1:
            continue
        dist = (
            abs(p["chorusRatio"] - current["chorusRatio"]) * 1.8 +
            abs(p["avgRepeat"] - current["avgRepeat"]) * 2.0 +
            abs(p["avgTitle"] - current["avgTitle"]) * 1.6 +
            abs(p["avgLines"] - current["avgLines"]) * 0.2 +
            abs(p["stanzaCount"] - current["stanzaCount"]) * 0.15
        )
        cand.append((dist, song, p))
    cand.sort(key=lambda x: x[0])
    out = []
    for _, song, p in cand[:max_examples]:
        st = song.get("stanzas") or []
        out.append({
            "track": f"{song.get('title','')} - {song.get('artist','')}",
            "lyricsSource": song.get("lyricsSource", ""),
            "stanzaCount": len(st),
            "labels": [str(x.get("draftLabel", "")).strip() or "Verse" for x in st],
            "stanzas": [
                {
                    "index": int(x.get("index", i)),
                    "label": str(x.get("draftLabel", "")).strip() or "Verse",
                    "text": str(x.get("text", "")).strip()[:220],
                }
                for i, x in enumerate(st[:8])
            ],
            "profile": {
                "chorusRatio": round(float(p["chorusRatio"]), 3),
                "avgRepeat": round(float(p["avgRepeat"]), 3),
                "avgTitleRatio": round(float(p["avgTitle"]), 3),
            },
        })
    return out


def parse_first_json(text: str) -> Optional[Dict[str, Any]]:
    raw = str(text or "").strip()
    if not raw:
        return None
    try:
        obj = json.loads(raw)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    s = raw.find("{")
    e = raw.rfind("}")
    if s >= 0 and e > s:
        try:
            obj = json.loads(raw[s:e + 1])
            if isinstance(obj, dict):
                return obj
        except Exception:
            return None
    return None


def normalize_base_label(label: str) -> str:
    t = str(label or "").strip()
    if not t:
        return "Section"
    t = re.sub(r"\s+\d+$", "", t).strip()
    if t in ALLOWED_LABELS:
        return t
    return t if t else "Section"


def number_labels(labels: List[str]) -> List[str]:
    base = [normalize_base_label(x) for x in labels]
    totals: Dict[str, int] = {}
    for b in base:
        totals[b] = totals.get(b, 0) + 1
    seen: Dict[str, int] = {}
    out = []
    for b in base:
        seen[b] = seen.get(b, 0) + 1
        if totals[b] > 1:
            out.append(f"{b} {seen[b]}")
        else:
            out.append(b)
    return out


def call_llm_chat(base_url: str, api_key: str, model: str, prompt: str, timeout: float) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Return strict JSON only."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.0,
    }
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            obj = json.loads(resp.read().decode("utf-8", errors="ignore"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="ignore") if hasattr(err, "read") else ""
        raise RuntimeError(f"LLM HTTP {err.code}: {body or err.reason}") from err
    choice = ((obj.get("choices") or [{}])[0] or {}).get("message") or {}
    return str(choice.get("content", ""))


def score_against_expected(pred_sections: List[Dict[str, Any]], expected_sections: List[Dict[str, Any]]) -> Dict[str, Any]:
    def sec_at(ms: int, rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        for r in rows:
            if int(r.get("startMs", 0)) <= ms < int(r.get("endMs", 0)):
                return r
        return rows[-1] if rows else None

    hits = 0
    total = len(expected_sections)
    start_err = []
    end_err = []
    mismatches = []
    for e in expected_sections:
        s = int(e.get("startMs", 0))
        ee = int(e.get("endMs", s + 1))
        mid = int((s + ee) / 2)
        p = sec_at(mid, pred_sections)
        exp_label = normalize_base_label(str(e.get("label", "")))
        pred_label = normalize_base_label(str((p or {}).get("label", "")))
        if exp_label == pred_label:
            hits += 1
        else:
            mismatches.append({"expected": exp_label, "predicted": pred_label, "startMs": s, "endMs": ee})
        if p:
            start_err.append(abs(s - int(p.get("startMs", s))))
            end_err.append(abs(ee - int(p.get("endMs", ee))))

    def mean(vals: List[float]) -> float:
        return (sum(vals) / len(vals)) if vals else 0.0

    return {
        "labelAccuracy": round((hits / total) if total else 0.0, 4),
        "startMaeMs": round(mean(start_err), 2),
        "endMaeMs": round(mean(end_err), 2),
        "expectedCount": total,
        "predictedCount": len(pred_sections),
        "mismatches": mismatches[:20],
    }


def load_training_package_audio_bundle(root_dir: Path) -> Dict[str, Any]:
    manifest = json.loads((root_dir / "manifest.json").read_text(encoding="utf-8"))
    mods = manifest.get("modules") or []
    audio_mod_ref = None
    for m in mods:
        if str(m.get("id", "")).strip() == "audio_track_analysis":
            audio_mod_ref = m
            break
    if not audio_mod_ref:
        raise RuntimeError("audio_track_analysis module not found in training package manifest")
    mod_path = root_dir / str(audio_mod_ref.get("path", "")).strip()
    mod = json.loads(mod_path.read_text(encoding="utf-8"))
    prompt_texts = []
    for p in (mod.get("assets", {}).get("prompts") or []):
        fp = mod_path.parent / str(p)
        if fp.exists():
            prompt_texts.append(f"# Asset: {fp.relative_to(root_dir).as_posix()}\n{fp.read_text(encoding='utf-8').strip()}")
    datasets = []
    corpus_songs = []
    for p in (mod.get("assets", {}).get("datasets") or []):
        di = mod_path.parent / str(p)
        if not di.exists():
            continue
        idx = json.loads(di.read_text(encoding="utf-8"))
        datasets.append(di)
        for src in idx.get("sources") or []:
            if str(src.get("type", "")).strip() != "stanza-corpus":
                continue
            cp = mod_path.parent / str(src.get("path", "")).strip()
            if not cp.exists():
                continue
            obj = json.loads(cp.read_text(encoding="utf-8"))
            songs = obj.get("songs") or []
            corpus_songs.extend([s for s in songs if isinstance(s, dict)])

    return {
        "packageId": str(manifest.get("packageId", "")).strip(),
        "packageVersion": str(manifest.get("version", "")).strip(),
        "moduleId": "audio_track_analysis",
        "moduleVersion": str(mod.get("version", "")).strip(),
        "promptText": "\n\n".join(prompt_texts).strip(),
        "promptCount": len(prompt_texts),
        "corpusSongs": corpus_songs,
    }


def run_case(case: Dict[str, Any], args, bundle: Dict[str, Any]) -> Dict[str, Any]:
    audio_path = Path(str(case.get("audioPath", "")).strip())
    expected = case.get("expectedSections") or []
    if not audio_path.exists():
        raise RuntimeError(f"audio missing: {audio_path}")
    if not expected:
        raise RuntimeError("expectedSections missing")

    service = call_analysis(args.analysis_base_url, args.provider, audio_path, args.timeout)
    lyrics = service.get("lyrics") or []
    chords = service.get("chords") or []
    duration_ms = int(round(float(service.get("durationMs", 0)))) if service.get("durationMs") is not None else 0
    track_title = str((service.get("meta") or {}).get("trackIdentity", {}).get("title", "")).strip() or str(case.get("title", "")).strip()

    stanza = infer_lyric_stanza_plan(lyrics, duration_ms, track_title)
    sections = stanza["sections"]
    lyrical_indices = stanza["lyricalIndices"]
    lyric_ctx = build_lyric_ctx(sections, lyrics, lyrical_indices)
    chord_ctx = build_chord_ctx(sections, chords, lyrical_indices)
    evidence = build_evidence(lyric_ctx, chord_ctx, track_title)
    fewshot = select_few_shot(bundle.get("corpusSongs") or [], evidence, track_title, max_examples=3)

    policy_hints = "\n".join([
        "Interpret lyrical structure from stanza text first, then assign labels to stanza indices.",
        "Do not change stanza count. Output strict JSON only.",
        "Prefer chorus when repeated title/hook language recurs across multiple stanzas.",
        "Pre-Chorus is a short transition directly before a Chorus; do not flatten it to Verse when it clearly lifts into repeated hook lines.",
        "Pre-Chorus should be weaker in title/hook repetition than the following Chorus.",
        "Do not label the first major hook-heavy lyrical stanza as Pre-Chorus when it is already the main recurring hook block.",
        "Use nextLikelyChorus and transitionToHookScore as transition evidence for Pre-Chorus labeling.",
        "If a stanza pivots from narrative into repeated title/hook lines and boundaries are coarse, bias that stanza toward Chorus if the hook recurs later.",
        "Use progressionRelative/cadenceRelative/progressionSimilarityToPrev as supporting evidence only.",
    ])
    prompt = "\n".join([
        bundle.get("promptText", ""),
        policy_hints,
        f"Track: {track_title}",
        "Allowed labels: Intro, Verse, Chorus, Pre-Chorus, Post-Chorus, Bridge, Instrumental, Outro, Refrain, Hook, Solo, Interlude, Breakdown, Tag.",
        "Return JSON with keys: sections (array of {index:number,label:string}), confidence (high|medium|low), rationale (one sentence).",
        f"Few-shot reference examples (weakly supervised corpus, soft guidance): {json.dumps(fewshot)}",
        f"Stanza sequence data: {json.dumps(lyric_ctx)}",
        f"Stanza chord data: {json.dumps(chord_ctx)}",
        f"Stanza evidence data: {json.dumps(evidence)}",
    ])

    llm_text = call_llm_chat(args.llm_base_url, args.llm_api_key, args.llm_model, prompt, args.timeout)
    parsed = parse_first_json(llm_text) or {}
    rows = parsed.get("sections") if isinstance(parsed, dict) else []
    label_by_idx = {}
    for r in rows or []:
        try:
            idx = int(r.get("index"))
        except Exception:
            continue
        label = normalize_base_label(str(r.get("label", "")))
        if label and label != "Section":
            label_by_idx[idx] = label

    merged = []
    for i, s in enumerate(sections):
        cur = normalize_base_label(str(s.get("label", "")))
        if cur == "Lyrical":
            merged.append(label_by_idx.get(i, "Verse"))
        else:
            merged.append(cur)
    numbered = number_labels(merged)
    final_sections = []
    for i, s in enumerate(sections):
        final_sections.append({
            "startMs": int(s.get("startMs", 0)),
            "endMs": int(s.get("endMs", int(s.get("startMs", 0)) + 1)),
            "label": numbered[i],
        })

    score = score_against_expected(final_sections, expected)
    return {
        "id": str(case.get("id", audio_path.name)),
        "title": str(case.get("title", "")).strip(),
        "trainingPackage": {
            "packageId": bundle.get("packageId", ""),
            "packageVersion": bundle.get("packageVersion", ""),
            "moduleId": bundle.get("moduleId", "audio_track_analysis"),
            "moduleVersion": bundle.get("moduleVersion", ""),
            "promptCount": bundle.get("promptCount", 0),
            "fewShotCount": len(fewshot),
        },
        "stanzaPlan": {
            "sectionCount": len(sections),
            "lyricalCount": len(lyrical_indices),
            "titleAwareSplits": int(stanza.get("titleAwareSplits", 0)),
        },
        "llm": {
            "confidence": str(parsed.get("confidence", "")).strip(),
            "rationale": str(parsed.get("rationale", "")).strip(),
        },
        "score": score,
        "finalLabels": [s["label"] for s in final_sections],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="App-level song-structure eval (service + stanza planner + package prompt/corpus + LLM)")
    ap.add_argument("--cases", required=True)
    ap.add_argument("--training-package-root", default="/Users/robterry/Projects/xLightsDesigner/training-packages/training-package-v1")
    ap.add_argument("--analysis-base-url", default="http://127.0.0.1:5055")
    ap.add_argument("--provider", default="beatnet", choices=["beatnet", "librosa", "auto"])
    ap.add_argument("--llm-base-url", default=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"))
    ap.add_argument("--llm-model", default=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"))
    ap.add_argument("--llm-api-key", default=os.environ.get("OPENAI_API_KEY", ""))
    ap.add_argument("--timeout", type=float, default=180.0)
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    if not args.llm_api_key:
        raise RuntimeError("Missing LLM API key. Set OPENAI_API_KEY or pass --llm-api-key.")

    cases_data = json.loads(Path(args.cases).read_text(encoding="utf-8"))
    cases = cases_data.get("cases") if isinstance(cases_data, dict) else []
    if not isinstance(cases, list) or not cases:
        raise RuntimeError("No cases found in --cases")

    bundle = load_training_package_audio_bundle(Path(args.training_package_root))

    reports = []
    for c in cases:
        try:
            rep = run_case(c, args, bundle)
            reports.append(rep)
            sc = rep.get("score", {})
            print(
                f"[case] {rep['id']}: labelAcc={sc.get('labelAccuracy',0):.3f} "
                f"startMAE={sc.get('startMaeMs',0):.1f} endMAE={sc.get('endMaeMs',0):.1f} "
                f"fewShot={rep.get('trainingPackage',{}).get('fewShotCount',0)}"
            )
        except Exception as err:
            print(f"[case] {str(c.get('id','unknown'))}: ERROR: {err}")

    if not reports:
        raise RuntimeError("No successful case reports")

    def mean(vals: List[float]) -> float:
        return (sum(vals) / len(vals)) if vals else 0.0

    agg = {
        "caseCount": len(reports),
        "meanLabelAccuracy": round(mean([float(r.get("score", {}).get("labelAccuracy", 0)) for r in reports]), 4),
        "meanStartMaeMs": round(mean([float(r.get("score", {}).get("startMaeMs", 0)) for r in reports]), 2),
        "meanEndMaeMs": round(mean([float(r.get("score", {}).get("endMaeMs", 0)) for r in reports]), 2),
        "meanFewShotCount": round(mean([float(r.get("trainingPackage", {}).get("fewShotCount", 0)) for r in reports]), 2),
    }

    out = {"aggregate": agg, "cases": reports}
    print("\n[aggregate]", json.dumps(agg, indent=2))
    if args.out:
        Path(args.out).write_text(json.dumps(out, indent=2), encoding="utf-8")
        print(f"[report] wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
