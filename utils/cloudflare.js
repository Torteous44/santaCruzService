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

  // Check if the file exists and is readable
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    const stats = fs.statSync(filePath);
    console.log(`File exists and is readable: ${filePath}`);
    console.log(`File size: ${stats.size} bytes`);
    
    if (stats.size > 10 * 1024 * 1024) {
      throw new Error(`File too large (${(stats.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 10MB.`);
    }
  } catch (err) {
    console.error(`File access error: ${err.message}`);
    throw new Error(`Cannot access upload file: ${err.message}`);
  }

  const formData = new FormData();
  
  // Stream the file data
  const fileStream = fs.createReadStream(filePath);
  const filename = path.basename(filePath);
  
  // Add file with explicit filename and mimetype
  formData.append('file', fileStream, {
    filename: filename,
    contentType: getMimeType(filePath)
  });
  
  if (metadata) {
    formData.append('metadata', metadata);
  }

  // Log upload details for debugging
  console.log(`Uploading image to Cloudflare: ${filePath}`);
  console.log(`File mimetype: ${getMimeType(filePath)}`);
  console.log(`Cloudflare API URL: ${CLOUDFLARE_API_URL}`);
  console.log(`API key present: ${CLOUDFLARE_API_KEY ? 'Yes' : 'No'}`);
  
  try {
    // Configure axios for detailed error handling
    const response = await axios.post(CLOUDFLARE_API_URL, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
        'Accept': 'application/json',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000, // 60 seconds timeout
      validateStatus: function (status) {
        // Log all status codes, but only reject the promise for 5xx errors
        console.log(`Cloudflare API response status: ${status}`);
        return status < 500; 
      }
    });
    
    // Log the entire response for debugging
    console.log(`Response status: ${response.status}`);
    
    if (response.status !== 200) {
      console.error('Non-200 response from Cloudflare:', response.data);
      throw new Error(`Cloudflare API error: ${response.status} ${JSON.stringify(response.data)}`);
    }
    
    console.log(`Upload successful: ${response.data.success}`);
    return response.data;
  } catch (error) {
    console.error('Error uploading to Cloudflare Images:', error.message);
    
    // Enhanced error logging
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error Response Data:', JSON.stringify(error.response.data));
      console.error('Error Response Status:', error.response.status);
      console.error('Error Response Headers:', JSON.stringify(error.response.headers));
      
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 415) {
        throw new Error(`Unsupported media type. Cloudflare Images supports: ${SUPPORTED_FORMATS.join(', ')}`);
      } else if (status === 413) {
        throw new Error('File too large. Maximum file size is 10MB.');
      } else if (data && data.errors && data.errors.length > 0) {
        throw new Error(`Cloudflare API Error: ${data.errors[0].message}`);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Error Request:', error.request);
      throw new Error('No response received from Cloudflare. The upload may have timed out.');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error Config:', error.config);
    }
    
    throw error;
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