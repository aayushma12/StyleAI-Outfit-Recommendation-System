// Image uploads now go directly from the browser to Cloudinary
// using an unsigned upload preset (see frontend/.env for config).
// This route is kept for potential future server-side operations.
const express = require('express');
const router  = express.Router();

router.get('/config', (req, res) => {
  res.json({
    cloudName:    process.env.CLOUDINARY_CLOUD_NAME,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
  });
});

module.exports = router;
