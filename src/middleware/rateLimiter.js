import rateLimit from "express-rate-limit";
import { errorResponse } from "../utils/response.js";
import { ERROR_CODES } from "../config/constants.js";

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10); // 15 mins
const maxGeneral = parseInt(process.env.RATE_LIMIT_MAX || "500", 10);
const maxAuth = parseInt(process.env.AUTH_RATE_LIMIT_MAX || "50", 10);

export const generalLimiter = rateLimit({
  windowMs,
  max: maxGeneral,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(
      res,
      "Too many requests from this IP. Please try again later.",
      null,
      429,
      ERROR_CODES.RATE_LIMIT_EXCEEDED
    );
  },
});

export const authLimiter = rateLimit({
  windowMs,
  max: maxAuth,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(
      res,
      "Too many authentication attempts. Please try again later.",
      null,
      429,
      ERROR_CODES.RATE_LIMIT_EXCEEDED
    );
  },
});

export const dealershipLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(
      res,
      "Too many dealership application submissions. Please try again later.",
      null,
      429,
      ERROR_CODES.RATE_LIMIT_EXCEEDED
    );
  },
});
