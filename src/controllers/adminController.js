import { ethers } from "ethers";
import { DealerApplication } from "../models/DealerApplication.js";
import { User } from "../models/User.js";
import { NFT } from "../models/NFT.js";
import { Listing } from "../models/Listing.js";
import { Auction } from "../models/Auction.js";
import { Order } from "../models/Order.js";
import { BlockchainEvent } from "../models/BlockchainEvent.js";
import { AuditLog } from "../models/AuditLog.js";
import { Notification } from "../models/Notification.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { CONTRACT_ADDRESSES, ERROR_CODES } from "../config/constants.js";
import { getProvider, getContractInstance } from "../config/contracts.js";
import { getIsConnected } from "../config/db.js";
import { logger } from "../utils/logger.js";

/**
 * Protocol Supervision Dashboard Overview
 * GET /api/admin/dashboard
 */
export const getSupervisionDashboard = async (req, res, next) => {
  try {
    const [
      totalNFTs,
      activeListings,
      activeAuctions,
      totalOrders,
      totalDealers,
      pendingApplications,
      recentEvents,
      volumeAggregate,
    ] = await Promise.all([
      NFT.countDocuments({ isActive: true }),
      Listing.countDocuments({ isActive: true }),
      Auction.countDocuments({ settled: false, cancelled: false }),
      Order.countDocuments({}),
      User.countDocuments({ isDealer: true }),
      DealerApplication.countDocuments({ status: "pending" }),
      BlockchainEvent.find({}).sort({ blockNumber: -1, createdAt: -1 }).limit(10).lean(),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalVolumeEth: { $sum: "$totalPriceInEth" },
            totalProtocolFeesEth: {
              $sum: {
                $divide: [
                  { $toDouble: "$protocolFeeAmount" },
                  1000000000000000000,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const totalVolumeEth = volumeAggregate[0] ? volumeAggregate[0].totalVolumeEth.toFixed(4) : "0.0000";
    const totalFeesEth = volumeAggregate[0] ? volumeAggregate[0].totalProtocolFeesEth.toFixed(4) : "0.0000";

    return successResponse(res, "Admin supervision dashboard metrics retrieved.", {
      metrics: {
        totalNFTs,
        activeListings,
        activeAuctions,
        totalOrders,
        totalDealers,
        pendingApplications,
        totalVolumeEth,
        totalFeesEth,
      },
      contractAddresses: CONTRACT_ADDRESSES,
      recentEvents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Dealership Applications for Admin Review
 * GET /api/admin/applications
 */
export const getDealerApplications = async (req, res, next) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status && status !== "all") query.status = status;
    if (category && category !== "all") query.category = category.toLowerCase();

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    const [applications, total] = await Promise.all([
      DealerApplication.find(query).sort({ submittedAt: -1 }).skip(skip).limit(parsedLimit).lean(),
      DealerApplication.countDocuments(query),
    ]);

    return successResponse(res, "Dealership applications retrieved.", {
      applications,
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
 * Review & Update Dealership Application
 * PUT /api/admin/applications/:id
 */
export const reviewDealerApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes, approvalTxHash } = req.body;
    const adminAddress = (req.user && req.user.address) || CONTRACT_ADDRESSES.treasury.toLowerCase();

    const application = await DealerApplication.findById(id);
    if (!application) {
      return errorResponse(res, "Dealership application not found.", null, 404, ERROR_CODES.NOT_FOUND);
    }

    application.status = status;
    application.reviewedBy = adminAddress;
    application.reviewNotes = reviewNotes || "";
    if (approvalTxHash) application.approvalTxHash = approvalTxHash;
    application.reviewedAt = new Date();
    await application.save();

    // If approved, update user model
    if (status === "approved") {
      await User.findOneAndUpdate(
        { address: application.applicantAddress },
        { isDealer: true, dealershipVerifiedAt: new Date() },
        { upsert: true }
      );
    } else if (status === "rejected") {
      await User.findOneAndUpdate(
        { address: application.applicantAddress },
        { isDealer: false }
      );
    }

    // Send notification to applicant
    await Notification.create({
      recipient: application.applicantAddress,
      title: status === "approved" ? "Dealership Application Approved!" : "Dealership Application Update",
      message:
        status === "approved"
          ? `Congratulations! Your dealership for "${application.businessName}" has been approved by the protocol administrators.`
          : `Your dealership application for "${application.businessName}" was declined. Reason: ${reviewNotes || "Requirements not met."}`,
      type: status === "approved" ? "dealer_approved" : "dealer_rejected",
      data: { applicationId: application._id, status, notes: reviewNotes },
    });

    // Record Audit Log
    await AuditLog.create({
      actorAddress: adminAddress,
      action: `DEALER_APPLICATION_${status.toUpperCase()}`,
      target: application.applicantAddress,
      metadata: { applicationId: id, businessName: application.businessName, reviewNotes },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });

    logger.info(`⚖️ Admin ${adminAddress} reviewed application ${id} -> ${status}`);

    return successResponse(res, `Dealership application ${status} successfully.`, application);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Indexed Blockchain Events
 * GET /api/admin/events
 */
export const getIndexedEvents = async (req, res, next) => {
  try {
    const { eventName, contractName, page = 1, limit = 50 } = req.query;

    const query = {};
    if (eventName && eventName !== "all") query.eventName = eventName;
    if (contractName && contractName !== "all") query.contractName = contractName;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    const [events, total] = await Promise.all([
      BlockchainEvent.find(query).sort({ blockNumber: -1, createdAt: -1 }).skip(skip).limit(parsedLimit).lean(),
      BlockchainEvent.countDocuments(query),
    ]);

    return successResponse(res, "Indexed blockchain events retrieved.", {
      events,
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
 * Get System Health & Connectivity
 * GET /api/admin/health
 */
export const getSystemHealth = async (req, res, next) => {
  try {
    const provider = getProvider();
    let currentBlock = 0;
    let rpcHealthy = false;

    try {
      currentBlock = await provider.getBlockNumber();
      rpcHealthy = true;
    } catch {
      rpcHealthy = false;
    }

    const dbHealthy = getIsConnected();

    return successResponse(res, "System health status.", {
      status: rpcHealthy && dbHealthy ? "OPERATIONAL" : "DEGRADED",
      timestamp: new Date().toISOString(),
      services: {
        database: { status: dbHealthy ? "CONNECTED" : "DISCONNECTED" },
        sepoliaRpc: { status: rpcHealthy ? "ONLINE" : "OFFLINE", currentBlock },
      },
      contracts: CONTRACT_ADDRESSES,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Directly Update Dealer Role by Address (Manual Controller)
 * POST /api/admin/dealers/status
 */
export const updateDealerStatusDirect = async (req, res, next) => {
  try {
    const { address, status } = req.body;
    const cleanAddress = address.toLowerCase();
    const isApproved = Boolean(status);
    const adminAddress = (req.user && req.user.address) || CONTRACT_ADDRESSES.treasury.toLowerCase();

    const user = await User.findOneAndUpdate(
      { address: cleanAddress },
      {
        isDealer: isApproved,
        ...(isApproved ? { dealershipVerifiedAt: new Date() } : {}),
      },
      { upsert: true, new: true }
    );

    // Update any pending applications
    if (isApproved) {
      await DealerApplication.updateMany(
        { applicantAddress: cleanAddress, status: "pending" },
        { status: "approved", reviewedBy: adminAddress, reviewedAt: new Date() }
      );
    }

    await Notification.create({
      recipient: cleanAddress,
      title: isApproved ? "Dealership Status Granted!" : "Dealership Status Revoked",
      message: isApproved
        ? "Protocol Administrator has verified your wallet as an authorized luxury dealer."
        : "Your luxury dealer accreditation has been revoked by protocol administrators.",
      type: isApproved ? "dealer_approved" : "dealer_rejected",
      data: { isDealer: isApproved },
    });

    await AuditLog.create({
      actorAddress: adminAddress,
      action: `MANUAL_DEALER_STATUS_${isApproved ? "GRANTED" : "REVOKED"}`,
      target: cleanAddress,
      metadata: { status: isApproved },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });

    logger.info(`👔 Admin ${adminAddress} manually updated dealer status for ${cleanAddress} -> ${isApproved}`);

    return successResponse(res, `Dealer status updated successfully for ${cleanAddress}.`, {
      address: cleanAddress,
      isDealer: isApproved,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Purge All Seed / Mock Data from Database
 * DELETE /api/admin/mock-data
 */
export const clearMockData = async (req, res, next) => {
  try {
    const [nftRes, listRes, aucRes] = await Promise.all([
      NFT.deleteMany({ isDemo: true }),
      Listing.deleteMany({ isDemo: true }),
      Auction.deleteMany({ isDemo: true }),
    ]);

    logger.info(`🧹 Admin purged mock data: NFTs=${nftRes.deletedCount}, Listings=${listRes.deletedCount}, Auctions=${aucRes.deletedCount}`);

    return successResponse(res, "Mock data purged successfully.", {
      deletedNFTs: nftRes.deletedCount,
      deletedListings: listRes.deletedCount,
      deletedAuctions: aucRes.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Comprehensive Dealers Analytics & Position Tracking
 * GET /api/admin/dealers-analytics
 */
export const getDealersAnalytics = async (req, res, next) => {
  try {
    // 1. Fetch all applications and all users flagged as dealers or with applications
    const [applications, dealerUsers] = await Promise.all([
      DealerApplication.find({}).sort({ submittedAt: -1 }).lean(),
      User.find({ $or: [{ isDealer: true }, { isPenalized: true }] }).lean(),
    ]);

    // Map by address
    const dealersMap = new Map();

    // Add from applications
    for (const app of applications) {
      const addr = app.applicantAddress.toLowerCase();
      dealersMap.set(addr, {
        applicationId: app._id,
        address: addr,
        businessName: app.businessName,
        contactPerson: app.contactPerson || "",
        email: app.email,
        phone: app.phone || "",
        category: app.category ? (app.category.charAt(0).toUpperCase() + app.category.slice(1)) : "Luxury",
        website: app.website || "",
        status: app.status || "pending",
        isPenalized: Boolean(app.isPenalized),
        penaltyReason: app.penaltyReason || "",
        penaltyDate: app.penaltyDate || null,
        exclusivityAgreed: app.exclusivityAgreed !== false,
        submittedAt: app.submittedAt,
        notes: app.provenanceProcess || app.reviewNotes || "",
        rawApplication: app,
      });
    }

    // Add / merge from User collection
    for (const user of dealerUsers) {
      const addr = user.address.toLowerCase();
      const existing = dealersMap.get(addr);
      if (existing) {
        existing.isDealer = user.isDealer;
        existing.isPenalized = Boolean(user.isPenalized || existing.isPenalized);
        existing.penaltyReason = user.penaltyReason || existing.penaltyReason;
        existing.penaltyDate = user.penaltyDate || existing.penaltyDate;
        existing.penaltyType = user.penaltyType || "";
        if (existing.isPenalized) existing.status = "penalized";
      } else {
        dealersMap.set(addr, {
          applicationId: null,
          address: addr,
          businessName: user.username || `Verified Dealer (${addr.slice(0, 6)}...${addr.slice(-4)})`,
          contactPerson: "",
          email: user.email || "",
          phone: "",
          category: "Luxury",
          website: "",
          status: user.isPenalized ? "penalized" : user.isDealer ? "approved" : "pending",
          isDealer: user.isDealer,
          isPenalized: Boolean(user.isPenalized),
          penaltyReason: user.penaltyReason || "",
          penaltyDate: user.penaltyDate || null,
          penaltyType: user.penaltyType || "",
          exclusivityAgreed: user.exclusivityAgreed !== false,
          submittedAt: user.dealershipVerifiedAt || user.createdAt,
          notes: "Direct verified dealer account.",
        });
      }
    }

    const dealersList = Array.from(dealersMap.values());

    // Canonical priority ordering: Dealer 1 = Aura Kicks Atelier, Dealer 2 = Kashee's Brand, Dealer 3 = Ahad, then subsequent by creation
    const canonicalOrder = [
      "0xd172aa950446e954c499fdf8d69abfe452f9f79e", // Dealer #1: Aura Kicks Atelier
      "0xd26f32a37bc7039439a51387abf74c127ccdc659", // Dealer #2: Kashee's Brand
      "0x041f913a616362e67cdce5d476f6bdec7776f309", // Dealer #3: Ahad
    ];

    dealersList.sort((a, b) => {
      const idxA = canonicalOrder.indexOf(a.address.toLowerCase());
      const idxB = canonicalOrder.indexOf(b.address.toLowerCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0);
    });

    // Enrich each dealer with activity & position statistics
    const enrichedDealers = await Promise.all(
      dealersList.map(async (dealer, index) => {
        const addr = dealer.address.toLowerCase();

        const [mintedNFTs, activeListings, activeAuctions, orders] = await Promise.all([
          NFT.find({ creator: addr, isActive: true }).select("tokenId title category image initialSupply maxSupply").lean(),
          Listing.find({ seller: addr, isActive: true }).select("listingId tokenId priceInEth quantity").lean(),
          Auction.find({ seller: addr, settled: false, cancelled: false }).select("auctionId tokenId startPriceInEth highestBidInEth endTime").lean(),
          Order.find({ seller: addr }).select("totalPriceInEth quantity createdAt").lean(),
        ]);

        const totalVolumeEth = orders.reduce((sum, o) => sum + (o.totalPriceInEth || 0), 0);
        const totalSalesCount = orders.length;
        const totalMintedNFTs = mintedNFTs.length;
        const activeListingsCount = activeListings.length;
        const activeAuctionsCount = activeAuctions.length;
        const totalSellingCount = activeListingsCount + activeAuctionsCount;

        // Determine performance position tier
        let positionTier = "Standard Dealer";
        let tierBadgeColor = "bg-slate-100 text-slate-700 border-slate-200";
        if (totalVolumeEth >= 5 || totalSalesCount >= 20) {
          positionTier = "Platinum Dealer (Top 1%)";
          tierBadgeColor = "bg-indigo-100 text-indigo-800 border-indigo-300";
        } else if (totalVolumeEth >= 1 || totalSalesCount >= 10) {
          positionTier = "Gold Dealer (VIP)";
          tierBadgeColor = "bg-yellow-100 text-yellow-800 border-yellow-300";
        } else if (totalVolumeEth >= 0.1 || totalSalesCount >= 3) {
          positionTier = "Silver Dealer (Established)";
          tierBadgeColor = "bg-purple-100 text-purple-800 border-purple-300";
        } else if (totalMintedNFTs > 0) {
          positionTier = "Bronze Dealer (Active)";
          tierBadgeColor = "bg-emerald-100 text-emerald-800 border-emerald-300";
        }

        return {
          ...dealer,
          dealerIndex: index + 1,
          dealerLabel: `Dealer #${index + 1}`,
          totalMintedNFTs,
          mintedNFTs,
          mintedNFTsPreview: mintedNFTs.slice(0, 6),
          activeListings,
          activeAuctions,
          activeListingsCount,
          activeAuctionsCount,
          totalSellingCount,
          totalSalesCount,
          totalVolumeEth: parseFloat(totalVolumeEth.toFixed(4)),
          positionTier,
          tierBadgeColor,
        };
      })
    );

    return successResponse(res, "Dealers analytics and activity retrieved successfully.", {
      dealers: enrichedDealers,
      totalCount: enrichedDealers.length,
      verifiedCount: enrichedDealers.filter((d) => d.status === "approved" || d.isDealer).length,
      pendingCount: enrichedDealers.filter((d) => d.status === "pending").length,
      penalizedCount: enrichedDealers.filter((d) => d.isPenalized || d.status === "penalized").length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Specific Dealer Inventory & Live Selling Items
 * GET /api/admin/dealers/:address/inventory
 */
export const getDealerInventory = async (req, res, next) => {
  try {
    const address = req.params.address.toLowerCase();

    const [user, application, mintedNFTs, activeListings, activeAuctions, recentSales] = await Promise.all([
      User.findOne({ address }).lean(),
      DealerApplication.findOne({ applicantAddress: address }).sort({ submittedAt: -1 }).lean(),
      NFT.find({ creator: address }).sort({ tokenId: -1 }).lean(),
      Listing.find({ seller: address, isActive: true }).sort({ createdAt: -1 }).lean(),
      Auction.find({ seller: address, settled: false, cancelled: false }).sort({ createdAt: -1 }).lean(),
      Order.find({ seller: address }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    return successResponse(res, `Inventory details for dealer ${address}.`, {
      dealer: {
        address,
        businessName: application ? application.businessName : (user ? user.username : "Dealer"),
        category: application ? application.category : "Luxury",
        isDealer: user ? user.isDealer : false,
        isPenalized: user ? Boolean(user.isPenalized) : false,
        penaltyReason: user ? user.penaltyReason : "",
        penaltyDate: user ? user.penaltyDate : null,
      },
      mintedNFTs,
      activeListings,
      activeAuctions,
      recentSales,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Impose Exclusivity Violation Penalty on a Dealer
 * POST /api/admin/dealers/penalize
 */
export const penalizeDealer = async (req, res, next) => {
  try {
    const { address, reason, penaltyType = "exclusivity_breach", revokeRole = false } = req.body;
    const cleanAddress = address.toLowerCase();
    const adminAddress = (req.user && req.user.address) || CONTRACT_ADDRESSES.treasury.toLowerCase();
    const penaltyReason = reason || "Violation of ChainArt Platform Exclusivity Agreement. External NFT trading detected.";

    // Update User model
    const user = await User.findOneAndUpdate(
      { address: cleanAddress },
      {
        isPenalized: true,
        penaltyReason,
        penaltyType,
        penaltyDate: new Date(),
        ...(revokeRole ? { isDealer: false } : {}),
      },
      { upsert: true, new: true }
    );

    // Update DealerApplication model if exists
    await DealerApplication.updateMany(
      { applicantAddress: cleanAddress },
      {
        status: "penalized",
        isPenalized: true,
        penaltyReason,
        penaltyDate: new Date(),
        reviewNotes: `Penalized by ${adminAddress}: ${penaltyReason}`,
      }
    );

    // Send urgent notification to dealer
    await Notification.create({
      recipient: cleanAddress,
      title: "⚠️ Exclusivity Policy Penalty Applied",
      message: `Protocol Administration has imposed an exclusivity penalty on your account. Reason: ${penaltyReason}. All dealers must exclusively mint and list high-value luxury assets on ChainArt.`,
      type: "dealer_penalized",
      data: { isPenalized: true, reason: penaltyReason, penaltyType },
    });

    // Record Audit Log
    await AuditLog.create({
      actorAddress: adminAddress,
      action: "DEALER_EXCLUSIVITY_PENALIZED",
      target: cleanAddress,
      metadata: { reason: penaltyReason, penaltyType, revokeRole },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });

    logger.warn(`🚨 Admin ${adminAddress} penalized dealer ${cleanAddress}: ${penaltyReason}`);

    return successResponse(res, `Dealer ${cleanAddress} has been penalized for exclusivity policy violation.`, {
      address: cleanAddress,
      isPenalized: true,
      penaltyReason,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lift Exclusivity Penalty & Restore Dealer Good Standing
 * POST /api/admin/dealers/lift-penalty
 */
export const liftPenalty = async (req, res, next) => {
  try {
    const { address } = req.body;
    const cleanAddress = address.toLowerCase();
    const adminAddress = (req.user && req.user.address) || CONTRACT_ADDRESSES.treasury.toLowerCase();

    await User.findOneAndUpdate(
      { address: cleanAddress },
      {
        isPenalized: false,
        penaltyReason: "",
        penaltyType: "",
        penaltyDate: null,
        isDealer: true,
      }
    );

    await DealerApplication.updateMany(
      { applicantAddress: cleanAddress },
      {
        status: "approved",
        isPenalized: false,
        penaltyReason: "",
        penaltyDate: null,
      }
    );

    await Notification.create({
      recipient: cleanAddress,
      title: "✅ Dealership Penalty Lifted",
      message: "Protocol Administration has reviewed your case and restored your luxury dealership privileges in good standing.",
      type: "dealer_approved",
      data: { isPenalized: false, isDealer: true },
    });

    await AuditLog.create({
      actorAddress: adminAddress,
      action: "DEALER_PENALTY_LIFTED",
      target: cleanAddress,
      metadata: { restored: true },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });

    logger.info(`✨ Admin ${adminAddress} lifted penalty for dealer ${cleanAddress}`);

    return successResponse(res, `Penalty lifted and dealership status restored for ${cleanAddress}.`, {
      address: cleanAddress,
      isPenalized: false,
      isDealer: true,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete / Expel Dealer from Platform
 * DELETE /api/admin/dealers/:address
 */
export const deleteDealer = async (req, res, next) => {
  try {
    const address = req.params.address.toLowerCase();
    const adminAddress = (req.user && req.user.address) || CONTRACT_ADDRESSES.treasury.toLowerCase();

    // Delete application records
    const deleteRes = await DealerApplication.deleteMany({ applicantAddress: address });

    // Revoke dealer status on User record
    await User.findOneAndUpdate(
      { address },
      {
        isDealer: false,
        dealershipVerifiedAt: null,
        isPenalized: false,
        penaltyReason: "",
      }
    );

    await Notification.create({
      recipient: address,
      title: "Dealership Account Removed",
      message: "Protocol administrators have removed your dealership account and revoked platform privileges.",
      type: "dealer_rejected",
      data: { deleted: true },
    });

    await AuditLog.create({
      actorAddress: adminAddress,
      action: "DEALER_DELETED_PERMANENTLY",
      target: address,
      metadata: { deletedApplications: deleteRes.deletedCount },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });

    logger.info(`🗑️ Admin ${adminAddress} deleted dealer ${address}`);

    return successResponse(res, `Dealer ${address} removed from system successfully.`, {
      address,
      deletedApplications: deleteRes.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

