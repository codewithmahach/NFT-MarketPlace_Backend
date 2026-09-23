import { ethers } from "ethers";
import { getProvider, getContractInstance } from "../config/contracts.js";
import { CONTRACT_ADDRESSES, PROTOCOL_CONSTANTS, LOYALTY_TIERS } from "../config/constants.js";
import { NFT } from "../models/NFT.js";
import { Listing } from "../models/Listing.js";
import { Auction } from "../models/Auction.js";
import { Bid } from "../models/Bid.js";
import { Order } from "../models/Order.js";
import { LoyaltyProfile } from "../models/LoyaltyProfile.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { DealerApplication } from "../models/DealerApplication.js";
import { BlockchainEvent } from "../models/BlockchainEvent.js";
import { IndexerState } from "../models/IndexerState.js";
import { logger } from "../utils/logger.js";

let isIndexingRunning = false;
let pollingInterval = null;

// Helper to determine loyalty tier
const computeTier = (points) => {
  if (points >= LOYALTY_TIERS.PLATINUM.minPoints) return "Platinum";
  if (points >= LOYALTY_TIERS.GOLD.minPoints) return "Gold";
  if (points >= LOYALTY_TIERS.SILVER.minPoints) return "Silver";
  return "Bronze";
};

/**
 * Handle NFTCreated event
 */
const handleNFTCreated = async (event) => {
  const { tokenId, creator, name, category, maxSupply, initialSupply, initialOwner } = event.args;
  const tId = Number(tokenId);

  const existingNFT = await NFT.findOne({ tokenId: tId });

  const updateFields = {
    tokenId: tId,
    contractAddress: CONTRACT_ADDRESSES.nft.toLowerCase(),
    creator: creator.toLowerCase(),
    title: name,
    category: category.toLowerCase(),
    maxSupply: Number(maxSupply),
    initialSupply: Number(initialSupply),
    totalSupply: Number(initialSupply),
    owners: [{ address: initialOwner.toLowerCase(), balance: Number(initialSupply) }],
    txHash: event.transactionHash,
    blockNumber: event.blockNumber,
  };

  // If NFT already has an uploaded image (http://, /uploads/, or ipfs://), preserve it and NEVER overwrite with fallback
  if (existingNFT && existingNFT.image && !existingNFT.image.startsWith("/images/categories/")) {
    updateFields.image = existingNFT.image;
  } else if (!existingNFT || !existingNFT.image) {
    updateFields.image = `/images/categories/${category.toLowerCase()}/${name.toLowerCase().replace(/\s+/g, "_")}.jpg`;
  }

  await NFT.findOneAndUpdate(
    { tokenId: tId },
    updateFields,
    { upsert: true, new: true }
  );
  logger.info(`📦 [Indexer] Indexed NFT #${tId}: "${name}" in category ${category}`);
};

/**
 * Handle NFTMinted event
 */
const handleNFTMinted = async (event) => {
  const { tokenId, to, amount } = event.args;
  const tId = Number(tokenId);
  const qty = Number(amount);
  const toAddress = to.toLowerCase();

  const nft = await NFT.findOne({ tokenId: tId });
  if (nft) {
    nft.totalSupply = (nft.totalSupply || 0) + qty;
    const ownerIndex = nft.owners.findIndex((o) => o.address === toAddress);
    if (ownerIndex >= 0) {
      nft.owners[ownerIndex].balance += qty;
    } else {
      nft.owners.push({ address: toAddress, balance: qty });
    }
    await nft.save();
    logger.info(`✨ [Indexer] Minted ${qty} copies of NFT #${tId} to ${toAddress}`);
  }
};

/**
 * Handle ListingCreated event
 */
const handleListingCreated = async (event) => {
  const { listingId, seller, tokenId, quantity, price, paymentToken, isDirectSale } = event.args;
  const lId = Number(listingId);
  const tId = Number(tokenId);
  const priceWei = price.toString();
  const priceEth = parseFloat(ethers.formatEther(price));

  await Listing.findOneAndUpdate(
    { listingId: lId },
    {
      listingId: lId,
      seller: seller.toLowerCase(),
      tokenId: tId,
      quantity: Number(quantity),
      initialQuantity: Number(quantity),
      price: priceWei,
      priceInEth: priceEth,
      paymentToken: paymentToken.toLowerCase(),
      isDirectSale: Boolean(isDirectSale),
      isActive: true,
      isCancelled: false,
      isSoldOut: false,
      txHash: event.transactionHash,
      blockNumber: event.blockNumber,
    },
    { upsert: true, new: true }
  );

  await NFT.findOneAndUpdate({ tokenId: tId }, { activeListingId: lId });
  logger.info(`🏷️ [Indexer] Listing #${lId} created for NFT #${tId} at ${priceEth} ETH`);
};

