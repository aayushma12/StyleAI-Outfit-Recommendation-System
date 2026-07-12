'use strict';

// ── Wardrobe image → structured metadata ────────────────────────────────────
// Hybrid pipeline: k-means color clustering (always runs, free, no API key)
// + one structured vision-LLM call for everything else (category-dependent
// attributes). Never throws — a wardrobe upload must never hard-fail just
// because AI tagging is unavailable; it degrades to colors-only or empty
// metadata and the user fills in the rest manually.

const axios     = require('axios');
const ai        = require('./aiProviderService');
const colorSvc  = require('./colorExtractionService');
const { sanitizeEnum, sanitizeEnumArray } = require('../utils/validation');
const { isAllowedImageUrl } = require('../utils/urlSafety');
const { OCCASIONS: VALID_OCCASIONS } = require('../constants/occasions');

const VALID_PATTERNS   = ['solid', 'striped', 'plaid', 'floral', 'geometric', 'abstract', 'animal_print', 'paisley', 'checkered', 'embroidered', 'other'];
const VALID_FITS       = ['fitted', 'regular', 'relaxed', 'oversized', 'cropped'];
const VALID_SLEEVES    = ['sleeveless', 'short', '3/4', 'long'];
const VALID_SEASONS    = ['winter', 'spring', 'monsoon', 'autumn', 'all'];
const VALID_STYLE_TAGS = ['minimalist', 'streetwear', 'smart_casual', 'korean', 'vintage',
  'preppy', 'athleisure', 'romantic', 'edgy', 'boho', 'classic', 'grunge', 'cottagecore', 'y2k', 'modest_chic'];
const VALID_LAYERING   = ['base', 'mid', 'outer', 'one_piece'];
const VALID_ACCESSORY_SLOTS = ['jewelry', 'bag', 'belt', 'watch', 'scarf', 'sunglasses', 'hair_accessory', 'footwear', 'outerwear'];
const VALID_NECKLINES  = ['crew', 'round', 'v_neck', 'polo_collar', 'shirt_collar', 'turtleneck', 'high_neck', 'square_neck', 'off_shoulder', 'boat_neck'];
const VALID_GENDERS    = ['women', 'men', 'unisex'];
const VALID_TEXTURES    = ['smooth', 'ribbed', 'knit', 'woven', 'lace', 'sequined', 'embroidered', 'denim', 'leather', 'velvet', 'satin', 'other'];
const VALID_SILHOUETTES = ['fitted', 'a_line', 'straight', 'flared', 'bodycon', 'oversized', 'wrap', 'asymmetric', 'other'];
const VALID_WEATHER     = ['hot', 'mild', 'cold', 'rainy', 'any'];
const VALID_CULTURAL    = ['western', 'indo_western', 'traditional', 'fusion', 'other'];

const SYSTEM_PROMPT = `You are a professional fashion cataloguer analyzing a single clothing item photo for a Kathmandu-based women's fashion app. Respond with ONLY a single JSON object — no prose, no markdown fences.`;

