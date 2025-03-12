const mongoose = require('mongoose');

const PhotoSchema = new mongoose.Schema({
  contributor: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: String, // Stored as "Mon YYYY"
    required: true
  },
  floorId: {
    type: String,
    required: true
  },
  roomId: {
    type: String,
    required: false
  },
  // Original file path (temporary storage)
  tempFilePath: {
    type: String,
    required: false
  },
  // Cloudflare image ID
  cloudflareId: {
    type: String,
    required: true
  },
  // Cloudflare image URL
  imageUrl: {
    type: String,
    required: true
  },
  originalFileName: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('Photo', PhotoSchema); 