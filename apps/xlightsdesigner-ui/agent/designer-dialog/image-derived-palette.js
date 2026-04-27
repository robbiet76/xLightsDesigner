import zlib from "node:zlib";

function str(value = "") {
  return String(value || "").trim();
}

function clampByte(value = 0) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function toHex({ r = 0, g = 0, b = 0 } = {}) {
  return `#${[r, g, b].map((value) => clampByte(value).toString(16).padStart(2, "0")).join("")}`;
}

function colorDistance(a = {}, b = {}) {
  return Math.sqrt(
    Math.pow((a.r || 0) - (b.r || 0), 2) +
    Math.pow((a.g || 0) - (b.g || 0), 2) +
    Math.pow((a.b || 0) - (b.b || 0), 2)
  );
}

function unfilterScanline({ filter = 0, row = Buffer.alloc(0), previous = Buffer.alloc(0), bytesPerPixel = 4 } = {}) {
  const out = Buffer.alloc(row.length);
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? out[index - bytesPerPixel] : 0;
    const up = previous[index] || 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] || 0 : 0;
    let predictor = 0;
    if (filter === 1) predictor = left;
    else if (filter === 2) predictor = up;
    else if (filter === 3) predictor = Math.floor((left + up) / 2);
    else if (filter === 4) {
      const p = left + up - upLeft;
      const pa = Math.abs(p - left);
      const pb = Math.abs(p - up);
      const pc = Math.abs(p - upLeft);
      predictor = pa <= pb && pa <= pc ? left : (pb <= pc ? up : upLeft);
    }
    out[index] = (row[index] + predictor) & 0xff;
  }
  return out;
}

export function decodePngPixels(buffer = Buffer.alloc(0)) {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const signature = source.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") return { ok: false, error: "not a png" };

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset + 8 <= source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.subarray(offset + 4, offset + 8).toString("ascii");
    const data = source.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      const compression = data[10];
      const filter = data[11];
      const interlace = data[12];
      if (bitDepth !== 8 || compression !== 0 || filter !== 0 || interlace !== 0) {
        return { ok: false, error: "unsupported png encoding" };
      }
      if (![2, 6].includes(colorType)) return { ok: false, error: "unsupported png color type" };
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }
  if (!width || !height || !idat.length) return { ok: false, error: "invalid png" };

  const channels = colorType === 6 ? 4 : 3;
  const rowLength = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const pixels = [];
  let readOffset = 0;
  let previous = Buffer.alloc(rowLength);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[readOffset];
    const raw = inflated.subarray(readOffset + 1, readOffset + 1 + rowLength);
    const row = unfilterScanline({ filter, row: raw, previous, bytesPerPixel: channels });
    for (let x = 0; x < width; x += 1) {
      const base = x * channels;
      pixels.push({
        r: row[base],
        g: row[base + 1],
        b: row[base + 2],
        a: channels === 4 ? row[base + 3] : 255
      });
    }
    previous = row;
    readOffset += rowLength + 1;
  }
  return { ok: true, width, height, pixels };
}

export function derivePaletteFromPixels(pixels = [], { maxColors = 8, binSize = 24, minDistance = 36 } = {}) {
  const bins = new Map();
  for (const pixel of Array.isArray(pixels) ? pixels : []) {
    if ((pixel?.a ?? 255) < 32) continue;
    const r = clampByte(pixel?.r);
    const g = clampByte(pixel?.g);
    const b = clampByte(pixel?.b);
    const brightness = (r + g + b) / 3;
    if (brightness < 8 || brightness > 248) continue;
    const key = [r, g, b].map((value) => Math.floor(value / binSize)).join(":");
    const row = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    row.count += 1;
    row.r += r;
    row.g += g;
    row.b += b;
    bins.set(key, row);
  }

  const candidates = [...bins.values()]
    .map((row) => ({
      count: row.count,
      r: row.r / row.count,
      g: row.g / row.count,
      b: row.b / row.count
    }))
    .sort((a, b) => b.count - a.count);

  const selected = [];
  for (const candidate of candidates) {
    if (selected.every((row) => colorDistance(row, candidate) >= minDistance)) {
      selected.push(candidate);
    }
    if (selected.length >= Math.max(1, Math.min(8, Number(maxColors) || 8))) break;
  }

  return selected.map((color, index) => ({
    name: `image color ${index + 1}`,
    hex: toHex(color),
    role: index === 0 ? "dominant" : "support"
  }));
}

export function derivePaletteFromImageFile({ content = null, mimeType = "", maxColors = 8 } = {}) {
  if (!Buffer.isBuffer(content)) return [];
  if (str(mimeType).toLowerCase() && str(mimeType).toLowerCase() !== "image/png") return [];
  const decoded = decodePngPixels(content);
  if (!decoded.ok) return [];
  return derivePaletteFromPixels(decoded.pixels, { maxColors });
}
