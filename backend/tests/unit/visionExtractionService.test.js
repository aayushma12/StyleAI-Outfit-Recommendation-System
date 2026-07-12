'use strict';

jest.mock('axios');
jest.mock('../../services/aiProviderService');
jest.mock('../../services/colorExtractionService');

const axios = require('axios');
const aiProvider = require('../../services/aiProviderService');
const colorSvc = require('../../services/colorExtractionService');
const { analyzeWardrobeImage } = require('../../services/visionExtractionService');

const VALID_URL = 'https://res.cloudinary.com/demo/image/upload/v1/item.jpg';

describe('visionExtractionService.analyzeWardrobeImage — neckline / genderCategory / details', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    colorSvc.extractColors.mockResolvedValue({ dominant: '#111111', secondary: '', palette: ['#111111'], namedColors: ['black'] });
    axios.get.mockResolvedValue({ data: Buffer.from('fake-image-bytes'), headers: { 'content-type': 'image/jpeg' } });
  });

  test('returns sanitized neckline/genderCategory/details on a successful vision response', async () => {
    aiProvider.generateVision.mockResolvedValue({
      available: true,
      provider: 'gemini',
      text: JSON.stringify({
        subcategory: 'blouse', pattern: 'solid', sleeveLength: 'short', fit: 'regular',
        materialGuess: 'cotton', styleTags: ['classic'], suitableSeasons: ['all'],
        suitableOccasions: ['office'], formalityLevel: 2, layeringLevel: 'base',
        accessoryCompatibility: [],
        neckline: 'v_neck', genderCategory: 'women',
        details: { hasHood: false, hasButtons: true, hasZipper: false, hasPockets: false, hasLogo: false, hasBelt: false, isTransparent: false },
        confidence: { neckline: 0.9, genderCategory: 0.95 },
      }),
    });

    const meta = await analyzeWardrobeImage(VALID_URL, 'tops');

    expect(meta.neckline).toBe('v_neck');
    expect(meta.genderCategory).toBe('women');
    expect(meta.details).toEqual({
      hasHood: false, hasButtons: true, hasZipper: false, hasPockets: false,
      hasLogo: false, hasBelt: false, isTransparent: false,
    });
    expect(meta.unverifiedFields).toEqual(expect.arrayContaining(['neckline', 'genderCategory', 'details']));
    expect(meta.aiMeta.fieldConfidence).toEqual({ neckline: 0.9, genderCategory: 0.95 });
  });

  test('rejects an invalid neckline/genderCategory value rather than passing it through', async () => {
    aiProvider.generateVision.mockResolvedValue({
      available: true,
      provider: 'gemini',
      text: JSON.stringify({
        subcategory: '', pattern: '', sleeveLength: '', fit: '', materialGuess: '',
        styleTags: [], suitableSeasons: [], suitableOccasions: [], formalityLevel: null,
        layeringLevel: '', accessoryCompatibility: [],
        neckline: 'not_a_real_neckline', genderCategory: 'not_a_real_gender',
        details: {},
      }),
    });

    const meta = await analyzeWardrobeImage(VALID_URL, 'tops');

    expect(meta.neckline).toBe('');
    expect(meta.genderCategory).toBe('');
    expect(meta.details).toEqual({
      hasHood: false, hasButtons: false, hasZipper: false, hasPockets: false,
      hasLogo: false, hasBelt: false, isTransparent: false,
    });
  });

  test('degrades gracefully (color-only) when vision is unavailable, still returning default neckline/gender/details', async () => {
    aiProvider.generateVision.mockResolvedValue({ available: false, provider: '', text: '' });

    const meta = await analyzeWardrobeImage(VALID_URL, 'tops');

    expect(meta.neckline).toBe('');
    expect(meta.genderCategory).toBe('');
    expect(meta.details).toEqual({
      hasHood: false, hasButtons: false, hasZipper: false, hasPockets: false,
      hasLogo: false, hasBelt: false, isTransparent: false,
    });
    expect(meta.aiMeta.provider).toBe('color-only');
  });

  test('never throws on a malformed JSON vision response', async () => {
    aiProvider.generateVision.mockResolvedValue({ available: true, provider: 'gemini', text: 'not json at all' });

    const meta = await analyzeWardrobeImage(VALID_URL, 'tops');

    expect(meta.aiMeta.provider).toBe('color-only');
    expect(meta.neckline).toBe('');
  });

  test('isCompleteOutfit:true (e.g. a co-ord set) passes through and is flagged for review', async () => {
    aiProvider.generateVision.mockResolvedValue({
      available: true,
      provider: 'gemini',
      text: JSON.stringify({
        subcategory: 'co-ord set', pattern: 'solid', sleeveLength: 'short', fit: 'regular',
        materialGuess: 'cotton', styleTags: ['classic'], suitableSeasons: ['all'],
        suitableOccasions: ['office'], formalityLevel: 2, layeringLevel: 'base',
        accessoryCompatibility: [], neckline: 'round', genderCategory: 'women',
        isCompleteOutfit: true,
        details: { hasHood: false, hasButtons: false, hasZipper: false, hasPockets: false, hasLogo: false, hasBelt: false, isTransparent: false },
      }),
    });

    const meta = await analyzeWardrobeImage(VALID_URL, 'tops');

    expect(meta.isCompleteOutfit).toBe(true);
    expect(meta.unverifiedFields).toContain('isCompleteOutfit');
  });

  test('isCompleteOutfit:false (the ordinary case) is not flagged as needing review', async () => {
    aiProvider.generateVision.mockResolvedValue({
      available: true,
      provider: 'gemini',
      text: JSON.stringify({
        subcategory: 'shirt', pattern: 'solid', sleeveLength: 'short', fit: 'regular',
        materialGuess: 'cotton', styleTags: ['classic'], suitableSeasons: ['all'],
        suitableOccasions: ['office'], formalityLevel: 2, layeringLevel: 'base',
        accessoryCompatibility: [], neckline: 'round', genderCategory: 'women',
        isCompleteOutfit: false,
        details: { hasHood: false, hasButtons: false, hasZipper: false, hasPockets: false, hasLogo: false, hasBelt: false, isTransparent: false },
      }),
    });

    const meta = await analyzeWardrobeImage(VALID_URL, 'tops');

    expect(meta.isCompleteOutfit).toBe(false);
    expect(meta.unverifiedFields).not.toContain('isCompleteOutfit');
  });
});

