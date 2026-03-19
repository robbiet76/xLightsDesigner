#!/usr/bin/env python3
import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-dir", required=True)
    parser.add_argument("--model-name", required=True)
    return parser.parse_args()


def load_controller_bases(networks_path):
    root = ET.parse(networks_path).getroot()
    controller_bases = {}
    channel_base = 0
    for controller in root.findall("Controller"):
        name = controller.attrib.get("Name")
        network = controller.find("network")
        if not name or network is None:
            continue
        max_channels = int(network.attrib.get("MaxChannels", "0") or "0")
        controller_bases[name] = {
            "baseZero": channel_base,
            "maxChannels": max_channels,
        }
        channel_base += max_channels
    return controller_bases


def parse_start_channel(raw, controller_bases):
    if not raw:
        raise ValueError("missing StartChannel")
    if raw.isdigit():
        absolute_one_based = int(raw)
        return absolute_one_based - 1
    match = re.match(r"^[!>]?([^:]+):(\d+)$", raw)
    if not match:
        raise ValueError(f"unsupported StartChannel format: {raw}")
    controller_name = match.group(1)
    offset_one_based = int(match.group(2))
    if controller_name not in controller_bases:
        raise ValueError(f"controller not found in networks xml: {controller_name}")
    return controller_bases[controller_name]["baseZero"] + offset_one_based - 1


def infer_channels_per_node(string_type):
    string_type = (string_type or "").strip().lower()
    if "rgb" in string_type:
        return 3
    if "single color" in string_type:
        return 1
    return 3


def infer_node_count(model):
    pixel_count = model.attrib.get("PixelCount")
    if pixel_count and pixel_count.isdigit():
        return int(pixel_count)

    display_as = (model.attrib.get("DisplayAs") or "").strip().lower()
    parm1 = int(model.attrib.get("parm1", "0") or "0")
    parm2 = int(model.attrib.get("parm2", "0") or "0")
    parm3 = int(model.attrib.get("parm3", "0") or "0")

    if "matrix" in display_as:
        if parm1 and parm2:
            return parm1 * parm2 * max(parm3, 1)
    if display_as in {"single line", "poly line"} and parm2:
        return parm2
    if parm2:
        return parm2
    if parm1:
        return parm1
    raise ValueError(f"unable to infer node count for model {model.attrib.get('name')}")


def resolve_model_family(display_as):
    raw = (display_as or "").strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")

    if raw in {"single line", "poly line"}:
        return "single_line"
    if raw == "arches":
        return "arch"
    if raw == "candy canes":
        return "cane"
    if raw in {"horiz matrix", "vert matrix", "matrix"}:
        return "matrix"
    if raw == "tree flat":
        return "tree_flat"
    if raw == "tree 360":
        return "tree_360"
    if raw == "star":
        return "star"
    if raw == "icicles":
        return "icicles"
    if raw == "spinner":
        return "spinner"
    if raw == "wreath":
        return "wreath"
    return normalized or "unknown"


def resolve_analyzer_family(model_family):
    if model_family in {"single_line", "arch", "cane", "icicles"}:
        return "linear"
    if model_family in {"tree_flat", "tree_360"}:
        return "tree"
    if model_family == "star":
        return "star"
    if model_family in {"spinner", "wreath"}:
        return "radial"
    if model_family == "matrix":
        return "matrix"
    return "base"


def structural_attributes(model):
    ignored = {
        "name",
        "WorldPosX",
        "WorldPosY",
        "WorldPosZ",
        "ScaleX",
        "ScaleY",
        "ScaleZ",
        "RotateX",
        "RotateY",
        "RotateZ",
        "StartChannel",
        "Controller",
        "LayoutGroup",
        "Transparency",
        "PixelSize",
        "Antialias",
        "versionNumber",
    }
    attrs = {}
    for key, value in sorted(model.attrib.items()):
        if key in ignored:
            continue
        attrs[key] = value.strip()
    return attrs