function buildImagePrompt(category) {
  return `Analyze this clothing item photo (declared category: "${category || 'unknown'}"). Return ONLY this JSON shape, using exactly these enums where given:

{
  "subcategory": "short specific name, e.g. 'blouse', 'hoop earrings', 'ankle boots'",
  "pattern": one of [${VALID_PATTERNS.join(', ')}],
  "sleeveLength": one of [${VALID_SLEEVES.join(', ')}] or null if not applicable,
  "fit": one of [${VALID_FITS.join(', ')}] or null if not applicable,
  "materialGuess": "best-guess fabric, e.g. 'cotton', 'denim', 'chiffon'",
  "styleTags": array of 1-3 from [${VALID_STYLE_TAGS.join(', ')}],
  "suitableSeasons": array from [${VALID_SEASONS.join(', ')}],
  "suitableOccasions": array of 1-4 from [${VALID_OCCASIONS.join(', ')}],
  "formalityLevel": integer 0-4 (0=loungewear, 1=casual, 2=smart casual, 3=business/festive, 4=formal/black-tie),
  "layeringLevel": one of [${VALID_LAYERING.join(', ')}],
  "accessoryCompatibility": array from [${VALID_ACCESSORY_SLOTS.join(', ')}] naming slots this item pairs well with,
  "neckline": one of [${VALID_NECKLINES.join(', ')}] or null if not applicable (e.g. bottoms, shoes, bags),
  "genderCategory": one of [${VALID_GENDERS.join(', ')}],
  "isCompleteOutfit": true if this single photographed item, on its own, already forms a complete outfit that should never be paired with an extra top or bottom (e.g. a saree, lehenga set, gown, jumpsuit, kurta set with matching bottom, or a matching co-ord top+bottom set) — false for an individual top, bottom, or standalone layering piece,
  "texture": one of [${VALID_TEXTURES.join(', ')}],
  "silhouette": one of [${VALID_SILHOUETTES.join(', ')}] or null if not applicable,
  "weatherSuitability": one of [${VALID_WEATHER.join(', ')}],
  "culturalCategory": one of [${VALID_CULTURAL.join(', ')}],
  "details": { "hasHood": boolean, "hasButtons": boolean, "hasZipper": boolean, "hasPockets": boolean, "hasLogo": boolean, "hasBelt": boolean, "isTransparent": boolean },
  "confidence": { "<fieldName>": 0.0-1.0 for each field above, your self-rated certainty }
}`;
}

function parseJsonRepair(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let raw = match[0];
  try { return JSON.parse(raw); } catch { /* try repair below */ }
  try {
    raw = raw.replace(/,\s*([}\]])/g, '$1'); // strip trailing commas
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchImageBuffer(imageUrl) {
  const { data, headers } = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
  const mimeType = headers['content-type']?.startsWith('image/') ? headers['content-type'] : 'image/jpeg';
  return { buffer: Buffer.from(data), mimeType };
}

/**
 * Analyzes a wardrobe item photo and returns structured metadata.
 * Always resolves (never throws) — degrades gracefully when vision is
 * unavailable, returning colors-only metadata instead.
 */
