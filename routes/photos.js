const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const Photo = require('../models/Photo');
const { uploadImage, deleteImage, getImageUrl, SUPPORTED_FORMATS } = require('../utils/cloudflare');

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/temp'));
  },
  filename: function(req, file, cb) {
    // Create a unique filename with timestamp and original extension
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
    cb(null, fileName);
  }
});

// File filter for multer to accept only images supported by Cloudflare
const fileFilter = (req, file, cb) => {
  // Check if the file is an image
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  
  // Check if the file extension is supported by Cloudflare
  const ext = path.extname(file.originalname).toLowerCase();
  if (!SUPPORTED_FORMATS.includes(ext)) {
    return cb(new Error(`Unsupported image format. Cloudflare Images supports: ${SUPPORTED_FORMATS.join(', ')}`), false);
  }
  
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit (Cloudflare max size)
  }
});

// GET all photos with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, floorId } = req.query;
    
    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (floorId) filter.floorId = floorId;
    
    const photos = await Photo.find(filter).sort({ submittedAt: -1 });
    
    res.json(photos);
  } catch (err) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ error: 'Server error fetching photos' });
  }
});

// POST a new photo
router.post('/upload', upload.single('imageFile'), async (req, res) => {
  try {
    console.log('Upload request received:', {
      headers: req.headers,
      filePresent: !!req.file,
      body: { ...req.body, imageFile: req.file ? '(file present)' : '(no file)' }
    });
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { contributor, floorId, roomId } = req.body;

    if (!contributor || !floorId) {
      return res.status(400).json({ 
        error: 'Please provide contributor name and floor ID' 
      });
    }

    // Format date as "Mon YYYY"
    const date = new Date().toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    // Create metadata for Cloudflare
    const metadata = JSON.stringify({
      contributor,
      floorId,
      roomId: roomId || '',
      date
    });

    // Get temporary file path
    const tempFilePath = path.join(__dirname, '../uploads/temp', req.file.filename);
    console.log('Temporary file path:', tempFilePath);
    
    // Upload image to Cloudflare
    try {
      const cloudflareResponse = await uploadImage(tempFilePath, metadata);
      
      if (!cloudflareResponse.success) {
        throw new Error('Failed to upload image to Cloudflare: ' + JSON.stringify(cloudflareResponse));
      }
      
      const cloudflareId = cloudflareResponse.result.id;
      const imageUrl = getImageUrl(cloudflareId);

      // Create new photo entry in database
      const newPhoto = new Photo({
        contributor,
        date,
        floorId,
        roomId: roomId || undefined,
        tempFilePath: `/uploads/temp/${req.file.filename}`,
        cloudflareId,
        imageUrl,
        originalFileName: req.file.originalname,
        status: 'pending'
      });

      await newPhoto.save();

      res.status(201).json({ 
        message: 'Photo uploaded and pending approval',
        photo: newPhoto
      });
    } catch (cloudflareError) {
      // Clean up temp file on error
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (unlinkError) {
        console.error('Error deleting temp file:', unlinkError);
      }
      
      throw cloudflareError;
    }
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ 
      error: err.message || 'Server error during upload',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Test upload endpoint - simpler version for testing CORS
router.post('/test-upload', upload.single('imageFile'), (req, res) => {
  try {
    console.log('Test upload request received');
    console.log('Headers:', req.headers);
    console.log('File:', req.file ? 'Present' : 'Not present');
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file in request' });
    }
    
    res.status(200).json({
      message: 'File received successfully',
      fileName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (err) {
    console.error('Test upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT approve a photo
router.put('/:id/approve', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    if (photo.status === 'approved') {
      return res.status(400).json({ error: 'Photo already approved' });
    }
    
    // Update the photo record
    photo.status = 'approved';
    photo.approvedAt = new Date();
    
    await photo.save();
    
    // Clean up temp file if it exists
    if (photo.tempFilePath) {
      const filePath = path.join(__dirname, '..', photo.tempFilePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        photo.tempFilePath = undefined;
        await photo.save();
      }
    }
    
    res.json({ 
      message: 'Photo approved successfully',
      photo
    });
  } catch (err) {
    console.error('Error approving photo:', err);
    res.status(500).json({ error: 'Server error approving photo' });
  }
});

// PUT reject a photo
router.put('/:id/reject', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    if (photo.status === 'rejected') {
      return res.status(400).json({ error: 'Photo already rejected' });
    }
    
    // Delete the image from Cloudflare
    if (photo.cloudflareId) {
      try {
        await deleteImage(photo.cloudflareId);
      } catch (cloudflareErr) {
        console.error('Failed to delete from Cloudflare:', cloudflareErr);
        // Continue even if Cloudflare deletion fails
      }
    }
    
    // Delete the temp file if it exists
    if (photo.tempFilePath) {
      const filePath = path.join(__dirname, '..', photo.tempFilePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Update the photo record
    photo.status = 'rejected';
    photo.tempFilePath = undefined;
    
    await photo.save();
    
    res.json({ 
      message: 'Photo rejected successfully',
      photo
    });
  } catch (err) {
    console.error('Error rejecting photo:', err);
    res.status(500).json({ error: 'Server error rejecting photo' });
  }
});

// GET supported image formats
router.get('/formats', (req, res) => {
  res.json({
    supported_formats: SUPPORTED_FORMATS,
    max_file_size: '10MB',
    message: 'These formats are supported by Cloudflare Images'
  });
});

// POST a new photo - simplified for direct upload
router.post('/direct-upload', upload.single('imageFile'), async (req, res) => {
  try {
    console.log('Direct upload request received');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('File present:', !!req.file);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get essential form data
    const contributor = req.body.contributor || 'Anonymous';
    const floorId = req.body.floorId || 'Unknown';
    const roomId = req.body.roomId || '';
    
    // Format date 
    const date = new Date().toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    // Simple metadata
    const metadata = JSON.stringify({ contributor, floorId, roomId, date });

    // Get temp file path
    const tempFilePath = path.join(__dirname, '../uploads/temp', req.file.filename);
    console.log('File saved to:', tempFilePath);
    
    try {
      // Upload to Cloudflare
      const cloudflareResponse = await uploadImage(tempFilePath, metadata);
      
      if (!cloudflareResponse.success) {
        throw new Error('Failed to upload to Cloudflare');
      }
      
      const cloudflareId = cloudflareResponse.result.id;
      const imageUrl = getImageUrl(cloudflareId);
      
      // Create new photo record
      const newPhoto = new Photo({
        contributor,
        date,
        floorId,
        roomId: roomId || undefined,
        cloudflareId,
        imageUrl,
        originalFileName: req.file.originalname,
        status: 'pending'
      });
      
      await newPhoto.save();
      
      // Clean up temp file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error('Error deleting temp file:', err);
      }
      
      return res.status(201).json({
        success: true,
        message: 'Photo uploaded successfully',
        photo: {
          id: newPhoto._id,
          imageUrl,
          status: 'pending'
        }
      });
    } catch (error) {
      console.error('Cloudflare upload error:', error);
      
      // Clean up temp file on error
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error('Error deleting temp file:', err);
      }
      
      throw error;
    }
  } catch (err) {
    console.error('Direct upload error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Server error during upload'
    });
  }
});

// CORS status check endpoint
router.get('/cors-check', (req, res) => {
  // Explicitly set CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  res.json({
    corsStatus: 'ok',
    message: 'CORS headers are being set correctly',
    receivedOrigin: req.headers.origin || 'none',
    timestamp: new Date().toISOString(),
    headers: {
      sent: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
      },
      received: req.headers
    }
  });
});

module.exports = router; 