def geometry_traits(display_as, attrs):
    traits = []
    model_type = resolve_model_family(display_as)
    traits.append(f"type:{model_type}")

    if attrs.get("LayerSizes"):
        traits.append("layered")
    if attrs.get("CandyCaneSticks", "").lower() == "true":
        traits.append("stick_segments")
    if attrs.get("TreeSpiralRotations") not in {None, "", "0", "0.000000"}:
        traits.append("spiral_enabled")
    if attrs.get("StrandDir"):
        traits.append(f"strand_dir:{attrs['StrandDir'].lower()}")
    if attrs.get("DropPattern"):
        traits.append("drop_pattern")
    if attrs.get("Alternate", "").lower() == "true":
        traits.append("alternate")
    if attrs.get("ZigZag", "").lower() == "true":
        traits.append("zigzag")

    parm1 = attrs.get("parm1")
    parm2 = attrs.get("parm2")
    parm3 = attrs.get("parm3")
    if model_type == "single_line":
        if parm2 == "1":
            traits.append("single_node")
        x2 = float(attrs.get("X2", "0") or "0")
        y2 = float(attrs.get("Y2", "0") or "0")
        if abs(x2) > abs(y2):
            traits.append("horizontal_orientation")
        elif abs(y2) > abs(x2):
            traits.append("vertical_orientation")
    if model_type == "arch":
        if parm1 and int(parm1) > 1:
            traits.append("grouped")
    if model_type == "cane":
        if parm1 and int(parm1) > 1:
            traits.append("grouped")
        if parm2 and int(parm2) <= 20:
            traits.append("low_node_density")
    if model_type == "matrix":
        if parm1 and parm2:
            rows = int(parm1)
            cols = int(parm2)
            traits.append(f"matrix:{rows}x{cols}")
            cells = rows * cols
            if cells <= 256:
                traits.append("density_low")
            elif cells <= 1024:
                traits.append("density_medium")
            else:
                traits.append("density_high")
    if model_type in {"tree_flat", "tree_360"}:
        if parm1 and parm2:
            traits.append(f"strings:{parm1}")
            traits.append(f"nodes_per_string:{parm2}")
    if model_type == "star" and parm3:
        traits.append(f"points:{parm3}")
    if model_type == "spinner" and parm3:
        traits.append(f"arms:{parm3}")

    return sorted(set(traits))


def resolve_geometry_profile(display_as, attrs):
    model_type = resolve_model_family(display_as)
    traits = set(geometry_traits(display_as, attrs))

    if model_type == "single_line":
        if "single_node" in traits:
            return "single_line_single_node"
        if "vertical_orientation" in traits:
            return "single_line_vertical"
        return "single_line_horizontal"
    if model_type == "arch":
        if "layered" in traits:
            return "arch_multi_layer"
        if "grouped" in traits:
            return "arch_grouped"
        return "arch_single"
    if model_type == "cane":
        if "stick_segments" in traits and "grouped" in traits:
            return "cane_stick_grouped"
        if "grouped" in traits:
            return "cane_grouped"
        return "cane_single"
    if model_type == "matrix":
        if "density_high" in traits:
            return "matrix_high_density"
        if "density_medium" in traits:
            return "matrix_medium_density"
        return "matrix_low_density"
    if model_type == "tree_360":
        if "spiral_enabled" in traits:
            return "tree_360_spiral"
        return "tree_360_round"
    if model_type == "tree_flat":
        return "tree_flat_single_layer"
    if model_type == "star":
        if "layered" in traits:
            return "star_multi_layer"
        return "star_single_layer"
    if model_type == "icicles":
        return "icicles_drop_pattern" if "drop_pattern" in traits else "icicles_standard"
    if model_type == "spinner":
        return "spinner_standard"
    return model_type


def main():
    args = parse_args()
    rgbeffects_path = f"{args.show_dir.rstrip('/')}/xlights_rgbeffects.xml"
    networks_path = f"{args.show_dir.rstrip('/')}/xlights_networks.xml"

    controller_bases = load_controller_bases(networks_path)
    rgbeffects_root = ET.parse(rgbeffects_path).getroot()

    target = None
    for model in rgbeffects_root.iter("model"):
        if model.attrib.get("name") == args.model_name:
            target = model
            break

    if target is None:
        print(json.dumps({"error": f"model not found: {args.model_name}"}))
        return 1

    start_channel_zero = parse_start_channel(target.attrib.get("StartChannel", ""), controller_bases)
    node_count = infer_node_count(target)
    channels_per_node = infer_channels_per_node(target.attrib.get("StringType", ""))
    channel_count = node_count * channels_per_node

    display_as = target.attrib.get("DisplayAs")
    resolved_model_family = resolve_model_family(display_as)
    attrs = structural_attributes(target)
    traits = geometry_traits(display_as, attrs)
    geometry_profile = resolve_geometry_profile(display_as, attrs)
    print(json.dumps({
        "modelName": args.model_name,
        "displayAs": display_as,
        "displayAsNormalized": re.sub(r"[^a-z0-9]+", "_", (display_as or "").strip().lower()).strip("_"),
        "resolvedModelType": resolved_model_family,
        "resolvedGeometryProfile": geometry_profile,
        "geometryTraits": traits,
        "analyzerFamily": resolve_analyzer_family(resolved_model_family),
        "structuralSettings": attrs,
        "stringType": target.attrib.get("StringType"),
        "startChannel": start_channel_zero + 1,
        "startChannelZero": start_channel_zero,
        "endChannel": start_channel_zero + channel_count,
        "channelCount": channel_count,
        "nodeCount": node_count,
        "channelsPerNode": channels_per_node,
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
