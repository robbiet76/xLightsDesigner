const CONTROLLED_METADATA_TAGS = [
  { name: "Focal", description: "Primary visual lead or hero target.", category: "role" },
  { name: "Support", description: "Supports a lead target without dominating the scene.", category: "role" },
  { name: "Background", description: "Stays behind focal action as ambient support.", category: "role" },
  { name: "Frame", description: "Provides perimeter or framing support.", category: "role" },
  { name: "Accent", description: "Adds highlight moments rather than broad coverage.", category: "role" },
  { name: "Character", description: "Reads as a figure or representational prop.", category: "semantic" },
  { name: "Lyric", description: "Good candidate for lyric or phrase emphasis.", category: "semantic" },
  { name: "Rhythm Driver", description: "Useful for pulse, beat, or rhythmic motion emphasis.", category: "semantic" },
  { name: "Ambient Fill", description: "Good for soft atmosphere or low-priority fill.", category: "semantic" },
  { name: "Perimeter", description: "Acts as an outline or edge treatment.", category: "semantic" }
];

function str(value = "") {
  return String(value || "").trim();
}

export function normalizeMetadataTagName(value = "") {
  return str(value)
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizeMetadataTagDescription(value = "") {
  return str(value);
}

export function getControlledMetadataTagRecords() {
  return CONTROLLED_METADATA_TAGS.map((row) => ({
    name: normalizeMetadataTagName(row.name),
    description: normalizeMetadataTagDescription(row.description),
    category: str(row.category || "general").toLowerCase(),
    source: "controlled",
    controlled: true
  }));
}

export function mergeMetadataTagRecords(rawRecords = []) {
  const byName = new Map();

  for (const row of getControlledMetadataTagRecords()) {
    byName.set(row.name, row);
  }

  for (const entry of Array.isArray(rawRecords) ? rawRecords : []) {
    if (typeof entry === "string") {
      const name = normalizeMetadataTagName(entry);
      if (!name || byName.has(name)) continue;
      byName.set(name, {
        name,
        description: "",
        category: "project",
        source: "custom",
        controlled: false
      });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const name = normalizeMetadataTagName(entry.name);
    if (!name || byName.has(name)) continue;
    byName.set(name, {
      name,
      description: normalizeMetadataTagDescription(entry.description),
      category: str(entry.category || "project").toLowerCase(),
      source: "custom",
      controlled: false
    });
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function toStoredMetadataTagRecords(records = []) {
  return (Array.isArray(records) ? records : [])
    .filter((row) => row && row.controlled !== true && str(row.source || "custom") !== "controlled")
    .map((row) => ({
      name: normalizeMetadataTagName(row.name),
      description: normalizeMetadataTagDescription(row.description),
      category: str(row.category || "project").toLowerCase()
    }))
    .filter((row) => row.name);
}

export function isControlledMetadataTag(name = "") {
  const normalized = normalizeMetadataTagName(name);
  return getControlledMetadataTagRecords().some((row) => row.name === normalized);
}
