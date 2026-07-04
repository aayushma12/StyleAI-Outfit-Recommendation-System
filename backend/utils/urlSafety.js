'use strict';

// ── SSRF guard for server-side image fetches ────────────────────────────────
// POST /api/wardrobe/analyze accepts a client-supplied imageUrl and the
// backend fetches it server-side (colorExtractionService, visionExtractionService)
// to run k-means color extraction and vision-LLM tagging. Without a check
// here, an authenticated user could point that URL at internal services,
// cloud metadata endpoints (e.g. 169.254.169.254), or other hosts reachable
// from the backend's network — a classic SSRF vector. Wardrobe photos only
// ever legitimately live on Cloudinary, so a strict hostname allowlist is
// both simple and sufficient (it also transitively blocks every internal/
// private/loopback address, since none of them match the allowed hostnames).

const ALLOWED_IMAGE_HOSTS = [/(^|\.)res\.cloudinary\.com$/i];

exports.isAllowedImageUrl = function isAllowedImageUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  return ALLOWED_IMAGE_HOSTS.some(pattern => pattern.test(url.hostname));
};
