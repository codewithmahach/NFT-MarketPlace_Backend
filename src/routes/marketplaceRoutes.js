import express from "express";
import {
  getActiveListings,
  getListingById,
  verifyPurchase,
  getUserListings,
  syncListing,
} from "../controllers/marketplaceController.js";
import { optionalAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/listings", optionalAuth, getActiveListings);
router.get("/listings/:listingId", optionalAuth, getListingById);
router.post("/verify-purchase", verifyPurchase);
router.post("/sync-listing", optionalAuth, syncListing);
router.get("/user/:address", getUserListings);

export default router;
