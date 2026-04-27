import zlib from "node:zlib";
import test from "node:test";
import assert from "node:assert/strict";

import {
  derivePaletteFromImageFile
} from "../../../agent/designer-dialog/image-derived-palette.js";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return out;
}

function makePng({ width, height, pixels }) {
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(Buffer.from([0]));
    for (let x = 0; x < width; x += 1) {
      const pixel = pixels[y * width + x];
      rows.push(Buffer.from([pixel.r, pixel.g, pixel.b, pixel.a ?? 255]));
    }
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

test("derivePaletteFromImageFile extracts dominant png colors", () => {
  const png = makePng({
    width: 4,
    height: 2,
    pixels: [
      { r: 28, g: 72, b: 120 }, { r: 30, g: 70, b: 118 }, { r: 218, g: 172, b: 52 }, { r: 220, g: 170, b: 50 },
      { r: 130, g: 28, b: 44 }, { r: 34, g: 120, b: 74 }, { r: 34, g: 120, b: 74 }, { r: 34, g: 120, b: 74 }
    ]
  });

  const palette = derivePaletteFromImageFile({ content: png, mimeType: "image/png", maxColors: 4 });

  assert.equal(palette.length >= 3, true);
  assert.equal(palette.length <= 4, true);
  assert.equal(palette[0].role, "dominant");
  assert.match(palette.map((row) => row.hex).join(","), /#22784a/);
});
