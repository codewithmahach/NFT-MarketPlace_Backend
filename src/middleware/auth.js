import jwt from "jsonwebtoken";
import { errorResponse } from "../utils/response.js";
import { ERROR_CODES } from "../config/constants.js";
import { User } from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "chainart_super_secure_jwt_secret_key_2026_sepolia_web3";

/**
 * Middleware: Verify JWT and attach user object
 */
export const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(
        res,
        "Authentication required. Please provide a valid Bearer token.",
        null,
        401,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || !decoded.address) {
      return errorResponse(
        res,
        "Invalid token payload.",
        null,
        401,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    // Attach basic claims immediately
    req.user = {
      address: decoded.address.toLowerCase(),
      isDealer: decoded.isDealer || false,
      isAdmin: decoded.isAdmin || false,
    };

    // Optionally fetch full user profile if needed
    try {
      const dbUser = await User.findOne({ address: req.user.address });
      if (dbUser) {
        req.user.isDealer = dbUser.isDealer;
        req.user.isAdmin = dbUser.isAdmin;
        req.user.profile = dbUser;
      }
    } catch {
      // Continue with JWT payload claims
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return errorResponse(
        res,
        "Token has expired. Please sign a new authentication nonce.",
        error.message,
        401,
        ERROR_CODES.UNAUTHORIZED
      );
    }
    return errorResponse(
      res,
      "Invalid authentication token.",
      error.message,
      401,
      ERROR_CODES.UNAUTHORIZED
    );
  }
};

/**
 * Middleware: Optional JWT authentication (doesn't fail if token is missing)
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.address) {
        req.user = {
          address: decoded.address.toLowerCase(),
          isDealer: decoded.isDealer || false,
          isAdmin: decoded.isAdmin || false,
        };
      }
    }
  } catch {
    // Ignore invalid tokens for optional endpoints
  }
  next();
};
