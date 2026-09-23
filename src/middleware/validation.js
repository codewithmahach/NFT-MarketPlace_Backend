import Joi from "joi";
import { errorResponse } from "../utils/response.js";
import { ERROR_CODES } from "../config/constants.js";

/**
 * Generic schema validation middleware generator
 */
export const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        message: detail.message.replace(/['"]/g, ""),
        path: detail.path.join("."),
      }));

      return errorResponse(
        res,
        "Validation failed. Please check your request parameters.",
        details,
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    req[property] = value;
    next();
  };
};

// Reusable Ethereum Address Validator
const ethAddress = Joi.string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .message("Must be a valid Ethereum hexadecimal address");

// Schemas
export const schemas = {
  getNonce: Joi.object({
    address: ethAddress.required(),
  }),

  verifySignature: Joi.object({
    address: ethAddress.required(),
    signature: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    username: Joi.string().max(50).allow(""),
    bio: Joi.string().max(500).allow(""),
    avatar: Joi.string().uri().allow(""),
    email: Joi.string().email().allow(""),
    preferences: Joi.object({
      emailNotifications: Joi.boolean(),
      bidAlerts: Joi.boolean(),
      priceChangeAlerts: Joi.boolean(),
    }),
  }),

  dealerApplication: Joi.object({
    applicantAddress: ethAddress.required(),
    businessName: Joi.string().min(2).max(100).required(),
    contactPerson: Joi.string().max(100).allow(""),
    email: Joi.string().email().required(),
    phone: Joi.string().max(30).allow(""),
    category: Joi.string().required(),
    yearsInBusiness: Joi.string().max(20).allow(""),
    website: Joi.string().uri().allow(""),
    socialLinks: Joi.object({
      instagram: Joi.string().allow(""),
      twitter: Joi.string().allow(""),
      linkedin: Joi.string().allow(""),
    }),
    physicalStoreAddress: Joi.string().max(250).allow(""),
    provenanceProcess: Joi.string().max(1000).allow(""),
    inventoryEstimatedValue: Joi.string().max(50).allow(""),
  }),

  reviewDealerApplication: Joi.object({
    status: Joi.string().valid("approved", "rejected").required(),
    reviewNotes: Joi.string().max(500).allow(""),
    approvalTxHash: Joi.string().allow(""),
  }),

  updateDealerStatusDirect: Joi.object({
    address: ethAddress.required(),
    status: Joi.boolean().required(),
  }),
};