exports.analyzeWardrobeImage = async function analyzeWardrobeImage(imageUrl, category) {
  const emptyMeta = {
    colorHex: [], colorNames: [], subcategory: '', pattern: '', sleeveLength: '', fit: '',
    materialGuess: '', styleTags: [], suitableSeasons: [], suitableOccasions: [],
    formalityLevel: null, layeringLevel: '', accessoryCompatibility: [],
    neckline: '', genderCategory: '', isCompleteOutfit: false,
    texture: '', silhouette: '', weatherSuitability: '', culturalCategory: '',
    details: { hasHood: false, hasButtons: false, hasZipper: false, hasPockets: false, hasLogo: false, hasBelt: false, isTransparent: false },
    unverifiedFields: [], aiMeta: { extractedAt: new Date(), provider: '', fieldConfidence: {}, visionAvailable: false },
  };

  if (!imageUrl) return emptyMeta;
  if (!isAllowedImageUrl(imageUrl)) {
    console.warn('[visionExtraction] rejected non-allowlisted image URL:', imageUrl);
    return emptyMeta;
  }

  // Step 1: colors — always attempted, no API key required.
  const colors = await colorSvc.extractColors(imageUrl);
  emptyMeta.colorHex    = colors.palette.slice(0, 2);
  emptyMeta.colorNames  = colors.namedColors;
  if (emptyMeta.colorHex.length) emptyMeta.unverifiedFields.push('colorHex');

  // Step 2: structured vision call — optional, provider cascade with graceful fallback.
  let imageBuffer, mimeType;
  try {
    ({ buffer: imageBuffer, mimeType } = await fetchImageBuffer(imageUrl));
  } catch (err) {
    console.warn('[visionExtraction] could not fetch image for vision analysis:', err.message);
    emptyMeta.aiMeta.provider = 'color-only';
    return emptyMeta;
  }

  const visionResult = await ai.generateVision({
    systemPrompt: SYSTEM_PROMPT,
    imagePrompt:  buildImagePrompt(category),
    imageBuffer,
    mimeType,
    maxTokens: 600,
  });

  if (!visionResult.available) {
    emptyMeta.aiMeta.provider = 'color-only';
    return emptyMeta;
  }

  const parsed = parseJsonRepair(visionResult.text);
  if (!parsed) {
    emptyMeta.aiMeta.provider = 'color-only';
    return emptyMeta;
  }

  const fields = {
    subcategory:            typeof parsed.subcategory === 'string' ? parsed.subcategory.trim().slice(0, 60) : '',
    pattern:                sanitizeEnum(parsed.pattern, VALID_PATTERNS),
    sleeveLength:            sanitizeEnum(parsed.sleeveLength, VALID_SLEEVES),
    fit:                    sanitizeEnum(parsed.fit, VALID_FITS),
    materialGuess:          typeof parsed.materialGuess === 'string' ? parsed.materialGuess.trim().slice(0, 60) : '',
    styleTags:              sanitizeEnumArray(parsed.styleTags, VALID_STYLE_TAGS),
    suitableSeasons:        sanitizeEnumArray(parsed.suitableSeasons, VALID_SEASONS),
    suitableOccasions:      sanitizeEnumArray(parsed.suitableOccasions, VALID_OCCASIONS),
    formalityLevel:         Number.isInteger(parsed.formalityLevel) ? Math.max(0, Math.min(4, parsed.formalityLevel)) : null,
    layeringLevel:          sanitizeEnum(parsed.layeringLevel, VALID_LAYERING),
    accessoryCompatibility: sanitizeEnumArray(parsed.accessoryCompatibility, VALID_ACCESSORY_SLOTS),
    neckline:               sanitizeEnum(parsed.neckline, VALID_NECKLINES),
    genderCategory:         sanitizeEnum(parsed.genderCategory, VALID_GENDERS),
    isCompleteOutfit:       parsed.isCompleteOutfit === true,
    texture:                sanitizeEnum(parsed.texture, VALID_TEXTURES),
    silhouette:             sanitizeEnum(parsed.silhouette, VALID_SILHOUETTES),
    weatherSuitability:     sanitizeEnum(parsed.weatherSuitability, VALID_WEATHER),
    culturalCategory:       sanitizeEnum(parsed.culturalCategory, VALID_CULTURAL),
    details: {
      hasHood:       !!parsed.details?.hasHood,
      hasButtons:    !!parsed.details?.hasButtons,
      hasZipper:     !!parsed.details?.hasZipper,
      hasPockets:    !!parsed.details?.hasPockets,
      hasLogo:       !!parsed.details?.hasLogo,
      hasBelt:       !!parsed.details?.hasBelt,
      isTransparent: !!parsed.details?.isTransparent,
    },
  };

  const unverified = Object.entries(fields)
    .filter(([k, v]) => {
      // A boolean is only worth flagging "AI suggested, please verify" when
      // it's the notable true case — not on every item where it's just the
      // default false (unlike string/array fields, an empty value there
      // already means "nothing detected").
      if (k === 'isCompleteOutfit') return v === true;
      return Array.isArray(v) ? v.length > 0 : v !== '' && v !== null;
    })
    .map(([k]) => k);

  return {
    ...emptyMeta,
    ...fields,
    unverifiedFields: [...emptyMeta.unverifiedFields, ...unverified],
    aiMeta: {
      extractedAt: new Date(),
      provider: visionResult.provider,
      fieldConfidence: (parsed.confidence && typeof parsed.confidence === 'object') ? parsed.confidence : {},
      visionAvailable: true,
    },
  };
};
