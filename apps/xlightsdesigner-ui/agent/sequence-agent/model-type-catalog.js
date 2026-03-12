function norm(value = "") {
  return String(value || "").trim();
}

function low(value = "") {
  return norm(value).toLowerCase();
}

function hasPrefix(value = "", prefix = "") {
  return low(value).startsWith(low(prefix));
}

const EXACT_TYPE_MAP = Object.freeze({
  "ModelGroup": { canonicalType: "model_group", category: "group", isGroup: true },
  "SubModel": { canonicalType: "submodel", category: "submodel", isSubmodel: true },
  "Star": { canonicalType: "star", category: "prop" },
  "Arches": { canonicalType: "arches", category: "prop" },
  "Candy Canes": { canonicalType: "candy_canes", category: "prop" },
  "Channel Block": { canonicalType: "channel_block", category: "utility" },
  "Circle": { canonicalType: "circle", category: "prop" },
  "Image": { canonicalType: "image", category: "media" },
  "Window Frame": { canonicalType: "window_frame", category: "prop" },
  "Wreath": { canonicalType: "wreath", category: "prop" },
  "Single Line": { canonicalType: "single_line", category: "line" },
  "Poly Line": { canonicalType: "poly_line", category: "line" },
  "MultiPoint": { canonicalType: "multipoint", category: "point" },
  "Cube": { canonicalType: "cube", category: "volume" },
  "Custom": { canonicalType: "custom", category: "custom" },
  "WholeHouse": { canonicalType: "whole_house", category: "aggregate" },
  "Vert Matrix": { canonicalType: "matrix_vertical", category: "matrix" },
  "Horiz Matrix": { canonicalType: "matrix_horizontal", category: "matrix" },
  "Spinner": { canonicalType: "spinner", category: "prop" },
  "DmxMovingHead": { canonicalType: "dmx_moving_head", category: "dmx", isDmx: true },
  "DmxMovingHeadAdv": { canonicalType: "dmx_moving_head_adv", category: "dmx", isDmx: true },
  "DmxFloodlight": { canonicalType: "dmx_floodlight", category: "dmx", isDmx: true },
  "DmxFloodArea": { canonicalType: "dmx_flood_area", category: "dmx", isDmx: true },
  "DmxSkull": { canonicalType: "dmx_skull", category: "dmx", isDmx: true },
  "DmxSkulltronix": { canonicalType: "dmx_skulltronix", category: "dmx", isDmx: true, isDeprecated: true },
  "DmxServo": { canonicalType: "dmx_servo", category: "dmx", isDmx: true },
  "DmxServo3d": { canonicalType: "dmx_servo_3d", category: "dmx", isDmx: true },
  "DmxGeneral": { canonicalType: "dmx_general", category: "dmx", isDmx: true },
  "DMX": { canonicalType: "dmx_generic", category: "dmx", isDmx: true }
});

export function classifyModelDisplayType(displayAs = "") {
  const rawType = norm(displayAs);
  if (!rawType) {
    return {
      rawType: "",
      canonicalType: "unknown",
      category: "unknown",
      isGroup: false,
      isSubmodel: false,
      isDmx: false,
      isDeprecated: false
    };
  }

  const exact = EXACT_TYPE_MAP[rawType];
  if (exact) {
    return {
      rawType,
      canonicalType: exact.canonicalType,
      category: exact.category,
      isGroup: Boolean(exact.isGroup),
      isSubmodel: Boolean(exact.isSubmodel),
      isDmx: Boolean(exact.isDmx),
      isDeprecated: Boolean(exact.isDeprecated)
    };
  }

  if (hasPrefix(rawType, "Tree")) {
    return { rawType, canonicalType: "tree", category: "tree", isGroup: false, isSubmodel: false, isDmx: false, isDeprecated: false };
  }
  if (hasPrefix(rawType, "Sphere")) {
    return { rawType, canonicalType: "sphere", category: "volume", isGroup: false, isSubmodel: false, isDmx: false, isDeprecated: false };
  }
  if (hasPrefix(rawType, "Icicles")) {
    return { rawType, canonicalType: "icicles", category: "line", isGroup: false, isSubmodel: false, isDmx: false, isDeprecated: false };
  }

  return {
    rawType,
    canonicalType: low(rawType).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown",
    category: "unknown",
    isGroup: false,
    isSubmodel: false,
    isDmx: hasPrefix(rawType, "Dmx") || rawType === "DMX",
    isDeprecated: false
  };
}