/**
 * Handle NFTPurchased event
 */
const handleNFTPurchased = async (event) => {
  const { listingId, buyer, quantity, totalPrice, royaltyAmount, protocolFeeAmount, sellerProceeds, saleSequence } =
    event.args;
  const lId = Number(listingId);
  const qty = Number(quantity);
  const buyerAddress = buyer.toLowerCase();
  const totalWei = totalPrice.toString();
  const totalEth = parseFloat(ethers.formatEther(totalPrice));

  const listing = await Listing.findOne({ listingId: lId });
  if (listing) {
    listing.quantity = Math.max(0, listing.quantity - qty);
    if (listing.quantity === 0) {
      listing.isActive = false;
      listing.isSoldOut = true;
      await NFT.findOneAndUpdate({ tokenId: listing.tokenId }, { activeListingId: null });
    }
    listing.saleSequence = Number(saleSequence);
    await listing.save();

    // Record Order
    await Order.create({
      orderType: "direct_sale",
      referenceId: lId,
      buyer: buyerAddress,
      seller: listing.seller,
      tokenId: listing.tokenId,
      quantity: qty,
      pricePerUnit: listing.price,
      totalPrice: totalWei,
      totalPriceInEth: totalEth,
      paymentToken: listing.paymentToken,
      royaltyAmount: royaltyAmount ? royaltyAmount.toString() : "0",
      protocolFeeAmount: protocolFeeAmount ? protocolFeeAmount.toString() : "0",
      sellerProceeds: sellerProceeds ? sellerProceeds.toString() : "0",
      txHash: event.transactionHash,
      blockNumber: event.blockNumber,
    });

    // Update NFT owner balance
    const nft = await NFT.findOne({ tokenId: listing.tokenId });
    if (nft) {
      const sellerIdx = nft.owners.findIndex((o) => o.address === listing.seller);
      if (sellerIdx >= 0) {
        nft.owners[sellerIdx].balance = Math.max(0, nft.owners[sellerIdx].balance - qty);
      }
      const buyerIdx = nft.owners.findIndex((o) => o.address === buyerAddress);
      if (buyerIdx >= 0) {
        nft.owners[buyerIdx].balance += qty;
      } else {
        nft.owners.push({ address: buyerAddress, balance: qty });
      }
      await nft.save();
    }

    // Send notifications
    await Notification.create({
      recipient: listing.seller,
      title: "NFT Item Sold!",
      message: `Your listing for NFT #${listing.tokenId} was purchased (${qty} unit(s)) for ${totalEth} ETH.`,
      type: "sale",
      data: { listingId: lId, tokenId: listing.tokenId, buyer: buyerAddress, amountEth: totalEth },
    });

    await Notification.create({
      recipient: buyerAddress,
      title: "Purchase Successful!",
      message: `You successfully bought ${qty} unit(s) of NFT #${listing.tokenId} for ${totalEth} ETH.`,
      type: "purchase",
      data: { listingId: lId, tokenId: listing.tokenId, amountEth: totalEth },
    });

    logger.info(`🎉 [Indexer] NFT #${listing.tokenId} purchased by ${buyerAddress} for ${totalEth} ETH`);
  }
};

/**
 * Handle ListingCancelled event
 */
const handleListingCancelled = async (event) => {
  const { listingId } = event.args;
  const lId = Number(listingId);

  const listing = await Listing.findOneAndUpdate(
    { listingId: lId },
    { isActive: false, isCancelled: true },
    { new: true }
  );

  if (listing) {
    await NFT.findOneAndUpdate({ activeListingId: lId }, { activeListingId: null });
    logger.info(`🚫 [Indexer] Listing #${lId} cancelled`);
  }
};

/**
 * Handle AuctionCreated event
 */
