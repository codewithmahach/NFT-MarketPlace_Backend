import express from "express";
import {
  submitApplication,
  getAllApplications,
  getMyApplication,
  getDealersList,
} from "../controllers/dealerController.js";
import { optionalAuth } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";
import { dealershipLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post(
  "/apply",
  dealershipLimiter,
  optionalAuth,
  validate(schemas.dealerApplication),
  submitApplication
);
router.get("/applications", getAllApplications);
router.get("/my-application/:address", getMyApplication);
router.get("/verified", getDealersList);

export default router;
