const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const photoRoutes = require('./routes/photos');
const adminRoutes = require('./routes/admin');

// Import database connection
const { connectToDatabase } = require('./utils/database');

// Initialize Express app
const app = express();

// Log environment configuration
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Server configured to use port: ${process.env.PORT || 3000}`);

// CORS Configuration
// Allow all origins in development, specific origins in production
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL, 'https://santacruzarchive.netlify.app', 'https://santacruzarchive.com', 'https://santacruz.onrender.com', 'https://www.santacruzarchive.net', 'https://santacruzarchive.net']
  : ['http://localhost:3000', 'http://localhost:5173', process.env.FRONTEND_URL];

console.log('CORS allowed origins:', allowedOrigins.filter(Boolean));

// Create a wildcard CORS middleware for Render deployment
app.use((req, res, next) => {
  // Set wildcard CORS headers for maximum leniency
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // For preflight OPTIONS requests, respond immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Standard CORS middleware as backup with maximum leniency
app.use(cors({
  origin: '*',
  credentials: true,
  methods: '*',
  allowedHeaders: '*',
  exposedHeaders: '*',
  maxAge: 86400,
  optionsSuccessStatus: 204,
  preflightContinue: false
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
      '/api/admin/healthcheck',
      '/api/admin/debug'
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