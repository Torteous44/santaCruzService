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
const PORT = process.env.PORT || 5000;

// Log environment configuration
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Server configured to use port: ${PORT}`);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', process.env.FRONTEND_URL, 'https://santacruz.onrender.com/'].filter(Boolean),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  res.status(500).json({
    error: 'Server Error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 