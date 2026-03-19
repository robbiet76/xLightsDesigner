#!/usr/bin/env python3
import json
import subprocess
import sys


def main():
    if len(sys.argv) != 4:
        print("usage: scan-fseq-active-ranges.py FSEQ WINDOW_START_MS WINDOW_END_MS", file=sys.stderr)
        return 2
    fseq = sys.argv[1]
    window_start_ms = sys.argv[2]
    window_end_ms = sys.argv[3]
    decoder = "/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/fseq_window_decoder"
    step = 2000
    for start in range(0, 50000, step):
        cmd = [
            decoder,
            "--fseq", fseq,
            "--start-channel", str(start),
            "--channel-count", str(step),
            "--window-start-ms", window_start_ms,
            "--window-end-ms", window_end_ms,
            "--node-count", str(step),
            "--channels-per-node", "1",
        ]
        p = subprocess.run(cmd, capture_output=True, text=True)
        if p.returncode != 0:
            continue
        data = json.loads(p.stdout)
        ratio = float(data.get("averageActiveChannelRatio", 0) or 0)
        mx = float(data.get("maxChannelLevel", 0) or 0)
        if ratio > 0 or mx > 0:
            print(f"{start + 1}-{start + step}: ratio={ratio:.6f} max={mx:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
