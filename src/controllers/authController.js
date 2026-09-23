import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import { Nonce } from "../models/Nonce.js";
import { User } from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { ERROR_CODES } from "../config/constants.js";
import { syncUserRoles, getPendingWithdrawals } from "../blockchain/verifier.js";
import { logger } from "../utils/logger.js";

const JWT_SECRET = process.env.JWT_SECRET || "chainart_super_secure_jwt_secret_key_2026_sepolia_web3";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Generate EIP-191 Nonce Challenge
 * POST /api/auth/nonce
 */
export const getNonce = async (req, res, next) => {
  try {
    const { address } = req.body;
    const cleanAddress = address.toLowerCase();

    // Generate cryptographic random nonce
    const rawNonce = crypto.randomBytes(16).toString("hex");
    const timestamp = new Date().toISOString();

    const message = [
      "Welcome to ChainArt NFT Marketplace!",
      "",
      "Please sign this message to verify your wallet ownership.",
      "This request is completely free and will not initiate a blockchain transaction.",
      "",
      `Wallet Address: ${cleanAddress}`,
      `Security Nonce: ${rawNonce}`,
      `Timestamp: ${timestamp}`,
    ].join("\n");

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save or update nonce document
    await Nonce.findOneAndUpdate(
      { address: cleanAddress },
      { nonce: rawNonce, message, expiresAt },
      { upsert: true, new: true }
    );

    return successResponse(res, "Authentication nonce generated successfully.", {
      address: cleanAddress,
      nonce: rawNonce,
      message,
      expiresAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Wallet Signature & Issue JWT
 * POST /api/auth/verify
 */
export const verifySignature = async (req, res, next) => {
  try {
    const { address, signature } = req.body;
    const cleanAddress = address.toLowerCase();

    // 1. Fetch active nonce record
    const nonceRecord = await Nonce.findOne({ address: cleanAddress });
    if (!nonceRecord) {
      return errorResponse(
        res,
        "Authentication nonce not found or expired. Please request a new nonce.",
        null,
        400,
        ERROR_CODES.NONCE_EXPIRED
      );
    }

    if (new Date() > nonceRecord.expiresAt) {
      await Nonce.deleteOne({ _id: nonceRecord._id });
      return errorResponse(
        res,
        "Authentication nonce has expired. Please request a new nonce.",
        null,
        400,
        ERROR_CODES.NONCE_EXPIRED
      );
    }

    // 2. Cryptographic signature recovery via ethers v6
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(nonceRecord.message, signature);
    } catch (err) {
      return errorResponse(
        res,
        "Failed to verify signature format.",
        err.message,
        400,
        ERROR_CODES.INVALID_SIGNATURE
      );
    }

    if (recoveredAddress.toLowerCase() !== cleanAddress) {
      return errorResponse(
        res,
        "Signature verification failed. Address mismatch.",
        { recoveredAddress, expectedAddress: cleanAddress },
        401,
        ERROR_CODES.INVALID_SIGNATURE
      );
    }

    // 3. Delete used nonce to prevent replay attacks
    await Nonce.deleteOne({ _id: nonceRecord._id });

    // 4. Sync on-chain roles (isDealer, isAdmin) from smart contracts
    let user = await syncUserRoles(cleanAddress);
    if (!user) {
      user = await User.findOneAndUpdate(
        { address: cleanAddress },
        { lastLoginAt: new Date() },
        { upsert: true, new: true }
      );
    } else {
      user.lastLoginAt = new Date();
      await user.save();
    }

    // 5. Issue JWT Token
    const token = jwt.sign(
      {
        address: cleanAddress,
        isDealer: user.isDealer,
        isAdmin: user.isAdmin,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info(`🔐 User authenticated: ${cleanAddress} (Admin: ${user.isAdmin}, Dealer: ${user.isDealer})`);

    return successResponse(res, "Wallet successfully authenticated.", {
      token,
      user: {
        address: user.address,
        username: user.username,
        bio: user.bio,
        avatar: user.avatar,
        email: user.email,
        isDealer: user.isDealer,
        isAdmin: user.isAdmin,
        dealershipVerifiedAt: user.dealershipVerifiedAt,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current Authenticated User Profile & On-Chain Balances
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    const address = req.user.address;

    // Resync roles and fetch profile
    const user = (await syncUserRoles(address)) || (await User.findOne({ address }));
    const withdrawals = await getPendingWithdrawals(address);

    return successResponse(res, "User profile retrieved successfully.", {
      user: {
        address: user.address,
        username: user.username,
        bio: user.bio,
        avatar: user.avatar,
        email: user.email,
        isDealer: user.isDealer,
        isAdmin: user.isAdmin,
        dealershipVerifiedAt: user.dealershipVerifiedAt,
        preferences: user.preferences,
        createdAt: user.createdAt,
      },
      withdrawals,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Profile Settings
 * PUT /api/auth/profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const address = req.user.address;
    const { username, bio, avatar, email, preferences } = req.body;

    const user = await User.findOneAndUpdate(
      { address },
      {
        ...(username !== undefined && { username }),
        ...(bio !== undefined && { bio }),
        ...(avatar !== undefined && { avatar }),
        ...(email !== undefined && { email }),
        ...(preferences !== undefined && { preferences }),
      },
      { new: true }
    );

    return successResponse(res, "Profile updated successfully.", user);
  } catch (error) {
    next(error);
  }
};
