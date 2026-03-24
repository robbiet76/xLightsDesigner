import { normalizeMetadataTagName } from "./metadata-tag-schema.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

const SYSTEM_VISUAL_HINT_DEFINITIONS = [
  {
    name: "Beat-Sync",
    description: "Good candidate for beat-driven motion and rhythmic emphasis.",
    semanticClass: "rhythmic_capability",
    behavioralIntent: "Prefer this target when the design calls for visible pulse, hits, or rhythmic support."
  },
  {
    name: "Flood Light",
    description: "Functions as wash or flood lighting rather than a typical line prop.",
    semanticClass: "lighting_capability",
    behavioralIntent: "Treat this target as broad wash/support lighting, not as a generic single-line shape."
  },
  {
    name: "Spot Light",
    description: "Functions as a tighter directional lighting source.",
    semanticClass: "lighting_capability",
    behavioralIntent: "Treat this target as a pointed lighting accent rather than broad base coverage."
  },
  {
    name: "Radial",
    description: "Reads as a radial form such as a spinner, star, wreath, or snowflake.",
    semanticClass: "shape_identity",
    behavioralIntent: "Favor radial or center-out visual treatments when the design intent fits."
  },
  {
    name: "Linear",
    description: "Reads as a line, border, gutter, garland, or other elongated path.",
    semanticClass: "shape_identity",
    behavioralIntent: "Favor directional, chase, and edge-following treatments when appropriate."
  },
  {
    name: "Outline",
    description: "Acts as an outline or perimeter treatment.",
    semanticClass: "structural_identity",
    behavioralIntent: "Use for framing, edge emphasis, and shape definition rather than dense focal fills."
  },
  {
    name: "Tree-Like",
    description: "Behaves visually like a tree surface or tree silhouette.",
    semanticClass: "surface_identity",
    behavioralIntent: "Treat as tree-oriented structure even if the raw model type is custom."
  },
  {
    name: "Matrix-Like",
    description: "Behaves visually like a matrix or pixel display surface.",
    semanticClass: "surface_identity",
    behavioralIntent: "Treat as a display surface suitable for image-like or panel-like looks."
  },
  {
    name: "Text",
    description: "Supports readable text-like content or text-oriented effects.",
    semanticClass: "content_capability",
    behavioralIntent: "Prefer for readable text or phrase-emphasis treatments."
  },
  {
    name: "Image",
    description: "Supports image-oriented looks better than purely abstract prop effects.",
    semanticClass: "content_capability",
    behavioralIntent: "Prefer for representational or image-like content when available."
  },
  {
    name: "Video",
    description: "Supports video-like or highly image-driven content.",
    semanticClass: "content_capability",
    behavioralIntent: "Treat as a display-capable surface for rich image/video-style content."
  }
];

export function getSystemVisualHintDefinitions() {
  return SYSTEM_VISUAL_HINT_DEFINITIONS.map((row) => ({
    name: normalizeMetadataTagName(row.name),
    description: str(row.description),
    semanticClass: str(row.semanticClass).toLowerCase(),
    behavioralIntent: str(row.behavioralIntent),
    controlled: true,
    source: "system",
    status: "defined",
    definedBy: "system",
    provenance: {
      source: "system",
      learnedFrom: "",
      createdAt: "",
      updatedAt: ""
    }
  }));
}

