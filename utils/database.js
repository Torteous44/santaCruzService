const mongoose = require('mongoose');

// Connection details
const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Connect to MongoDB database
 * @returns {Promise} Mongoose connection
 */
async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

module.exports = {
  connectToDatabase
}; 