'use strict';

// ── Composite outfit preview image ──────────────────────────────────────────
// When a user saves an outfit, this combines up to 4 of its item photos into
// a single collage image and uploads it to Cloudinary, so the Saved Outfits
// page can show one clean preview instead of a grid of separate thumbnails.
// Never throws — a failed/partial composite just means the card falls back
// to its existing per-item thumbnail grid, matching the same "never block
// the user-facing flow" contract already used by colorExtractionService and
// visionExtractionService.

const axios = require('axios');
const Jimp = require('jimp');
const cloudinary = require('../config/cloudinary');
const { isAllowedImageUrl } = require('../utils/urlSafety');

const CANVAS_SIZE = 800;
const MAX_ITEMS = 4;

// Jimp only decodes JPEG/PNG/BMP/TIFF/GIF — wardrobe photos are frequently
// WebP/AVIF (browsers commonly export those from camera/gallery uploads).
// Rather than add a new image-decoding dependency, ask Cloudinary to
// transcode on delivery: inserting the f_jpg transformation into any
// Cloudinary upload URL forces a JPEG regardless of the stored format.
function asJpeg(url) {
  return url.includes('/upload/') ? url.replace('/upload/', '/upload/f_jpg/') : url;
}

async function fetchImage(url) {
  if (!isAllowedImageUrl(url)) return null;
  try {
    const { data } = await axios.get(asJpeg(url), { responseType: 'arraybuffer', timeout: 8000 });
    return await Jimp.read(Buffer.from(data));
  } catch (err) {
    console.warn('[outfitPreviewService] failed to fetch/read image:', err.message);
    return null;
  }
}

// Lays out 1-4 images on a fixed square canvas: fullsize, side-by-side
// halves, or a 2x2 grid. Missing cells (fewer than 4 images) are left as
// plain canvas background rather than stretched to fill.
function layoutFor(count) {
  if (count <= 1) return [{ x: 0, y: 0, w: CANVAS_SIZE, h: CANVAS_SIZE }];
  if (count === 2) return [
    { x: 0,               y: 0, w: CANVAS_SIZE / 2, h: CANVAS_SIZE },
    { x: CANVAS_SIZE / 2, y: 0, w: CANVAS_SIZE / 2, h: CANVAS_SIZE },
  ];
  const half = CANVAS_SIZE / 2;
  return [
    { x: 0,    y: 0,    w: half, h: half },
    { x: half, y: 0,    w: half, h: half },
    { x: 0,    y: half, w: half, h: half },
    { x: half, y: half, w: half, h: half },
  ];
}

exports.generatePreviewImage = async function generatePreviewImage(imageUrls = []) {
  const urls = imageUrls.filter(Boolean).slice(0, MAX_ITEMS);
  if (!urls.length) return null;

  try {
    const images = (await Promise.all(urls.map(fetchImage))).filter(Boolean);
    if (!images.length) return null;

    const canvas = new Jimp(CANVAS_SIZE, CANVAS_SIZE, '#F7FFFD');
    const cells = layoutFor(images.length);

    images.forEach((img, i) => {
      const cell = cells[i];
      img.cover(cell.w, cell.h);
      canvas.composite(img, cell.x, cell.y);
    });

    const buffer = await canvas.getBufferAsync(Jimp.MIME_JPEG);
    const dataUri = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, { folder: 'styleai/outfit-previews' });

    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    console.warn('[outfitPreviewService] composite generation failed:', err.message);
    return null;
  }
};
