const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Load Cloudflare credentials from environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_IMAGES_API_KEY;
const CLOUDFLARE_ACCOUNT_HASH = process.env.CLOUDFLARE_ACCOUNT_HASH;

// Cloudflare API base URL
const CLOUDFLARE_API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`;

// Supported image formats by Cloudflare Images
const SUPPORTED_FORMATS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.svg', '.avif'
];

/**
 * Check if the file format is supported by Cloudflare Images
 * @param {string} filePath - Path to the image file
 * @returns {boolean} - Whether the format is supported
 */
function isFormatSupported(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_FORMATS.includes(ext);
}

/**
 * Upload an image to Cloudflare Images
 * @param {string} filePath - Path to the image file
 * @param {string} metadata - Optional metadata as JSON string
 * @returns {Promise<object>} - Cloudflare API response
 */
async function uploadImage(filePath, metadata = '') {
  try {
    // Basic validation
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Create form data
    const formData = new FormData();
    const fileStream = fs.createReadStream(filePath);
    
    // Add file with basic name
    formData.append('file', fileStream);
    
    if (metadata) {
      formData.append('metadata', metadata);
    }

    // Make API request with simple configuration
    const response = await axios.post(CLOUDFLARE_API_URL, formData, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
      },
      maxBodyLength: Infinity,
      timeout: 30000, // 30 second timeout
    });
    
    return response.data;
  } catch (error) {
    console.error('Cloudflare upload error:', error.message);
    throw new Error('Error uploading to Cloudflare: ' + error.message);
  }
}

/**
 * Get the MIME type based on file extension
 * @param {string} filePath - Path to the file
 * @returns {string} - MIME type
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
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
  getImageUrl,
  SUPPORTED_FORMATS // Export supported formats for use in frontend validation
}; 