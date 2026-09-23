import { errorResponse } from "../utils/response.js";
import { ERROR_CODES, ROLES } from "../config/constants.js";
import { getContractInstance } from "../config/contracts.js";
import { User } from "../models/User.js";
import { logger } from "../utils/logger.js";

/**
 * Check if an address has dealer status on-chain or in DB
 */
export const checkOnChainDealer = async (address) => {
  try {
    const nftContract = getContractInstance("nft");
    const hasRole = await nftContract.hasRole(ROLES.DEALER_ROLE, address);
    return hasRole;
  } catch (error) {
    logger.warn(`Failed to check on-chain dealer role for ${address}: ${error.message}`);
    return false;
  }
};

/**
 * Check if an address has admin status on-chain or in DB
 */
export const checkOnChainAdmin = async (address) => {
  try {
    const nftContract = getContractInstance("nft");
    const isDefaultAdmin = await nftContract.hasRole(ROLES.DEFAULT_ADMIN_ROLE, address);
    if (isDefaultAdmin) return true;
    const isAdmin = await nftContract.hasRole(ROLES.ADMIN_ROLE, address);
    return isAdmin;
  } catch (error) {
    logger.warn(`Failed to check on-chain admin role for ${address}: ${error.message}`);
    return false;
  }
};

/**
 * Middleware: Require Dealer role
 */
export const requireDealer = async (req, res, next) => {
  if (!req.user || !req.user.address) {
    return errorResponse(res, "Authentication required.", null, 401, ERROR_CODES.UNAUTHORIZED);
  }

  const address = req.user.address;

  // 1. Check if user has admin privileges (admins can do dealer actions)
  if (req.user.isAdmin) {
    return next();
  }

  // 2. Check cached DB role
  if (req.user.isDealer) {
    return next();
  }

  // 3. Fallback: Query live blockchain
  const onChainDealer = await checkOnChainDealer(address);
  if (onChainDealer) {
    // Update DB record
    await User.findOneAndUpdate({ address }, { isDealer: true }, { upsert: true });
    req.user.isDealer = true;
    return next();
  }

  return errorResponse(
    res,
    "Access denied. Verified Dealer role required.",
    { address, requiredRole: "DEALER_ROLE" },
    403,
    ERROR_CODES.FORBIDDEN
  );
};

/**
 * Middleware: Require Admin role
 */
export const requireAdmin = async (req, res, next) => {
  if (!req.user || !req.user.address) {
    return errorResponse(res, "Authentication required.", null, 401, ERROR_CODES.UNAUTHORIZED);
  }

  const address = req.user.address;

  // 1. Check cached DB role
  if (req.user.isAdmin) {
    return next();
  }

  // 2. Fallback: Query live blockchain
  const onChainAdmin = await checkOnChainAdmin(address);
  if (onChainAdmin) {
    // Update DB record
    await User.findOneAndUpdate({ address }, { isAdmin: true }, { upsert: true });
    req.user.isAdmin = true;
    return next();
  }

  return errorResponse(
    res,
    "Access denied. Protocol Administrator role required.",
    { address, requiredRole: "ADMIN_ROLE" },
    403,
    ERROR_CODES.FORBIDDEN
  );
};
