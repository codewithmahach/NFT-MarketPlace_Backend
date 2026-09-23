import express from "express";
import authRoutes from "./authRoutes.js";
import nftRoutes from "./nftRoutes.js";
import marketplaceRoutes from "./marketplaceRoutes.js";
import auctionRoutes from "./auctionRoutes.js";
import orderRoutes from "./orderRoutes.js";
import loyaltyRoutes from "./loyaltyRoutes.js";
import dealerRoutes from "./dealerRoutes.js";
import adminRoutes from "./adminRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import { successResponse } from "../utils/response.js";
import { CONTRACT_ADDRESSES } from "../config/constants.js";

const router = express.Router();

// Root API Status & Discovery Endpoint
router.get("/", (req, res) => {
  return successResponse(res, "ChainArt NFT Marketplace API is operational.", {
    name: "ChainArt Protocol Backend",
    version: "1.0.0",
    network: "Ethereum Sepolia",
    chainId: 11155111,
    contracts: CONTRACT_ADDRESSES,
    endpoints: {
      auth: "/api/auth",
      nfts: "/api/nfts",
      marketplace: "/api/marketplace",
      auctions: "/api/auctions",
      orders: "/api/orders",
      loyalty: "/api/loyalty",
      dealers: "/api/dealers",
      admin: "/api/admin",
      notifications: "/api/notifications",
    },
  });
});

router.use("/auth", authRoutes);
router.use("/nfts", nftRoutes);
router.use("/marketplace", marketplaceRoutes);
router.use("/auctions", auctionRoutes);
router.use("/orders", orderRoutes);
router.use("/loyalty", loyaltyRoutes);
router.use("/dealers", dealerRoutes);
router.use("/admin", adminRoutes);
router.use("/notifications", notificationRoutes);

export default router;