describe('visionExtractionService.analyzeWardrobeImage — texture / silhouette / weatherSuitability / culturalCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    colorSvc.extractColors.mockResolvedValue({ dominant: '#111111', secondary: '', palette: ['#111111'], namedColors: ['black'] });
    axios.get.mockResolvedValue({ data: Buffer.from('fake-image-bytes'), headers: { 'content-type': 'image/jpeg' } });
  });

  test('returns sanitized texture/silhouette/weatherSuitability/culturalCategory on a successful vision response', async () => {
    aiProvider.generateVision.mockResolvedValue({
      available: true,
      provider: 'gemini',
      text: JSON.stringify({
        subcategory: 'blouse', pattern: 'solid', sleeveLength: 'short', fit: 'regular',
        materialGuess: 'cotton', styleTags: ['classic'], suitableSeasons: ['all'],
        suitableOccasions: ['office'], formalityLevel: 2, layeringLevel: 'base',
        accessoryCompatibility: [], neckline: 'v_neck', genderCategory: 'women',
        texture: 'woven', silhouette: 'fitted', weatherSuitability: 'mild', culturalCategory: 'western',
        details: { hasHood: false, hasButtons: true, hasZipper: false, hasPockets: false, hasLogo: false, hasBelt: false, isTransparent: false },
        confidence: { texture: 0.8, silhouette: 0.7, weatherSuitability: 0.9, culturalCategory: 0.6 },
      }),
    });

    const meta = await analyzeWardrobeImage(VALID_URL, 'tops');

    expect(meta.texture).toBe('woven');
    expect(meta.silhouette).toBe('fitted');
    expect(meta.weatherSuitability).toBe('mild');
    expect(meta.culturalCategory).toBe('western');
    expect(meta.unverifiedFields).toEqual(expect.arrayContaining(['texture', 'silhouette', 'weatherSuitability', 'culturalCategory']));
  });

  test('rejects invalid texture/silhouette/weatherSuitability/culturalCategory values rather than passing them through', async () => {
    aiProvider.generateVision.mockResolvedValue({
      available: true,
      provider: 'gemini',
      text: JSON.stringify({
        subcategory: '', pattern: '', sleeveLength: '', fit: '', materialGuess: '',
        styleTags: [], suitableSeasons: [], suitableOccasions: [], formalityLevel: null,
        layeringLevel: '', accessoryCompatibility: [], neckline: '', genderCategory: '',
        texture: 'not_a_real_texture', silhouette: 'not_a_real_silhouette',
        weatherSuitability: 'not_a_real_weather', culturalCategory: 'not_a_real_culture',
        details: {},
      }),
    });

    const meta = await analyzeWardrobeImage(VALID_URL, 'tops');

    expect(meta.texture).toBe('');
    expect(meta.silhouette).toBe('');
    expect(meta.weatherSuitability).toBe('');
    expect(meta.culturalCategory).toBe('');
  });

  test('degrades gracefully (color-only) when vision is unavailable, still returning default values for the 4 new fields', async () => {
    aiProvider.generateVision.mockResolvedValue({ available: false, provider: '', text: '' });

    const meta = await analyzeWardrobeImage(VALID_URL, 'tops');

    expect(meta.texture).toBe('');
    expect(meta.silhouette).toBe('');
    expect(meta.weatherSuitability).toBe('');
    expect(meta.culturalCategory).toBe('');
  });
});
