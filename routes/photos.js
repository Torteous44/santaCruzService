const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const Photo = require('../models/Photo');
const { uploadImage, deleteImage, getImageUrl } = require('../utils/cloudflare');

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

// File filter for multer to accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
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
    
    // Upload image to Cloudflare
    const cloudflareResponse = await uploadImage(tempFilePath, metadata);
    
    if (!cloudflareResponse.success) {
      throw new Error('Failed to upload image to Cloudflare');
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
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Server error during upload' });
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

module.exports = router; 