const handleAuctionCreated = async (event) => {
  const { auctionId, seller, tokenId, quantity, paymentToken, startingPrice, startTime, endTime, minIncrementBps } =
    event.args;
  const aId = Number(auctionId);
  const tId = Number(tokenId);
  const startingEth = parseFloat(ethers.formatEther(startingPrice));

  await Auction.findOneAndUpdate(
    { auctionId: aId },
    {
      auctionId: aId,
      seller: seller.toLowerCase(),
      tokenId: tId,
      quantity: Number(quantity),
      startingPrice: startingPrice.toString(),
      startingPriceInEth: startingEth,
      minIncrementBps: Number(minIncrementBps || 1000),
      paymentToken: (paymentToken || ethers.ZeroAddress).toLowerCase(),
      startTime: new Date(Number(startTime) * 1000),
      endTime: new Date(Number(endTime) * 1000),
      settled: false,
      cancelled: false,
      highestBid: "0",
      highestBidInEth: 0,
      highestBidder: ethers.ZeroAddress,
      bidsCount: 0,
      txHash: event.transactionHash,
      blockNumber: event.blockNumber,
    },
    { upsert: true, new: true }
  );

  await NFT.findOneAndUpdate({ tokenId: tId }, { activeAuctionId: aId });
  logger.info(`🏛️ [Indexer] Auction #${aId} created for NFT #${tId} (Start: ${startingEth} ETH)`);
};

/**
 * Handle BidPlaced event
 */
const handleBidPlaced = async (event) => {
  const { auctionId, bidder, amount } = event.args;
  const aId = Number(auctionId);
  const bidderAddress = bidder.toLowerCase();
  const bidWei = amount.toString();
  const bidEth = parseFloat(ethers.formatEther(amount));

  const auction = await Auction.findOne({ auctionId: aId });
  if (auction) {
    const previousBidder = auction.highestBidder;

    auction.highestBid = bidWei;
    auction.highestBidInEth = bidEth;
    auction.highestBidder = bidderAddress;
    auction.bidsCount = (auction.bidsCount || 0) + 1;
    await auction.save();

    await Bid.create({
      auctionId: aId,
      bidder: bidderAddress,
      amount: bidWei,
      amountInEth: bidEth,
      paymentToken: auction.paymentToken,
      txHash: event.transactionHash,
      blockNumber: event.blockNumber,
    });

    // Notify seller
    await Notification.create({
      recipient: auction.seller,
      title: "New Bid Placed!",
      message: `A new highest bid of ${bidEth} ETH was placed on Auction #${aId}.`,
      type: "bid",
      data: { auctionId: aId, bidder: bidderAddress, amountEth: bidEth },
    });

    // Notify previous bidder of outbid
    if (previousBidder && previousBidder !== ethers.ZeroAddress && previousBidder !== bidderAddress) {
      await Notification.create({
        recipient: previousBidder,
        title: "You Have Been Outbid!",
        message: `Your bid on Auction #${aId} was outbid with ${bidEth} ETH. You can withdraw your refund anytime.`,
        type: "outbid",
        data: { auctionId: aId, newHighestBid: bidEth },
      });
    }

    logger.info(`💰 [Indexer] Bid of ${bidEth} ETH placed on Auction #${aId} by ${bidderAddress}`);
  }
};

/**
 * Handle AuctionSettled event
 */
const handleAuctionSettled = async (event) => {
  const { auctionId, winner, winningBid, royaltyAmount, protocolFeeAmount, sellerProceeds } = event.args;
  const aId = Number(auctionId);
  const winnerAddress = winner.toLowerCase();
  const winEth = parseFloat(ethers.formatEther(winningBid));

  const auction = await Auction.findOneAndUpdate(
    { auctionId: aId },
    { settled: true, highestBidder: winnerAddress },
    { new: true }
  );

  if (auction) {
    await NFT.findOneAndUpdate({ tokenId: auction.tokenId }, { activeAuctionId: null });

    // Record order
    await Order.create({
      orderType: "auction_won",
      referenceId: aId,
      buyer: winnerAddress,
      seller: auction.seller,
      tokenId: auction.tokenId,
      quantity: auction.quantity,
      pricePerUnit: winningBid.toString(),
      totalPrice: winningBid.toString(),
      totalPriceInEth: winEth,
      paymentToken: auction.paymentToken,
      royaltyAmount: royaltyAmount ? royaltyAmount.toString() : "0",
      protocolFeeAmount: protocolFeeAmount ? protocolFeeAmount.toString() : "0",
      sellerProceeds: sellerProceeds ? sellerProceeds.toString() : "0",
      txHash: event.transactionHash,
      blockNumber: event.blockNumber,
    });

    // Notify winner and seller
    await Notification.create({
      recipient: winnerAddress,
      title: "Auction Won!",
      message: `Congratulations! You won Auction #${aId} for NFT #${auction.tokenId} at ${winEth} ETH.`,
      type: "auction_won",
      data: { auctionId: aId, tokenId: auction.tokenId, winningBidEth: winEth },
    });

    logger.info(`🏆 [Indexer] Auction #${aId} settled. Winner: ${winnerAddress} (${winEth} ETH)`);
  }
};

