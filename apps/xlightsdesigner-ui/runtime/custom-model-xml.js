function norm(value = "") {
  return String(value || "").trim();
}

function decodeXmlEntity(value = "") {
  return String(value || "").replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (match, entity) => {
    if (entity === "amp") return "&";
    if (entity === "lt") return "<";
    if (entity === "gt") return ">";
    if (entity === "quot") return "\"";
    if (entity === "apos") return "'";
    if (entity.startsWith("#x")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return match;
  });
}

export function parseXmlAttributes(source = "") {
  const text = String(source || "");
  const attrs = {};
  let index = 0;
  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index])) index += 1;
    const nameStart = index;
    while (index < text.length && /[^\s=/>]/.test(text[index])) index += 1;
    const name = text.slice(nameStart, index);
    if (!name) break;
    while (index < text.length && /\s/.test(text[index])) index += 1;
    if (text[index] !== "=") {
      attrs[name] = "";
      continue;
    }
    index += 1;
    while (index < text.length && /\s/.test(text[index])) index += 1;
    const quote = text[index] === "'" || text[index] === "\"" ? text[index] : "";
    if (!quote) {
      const valueStart = index;
      while (index < text.length && /[^\s/>]/.test(text[index])) index += 1;
      attrs[name] = decodeXmlEntity(text.slice(valueStart, index));
      continue;
    }
    index += 1;
    const valueStart = index;
    while (index < text.length && text[index] !== quote) index += 1;
    attrs[name] = decodeXmlEntity(text.slice(valueStart, index));
    if (text[index] === quote) index += 1;
  }
  return attrs;
}

function buildModelNode(attrs = {}) {
  const name = norm(attrs.name);
  if (!name) return null;
  return {
    id: name,
    name,
    displayAs: norm(attrs.DisplayAs),
    type: norm(attrs.DisplayAs),
    attributes: attrs
  };
}

function buildSubmodelNode(parentName = "", attrs = {}) {
  const name = norm(attrs.name);
  if (!parentName || !name) return null;
  const id = `${parentName}/${name}`;
  return {
    id,
    name,
    parentId: parentName,
    type: "submodel",
    submodelType: norm(attrs.type),
    attributes: attrs,
    ...attrs
  };
}

export function parseXLightsRgbEffectsCustomModelSceneGraph(xmlText = "") {
  const modelsById = {};
  const submodelsById = {};
  const tagPattern = /<\s*(\/?)(model|subModel|faceInfo)\b([^>]*?)(\/?)\s*>/gi;
  const modelStack = [];
  let match = null;

  while ((match = tagPattern.exec(String(xmlText || "")))) {
    const closing = match[1] === "/";
    const tagName = match[2];
    const attrs = parseXmlAttributes(match[3] || "");
    const selfClosing = match[4] === "/" || /\/\s*$/.test(match[3] || "");

    if (tagName === "model") {
      if (closing) {
        modelStack.pop();
        continue;
      }
      const node = buildModelNode(attrs);
      if (!node) continue;
      modelsById[node.id] = node;
      if (!selfClosing) modelStack.push(node.id);
      continue;
    }

    const currentModelId = modelStack[modelStack.length - 1] || "";
    if (!currentModelId) continue;

    if (tagName === "subModel" && !closing) {
      const submodel = buildSubmodelNode(currentModelId, attrs);
      if (submodel) submodelsById[submodel.id] = submodel;
    } else if (tagName === "faceInfo" && !closing) {
      modelsById[currentModelId] = {
        ...modelsById[currentModelId],
        faceInfo: attrs
      };
    }
  }

  return {
    modelsById,
    submodelsById,
    groupsById: {},
    stats: {}
  };
}
