import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/omsahuvastralaya';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error(`⚠️ Please ensure MongoDB is running or configure MONGODB_URI in your .env file.`);
    return null;
  }
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}
