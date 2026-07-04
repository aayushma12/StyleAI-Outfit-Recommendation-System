'use strict';

// ── Color extraction via k-means clustering ─────────────────────────────────
// Genuine unsupervised ML: clusters the image's pixels in RGB space to find
// dominant/secondary colors. Free, instant, needs no API key — always runs
// regardless of which (if any) LLM provider is configured.

const axios = require('axios');
const Jimp  = require('jimp');
const { isAllowedImageUrl } = require('../utils/urlSafety');

const K               = 5;   // number of clusters
const MAX_ITERATIONS  = 12;
const SAMPLE_SIZE     = 100; // resize longest edge to this before sampling pixels

// Named palette used to map a clustered RGB centroid back to a human-readable
// color name — this is what lets the existing hue-based fashionRulesEngine
// (which matches against name substrings) understand AI-extracted colors
// exactly like it understands user-typed ones.
const NAMED_PALETTE = {
  black: [17, 17, 17], white: [250, 250, 250], grey: [156, 163, 175],
  red: [220, 38, 38], crimson: [200, 20, 60], maroon: [127, 29, 29],
  orange: [234, 88, 12], coral: [248, 113, 113], peach: [255, 200, 170],
  yellow: [245, 158, 11], gold: [217, 119, 6], mustard: [180, 140, 20],
  green: [5, 150, 105], olive: [77, 124, 15], mint: [110, 231, 183],
  teal: [13, 148, 136], cyan: [8, 145, 178], turquoise: [64, 200, 190],
  blue: [37, 99, 235], navy: [30, 58, 95], denim: [70, 100, 150],
  purple: [124, 58, 237], violet: [139, 92, 246], lavender: [167, 139, 250],
  pink: [236, 72, 153], rose: [244, 63, 94], fuchsia: [217, 70, 239],
  brown: [146, 64, 14], tan: [210, 180, 140], beige: [212, 184, 150],
  cream: [245, 240, 232], khaki: [189, 183, 107], camel: [193, 154, 107],
  silver: [148, 163, 184],
};

function dist2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function rgbToHex([r, g, b]) {
  const h = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function nearestNamedColor(rgb) {
  let best = 'grey', bestDist = Infinity;
  for (const [name, ref] of Object.entries(NAMED_PALETTE)) {
    const d = dist2(rgb, ref);
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

// Deterministic farthest-point initialization (better + more reproducible
// than random init for a small K on a small sample).
function initCentroids(pixels, k) {
  const centroids = [pixels[Math.floor(pixels.length / 2)]];
  while (centroids.length < k) {
    let farthest = null, farthestDist = -1;
    for (const p of pixels) {
      const minDistToCentroids = Math.min(...centroids.map(c => dist2(p, c)));
      if (minDistToCentroids > farthestDist) { farthestDist = minDistToCentroids; farthest = p; }
    }
    centroids.push(farthest);
  }
  return centroids;
}

function kmeans(pixels, k) {
  if (pixels.length <= k) return pixels.map(p => ({ centroid: p, count: 1 }));

  let centroids = initCentroids(pixels, k);
  let assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;
    for (let i = 0; i < pixels.length; i++) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist2(pixels[i], centroids[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }

    const sums   = centroids.map(() => [0, 0, 0]);
    const counts = centroids.map(() => 0);
    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i];
      sums[c][0] += pixels[i][0]; sums[c][1] += pixels[i][1]; sums[c][2] += pixels[i][2];
      counts[c]++;
    }
    centroids = centroids.map((c, idx) => counts[idx] > 0
      ? [sums[idx][0] / counts[idx], sums[idx][1] / counts[idx], sums[idx][2] / counts[idx]]
      : c);

    if (!changed) break;
  }

  const counts = centroids.map(() => 0);
  for (const a of assignments) counts[a]++;
  return centroids.map((centroid, i) => ({ centroid, count: counts[i] }));
}

/**
 * Extracts dominant/secondary colors from an image URL using k-means clustering.
 * Always resolves — worst case returns empty arrays, never throws.
 */
exports.extractColors = async function extractColors(imageUrl) {
  if (!isAllowedImageUrl(imageUrl)) {
    console.warn('[colorExtraction] rejected non-allowlisted image URL:', imageUrl);
    return { dominant: '', secondary: '', palette: [], namedColors: [] };
  }
  try {
    const { data } = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
    const buffer = Buffer.from(data);
    return exports.extractColorsFromBuffer(buffer);
  } catch (err) {
    console.warn('[colorExtraction] failed to fetch/process image:', err.message);
    return { dominant: '', secondary: '', palette: [], namedColors: [] };
  }
};

exports.extractColorsFromBuffer = async function extractColorsFromBuffer(buffer) {
  try {
    const image = await Jimp.read(buffer);
    image.resize(SAMPLE_SIZE, Jimp.AUTO);

    const pixels = [];
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      const a = this.bitmap.data[idx + 3];
      if (a < 128) return; // skip transparent background pixels
      pixels.push([r, g, b]);
    });

    if (pixels.length === 0) return { dominant: '', secondary: '', palette: [], namedColors: [] };

    const clusters = kmeans(pixels, K).sort((a, b) => b.count - a.count);
    const palette     = clusters.map(c => rgbToHex(c.centroid));
    const namedColors = clusters.map(c => nearestNamedColor(c.centroid));

    return {
      dominant:    palette[0]  || '',
      secondary:   palette[1]  || '',
      palette,
      namedColors: [...new Set(namedColors)],
    };
  } catch (err) {
    console.warn('[colorExtraction] k-means failed:', err.message);
    return { dominant: '', secondary: '', palette: [], namedColors: [] };
  }
};
