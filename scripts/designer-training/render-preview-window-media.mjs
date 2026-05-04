#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function str(value = '') {
  return String(value || '').trim();
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolvePath(filePath = '') {
  const value = str(filePath);
  if (!value) return '';
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv = []) {
  const args = {
    windowPath: '',
    out: '',
    framesDir: '',
    width: 1280,
    height: 720,
    fps: 20,
    nodeRadius: 3
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${token}`);
      return argv[index];
    };
    if (token === '--window') args.windowPath = resolvePath(next());
    else if (token === '--out') args.out = resolvePath(next());
    else if (token === '--frames-dir') args.framesDir = resolvePath(next());
    else if (token === '--width') args.width = Number(next());
    else if (token === '--height') args.height = Number(next());
    else if (token === '--fps') args.fps = Number(next());
    else if (token === '--node-radius') args.nodeRadius = Number(next());
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/designer-training/render-preview-window-media.mjs --window preview-scene-window.json --out review-window.mp4

Options:
  --frames-dir frames/
  --width 1280 --height 720
  --fps 20
  --node-radius 3
`;
}

function collectNodes(windowDoc = {}) {
  const nodes = [];
  for (const frame of Array.isArray(windowDoc.frames) ? windowDoc.frames : []) {
    for (const model of Array.isArray(frame.models) ? frame.models : []) {
      for (const node of Array.isArray(model.activeNodes) ? model.activeNodes : []) {
        const screen = node?.screen || {};
        nodes.push({
          x: number(screen.x, NaN),
          y: number(screen.y, NaN),
          z: number(screen.z, 0)
        });
      }
    }
  }
  return nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
}

function boundsFor(nodes = []) {
  if (!nodes.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  return { minX, maxX, minY, maxY };
}

function projectPoint({ x, y }, bounds, width, height) {
  const marginX = width * 0.06;
  const marginY = height * 0.08;
  const usableW = Math.max(1, width - marginX * 2);
  const usableH = Math.max(1, height - marginY * 2);
  const px = marginX + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * usableW;
  const py = marginY + (1 - ((y - bounds.minY) / (bounds.maxY - bounds.minY))) * usableH;
  return {
    x: Math.max(0, Math.min(width - 1, Math.round(px))),
    y: Math.max(0, Math.min(height - 1, Math.round(py)))
  };
}

function drawNode(buffer, width, height, x, y, rgb, radius) {
  const r = Math.max(1, Math.round(radius));
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      if ((dx * dx) + (dy * dy) > r * r) continue;
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const index = (py * width + px) * 3;
      buffer[index] = Math.max(buffer[index], rgb.r);
      buffer[index + 1] = Math.max(buffer[index + 1], rgb.g);
      buffer[index + 2] = Math.max(buffer[index + 2], rgb.b);
    }
  }
}

function renderFrame(frame, bounds, { width, height, nodeRadius }) {
  const buffer = Buffer.alloc(width * height * 3);
  for (const model of Array.isArray(frame.models) ? frame.models : []) {
    for (const node of Array.isArray(model.activeNodes) ? model.activeNodes : []) {
      const screen = node?.screen || {};
      if (!Number.isFinite(Number(screen.x)) || !Number.isFinite(Number(screen.y))) continue;
      const point = projectPoint({ x: Number(screen.x), y: Number(screen.y) }, bounds, width, height);
      const rgb = node?.rgb || {};
      drawNode(buffer, width, height, point.x, point.y, {
        r: Math.max(0, Math.min(255, Math.round(number(rgb.r, 0)))),
        g: Math.max(0, Math.min(255, Math.round(number(rgb.g, 0)))),
        b: Math.max(0, Math.min(255, Math.round(number(rgb.b, 0))))
      }, nodeRadius);
    }
  }
  return buffer;
}

function writePpm(filePath, width, height, rgbBuffer) {
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`, 'ascii');
  fs.writeFileSync(filePath, Buffer.concat([header, rgbBuffer]));
}

export function renderPreviewWindowMedia({
  windowPath,
  out,
  framesDir = '',
  width = 1280,
  height = 720,
  fps = 20,
  nodeRadius = 3
} = {}) {
  const resolvedWindowPath = resolvePath(windowPath);
  const resolvedOut = resolvePath(out);
  if (!resolvedWindowPath || !fs.existsSync(resolvedWindowPath)) throw new Error(`preview window not found: ${resolvedWindowPath || '(missing)'}`);
  if (!resolvedOut) throw new Error('output media path is required');
  const windowDoc = readJson(resolvedWindowPath);
  const frames = Array.isArray(windowDoc.frames) ? windowDoc.frames : [];
  if (!frames.length) throw new Error('preview window contains no frames');
  const resolvedFramesDir = resolvePath(framesDir || fs.mkdtempSync(path.join(os.tmpdir(), 'xld-preview-window-frames-')));
  fs.mkdirSync(resolvedFramesDir, { recursive: true });
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  const renderBounds = boundsFor(collectNodes(windowDoc));
  frames.forEach((frame, index) => {
    const buffer = renderFrame(frame, renderBounds, {
      width: Math.max(1, Math.round(number(width, 1280))),
      height: Math.max(1, Math.round(number(height, 720))),
      nodeRadius: number(nodeRadius, 3)
    });
    writePpm(path.join(resolvedFramesDir, `frame-${String(index + 1).padStart(4, '0')}.ppm`), width, height, buffer);
  });
  execFileSync('ffmpeg', [
    '-y',
    '-v', 'error',
    '-framerate', String(number(fps, 20)),
    '-i', path.join(resolvedFramesDir, 'frame-%04d.ppm'),
    '-pix_fmt', 'yuv420p',
    resolvedOut
  ]);
  return {
    ok: true,
    artifactType: 'preview_window_media_v1',
    windowPath: resolvedWindowPath,
    out: resolvedOut,
    framesDir: resolvedFramesDir,
    frameCount: frames.length,
    width: Math.round(number(width, 1280)),
    height: Math.round(number(height, 720)),
    fps: number(fps, 20)
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.windowPath || !args.out) {
      process.stdout.write(usage());
      process.exit(args.help ? 0 : 1);
    }
    process.stdout.write(`${JSON.stringify(renderPreviewWindowMedia(args), null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
