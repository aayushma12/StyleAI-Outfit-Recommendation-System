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
});
