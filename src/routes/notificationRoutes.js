import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController.js";
import { authenticateJWT, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", optionalAuth, getNotifications);
router.put("/:id/read", authenticateJWT, markAsRead);
router.put("/read-all", authenticateJWT, markAllAsRead);

export default router;