/**
 * Handle SaleRecorded (Loyalty) event
 */
const handleSaleRecorded = async (event) => {
  const { seller, buyer, saleAmount } = event.args;
  const sellerAddr = (seller || "").toLowerCase();
  const buyerAddr = (buyer || "").toLowerCase();
  const sPts = 10;
  const bPts = 5;

  // Update seller loyalty
  if (sellerAddr) {
    let sellerProfile = await LoyaltyProfile.findOne({ userAddress: sellerAddr });
    if (!sellerProfile) {
      sellerProfile = new LoyaltyProfile({ userAddress: sellerAddr, totalPoints: 0, completedSalesCount: 0 });
    }
    sellerProfile.totalPoints += sPts;
    sellerProfile.completedSalesCount = (sellerProfile.completedSalesCount || 0) + 1;
    sellerProfile.currentTier = computeTier(sellerProfile.totalPoints);
    sellerProfile.history.push({
      type: "sale_reward",
      points: sPts,
      txHash: event.transactionHash,
      description: `Earned ${sPts} loyalty points from selling NFT`,
    });
    await sellerProfile.save();
  }

  // Update buyer loyalty
  if (buyerAddr) {
    let buyerProfile = await LoyaltyProfile.findOne({ userAddress: buyerAddr });
    if (!buyerProfile) {
      buyerProfile = new LoyaltyProfile({ userAddress: buyerAddr, totalPoints: 0 });
    }
    buyerProfile.totalPoints += bPts;
    buyerProfile.currentTier = computeTier(buyerProfile.totalPoints);
    buyerProfile.history.push({
      type: "purchase_reward",
      points: bPts,
      txHash: event.transactionHash,
      description: `Earned ${bPts} loyalty points from purchasing NFT`,
    });
    await buyerProfile.save();
  }

  logger.info(`⭐ [Indexer] Loyalty points awarded: Seller (${sellerAddr}) +${sPts}, Buyer (${buyerAddr}) +${bPts}`);
};

/**
 * Handle RewardClaimed (Loyalty Milestone) event
 */
const handleRewardClaimed = async (event) => {
  const { user, amount } = event.args;
  const userAddr = (user || "").toLowerCase();
  const rewardEth = amount ? ethers.formatEther(amount) : "0";

  let profile = await LoyaltyProfile.findOne({ userAddress: userAddr });
  if (profile) {
    profile.claimedMilestonesCount = (profile.claimedMilestonesCount || 0) + 1;
    profile.history.push({
      type: "milestone_claim",
      points: 0,
      rewardAmountWei: (amount || "0").toString(),
      txHash: event.transactionHash,
      description: `Claimed 2% milestone bonus reward of ${rewardEth} ETH`,
    });
    await profile.save();
  }

  await Notification.create({
    recipient: userAddr,
    title: "Milestone Reward Claimed!",
    message: `You successfully claimed ${rewardEth} ETH milestone reward!`,
    type: "milestone_ready",
    data: { rewardEth },
  });

  logger.info(`🎁 [Indexer] Milestone reward claimed by ${userAddr} (${rewardEth} ETH)`);
};

/**
 * Handle DealerStatusChanged event
 */
const handleDealerStatusChanged = async (event) => {
  const dealer = event.args.dealer || event.args[0];
  const verified = event.args.verified !== undefined ? event.args.verified : (event.args.status !== undefined ? event.args.status : Boolean(event.args[1]));
  const dealerAddr = (dealer || "").toLowerCase();
  const isVerified = Boolean(verified);

  if (!dealerAddr) return;

  await User.findOneAndUpdate(
    { address: dealerAddr },
    {
      isDealer: isVerified,
      ...(isVerified ? { dealershipVerifiedAt: new Date() } : {}),
    },
    { upsert: true }
  );

  if (isVerified) {
    await DealerApplication.updateMany(
      { applicantAddress: dealerAddr, status: "pending" },
      { status: "approved", reviewedAt: new Date(), approvalTxHash: event.transactionHash }
    );
  }

  await Notification.create({
    recipient: dealerAddr,
    title: isVerified ? "Dealership Approved!" : "Dealership Status Updated",
    message: isVerified
      ? "Congratulations! Your dealership has been verified and granted DEALER_ROLE on-chain."
      : "Your dealership status has been revoked.",
    type: isVerified ? "dealer_approved" : "dealer_rejected",
    data: { isDealer: isVerified },
  });

  logger.info(`👔 [Indexer] Dealer status updated for ${dealerAddr}: ${isVerified}`);
};

