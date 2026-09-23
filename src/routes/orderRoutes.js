import express from "express";
import { getUserOrders, getOrderById } from "../controllers/orderController.js";
import { authenticateJWT, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/user/:address", optionalAuth, getUserOrders);
router.get("/:orderId", optionalAuth, getOrderById);

export default router;
