import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function str(value = "") {
  return String(value || "").trim();
}

function sanitizeFileNameComponent(value = "") {
  return str(value).replace(/[/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeMediaIdentityToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildMediaIdentityKey({ isrc = "", title = "", artist = "" } = {}) {
  const normalizedIsrc = normalizeMediaIdentityToken(isrc);
  if (normalizedIsrc) return `isrc:${normalizedIsrc}`;
  const normalizedTitle = normalizeMediaIdentityToken(title);
  const normalizedArtist = normalizeMediaIdentityToken(artist);
  if (!normalizedTitle) return "";
  return `title:${normalizedTitle}|artist:${normalizedArtist || "unknown"}`;
}

function computeFileContentFingerprint(filePath = "") {
  const absolutePath = str(filePath);
  if (!absolutePath || !fs.existsSync(absolutePath)) return "";
  const h = crypto.createHash("sha256");
  const fh = fs.openSync(absolutePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    for (;;) {
      const read = fs.readSync(fh, buffer, 0, buffer.length, null);
      if (!read) break;
      h.update(read === buffer.length ? buffer : buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(fh);
  }
  return h.digest("hex");
}

function normalizeMetadataPayload(payload = {}) {
  const current = payload?.current && typeof payload.current === "object" ? payload.current : {};
  const recommended = payload?.recommended && typeof payload.recommended === "object" ? payload.recommended : {};
  return {
    current: {
      title: str(current?.title),
      artist: str(current?.artist),
      album: str(current?.album)
    },
    recommended: {
      title: str(recommended?.title),
      artist: str(recommended?.artist),
      album: str(recommended?.album)
    }
  };
}

export function readMediaIdentityFromFile(filePath = "", options = {}) {
  const absolutePath = str(filePath);
  if (!absolutePath || !fs.existsSync(absolutePath)) return null;
  const includeFingerprint = options?.includeFingerprint === true;
  const cache = options?.cache instanceof Map ? options.cache : null;
  let stats = null;
  try {
    stats = fs.statSync(absolutePath);
  } catch {
    stats = null;
  }
  const cacheKey = stats
    ? `${absolutePath}::${Number(stats.mtimeMs || 0)}::${Number(stats.size || 0)}`
    : absolutePath;
  if (cache?.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (!includeFingerprint || str(cached?.contentFingerprint)) {
      return cached;
    }
  }

  const ffprobe = str(options?.ffprobeBin || process.env.FFPROBE_BIN || "ffprobe") || "ffprobe";
  const spawnSyncCompat = options?.spawnSyncCompat;
  let parsed = {};
  if (typeof spawnSyncCompat === "function") {
    try {
      const { stdout } = spawnSyncCompat(ffprobe, [
        "-v", "error",
        "-show_entries", "format=duration:format_tags=title,artist,album,date,isrc",
        "-of", "json",
        absolutePath
      ]);
      parsed = JSON.parse(String(stdout || "{}"));
    } catch {
      parsed = {};
    }
  }

  const format = parsed?.format && typeof parsed.format === "object" ? parsed.format : {};
  const tags = format?.tags && typeof format.tags === "object" ? format.tags : {};
  const title = str(tags?.title);
  const artist = str(tags?.artist);
  const album = str(tags?.album);
  const date = str(tags?.date);
  const isrc = str(tags?.isrc);
  let durationMs = null;
  try {
    const rawDuration = Number(format?.duration);
    durationMs = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration * 1000) : null;
  } catch {
    durationMs = null;
  }

  const identity = {
    title,
    artist,
    album,
    date,
    isrc,
    durationMs,
    identityKey: buildMediaIdentityKey({ isrc, title, artist }),
    contentFingerprint: includeFingerprint ? computeFileContentFingerprint(absolutePath) : ""
  };
  cache?.set(cacheKey, identity);
  return identity;
}

export async function applyMediaIdentityRecommendation(payload = {}, options = {}) {
  const filePath = str(payload?.filePath);
  if (!filePath) return { ok: false, error: "Missing filePath" };
  if (!fs.existsSync(filePath)) return { ok: false, error: "Media file not found" };

  const rename = payload?.rename === true;
  const retag = payload?.retag === true;
  const recommendation = payload?.recommendation && typeof payload.recommendation === "object" ? payload.recommendation : {};
  const metadataRecommendation = normalizeMetadataPayload(payload?.metadataRecommendation || {});
  const parsed = path.parse(filePath);
  let targetPath = filePath;
  if (rename) {
    const requestedName = sanitizeFileNameComponent(str(recommendation?.recommendedFileName));
    if (!requestedName) return { ok: false, error: "Missing recommended file name" };
    targetPath = path.join(parsed.dir, requestedName.endsWith(parsed.ext) ? requestedName : `${requestedName}${parsed.ext}`);
    if (path.resolve(targetPath) !== path.resolve(filePath) && fs.existsSync(targetPath)) {
      return { ok: false, error: "Target file already exists" };
    }
  }

  const ffmpeg = options?.ffmpegBin || process.env.FFMPEG_BIN || "ffmpeg";
  const runBinary = options?.runBinary;
  const currentPath = filePath;
  if (retag) {
    if (typeof runBinary !== "function") {
      return { ok: false, error: "Retagging requires runBinary support" };
    }
    const tmpPath = path.join(parsed.dir, `${parsed.name}.xld-retag-${Date.now()}${parsed.ext}`);
    const args = ["-y", "-i", currentPath, "-map", "0", "-c", "copy"];
    const title = str(metadataRecommendation?.recommended?.title);
    const artist = str(metadataRecommendation?.recommended?.artist);
    const album = str(metadataRecommendation?.recommended?.album);
    if (title) args.push("-metadata", `title=${title}`);
    if (artist) args.push("-metadata", `artist=${artist}`);
    if (album) args.push("-metadata", `album=${album}`);
    args.push(tmpPath);
    await runBinary(ffmpeg, args);
    if (rename) {
      fs.unlinkSync(currentPath);
      fs.renameSync(tmpPath, targetPath);
    } else {
      fs.renameSync(tmpPath, currentPath);
    }
  } else if (rename && path.resolve(targetPath) !== path.resolve(currentPath)) {
    fs.renameSync(currentPath, targetPath);
  }

  return {
    ok: true,
    filePath: targetPath,
    renamed: rename && path.resolve(targetPath) !== path.resolve(filePath),
    retagged: retag,
    fileName: path.basename(targetPath)
  };
}
