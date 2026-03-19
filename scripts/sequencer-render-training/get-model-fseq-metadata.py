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

    print(json.dumps({
        "modelName": args.model_name,
        "displayAs": target.attrib.get("DisplayAs"),
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
