import express from "express";
import {
  getLoyaltyProfile,
  getLeaderboard,
  verifyRewardClaim,
} from "../controllers/loyaltyController.js";
import { optionalAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/profile/:address", optionalAuth, getLoyaltyProfile);
router.get("/leaderboard", getLeaderboard);
router.post("/verify-claim", verifyRewardClaim);

export default router;
