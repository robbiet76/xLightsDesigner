#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import xml.etree.ElementTree as ET
from pathlib import Path


def ensure_child(parent: ET.Element, tag: str) -> ET.Element:
    node = parent.find(tag)
    if node is None:
        node = ET.SubElement(parent, tag)
    return node


def set_child_text(parent: ET.Element, tag: str, text: str) -> None:
    node = ensure_child(parent, tag)
    node.text = text


def strip_timing_rows(display: ET.Element | None, element_effects: ET.Element | None) -> None:
    if display is None or element_effects is None:
      return

    display_rows = list(display)
    effects_rows = list(element_effects)
    kept_display = []
    kept_effects = []

    for disp, eff in zip(display_rows, effects_rows):
        if disp.attrib.get("type") == "timing":
            continue
        kept_display.append(disp)
        kept_effects.append(eff)

    display[:] = kept_display
    element_effects[:] = kept_effects


def clear_effect_rows(element_effects: ET.Element | None) -> None:
    if element_effects is None:
        return
    for row in list(element_effects):
        row[:] = [ET.Element("EffectLayer")]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--duration-seconds", type=float, default=30.0)
    args = parser.parse_args()

    source = Path(args.source)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    tree = ET.parse(source)
    root = tree.getroot()

    head = root.find("head")
    if head is None:
        raise SystemExit("Missing <head> in source sequence")

    set_child_text(head, "sequenceType", "Animation")
    set_child_text(head, "sequenceDuration", f"{args.duration_seconds:.3f}")
    set_child_text(head, "song", "Render Training Animation Fixture")
    set_child_text(head, "artist", "")
    set_child_text(head, "album", "")
    set_child_text(head, "MusicURL", "")
    set_child_text(head, "comment", "Auto-generated internal animation-only fixture for sequencer render training.")
    set_child_text(head, "imageDir", "")

    media = head.find("mediaFile")
    if media is not None:
        head.remove(media)

    sequence_media = root.find("SequenceMedia")
    if sequence_media is not None:
        sequence_media.clear()

    strip_timing_rows(root.find("DisplayElements"), root.find("ElementEffects"))
    clear_effect_rows(root.find("ElementEffects"))

    timing_tags = root.find("TimingTags")
    if timing_tags is not None:
        timing_tags.clear()

    ET.indent(tree, space="  ")
    tree.write(output, encoding="UTF-8", xml_declaration=True)
    print(str(output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
