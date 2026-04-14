#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from pathlib import Path

ACTIVE_PIXEL_EPSILON = 0.0003
ACTIVE_BRIGHTNESS_EPSILON = 0.0003


def run(cmd):
    return subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def probe(gif_path: Path):
    payload = json.loads(
        run(
            [
                'ffprobe', '-v', 'error', '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height',
                '-show_entries', 'format=duration',
                '-of', 'json', str(gif_path),
            ]
        ).stdout.decode('utf-8')
    )
    stream = (payload.get('streams') or [{}])[0]
    width = int(stream.get('width') or 0)
    height = int(stream.get('height') or 0)
    duration = float((payload.get('format') or {}).get('duration') or 0.0)
    if width <= 0 or height <= 0:
        raise ValueError(f'invalid GIF dimensions for {gif_path}')
    if duration <= 0:
        duration = 1.0
    return width, height, duration


def sample_frames(gif_path: Path, width: int, height: int, duration: float):
    target_samples = max(12, min(24, int(round(duration * 5))))
    fps = max(2.0, target_samples / duration)
    raw = run(
        [
            'ffmpeg', '-v', 'error', '-i', str(gif_path),
            '-vf', f'fps={fps:.6f}',
            '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
        ]
    ).stdout
    frame_size = width * height * 3
    if frame_size <= 0 or len(raw) < frame_size:
        return []

    frame_count = len(raw) // frame_size
    metrics = []
    for frame_idx in range(frame_count):
        chunk = raw[frame_idx * frame_size:(frame_idx + 1) * frame_size]
        total = width * height
        sum_r = 0.0
        sum_g = 0.0
        sum_b = 0.0
        sum_brightness = 0.0
        active = 0
        dominant = 0
        seen = set()
        for i in range(0, len(chunk), 3):
            r = chunk[i] / 255.0
            g = chunk[i + 1] / 255.0
            b = chunk[i + 2] / 255.0
            sum_r += r
            sum_g += g
            sum_b += b
            brightness = (r + g + b) / 3.0
            sum_brightness += brightness
            if brightness > 0.05:
                active += 1
            if brightness > 0.8:
                dominant += 1
            seen.add((chunk[i], chunk[i + 1], chunk[i + 2]))
        metrics.append(
            {
                'frameIndex': frame_idx,
                'frameAverageBrightness': (sum_brightness / total) if total else 0.0,
                'frameActivePixelRatio': (active / total) if total else 0.0,
                'frameDominantPixelRatio': (dominant / total) if total else 0.0,
                'frameUniqueColorCount': len(seen),
                'frameAverageRgb': {
                    'r': (sum_r / total) if total else 0.0,
                    'g': (sum_g / total) if total else 0.0,
                    'b': (sum_b / total) if total else 0.0,
                },
            }
        )
    return metrics


def best_frame(metrics):
    return sorted(
        metrics,
        key=lambda row: (
            -row['frameActivePixelRatio'],
            -row['frameAverageBrightness'],
            -row['frameUniqueColorCount'],
        ),
    )[0]


def round6(value):
    return round(value, 6)


