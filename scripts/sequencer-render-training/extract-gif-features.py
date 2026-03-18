#!/usr/bin/env python3
import argparse
import json
import math
import struct
import sys
import zlib
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gif", required=True)
    parser.add_argument("--first-frame-png", required=True)
    return parser.parse_args()


def parse_gif_metrics(path: Path):
    data = path.read_bytes()
    if len(data) < 13 or data[:6] not in (b"GIF87a", b"GIF89a"):
        raise ValueError(f"Unsupported GIF header in {path}")

    width, height, packed, _, _ = struct.unpack("<HHBBB", data[6:13])
    offset = 13
    has_gct = bool(packed & 0x80)
    gct_size = 2 ** ((packed & 0x07) + 1) if has_gct else 0
    if has_gct:
        offset += 3 * gct_size

    frame_count = 0
    loop_count = None
    delay_values = []
    gce_delay_cs = None
    max_local_palette = 0

    while offset < len(data):
        block_id = data[offset]
        offset += 1

        if block_id == 0x3B:
            break

        if block_id == 0x21:
            if offset >= len(data):
                break
            label = data[offset]
            offset += 1

            if label == 0xF9:
                block_size = data[offset]
                offset += 1
                if block_size != 4:
                    raise ValueError("Unexpected graphic control block size")
                _, delay_cs, _ = struct.unpack("<BHB", data[offset : offset + 4])
                gce_delay_cs = delay_cs
                offset += 4
                offset += 1  # terminator
                continue

            if label == 0xFF:
                block_size = data[offset]
                offset += 1
                app_data = data[offset : offset + block_size]
                offset += block_size
                subchunks = []
                while True:
                    sub_size = data[offset]
                    offset += 1
                    if sub_size == 0:
                        break
                    subchunks.append(data[offset : offset + sub_size])
                    offset += sub_size
                app_payload = b"".join(subchunks)
                if app_data.startswith(b"NETSCAPE") and len(app_payload) >= 3 and app_payload[0] == 1:
                    loop_count = struct.unpack("<H", app_payload[1:3])[0]
                continue

            while True:
                sub_size = data[offset]
                offset += 1
                if sub_size == 0:
                    break
                offset += sub_size
            continue

        if block_id == 0x2C:
            if offset + 9 > len(data):
                break
            _, _, _, _, packed_fields = struct.unpack("<HHHHB", data[offset : offset + 9])
            offset += 9
            has_lct = bool(packed_fields & 0x80)
            if has_lct:
                lct_size = 2 ** ((packed_fields & 0x07) + 1)
                max_local_palette = max(max_local_palette, lct_size)
                offset += 3 * lct_size
            offset += 1  # LZW minimum code size
            while True:
                sub_size = data[offset]
                offset += 1
                if sub_size == 0:
                    break
                offset += sub_size
            frame_count += 1
            delay_values.append((gce_delay_cs or 0) * 10)
            gce_delay_cs = None
            continue

        raise ValueError(f"Unexpected GIF block id 0x{block_id:02x}")

    total_duration_ms = sum(delay_values)
    avg_delay_ms = (total_duration_ms / len(delay_values)) if delay_values else 0
    return {
        "gifLogicalWidth": width,
        "gifLogicalHeight": height,
        "gifFrameCount": frame_count,
        "gifTotalDurationMs": total_duration_ms,
        "gifAverageFrameDelayMs": avg_delay_ms,
        "gifLoopCount": loop_count,
        "gifGlobalColorTableSize": gct_size,
        "gifMaxLocalColorTableSize": max_local_palette,
    }


def paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def parse_png_metrics(path: Path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Unsupported PNG header in {path}")

    offset = 8
    width = height = bit_depth = color_type = None
    idat = bytearray()
    while offset < len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        chunk_type = data[offset + 4 : offset + 8]
        chunk_data = data[offset + 8 : offset + 8 + length]
        offset += 12 + length

        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type, _, _, _ = struct.unpack(">IIBBBBB", chunk_data)
        elif chunk_type == b"IDAT":
            idat.extend(chunk_data)
        elif chunk_type == b"IEND":
            break

    if width is None or height is None:
        raise ValueError("PNG missing IHDR")
    if bit_depth != 8 or color_type != 2:
        raise ValueError("Only 8-bit RGB PNGs are supported")

    raw = zlib.decompress(bytes(idat))
    stride = width * 3
    rows = []
    pos = 0
    prev = [0] * stride
    for _ in range(height):
        filter_type = raw[pos]
        pos += 1
        row = list(raw[pos : pos + stride])
        pos += stride
        decoded = [0] * stride
        for i, value in enumerate(row):
            left = decoded[i - 3] if i >= 3 else 0
            up = prev[i]
            up_left = prev[i - 3] if i >= 3 else 0
            if filter_type == 0:
                decoded[i] = value
            elif filter_type == 1:
                decoded[i] = (value + left) & 0xFF
            elif filter_type == 2:
                decoded[i] = (value + up) & 0xFF
            elif filter_type == 3:
                decoded[i] = (value + ((left + up) // 2)) & 0xFF
            elif filter_type == 4:
                decoded[i] = (value + paeth(left, up, up_left)) & 0xFF
            else:
                raise ValueError(f"Unsupported PNG filter {filter_type}")
        rows.append(decoded)
        prev = decoded

    pixels = []
    for row in rows:
        for i in range(0, len(row), 3):
            pixels.append((row[i], row[i + 1], row[i + 2]))

    unique_colors = len(set(pixels))
    brightness_values = [(r + g + b) / (255.0 * 3.0) for r, g, b in pixels]
    avg_brightness = sum(brightness_values) / len(brightness_values) if brightness_values else 0
    active_threshold = 0.05
    active_pixels = sum(1 for v in brightness_values if v > active_threshold)
    dominant_pixels = sum(1 for v in brightness_values if v > 0.8)
    non_black = [(r, g, b) for r, g, b in pixels if (r + g + b) > 0]
    if non_black:
        avg_r = sum(p[0] for p in non_black) / len(non_black)
        avg_g = sum(p[1] for p in non_black) / len(non_black)
        avg_b = sum(p[2] for p in non_black) / len(non_black)
    else:
        avg_r = avg_g = avg_b = 0

    return {
        "firstFrameWidth": width,
        "firstFrameHeight": height,
        "firstFrameUniqueColorCount": unique_colors,
        "firstFrameAverageBrightness": round(avg_brightness, 6),
        "firstFrameActivePixelRatio": round(active_pixels / len(pixels), 6) if pixels else 0,
        "firstFrameDominantPixelRatio": round(dominant_pixels / len(pixels), 6) if pixels else 0,
        "firstFrameAverageRgb": {
            "r": round(avg_r, 3),
            "g": round(avg_g, 3),
            "b": round(avg_b, 3),
        },
    }


def main():
    args = parse_args()
    gif_path = Path(args.gif)
    png_path = Path(args.first_frame_png)

    features = {}
    features.update(parse_gif_metrics(gif_path))
    features.update(parse_png_metrics(png_path))
    json.dump(features, sys.stdout, separators=(",", ":"))


if __name__ == "__main__":
    main()
