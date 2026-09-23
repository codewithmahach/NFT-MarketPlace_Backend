import { ethers } from "ethers";

export const ROLES = {
  DEFAULT_ADMIN_ROLE: ethers.ZeroHash,
  ADMIN_ROLE: ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE")),
  DEALER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("DEALER_ROLE")),
};

export const CONTRACT_ADDRESSES = {
  chainId: 11155111,
  networkName: "Ethereum Sepolia",
  nft: process.env.NFT_CONTRACT_ADDRESS || "0xF9CFB066E7c755a22D9C632d941BCC29dd3C196f",
  marketplace: process.env.MARKETPLACE_CONTRACT_ADDRESS || "0x9180901fd05AAE6fffB8E6b6eb19f36CB6de3C5f",
  auction: process.env.AUCTION_CONTRACT_ADDRESS || "0x591A265C464C7DC820e3e68C52eE174347071f25",
  loyalty: process.env.LOYALTY_CONTRACT_ADDRESS || "0x34AbD91dac11A0b5718a2b506D8b68fC0707a5E4",
  usdt: process.env.USDT_CONTRACT_ADDRESS || "0xd077a400968890eacc75cdc901f0356c943e4fdb",
  treasury: process.env.TREASURY_ADDRESS || "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
};

export const PROTOCOL_CONSTANTS = {
  FEE_DENOMINATOR: 10000,
  MARKETPLACE_FEE_BPS: 250, // 2.5%
  AUCTION_FEE_BPS: 250, // 2.5%
  DEFAULT_ROYALTY_BPS: 500, // 5.0%
  MAX_ROYALTY_BPS: 1000, // 10.0%
  MILESTONE_SALES_COUNT: 10,
  MILESTONE_REWARD_WEI: ethers.parseEther("0.01").toString(),
};

export const LOYALTY_TIERS = {
  BRONZE: { name: "Bronze", minPoints: 0, feeDiscountBps: 0, badge: "🥉" },
  SILVER: { name: "Silver", minPoints: 100, feeDiscountBps: 500, badge: "🥈" },
  GOLD: { name: "Gold", minPoints: 500, feeDiscountBps: 1500, badge: "🥇" },
  PLATINUM: { name: "Platinum", minPoints: 2000, feeDiscountBps: 3000, badge: "💎" },
};

export const CATEGORIES = [
  "watches",
  "jewelry",
  "handbags",
  "shoes",
  "art",
  "cars",
  "spirits",
  "antiques",
  "fashion",
];

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BLOCKCHAIN_ERROR: "BLOCKCHAIN_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NONCE_EXPIRED: "NONCE_EXPIRED",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  ALREADY_EXISTS: "ALREADY_EXISTS",
};
