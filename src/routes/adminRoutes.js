import express from "express";
import {
  getSupervisionDashboard,
  getDealerApplications,
  reviewDealerApplication,
  updateDealerStatusDirect,
  clearMockData,
  getIndexedEvents,
  getSystemHealth,
  getDealersAnalytics,
  getDealerInventory,
  penalizeDealer,
  liftPenalty,
  deleteDealer,
} from "../controllers/adminController.js";
import { optionalAuth } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";

const router = express.Router();

// System health check
router.get("/health", getSystemHealth);

// Protocol administration routes with optionalAuth
router.use(optionalAuth);

// Live Read Endpoints
router.get("/dashboard", getSupervisionDashboard);
router.get("/applications", getDealerApplications);
router.get("/dealers-analytics", getDealersAnalytics);
router.get("/dealers/:address/inventory", getDealerInventory);
router.get("/events", getIndexedEvents);

// Administrative Action Endpoints
router.put("/applications/:id", validate(schemas.reviewDealerApplication), reviewDealerApplication);
router.post("/dealers/status", validate(schemas.updateDealerStatusDirect), updateDealerStatusDirect);
router.post("/dealers/penalize", penalizeDealer);
router.post("/dealers/lift-penalty", liftPenalty);
router.delete("/dealers/:address", deleteDealer);
router.delete("/mock-data", clearMockData);

export default router;