/**
 * Main Event Processor with Idempotent Deduplication
 */
export const processContractEvents = async (contractName, contractInstance, fromBlock, toBlock) => {
  try {
    const filter = { fromBlock, toBlock };
    const events = await contractInstance.queryFilter("*", fromBlock, toBlock);

    for (const event of events) {
      if (!event.fragment || !event.args) continue;

      const eventName = event.fragment.name;
      const txHash = event.transactionHash;
      const logIndex = event.index;

      // Idempotency check in MongoDB
      const existing = await BlockchainEvent.findOne({ transactionHash: txHash, logIndex });
      if (existing) continue;

      // Dispatch event to handlers
      try {
        switch (eventName) {
          case "NFTCreated":
            await handleNFTCreated(event);
            break;
          case "NFTMinted":
            await handleNFTMinted(event);
            break;
          case "ListingCreated":
            await handleListingCreated(event);
            break;
          case "NFTPurchased":
            await handleNFTPurchased(event);
            break;
          case "ListingCancelled":
            await handleListingCancelled(event);
            break;
          case "AuctionCreated":
            await handleAuctionCreated(event);
            break;
          case "BidPlaced":
            await handleBidPlaced(event);
            break;
          case "AuctionSettled":
            await handleAuctionSettled(event);
            break;
          case "AuctionCancelled":
            break;
          case "SaleRecorded":
            await handleSaleRecorded(event);
            break;
          case "RewardClaimed":
            await handleRewardClaimed(event);
            break;
          case "DealerStatusChanged":
            await handleDealerStatusChanged(event);
            break;
          default:
            break;
        }

        // Record processed event
        await BlockchainEvent.create({
          contractAddress: contractInstance.target.toLowerCase(),
          contractName,
          eventName,
          blockNumber: event.blockNumber,
          logIndex,
          transactionHash: txHash,
          args: Object.fromEntries(
            Object.entries(event.args).filter(([k]) => isNaN(Number(k)))
          ),
          processed: true,
        });
      } catch (err) {
        logger.error(`Error processing event ${eventName} in tx ${txHash}: ${err.message}`);
      }
    }

    // Save checkpoint
    await IndexerState.findOneAndUpdate(
      { contractName },
      { lastProcessedBlock: toBlock, lastSyncTimestamp: new Date() },
      { upsert: true }
    );
  } catch (error) {
    logger.error(`Error indexing events for ${contractName} [${fromBlock} - ${toBlock}]: ${error.message}`);
  }
};

/**
 * Start Blockchain Indexer Background Job
 */
export const startIndexer = async () => {
  if (isIndexingRunning) return;
  isIndexingRunning = true;

  logger.info("🚀 Starting Blockchain Event Indexer & Synchronizer...");

  const contracts = [
    { name: "ChainArtNFT", instance: getContractInstance("nft") },
    { name: "ChainArtMarketplace", instance: getContractInstance("marketplace") },
    { name: "ChainArtAuction", instance: getContractInstance("auction") },
    { name: "ChainArtLoyalty", instance: getContractInstance("loyalty") },
  ];

  const provider = getProvider();

  const sync = async () => {
    try {
      const latestBlock = await provider.getBlockNumber();

      for (const { name, instance } of contracts) {
        let state = await IndexerState.findOne({ contractName: name });
        const startBlock = state
          ? state.lastProcessedBlock + 1
          : parseInt(process.env.INDEXER_START_BLOCK || "7800000", 10);

        if (startBlock <= latestBlock) {
          // Process in batches of 500 blocks to comply with RPC limits
          const batchSize = 500;
          let currentFrom = startBlock;
          while (currentFrom <= latestBlock) {
            const currentTo = Math.min(currentFrom + batchSize - 1, latestBlock);
            await processContractEvents(name, instance, currentFrom, currentTo);
            currentFrom = currentTo + 1;
          }
        }
      }
    } catch (err) {
      logger.warn(`Indexer sync cycle error: ${err.message}`);
    }
  };

  // Run initial sync
  sync();

  // Set recurring polling interval
  const intervalMs = parseInt(process.env.INDEXER_POLL_INTERVAL_MS || "15000", 10);
  pollingInterval = setInterval(sync, intervalMs);
};

export const stopIndexer = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  isIndexingRunning = false;
  logger.info("🛑 Blockchain Event Indexer stopped.");
};
