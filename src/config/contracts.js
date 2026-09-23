import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONTRACT_ADDRESSES } from "./constants.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ABIs
const loadAbi = (filename) => {
  const filePath = path.join(__dirname, "abis", filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

export const ABIS = {
  ChainArtNFT: loadAbi("ChainArtNFT.json"),
  ChainArtMarketplace: loadAbi("ChainArtMarketplace.json"),
  ChainArtAuction: loadAbi("ChainArtAuction.json"),
  ChainArtLoyalty: loadAbi("ChainArtLoyalty.json"),
  MockUSDT: loadAbi("MockUSDT.json"),
};

// RPC URLs with fallback
const RPC_URLS = [
  process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  process.env.FALLBACK_RPC_URL_1 || "https://rpc.sepolia.org",
  process.env.FALLBACK_RPC_URL_2 || "https://sepolia.infura.io/v3/ec27627d77a14d5fbd11fb8ba2f7c722",
];

let currentRpcIndex = 0;
let providerInstance = null;

export const getProvider = () => {
  if (!providerInstance) {
    providerInstance = createProvider(currentRpcIndex);
  }
  return providerInstance;
};

const createProvider = (index) => {
  const url = RPC_URLS[index % RPC_URLS.length];
  logger.info(`🔗 Connecting to Ethereum Sepolia RPC [${index}]: ${url}`);
  return new ethers.JsonRpcProvider(url, {
    chainId: CONTRACT_ADDRESSES.chainId,
    name: "sepolia",
  });
};

export const rotateProvider = () => {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_URLS.length;
  providerInstance = createProvider(currentRpcIndex);
  logger.warn(`🔄 Switched Sepolia RPC provider to: ${RPC_URLS[currentRpcIndex]}`);
  return providerInstance;
};

// Read-only contract instances
export const getContractInstance = (name, customRunner = null) => {
  const runner = customRunner || getProvider();
  switch (name.toLowerCase()) {
    case "nft":
    case "chainartnft":
      return new ethers.Contract(CONTRACT_ADDRESSES.nft, ABIS.ChainArtNFT, runner);
    case "marketplace":
    case "chainartmarketplace":
      return new ethers.Contract(CONTRACT_ADDRESSES.marketplace, ABIS.ChainArtMarketplace, runner);
    case "auction":
    case "chainartauction":
      return new ethers.Contract(CONTRACT_ADDRESSES.auction, ABIS.ChainArtAuction, runner);
    case "loyalty":
    case "chainartloyalty":
      return new ethers.Contract(CONTRACT_ADDRESSES.loyalty, ABIS.ChainArtLoyalty, runner);
    case "usdt":
    case "mockusdt":
      return new ethers.Contract(CONTRACT_ADDRESSES.usdt, ABIS.MockUSDT, runner);
    default:
      throw new Error(`Unknown contract name: ${name}`);
  }
};