def summarize(metrics):
    if not metrics:
        return {
            'sampledFrameCount': 0,
            'nonBlankSampledFrameCount': 0,
            'nonBlankSampledFrameRatio': 0,
            'activeSampledFrameStartIndex': None,
            'activeSampledFrameEndIndex': None,
            'activeSampledFrameSpanRatio': 0,
            'temporalBrightnessDeltaMean': 0,
            'temporalActiveDeltaMean': 0,
            'temporalDominantDeltaMean': 0,
            'temporalUniqueColorDeltaMean': 0,
            'temporalColorDeltaMean': 0,
            'temporalMotionMean': 0,
            'temporalMotionPeak': 0,
            'temporalSignature': 'static_or_near_static',
            'sampledFrameMetrics': [],
            'sampledFrameTransitions': [],
            'representativeSampledFrameIndex': 0,
            'representativeSampledFrameAverageBrightness': 0,
            'representativeSampledFrameActivePixelRatio': 0,
            'representativeSampledFrameDominantPixelRatio': 0,
            'representativeSampledFrameUniqueColorCount': 0,
            'representativeSampledFrameAverageRgb': {'r': 0, 'g': 0, 'b': 0},
        }

    transitions = []
    for previous, current in zip(metrics, metrics[1:]):
        brightness_delta = abs(current['frameAverageBrightness'] - previous['frameAverageBrightness'])
        active_delta = abs(current['frameActivePixelRatio'] - previous['frameActivePixelRatio'])
        dominant_delta = abs(current['frameDominantPixelRatio'] - previous['frameDominantPixelRatio'])
        unique_color_delta = abs(current['frameUniqueColorCount'] - previous['frameUniqueColorCount'])
        color_delta = (
            abs(current['frameAverageRgb']['r'] - previous['frameAverageRgb']['r'])
            + abs(current['frameAverageRgb']['g'] - previous['frameAverageRgb']['g'])
            + abs(current['frameAverageRgb']['b'] - previous['frameAverageRgb']['b'])
        ) / 3.0
        combined_delta = (
            (brightness_delta * 0.35)
            + (active_delta * 0.25)
            + (dominant_delta * 0.1)
            + (min(unique_color_delta / 8.0, 1.0) * 0.1)
            + (color_delta * 0.2)
        )
        transitions.append(
            {
                'fromFrameIndex': previous['frameIndex'],
                'toFrameIndex': current['frameIndex'],
                'brightnessDelta': round6(brightness_delta),
                'activeDelta': round6(active_delta),
                'dominantDelta': round6(dominant_delta),
                'uniqueColorDelta': unique_color_delta,
                'colorDelta': round6(color_delta),
                'combinedDelta': round6(combined_delta),
            }
        )

    def average(key):
        if not transitions:
            return 0.0
        return sum(row[key] for row in transitions) / len(transitions)

    def maximum(key):
        return max((row[key] for row in transitions), default=0.0)

    active_frames = [
        row for row in metrics
        if (
            row['frameActivePixelRatio'] > ACTIVE_PIXEL_EPSILON
            or row['frameAverageBrightness'] > ACTIVE_BRIGHTNESS_EPSILON
            or row['frameUniqueColorCount'] > 1
        )
    ]
    active_start = active_frames[0]['frameIndex'] if active_frames else None
    active_end = active_frames[-1]['frameIndex'] if active_frames else None
    active_span_ratio = ((len(active_frames) - 1) / max(1, len(metrics) - 1)) if active_frames else 0.0
    non_blank_ratio = (len(active_frames) / len(metrics)) if metrics else 0.0
    motion_mean = average('combinedDelta')
    if motion_mean >= 0.12:
        signature = 'high_motion'
    elif motion_mean >= 0.04:
        signature = 'moderate_motion'
    elif motion_mean > 0.01:
        signature = 'subtle_motion'
    else:
        signature = 'static_or_near_static'

    representative = best_frame(metrics)
    return {
        'sampledFrameCount': len(metrics),
        'nonBlankSampledFrameCount': len(active_frames),
        'nonBlankSampledFrameRatio': round6(non_blank_ratio),
        'activeSampledFrameStartIndex': active_start,
        'activeSampledFrameEndIndex': active_end,
        'activeSampledFrameSpanRatio': round6(active_span_ratio),
        'temporalBrightnessDeltaMean': round6(average('brightnessDelta')),
        'temporalActiveDeltaMean': round6(average('activeDelta')),
        'temporalDominantDeltaMean': round6(average('dominantDelta')),
        'temporalUniqueColorDeltaMean': round6(average('uniqueColorDelta')),
        'temporalColorDeltaMean': round6(average('colorDelta')),
        'temporalMotionMean': round6(motion_mean),
        'temporalMotionPeak': round6(maximum('combinedDelta')),
        'temporalSignature': signature,
        'sampledFrameMetrics': [
            {
                'frameIndex': row['frameIndex'],
                'frameAverageBrightness': round6(row['frameAverageBrightness']),
                'frameActivePixelRatio': round6(row['frameActivePixelRatio']),
                'frameDominantPixelRatio': round6(row['frameDominantPixelRatio']),
                'frameUniqueColorCount': row['frameUniqueColorCount'],
                'frameAverageRgb': {
                    'r': round6(row['frameAverageRgb']['r']),
                    'g': round6(row['frameAverageRgb']['g']),
                    'b': round6(row['frameAverageRgb']['b']),
                },
            }
            for row in metrics
        ],
        'sampledFrameTransitions': transitions,
        'representativeSampledFrameIndex': representative['frameIndex'],
        'representativeSampledFrameAverageBrightness': round6(representative['frameAverageBrightness']),
        'representativeSampledFrameActivePixelRatio': round6(representative['frameActivePixelRatio']),
        'representativeSampledFrameDominantPixelRatio': round6(representative['frameDominantPixelRatio']),
        'representativeSampledFrameUniqueColorCount': representative['frameUniqueColorCount'],
        'representativeSampledFrameAverageRgb': {
            'r': round6(representative['frameAverageRgb']['r']),
            'g': round6(representative['frameAverageRgb']['g']),
            'b': round6(representative['frameAverageRgb']['b']),
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--gif', required=True)
    args = parser.parse_args()
    gif_path = Path(args.gif)
    width, height, duration = probe(gif_path)
    metrics = sample_frames(gif_path, width, height, duration)
    json.dump(summarize(metrics), sys.stdout, separators=(',', ':'))


if __name__ == '__main__':
    main()
