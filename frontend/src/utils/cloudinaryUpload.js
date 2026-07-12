import axios from 'axios';

// Uploads a File directly to Cloudinary via the app's unsigned upload preset.
// Shared by ItemModal (footwear/accessory + edit flows) and FastAddModal (the
// fast Top/Bottom/Dress flow) so both paths use identical config/error handling.
export async function uploadWardrobeImage(file, { folder = 'styleai/wardrobe', onProgress } = {}) {
  const cloudName    = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    const err = new Error('Image upload is not configured. Please contact the administrator.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', uploadPreset);
  fd.append('folder', folder);

  try {
    const { data } = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      fd,
      { onUploadProgress: e => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))) }
    );
    return { imageUrl: data.secure_url, publicId: data.public_id || '' };
  } catch (err) {
    const cloudMsg = err.response?.data?.error?.message || '';
    const isPreset = cloudMsg.toLowerCase().includes('preset') || cloudMsg.toLowerCase().includes('upload_preset');
    const e = new Error(
      isPreset
        ? `Upload preset "${uploadPreset}" not found. Create it as an unsigned preset on Cloudinary.`
        : 'Image upload failed. Please try again.'
    );
    e.code = isPreset ? 'PRESET_MISSING' : 'UPLOAD_FAILED';
    throw e;
  }
}
