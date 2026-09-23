import { ethers } from "ethers";
import { Listing } from "../models/Listing.js";
import { NFT } from "../models/NFT.js";
import { Order } from "../models/Order.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { PROTOCOL_CONSTANTS, ERROR_CODES } from "../config/constants.js";
import { verifyTransaction } from "../blockchain/verifier.js";
import { getContractInstance } from "../config/contracts.js";

/**
 * Get Active Listings with Filters
 * GET /api/marketplace/listings
 */
export const getActiveListings = async (req, res, next) => {
  try {
    const {
      category,
      paymentToken,
      minPrice,
      maxPrice,
      sortBy = "newest", // 'newest', 'price_asc', 'price_desc'
      page = 1,
      limit = 20,
    } = req.query;

    const query = { isActive: true, quantity: { $gt: 0 } };

    if (paymentToken) {
      query.paymentToken = paymentToken.toLowerCase();
    }

    if (minPrice || maxPrice) {
      query.priceInEth = {};
      if (minPrice) query.priceInEth.$gte = parseFloat(minPrice);
      if (maxPrice) query.priceInEth.$lte = parseFloat(maxPrice);
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    let sortOptions = { createdAt: -1 };
    if (sortBy === "price_asc") sortOptions = { priceInEth: 1 };
    if (sortBy === "price_desc") sortOptions = { priceInEth: -1 };

    let listings = await Listing.find(query).sort(sortOptions).skip(skip).limit(parsedLimit).lean();

    // Enrich with NFT metadata
    const enriched = await Promise.all(
      listings.map(async (listing) => {
        const nft = await NFT.findOne({ tokenId: listing.tokenId }).lean();
        return {
          ...listing,
          nft,
        };
      })
    );

    // Apply category filter if requested
    let filtered = enriched;
    if (category && category !== "all") {
      filtered = enriched.filter((item) => item.nft && item.nft.category === category.toLowerCase());
    }

    const total = await Listing.countDocuments(query);

    return successResponse(res, "Active listings retrieved successfully.", {
      listings: filtered,
      pagination: {
        page: parseInt(page, 10),
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Listing Details with Fee Breakdown
 * GET /api/marketplace/listings/:listingId
 */
export const getListingById = async (req, res, next) => {
  try {
    const listingId = parseInt(req.params.listingId, 10);
    if (isNaN(listingId)) {
      return errorResponse(res, "Invalid listing ID.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const listing = await Listing.findOne({ listingId }).lean();
    if (!listing) {
      return errorResponse(res, `Listing #${listingId} not found.`, null, 404, ERROR_CODES.NOT_FOUND);
    }

    const nft = await NFT.findOne({ tokenId: listing.tokenId }).lean();

    // Calculate fee breakdown
    const priceWei = BigInt(listing.price);
    const feeDenominator = BigInt(PROTOCOL_CONSTANTS.FEE_DENOMINATOR);
    const protocolFeeBps = BigInt(PROTOCOL_CONSTANTS.MARKETPLACE_FEE_BPS); // 250 bps = 2.5%
    const royaltyFeeBps = BigInt((nft && nft.royaltyFeeBps) || PROTOCOL_CONSTANTS.DEFAULT_ROYALTY_BPS); // 500 bps = 5.0%

    const protocolFeeWei = (priceWei * protocolFeeBps) / feeDenominator;
    const royaltyFeeWei = (priceWei * royaltyFeeBps) / feeDenominator;
    const sellerProceedsWei = priceWei - protocolFeeWei - royaltyFeeWei;

    const breakdown = {
      priceWei: priceWei.toString(),
      priceEth: ethers.formatEther(priceWei),
      protocolFeeWei: protocolFeeWei.toString(),
      protocolFeeEth: ethers.formatEther(protocolFeeWei),
      protocolFeePercent: "2.5%",
      royaltyFeeWei: royaltyFeeWei.toString(),
      royaltyFeeEth: ethers.formatEther(royaltyFeeWei),
      royaltyFeePercent: `${Number(royaltyFeeBps) / 100}%`,
      royaltyRecipient: (nft && nft.royaltyRecipient) || (nft && nft.creator) || "",
      sellerProceedsWei: sellerProceedsWei.toString(),
      sellerProceedsEth: ethers.formatEther(sellerProceedsWei),
      sellerProceedsPercent: `${(Number(feeDenominator - protocolFeeBps - royaltyFeeBps) / 100).toFixed(1)}%`,
    };

    return successResponse(res, "Listing retrieved successfully.", {
      listing,
      nft,
      breakdown,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Purchase Transaction On-Chain
 * POST /api/marketplace/verify-purchase
 */
export const verifyPurchase = async (req, res, next) => {
  try {
    const { txHash } = req.body;
    if (!txHash) {
      return errorResponse(res, "Transaction hash is required.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const txResult = await verifyTransaction(txHash);
    if (!txResult.verified) {
      return errorResponse(
        res,
        "Transaction verification failed on Ethereum Sepolia.",
        txResult,
        400,
        ERROR_CODES.BLOCKCHAIN_ERROR
      );
    }

    // Check if order was already recorded by indexer
    let order = await Order.findOne({ txHash });
    if (!order) {
      // Find matching purchase receipt from logs
      const marketplace = getContractInstance("marketplace");
      const iface = marketplace.interface;

      for (const log of txResult.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === "NFTPurchased") {
            const { listingId, buyer, quantity, totalPrice, royaltyAmount, protocolFeeAmount, sellerProceeds } =
              parsed.args;
            const listing = await Listing.findOne({ listingId: Number(listingId) });

            order = await Order.create({
              orderType: "direct_sale",
              referenceId: Number(listingId),
              buyer: buyer.toLowerCase(),
              seller: listing ? listing.seller : txResult.from.toLowerCase(),
              tokenId: listing ? listing.tokenId : 1,
              quantity: Number(quantity),
              pricePerUnit: (BigInt(totalPrice) / BigInt(quantity)).toString(),
              totalPrice: totalPrice.toString(),
              totalPriceInEth: parseFloat(ethers.formatEther(totalPrice)),
              paymentToken: listing ? listing.paymentToken : ethers.ZeroAddress,
              royaltyAmount: royaltyAmount ? royaltyAmount.toString() : "0",
              protocolFeeAmount: protocolFeeAmount ? protocolFeeAmount.toString() : "0",
              sellerProceeds: sellerProceeds ? sellerProceeds.toString() : "0",
              txHash,
              blockNumber: txResult.blockNumber,
            });
            break;
          }
        } catch {
          // Log not from marketplace interface
        }
      }
    }

    return successResponse(res, "Purchase verified successfully on blockchain.", {
      verified: true,
      blockNumber: txResult.blockNumber,
      order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Listings
 * GET /api/marketplace/user/:address
 */
export const getUserListings = async (req, res, next) => {
  try {
    const seller = req.params.address.toLowerCase();
    const { status = "active" } = req.query; // 'active', 'sold', 'cancelled', 'all'

    let query = { seller };
    if (status === "active") {
      query.isActive = true;
    } else if (status === "sold") {
      query.isSoldOut = true;
    } else if (status === "cancelled") {
      query.isCancelled = true;
    }

    const listings = await Listing.find(query).sort({ createdAt: -1 }).lean();
    const enriched = await Promise.all(
      listings.map(async (l) => {
        const nft = await NFT.findOne({ tokenId: l.tokenId }).lean();
        return { ...l, nft };
      })
    );

    return successResponse(res, "User listings retrieved successfully.", enriched);
  } catch (error) {
    next(error);
  }
};

/**
 * Sync Newly Created Listing
 * POST /api/marketplace/sync-listing
 */
export const syncListing = async (req, res, next) => {
  try {
    const { listingId, seller, tokenId, quantity, price, paymentToken, duration, txHash } = req.body;
    const lId = parseInt(listingId, 10);
    const tId = parseInt(tokenId, 10);
    if (isNaN(lId) || isNaN(tId)) {
      return errorResponse(res, "Valid listingId and tokenId required.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }
    const priceEth = parseFloat(price) || 0;
    const priceWei = typeof price === "string" && price.includes(".") ? ethers.parseEther(price).toString() : String(price || "0");
    const sellerAddr = (seller || (req.user ? req.user.address : "")).toLowerCase();

    const listing = await Listing.findOneAndUpdate(
      { listingId: lId },
      {
        listingId: lId,
        seller: sellerAddr,
        tokenId: tId,
        quantity: parseInt(quantity, 10) || 1,
        initialQuantity: parseInt(quantity, 10) || 1,
        price: priceWei,
        priceInEth: priceEth,
        paymentToken: (paymentToken || ethers.ZeroAddress).toLowerCase(),
        isDirectSale: true,
        isActive: true,
        isCancelled: false,
        isSoldOut: false,
        txHash: txHash || "",
      },
      { upsert: true, new: true }
    );

    await NFT.findOneAndUpdate({ tokenId: tId }, { activeListingId: lId });

    return successResponse(res, "Listing synchronized successfully.", listing);
  } catch (error) {
    next(error);
  }
};

