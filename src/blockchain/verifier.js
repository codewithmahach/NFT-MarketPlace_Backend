import { ethers } from "ethers";
import { getProvider, getContractInstance } from "../config/contracts.js";
import { ROLES, CONTRACT_ADDRESSES } from "../config/constants.js";
import { User } from "../models/User.js";
import { DealerApplication } from "../models/DealerApplication.js";
import { logger } from "../utils/logger.js";

/**
 * Verify a transaction receipt on Ethereum Sepolia
 */
export const verifyTransaction = async (txHash) => {
  const provider = getProvider();
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return { verified: false, error: "Transaction not found on chain" };
    }

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return { verified: false, pending: true, error: "Transaction is still pending confirmation" };
    }

    const success = receipt.status === 1;
    return {
      verified: success,
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed.toString(),
      logs: receipt.logs,
    };
  } catch (error) {
    logger.error(`Error verifying transaction ${txHash}: ${error.message}`);
    return { verified: false, error: error.message };
  }
};

/**
 * Check pending pull-payment withdrawals for a user
 */
export const getPendingWithdrawals = async (userAddress, tokenAddress = ethers.ZeroAddress) => {
  try {
    const marketplace = getContractInstance("marketplace");
    const auction = getContractInstance("auction");

    const [marketplaceBalance, auctionBalance] = await Promise.all([
      marketplace.getPendingWithdrawal(userAddress, tokenAddress).catch(() => 0n),
      auction.getPendingWithdrawal(userAddress, tokenAddress).catch(() => 0n),
    ]);

    return {
      userAddress,
      tokenAddress,
      marketplacePendingWei: marketplaceBalance.toString(),
      marketplacePendingEth: ethers.formatEther(marketplaceBalance),
      auctionPendingWei: auctionBalance.toString(),
      auctionPendingEth: ethers.formatEther(auctionBalance),
      totalPendingWei: (marketplaceBalance + auctionBalance).toString(),
      totalPendingEth: ethers.formatEther(marketplaceBalance + auctionBalance),
    };
  } catch (error) {
    logger.error(`Error fetching pending withdrawals for ${userAddress}: ${error.message}`);
    return {
      userAddress,
      tokenAddress,
      marketplacePendingWei: "0",
      marketplacePendingEth: "0.0",
      auctionPendingWei: "0",
      auctionPendingEth: "0.0",
      totalPendingWei: "0",
      totalPendingEth: "0.0",
    };
  }
};

/**
 * Synchronize on-chain roles with DB
 */
export const syncUserRoles = async (userAddress) => {
  try {
    const cleanAddress = userAddress.toLowerCase();
    const existingUser = await User.findOne({ address: cleanAddress });
    const application = await DealerApplication.findOne({ applicantAddress: cleanAddress, status: "approved" });

    const nft = getContractInstance("nft");
    const [isDefaultAdmin, isAdminRole, isDealerOnChain] = await Promise.all([
      nft.hasRole(ROLES.DEFAULT_ADMIN_ROLE, userAddress).catch(() => false),
      nft.hasRole(ROLES.ADMIN_ROLE, userAddress).catch(() => false),
      nft.hasRole(ROLES.DEALER_ROLE, userAddress).catch(() => false),
    ]);

    const isContractDealer = typeof nft.isDealer === "function" 
      ? await nft.isDealer(userAddress).catch(() => false) 
      : false;

    const isAdmin = Boolean(isDefaultAdmin || isAdminRole || existingUser?.isAdmin);
    const isDealer = Boolean(isDealerOnChain || isContractDealer || application || existingUser?.isDealer);

    const updatedUser = await User.findOneAndUpdate(
      { address: cleanAddress },
      {
        isAdmin,
        isDealer,
        ...(isDealer ? { dealershipVerifiedAt: existingUser?.dealershipVerifiedAt || new Date() } : {}),
      },
      { upsert: true, new: true }
    );

    return updatedUser;
  } catch (error) {
    logger.error(`Failed to sync on-chain roles for ${userAddress}: ${error.message}`);
    return null;
  }
};
