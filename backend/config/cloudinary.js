const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
  // SHA-256 signing (required for Cloudinary accounts created after 2023).
  // If uploads fail with "Invalid Signature" and your account was created earlier,
  // remove the line below so the SDK falls back to SHA-1.
  signature_algorithm: 'sha256',
});

module.exports = cloudinary;
