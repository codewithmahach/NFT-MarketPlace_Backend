import dotenv from "dotenv";
import app from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { startIndexer, stopIndexer } from "./blockchain/indexer.js";
import { seedDatabase, fixKasheeToken5 } from "./utils/seedData.js";
import { NFT } from "./models/NFT.js";
import { logger } from "./utils/logger.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Connect Database
    const db = await connectDB();

    // 2. Token #5 Data Migration
    if (db) {
      await fixKasheeToken5();
    }

    // 3. Check if DB seeding is enabled (Disabled by default to protect on-chain data)
    if (db && process.env.ENABLE_SEED_DATA === "true") {
      const nftCount = await NFT.countDocuments();
      if (nftCount === 0) {
        logger.info("Database is empty and ENABLE_SEED_DATA=true. Populating demo NFT collections...");
        await seedDatabase();
      }
    } else if (db) {
      const nftCount = await NFT.countDocuments();
      logger.info(`Database connected with ${nftCount} NFTs. (Automatic seeding is disabled; ENABLE_SEED_DATA=${process.env.ENABLE_SEED_DATA || "false"})`);
    }

    // 3. Start HTTP Server
    const server = app.listen(PORT, () => {
      logger.info(`=======================================================`);
      logger.info(`🚀 ChainArt NFT Marketplace Backend Server Running`);
      logger.info(`📡 Port: ${PORT}`);
      logger.info(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`⛓️  Blockchain: Ethereum Sepolia (Chain ID: 11155111)`);
      logger.info(`📖 API Root: http://localhost:${PORT}/api`);
      logger.info(`=======================================================`);
    });

    // 4. Start Blockchain Event Indexer
    if (process.env.NODE_ENV !== "test") {
      startIndexer();
    }

    // 5. Graceful Shutdown Handlers
    const shutdown = async (signal) => {
      logger.warn(`Received ${signal}. Gracefully shutting down ChainArt backend...`);
      stopIndexer();
      server.close(async () => {
        logger.info("HTTP Server closed.");
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error(`Fatal error during server startup: ${error.message}`);
    process.exit(1);
  }
};

startServer();
