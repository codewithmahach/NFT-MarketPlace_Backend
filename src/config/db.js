import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

let isConnected = false;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chainart_marketplace";

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });

    isConnected = true;
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Attempting reconnection...");
      isConnected = false;
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected.");
      isConnected = true;
    });

    return conn;
  } catch (error) {
    logger.error(`❌ MongoDB initial connection failed: ${error.message}`);
    logger.warn("⚠️ Running in standby database mode. Ensure MongoDB is running on mongodb://127.0.0.1:27017/chainart_marketplace");
    // Don't crash process, allow server to serve read/status endpoints and retry in background
    return null;
  }
};

export const getIsConnected = () => {
  return mongoose.connection.readyState === 1 || isConnected;
};

export const disconnectDB = async () => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info("MongoDB disconnected gracefully.");
  }
};
