'use strict';

jest.mock('axios');
jest.mock('../../config/cloudinary', () => ({
  uploader: { upload: jest.fn() },
}));
jest.mock('jimp', () => {
  const instance = {
    cover:          jest.fn().mockReturnThis(),
    composite:      jest.fn().mockReturnThis(),
    getBufferAsync: jest.fn().mockResolvedValue(Buffer.from('fake-composite-bytes')),
  };
  function MockJimp() { return instance; }
  MockJimp.read = jest.fn().mockResolvedValue(instance);
  MockJimp.MIME_JPEG = 'image/jpeg';
  MockJimp.__instance = instance;
  return MockJimp;
});

const axios = require('axios');
const Jimp = require('jimp');
const cloudinary = require('../../config/cloudinary');
const { generatePreviewImage } = require('../../services/outfitPreviewService');

const VALID_URL_A = 'https://res.cloudinary.com/demo/image/upload/v1/item-a.jpg';
const VALID_URL_B = 'https://res.cloudinary.com/demo/image/upload/v1/item-b.jpg';

describe('outfitPreviewService.generatePreviewImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Jimp.read.mockResolvedValue(Jimp.__instance);
    Jimp.__instance.getBufferAsync.mockResolvedValue(Buffer.from('fake-composite-bytes'));
    cloudinary.uploader.upload.mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/preview.jpg',
      public_id:  'styleai/outfit-previews/abc123',
    });
  });

  test('returns null for an empty item list — never calls Cloudinary or fetches anything', async () => {
    const result = await generatePreviewImage([]);
    expect(result).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
  });

  test('rejects a non-Cloudinary URL before ever fetching it (SSRF guard)', async () => {
    const result = await generatePreviewImage(['https://evil-internal-host.example/x.jpg']);
    expect(axios.get).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('composites successfully fetched images and uploads the result to Cloudinary', async () => {
    axios.get.mockResolvedValue({ data: Buffer.from('raw-image-bytes') });

    const result = await generatePreviewImage([VALID_URL_A, VALID_URL_B]);

    expect(result).toEqual({
      url:      'https://res.cloudinary.com/demo/image/upload/v1/preview.jpg',
      publicId: 'styleai/outfit-previews/abc123',
    });
    expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/jpeg;base64,/),
      { folder: 'styleai/outfit-previews' }
    );
  });

  test('caps at 4 images even if more are supplied', async () => {
    axios.get.mockResolvedValue({ data: Buffer.from('raw-image-bytes') });
    await generatePreviewImage([VALID_URL_A, VALID_URL_B, VALID_URL_A, VALID_URL_B, VALID_URL_A, VALID_URL_B]);
    expect(axios.get).toHaveBeenCalledTimes(4);
  });

  test('a mix of failing and succeeding image fetches still produces a composite from whatever succeeded', async () => {
    axios.get
      .mockResolvedValueOnce({ data: Buffer.from('ok') })
      .mockRejectedValueOnce(new Error('one image unreachable'));

    const result = await generatePreviewImage([VALID_URL_A, VALID_URL_B]);

    expect(result).not.toBeNull();
    expect(result.url).toContain('cloudinary.com');
  });

  test('total fetch failure (every image unreachable) returns null without throwing', async () => {
    axios.get.mockRejectedValue(new Error('network down'));
    const result = await generatePreviewImage([VALID_URL_A, VALID_URL_B]);
    expect(result).toBeNull();
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
  });

  test('a Cloudinary upload failure returns null without throwing', async () => {
    axios.get.mockResolvedValue({ data: Buffer.from('raw-image-bytes') });
    cloudinary.uploader.upload.mockRejectedValue(new Error('cloudinary rejected the upload'));

    const result = await generatePreviewImage([VALID_URL_A]);
    expect(result).toBeNull();
  });
});
