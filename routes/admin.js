const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Photo = require('../models/Photo');

// Health check endpoint
router.get('/healthcheck', async (req, res) => {
  try {
    const healthData = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      environment: process.env.NODE_ENV,
      mongodbConnected: mongoose.connection.readyState === 1,
      apiVersion: '1.0',
      serverTime: new Date().toISOString()
    };
    
    if (!healthData.mongodbConnected) {
      return res.status(503).json({
        ...healthData,
        status: 'Service Unavailable',
        message: 'Database connection is not established'
      });
    }
    
    res.json({
      ...healthData,
      status: 'OK',
      message: 'Service is healthy'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      timestamp: Date.now(),
      status: 'Error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Debug endpoint
router.get('/debug', (req, res) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongoStatus: mongoose.connection.readyState,
    mongoReadyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
    apiEndpoints: [
      { method: 'GET', path: '/api/photos', description: 'Get all photos with optional filters' },
      { method: 'POST', path: '/api/photos/upload', description: 'Upload a new photo' },
      { method: 'PUT', path: '/api/photos/:id/approve', description: 'Approve a pending photo' },
      { method: 'PUT', path: '/api/photos/:id/reject', description: 'Reject a pending photo' },
      { method: 'GET', path: '/api/admin/healthcheck', description: 'Check API health status' },
      { method: 'GET', path: '/api/admin/debug', description: 'This debug endpoint' }
    ],
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
  };
  
  res.json(debugInfo);
});

// Get all pending photos
router.get('/photos/pending', async (req, res) => {
  try {
    const pendingPhotos = await Photo.find({ status: 'pending' })
      .sort({ submittedAt: -1 });
    
    res.json(pendingPhotos);
  } catch (err) {
    console.error('Error fetching pending photos:', err);
    res.status(500).json({ 
      error: 'Server error fetching pending photos',
      message: err.message
    });
  }
});

// Get photo statistics
router.get('/photos/stats', async (req, res) => {
  try {
    const stats = await Photo.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Convert array to object with status as keys
    const statsObj = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0
    };
    
    stats.forEach(item => {
      statsObj[item._id] = item.count;
    });
    
    // Calculate total
    statsObj.total = statsObj.pending + statsObj.approved + statsObj.rejected;
    
    res.json(statsObj);
  } catch (err) {
    console.error('Error fetching photo statistics:', err);
    res.status(500).json({ 
      error: 'Server error fetching photo statistics',
      message: err.message
    });
  }
});

module.exports = router; 