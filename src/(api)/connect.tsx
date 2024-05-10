import mongoose from "mongoose";
async function connectToDatabase() {
  try {
    const dbHost = process.env.DBHOST;
    if (!dbHost) {
      throw new Error('DBHOST environment variable is not set');
    }
    await mongoose.connect(dbHost);
    console.log('Connected to the database');
  } catch (error) {
    console.error('Error connecting to the database', error);
    throw error;
  }
}

export { connectToDatabase };