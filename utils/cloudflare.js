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
  // Check if the file format is supported
  if (!isFormatSupported(filePath)) {
    throw new Error(`Unsupported image format. Cloudflare Images supports: ${SUPPORTED_FORMATS.join(', ')}`);
  }

  const formData = new FormData();
  
  // Stream the file data
  const fileStream = fs.createReadStream(filePath);
  formData.append('file', fileStream);
  
  if (metadata) {
    formData.append('metadata', metadata);
  }

  try {
    // Log upload details
    console.log(`Uploading image to Cloudflare: ${filePath}`);
    
    const response = await axios.post(CLOUDFLARE_API_URL, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    
    console.log(`Upload successful: ${response.data.success}`);
    return response.data;
  } catch (error) {
    console.error('Error uploading to Cloudflare Images:', error.message);
    
    // Enhanced error handling with more specific messages
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      console.error(`Cloudflare API Error (${status}):`, data);
      
      if (status === 415) {
        throw new Error(`Unsupported media type. Cloudflare Images supports: ${SUPPORTED_FORMATS.join(', ')}`);
      } else if (status === 413) {
        throw new Error('File too large. Maximum file size is 10MB.');
      } else if (data && data.errors && data.errors.length > 0) {
        throw new Error(`Cloudflare API Error: ${data.errors[0].message}`);
      }
    }
    
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
  getImageUrl,
  SUPPORTED_FORMATS // Export supported formats for use in frontend validation
}; 