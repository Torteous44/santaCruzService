const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Load Cloudflare credentials from environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_IMAGES_API_KEY;
const CLOUDFLARE_ACCOUNT_HASH = process.env.CLOUDFLARE_ACCOUNT_HASH;

// Cloudflare API base URL
const CLOUDFLARE_API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`;

/**
 * Upload an image to Cloudflare Images
 * @param {string} filePath - Path to the image file
 * @param {string} metadata - Optional metadata as JSON string
 * @returns {Promise<object>} - Cloudflare API response
 */
async function uploadImage(filePath, metadata = '') {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  
  if (metadata) {
    formData.append('metadata', metadata);
  }

  try {
    const response = await axios.post(CLOUDFLARE_API_URL, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading to Cloudflare Images:', error.message);
    throw error;
  }
}

/**
 * Delete an image from Cloudflare Images
 * @param {string} imageId - Cloudflare image ID
 * @returns {Promise<object>} - Cloudflare API response
 */
async function deleteImage(imageId) {
  try {
    const response = await axios.delete(`${CLOUDFLARE_API_URL}/${imageId}`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting from Cloudflare Images:', error.message);
    throw error;
  }
}

/**
 * Generate a delivery URL for a Cloudflare image
 * @param {string} imageId - Cloudflare image ID
 * @param {string} variant - Delivery variant (default: 'public')
 * @returns {string} - Image delivery URL
 */
function getImageUrl(imageId, variant = 'public') {
  return `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_HASH}/${imageId}/${variant}`;
}

module.exports = {
  uploadImage,
  deleteImage,
  getImageUrl
}; 