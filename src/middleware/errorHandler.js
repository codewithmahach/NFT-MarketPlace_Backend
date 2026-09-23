import { errorResponse } from "../utils/response.js";
import { ERROR_CODES } from "../config/constants.js";
import { logger } from "../utils/logger.js";

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req, res, next) => {
  return errorResponse(
    res,
    `Resource not found: ${req.method} ${req.originalUrl}`,
    null,
    404,
    ERROR_CODES.NOT_FOUND
  );
};

/**
 * Global Centralized Error Handler
 */
export const globalErrorHandler = (err, req, res, next) => {
  logger.error(`Unhandled Error [${req.method} ${req.originalUrl}]: ${err.message}`, {
    stack: err.stack,
  });

  // Handle Mongoose Duplicate Key Error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return errorResponse(
      res,
      `A record with this ${field} already exists.`,
      err.keyValue,
      409,
      ERROR_CODES.ALREADY_EXISTS
    );
  }

  // Handle Mongoose Cast Error
  if (err.name === "CastError") {
    return errorResponse(
      res,
      `Invalid parameter format for field: ${err.path}`,
      err.value,
      400,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return errorResponse(
      res,
      "Invalid authentication token signature.",
      err.message,
      401,
      ERROR_CODES.UNAUTHORIZED
    );
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "An unexpected internal server error occurred.";

  return errorResponse(
    res,
    message,
    process.env.NODE_ENV === "development" ? err.stack : null,
    statusCode,
    err.errorCode || ERROR_CODES.INTERNAL_ERROR
  );
};
