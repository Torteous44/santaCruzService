const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

// Import routes
const photoRoutes = require('./routes/photos');
const adminRoutes = require('./routes/admin');

// Import database connection
const { connectToDatabase } = require('./utils/database');

// Initialize Express app
const app = express();

// ABSOLUTE HIGHEST PRIORITY: CORS HEADERS FOR EVERYTHING
// This simple middleware will add CORS headers to EVERY response
// It runs before any other middleware or route handlers
app.use((req, res, next) => {
  // Allow ANY origin, method, and header
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Log environment configuration
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Server configured to use port: ${process.env.PORT || 3000}`);

// CORS Configuration
// Allow all origins in development, specific origins in production
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL, 'https://santacruzarchive.netlify.app', 'https://santacruzarchive.com', 'https://santacruz.onrender.com', 'https://www.santacruzarchive.net', 'https://santacruzarchive.net']
  : ['http://localhost:3000', 'http://localhost:5173', process.env.FRONTEND_URL];

console.log('CORS allowed origins:', allowedOrigins.filter(Boolean));

// Use the cors package as a fallback
app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*',
  exposedHeaders: '*',
  credentials: true
}));

// Increase the limit for JSON and URL-encoded payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize database connection
connectToDatabase().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

// Database connection check middleware
app.use((req, res, next) => {
  // Skip the check for health check endpoint
  if (req.url === '/api/admin/healthcheck') {
    return next();
  }
  
  // Check if database is connected before proceeding with the request
  if (mongoose.connection.readyState !== 1) {
    console.error('Database not connected! Request to', req.url);
    
    // Still set CORS headers even for error responses
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    
    return res.status(503).json({ 
      error: 'Service unavailable', 
      message: 'Database connection not established',
      cors: 'enabled'
    });
  }
  
  next();
});

// Routes
app.use('/api/photos', photoRoutes);
app.use('/api/admin', adminRoutes);

// Base API route
app.get('/api', (req, res) => {
  res.json({
    message: 'Santa Cruz Archive API',
    version: '1.0',
    endpoints: [
      '/api/photos',
      '/api/photos/upload',
      '/api/photos/formats',
      '/api/photos/cors-check',
      '/api/photos/approved',
      '/api/admin/healthcheck',
      '/api/admin/debug',
      '/api/admin/photos/pending',
      '/api/admin/photos/stats'
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `The requested resource '${req.originalUrl}' does not exist`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // Special handling for CORS errors
  if (err.message.includes('CORS')) {
    console.error('CORS Error Details:', {
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
      headers: req.headers
    });
    
    return res.status(403).json({
      error: 'CORS Error',
      message: err.message,
      origin: req.headers.origin,
      allowedOrigins: allowedOrigins.filter(Boolean)
    });
  }
  
  res.status(500).json({
    error: 'Server Error',
    message: err.message
  });
});

// Start server
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
}); 