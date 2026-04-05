ObjC.import('Foundation');
ObjC.import('AppKit');
ObjC.import('ImageIO');

function frameMetrics(source, index) {
  const image = $.CGImageSourceCreateImageAtIndex(source, index, null);
  const rep = $.NSBitmapImageRep.alloc.initWithCGImage(image);
  const width = Number(rep.pixelsWide);
  const height = Number(rep.pixelsHigh);
  const total = width * height;

  let sumBrightness = 0;
  let active = 0;
  let dominant = 0;
  const seen = {};
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = rep.colorAtXY(x, y);
      const r = Number(c.redComponent);
      const g = Number(c.greenComponent);
      const b = Number(c.blueComponent);
      const brightness = (r + g + b) / 3;
      sumBrightness += brightness;
      if (brightness > 0.05) {
        active += 1;
      }
      if (brightness > 0.8) {
        dominant += 1;
      }
      const key = Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255);
      seen[key] = true;
    }
  }

  return {
    frameIndex: index,
    frameAverageBrightness: total > 0 ? sumBrightness / total : 0,
    frameActivePixelRatio: total > 0 ? active / total : 0,
    frameDominantPixelRatio: total > 0 ? dominant / total : 0,
    frameUniqueColorCount: Object.keys(seen).length
  };
}

function sampledIndices(count) {
  const fractions = [];
  const buckets = 20;
  for (let i = 0; i <= buckets; i++) {
    fractions.push(i / buckets);
  }
  fractions.push(0.01, 0.03, 0.05, 0.95, 0.97, 0.99);
  const indices = [];
  const seen = {};
  for (const f of fractions) {
    const idx = Math.max(0, Math.min(count - 1, Math.round((count - 1) * f)));
    if (!seen[idx]) {
      seen[idx] = true;
      indices.push(idx);
    }
  }
  return indices;
}

function bestFrame(metrics) {
  const ordered = metrics.slice().sort(function(a, b) {
    if (b.frameActivePixelRatio !== a.frameActivePixelRatio) {
      return b.frameActivePixelRatio - a.frameActivePixelRatio;
    }
    if (b.frameAverageBrightness !== a.frameAverageBrightness) {
      return b.frameAverageBrightness - a.frameAverageBrightness;
    }
    return b.frameUniqueColorCount - a.frameUniqueColorCount;
  });
  return ordered[0];
}

function run(argv) {
  if (argv.length < 1) {
    throw new Error('gif path is required');
  }

  const gifPath = argv[0];
  const url = $.NSURL.fileURLWithPath(gifPath);
  const source = $.CGImageSourceCreateWithURL(url, null);
  if (!source) {
    throw new Error('Failed to create image source for ' + gifPath);
  }

  const count = Number($.CGImageSourceGetCount(source));
  const indices = sampledIndices(count);
  const metrics = indices.map(function(idx) { return frameMetrics(source, idx); });
  const best = bestFrame(metrics);

  const result = {
    representativeSampledFrameIndex: best.frameIndex,
    representativeSampledFrameAverageBrightness: Number(best.frameAverageBrightness.toFixed(6)),
    representativeSampledFrameActivePixelRatio: Number(best.frameActivePixelRatio.toFixed(6)),
    representativeSampledFrameDominantPixelRatio: Number(best.frameDominantPixelRatio.toFixed(6)),
    representativeSampledFrameUniqueColorCount: best.frameUniqueColorCount,
    sampledFrameMetrics: metrics.map(function(m) {
      return {
        frameIndex: m.frameIndex,
        frameAverageBrightness: Number(m.frameAverageBrightness.toFixed(6)),
        frameActivePixelRatio: Number(m.frameActivePixelRatio.toFixed(6)),
        frameDominantPixelRatio: Number(m.frameDominantPixelRatio.toFixed(6)),
        frameUniqueColorCount: m.frameUniqueColorCount
      };
    })
  };

  $.NSFileHandle.fileHandleWithStandardOutput.writeData(
    $(JSON.stringify(result)).dataUsingEncoding($.NSUTF8StringEncoding)
  );
}
