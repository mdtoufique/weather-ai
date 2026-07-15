/**
 * MongoDB connection helper via Mongoose.
 * @module utils/db
 */

import mongoose from 'mongoose';

/**
 * Establish a connection to MongoDB using MONGO_URI.
 * Logs success or failure; exits the process if connection fails at boot.
 * @returns {Promise<void>}
 */
export async function connectDb() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

/**
 * Gracefully disconnect from MongoDB.
 * @returns {Promise<void>}
 */
export async function disconnectDb() {
  await mongoose.disconnect();
}
