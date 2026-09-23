import { ethers } from "ethers";
import { Auction } from "../models/Auction.js";
import { Bid } from "../models/Bid.js";
import { NFT } from "../models/NFT.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { ERROR_CODES } from "../config/constants.js";
import { verifyTransaction } from "../blockchain/verifier.js";
import { getContractInstance } from "../config/contracts.js";

/**
 * Get Active Auctions
 * GET /api/auctions
 */
export const getActiveAuctions = async (req, res, next) => {
  try {
    const { category, sortBy = "ending_soon", page = 1, limit = 20 } = req.query;

    const now = new Date();
    const query = {
      settled: false,
      cancelled: false,
      endTime: { $gt: now },
    };

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    let sortOptions = { endTime: 1 }; // Ending soonest
    if (sortBy === "highest_bid") sortOptions = { highestBidInEth: -1 };
    if (sortBy === "newest") sortOptions = { createdAt: -1 };

    const auctions = await Auction.find(query).sort(sortOptions).skip(skip).limit(parsedLimit).lean();

    const enriched = await Promise.all(
      auctions.map(async (a) => {
        const nft = await NFT.findOne({ tokenId: a.tokenId }).lean();
        return { ...a, nft };
      })
    );

    let filtered = enriched;
    if (category && category !== "all") {
      filtered = enriched.filter((a) => a.nft && a.nft.category === category.toLowerCase());
    }

    const total = await Auction.countDocuments(query);

    return successResponse(res, "Active auctions retrieved successfully.", {
      auctions: filtered,
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
 * Get Single Auction Details with Bid History & Next Min Bid
 * GET /api/auctions/:auctionId
 */
export const getAuctionById = async (req, res, next) => {
  try {
    const auctionId = parseInt(req.params.auctionId, 10);
    if (isNaN(auctionId)) {
      return errorResponse(res, "Invalid auction ID.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const auction = await Auction.findOne({ auctionId }).lean();
    if (!auction) {
      return errorResponse(res, `Auction #${auctionId} not found.`, null, 404, ERROR_CODES.NOT_FOUND);
    }

    const [nft, bids] = await Promise.all([
      NFT.findOne({ tokenId: auction.tokenId }).lean(),
      Bid.find({ auctionId }).sort({ amountInEth: -1, timestamp: -1 }).lean(),
    ]);

    // Calculate minimum next bid
    const highestBidWei = BigInt(auction.highestBid || "0");
    const startingPriceWei = BigInt(auction.startingPrice || "0");
    let minNextBidWei;

    if (highestBidWei === 0n) {
      minNextBidWei = startingPriceWei;
    } else {
      // 5% minimum bid increment
      const increment = (highestBidWei * 500n) / 10000n;
      minNextBidWei = highestBidWei + (increment > 0n ? increment : 1n);
    }

    const minNextBidEth = parseFloat(ethers.formatEther(minNextBidWei));

    return successResponse(res, "Auction details retrieved successfully.", {
      auction,
      nft,
      bids,
      nextBidInfo: {
        minNextBidWei: minNextBidWei.toString(),
        minNextBidEth,
        isReserveMet: highestBidWei >= BigInt(auction.reservePrice || "0"),
        hasStarted: new Date() >= new Date(auction.startTime),
        hasEnded: new Date() >= new Date(auction.endTime),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Bid Transaction On-Chain
 * POST /api/auctions/verify-bid
 */
export const verifyBid = async (req, res, next) => {
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

    let bid = await Bid.findOne({ txHash });
    if (!bid) {
      const auctionContract = getContractInstance("auction");
      const iface = auctionContract.interface;

      for (const log of txResult.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === "BidPlaced") {
            const { auctionId, bidder, amount } = parsed.args;
            const aId = Number(auctionId);
            const bidWei = amount.toString();
            const bidEth = parseFloat(ethers.formatEther(amount));

            bid = await Bid.create({
              auctionId: aId,
              bidder: bidder.toLowerCase(),
              amount: bidWei,
              amountInEth: bidEth,
              paymentToken: ethers.ZeroAddress,
              txHash,
              blockNumber: txResult.blockNumber,
            });

            await Auction.findOneAndUpdate(
              { auctionId: aId },
              { highestBid: bidWei, highestBidInEth: bidEth, highestBidder: bidder.toLowerCase(), $inc: { bidsCount: 1 } }
            );
            break;
          }
        } catch {
          // Log not from auction interface
        }
      }
    }

    return successResponse(res, "Bid verified successfully on blockchain.", {
      verified: true,
      blockNumber: txResult.blockNumber,
      bid,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Auction Participation
 * GET /api/auctions/user/:address
 */
export const getUserAuctions = async (req, res, next) => {
  try {
    const address = req.params.address.toLowerCase();
    const { type = "created" } = req.query; // 'created', 'bidded'

    let auctions = [];
    if (type === "bidded") {
      const userBids = await Bid.find({ bidder: address }).distinct("auctionId");
      auctions = await Auction.find({ auctionId: { $in: userBids } }).sort({ createdAt: -1 }).lean();
    } else {
      auctions = await Auction.find({ seller: address }).sort({ createdAt: -1 }).lean();
    }

    const enriched = await Promise.all(
      auctions.map(async (a) => {
        const nft = await NFT.findOne({ tokenId: a.tokenId }).lean();
        return { ...a, nft };
      })
    );

    return successResponse(res, "User auctions retrieved successfully.", enriched);
  } catch (error) {
    next(error);
  }
};

/**
 * Sync Newly Created Auction
 * POST /api/auctions/sync-auction
 */
export const syncAuction = async (req, res, next) => {
  try {
    const { auctionId, seller, tokenId, quantity, startPrice, durationDays, paymentToken, txHash } = req.body;
    const aId = parseInt(auctionId, 10);
    const tId = parseInt(tokenId, 10);
    if (isNaN(aId) || isNaN(tId)) {
      return errorResponse(res, "Valid auctionId and tokenId required.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }
    const startingEth = parseFloat(startPrice) || 0;
    const startingWei = typeof startPrice === "string" && startPrice.includes(".") ? ethers.parseEther(startPrice).toString() : String(startPrice || "0");
    const sellerAddr = (seller || (req.user ? req.user.address : "")).toLowerCase();
    const days = parseInt(durationDays, 10) || 3;
    const now = new Date();
    const endTime = new Date(now.getTime() + days * 86400 * 1000);

    const auction = await Auction.findOneAndUpdate(
      { auctionId: aId },
      {
        auctionId: aId,
        seller: sellerAddr,
        tokenId: tId,
        quantity: parseInt(quantity, 10) || 1,
        startingPrice: startingWei,
        startingPriceInEth: startingEth,
        highestBid: "0",
        highestBidInEth: 0,
        highestBidder: ethers.ZeroAddress,
        paymentToken: (paymentToken || ethers.ZeroAddress).toLowerCase(),
        startTime: now,
        endTime: endTime,
        settled: false,
        cancelled: false,
        bidsCount: 0,
        isDemo: false,
        txHash: txHash || "",
      },
      { upsert: true, new: true }
    );

    await NFT.findOneAndUpdate({ tokenId: tId }, { activeAuctionId: aId });

    return successResponse(res, "Auction synchronized successfully.", auction);
  } catch (error) {
    next(error);
  }
};

