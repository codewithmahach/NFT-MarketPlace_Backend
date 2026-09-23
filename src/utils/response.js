/**
 * Standard API Response Structure
 * All API responses will adhere to this format:
 * {
 *   success: true | false,
 *   message: "Human-readable summary",
 *   data: { ... } | [ ... ] | null,
 *   error: { code: string, details: any } | null,
 *   timestamp: ISO string
 * }
 */

export const successResponse = (res, message = "Success", data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    error: null,
    timestamp: new Date().toISOString(),
  });
};

export const errorResponse = (
  res,
  message = "An error occurred",
  errorDetails = null,
  statusCode = 500,
  errorCode = "INTERNAL_ERROR"
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    error: {
      code: errorCode,
      details: errorDetails,
    },
    timestamp: new Date().toISOString(),
  });
};
