import express from "express";
import { getNonce, verifySignature, getMe, updateProfile } from "../controllers/authController.js";
import { authenticateJWT } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Public auth endpoints
router.post("/nonce", authLimiter, validate(schemas.getNonce), getNonce);
router.post("/verify", authLimiter, validate(schemas.verifySignature), verifySignature);

// Protected auth endpoints
router.get("/me", authenticateJWT, getMe);
router.put("/profile", authenticateJWT, validate(schemas.updateProfile), updateProfile);

export default router;
