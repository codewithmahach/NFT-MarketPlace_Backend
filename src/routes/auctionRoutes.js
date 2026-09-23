import express from "express";
import {
  getActiveAuctions,
  getAuctionById,
  verifyBid,
  getUserAuctions,
  syncAuction,
} from "../controllers/auctionController.js";
import { optionalAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", optionalAuth, getActiveAuctions);
router.get("/:auctionId", optionalAuth, getAuctionById);
router.post("/verify-bid", verifyBid);
router.post("/sync-auction", optionalAuth, syncAuction);
router.get("/user/:address", getUserAuctions);

export default router;
