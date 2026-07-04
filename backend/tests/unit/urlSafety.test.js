'use strict';

const { isAllowedImageUrl } = require('../../utils/urlSafety');

describe('urlSafety.isAllowedImageUrl (SSRF guard)', () => {
  test('accepts a real Cloudinary-hosted image URL', () => {
    expect(isAllowedImageUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(true);
  });

  test('rejects cloud metadata endpoints', () => {
    expect(isAllowedImageUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  test('rejects internal/localhost services', () => {
    expect(isAllowedImageUrl('http://localhost:8000/internal')).toBe(false);
    expect(isAllowedImageUrl('http://localhost:27017/')).toBe(false);
    expect(isAllowedImageUrl('http://127.0.0.1:5000/api/admin')).toBe(false);
  });

  test('rejects non-http(s) protocols', () => {
    expect(isAllowedImageUrl('file:///etc/passwd')).toBe(false);
  });

  test('rejects domain-spoofing attempts', () => {
    // Cloudinary hostname appearing as a path segment on an attacker's domain.
    expect(isAllowedImageUrl('https://evil.com/res.cloudinary.com')).toBe(false);
    // Cloudinary hostname as a prefix of an attacker-controlled subdomain.
    expect(isAllowedImageUrl('https://res.cloudinary.com.evil.com/x')).toBe(false);
  });

  test('rejects malformed or empty input without throwing', () => {
    expect(isAllowedImageUrl('not-a-url')).toBe(false);
    expect(isAllowedImageUrl('')).toBe(false);
    expect(isAllowedImageUrl(undefined)).toBe(false);
  });
});