export function mergeVisualHintDefinitions(rawRecords = []) {
  const byName = new Map();

  for (const row of getSystemVisualHintDefinitions()) {
    byName.set(row.name, row);
  }

  for (const entry of arr(rawRecords)) {
    if (!entry || typeof entry !== "object") continue;
    const name = normalizeMetadataTagName(entry.name);
    if (!name || byName.has(name)) continue;
    byName.set(name, {
      name,
      description: str(entry.description),
      semanticClass: str(entry.semanticClass || "custom").toLowerCase(),
      behavioralIntent: str(entry.behavioralIntent),
      behavioralTags: arr(entry.behavioralTags).map((row) => normalizeMetadataTagName(row)).filter(Boolean),
      controlled: false,
      source: str(entry.source || "custom").toLowerCase() || "custom",
      status: str(entry.status || "pending_definition").toLowerCase() || "pending_definition",
      definedBy: str(entry.definedBy || "user").toLowerCase() || "user",
      provenance: {
        source: str(entry?.provenance?.source || entry.source || "custom").toLowerCase() || "custom",
        learnedFrom: str(entry?.provenance?.learnedFrom),
        createdAt: str(entry?.provenance?.createdAt || entry.createdAt),
        updatedAt: str(entry?.provenance?.updatedAt || entry.updatedAt)
      }
    });
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function toStoredVisualHintDefinitions(records = []) {
  return arr(records)
    .filter((row) => row && row.controlled !== true && str(row.source || "custom") !== "system")
    .map((row) => ({
      name: normalizeMetadataTagName(row.name),
      description: str(row.description),
      semanticClass: str(row.semanticClass || "custom").toLowerCase(),
      behavioralIntent: str(row.behavioralIntent),
      behavioralTags: arr(row.behavioralTags).map((value) => normalizeMetadataTagName(value)).filter(Boolean),
      source: str(row.source || "custom").toLowerCase() || "custom",
      status: str(row.status || "pending_definition").toLowerCase() || "pending_definition",
      definedBy: str(row.definedBy || "user").toLowerCase() || "user",
      provenance: {
        source: str(row?.provenance?.source || row.source || "custom").toLowerCase() || "custom",
        learnedFrom: str(row?.provenance?.learnedFrom),
        createdAt: str(row?.provenance?.createdAt || row.createdAt),
        updatedAt: str(row?.provenance?.updatedAt || row.updatedAt)
      }
    }))
    .filter((row) => row.name);
}

export function ensureVisualHintDefinitions(records = [], hintNames = [], { timestamp = "" } = {}) {
  const merged = mergeVisualHintDefinitions(records);
  const byName = new Map(merged.map((row) => [row.name, row]));
  const iso = str(timestamp);
  let changed = false;

  for (const rawName of arr(hintNames)) {
    const name = normalizeMetadataTagName(rawName);
    if (!name || byName.has(name)) continue;
    changed = true;
    byName.set(name, {
      name,
      description: "",
      semanticClass: "custom",
      behavioralIntent: "",
      controlled: false,
      source: "custom",
      status: "pending_definition",
      definedBy: "user",
      provenance: {
        source: "user",
        learnedFrom: "",
        createdAt: iso,
        updatedAt: iso
      }
    });
  }

  return changed
    ? Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
    : merged;
}

export function defineVisualHint(records = [], rawName = "", {
  description = "",
  semanticClass = "custom",
  behavioralIntent = "",
  behavioralTags = [],
  definedBy = "agent",
  source = "managed",
  learnedFrom = "chat_dialog",
  timestamp = ""
} = {}) {
  const name = normalizeMetadataTagName(rawName);
  if (!name) return mergeVisualHintDefinitions(records);

  const merged = mergeVisualHintDefinitions(records);
  const byName = new Map(merged.map((row) => [row.name, row]));
  const existing = byName.get(name);
  const iso = str(timestamp);

  if (existing?.controlled === true && existing?.source === "system") {
    return merged;
  }

  byName.set(name, {
    ...(existing && typeof existing === "object" ? existing : {}),
    name,
    description: str(description) || str(existing?.description),
    semanticClass: str(semanticClass || existing?.semanticClass || "custom").toLowerCase(),
    behavioralIntent: str(behavioralIntent) || str(existing?.behavioralIntent),
    behavioralTags: arr(behavioralTags).map((row) => normalizeMetadataTagName(row)).filter(Boolean),
    controlled: false,
    source: str(source || existing?.source || "managed").toLowerCase() || "managed",
    status: "defined",
    definedBy: str(definedBy || existing?.definedBy || "agent").toLowerCase() || "agent",
    provenance: {
      source: str(source || existing?.provenance?.source || existing?.source || "managed").toLowerCase() || "managed",
      learnedFrom: str(learnedFrom || existing?.provenance?.learnedFrom || "chat_dialog"),
      createdAt: str(existing?.provenance?.createdAt),
      updatedAt: iso || str(existing?.provenance?.updatedAt)
    }
  });

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}
