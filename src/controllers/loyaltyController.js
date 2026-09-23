import { ethers } from "ethers";
import { LoyaltyProfile } from "../models/LoyaltyProfile.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { LOYALTY_TIERS, PROTOCOL_CONSTANTS, ERROR_CODES } from "../config/constants.js";
import { getContractInstance } from "../config/contracts.js";
import { verifyTransaction } from "../blockchain/verifier.js";

/**
 * Get User Loyalty Profile & Milestone Progress
 * GET /api/loyalty/profile/:address
 */
export const getLoyaltyProfile = async (req, res, next) => {
  try {
    const address = req.params.address.toLowerCase();

    let profile = await LoyaltyProfile.findOne({ userAddress: address }).lean();

    // Query on-chain loyalty contract for live sync
    try {
      const loyaltyContract = getContractInstance("loyalty");
      const [onChainPoints, totalSales, completedMilestones] = await Promise.all([
        loyaltyContract.loyaltyPoints(address).catch(() => 0n),
        loyaltyContract.salesCount(address).catch(() => 0n),
        loyaltyContract.claimedMilestones(address).catch(() => 0n),
      ]);

      const pts = Number(onChainPoints);
      const sales = Number(totalSales);
      const claimed = Number(completedMilestones);

      if (!profile) {
        profile = {
          userAddress: address,
          totalPoints: pts,
          completedSalesCount: sales,
          claimedMilestonesCount: claimed,
          history: [],
        };
      } else {
        profile.totalPoints = Math.max(profile.totalPoints, pts);
        profile.completedSalesCount = Math.max(profile.completedSalesCount, sales);
        profile.claimedMilestonesCount = Math.max(profile.claimedMilestonesCount, claimed);
      }
    } catch {
      // Use DB profile
    }

    if (!profile) {
      profile = {
        userAddress: address,
        totalPoints: 0,
        completedSalesCount: 0,
        claimedMilestonesCount: 0,
        history: [],
      };
    }

    // Determine current tier perks
    let tierInfo = LOYALTY_TIERS.BRONZE;
    if (profile.totalPoints >= LOYALTY_TIERS.PLATINUM.minPoints) {
      tierInfo = LOYALTY_TIERS.PLATINUM;
    } else if (profile.totalPoints >= LOYALTY_TIERS.GOLD.minPoints) {
      tierInfo = LOYALTY_TIERS.GOLD;
    } else if (profile.totalPoints >= LOYALTY_TIERS.SILVER.minPoints) {
      tierInfo = LOYALTY_TIERS.SILVER;
    }

    // Calculate milestone progress (10 sales = 0.05 ETH)
    const milestoneSales = PROTOCOL_CONSTANTS.MILESTONE_SALES_COUNT; // 10
    const salesProgress = profile.completedSalesCount % milestoneSales;
    const eligibleMilestones = Math.floor(profile.completedSalesCount / milestoneSales);
    const unclaimedMilestones = Math.max(0, eligibleMilestones - profile.claimedMilestonesCount);
    const isClaimEligible = unclaimedMilestones > 0;
    const rewardPerMilestoneEth = parseFloat(ethers.formatEther(PROTOCOL_CONSTANTS.MILESTONE_REWARD_WEI));
    const claimableRewardEth = (unclaimedMilestones * rewardPerMilestoneEth).toFixed(2);

    return successResponse(res, "Loyalty profile retrieved successfully.", {
      profile: {
        ...profile,
        currentTier: tierInfo.name,
        tierBadge: tierInfo.badge,
        feeDiscountPercent: `${tierInfo.feeDiscountBps / 100}%`,
      },
      tierBenefits: LOYALTY_TIERS,
      milestone: {
        targetSales: milestoneSales,
        currentSalesInMilestone: salesProgress,
        percentToNextMilestone: Math.min(100, Math.round((salesProgress / milestoneSales) * 100)),
        totalCompletedMilestones: eligibleMilestones,
        claimedMilestones: profile.claimedMilestonesCount,
        unclaimedMilestones,
        isClaimEligible,
        claimableRewardEth,
        rewardPerMilestone: `${rewardPerMilestoneEth} ETH`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Loyalty Leaderboard
 * GET /api/loyalty/leaderboard
 */
export const getLeaderboard = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;

    const topProfiles = await LoyaltyProfile.find({})
      .sort({ totalPoints: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    const ranked = topProfiles.map((p, idx) => ({
      rank: idx + 1,
      userAddress: p.userAddress,
      totalPoints: p.totalPoints,
      currentTier: p.currentTier,
      completedSalesCount: p.completedSalesCount,
      claimedMilestonesCount: p.claimedMilestonesCount,
    }));

    return successResponse(res, "Leaderboard retrieved successfully.", ranked);
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Milestone Reward Claim On-Chain
 * POST /api/loyalty/verify-claim
 */
export const verifyRewardClaim = async (req, res, next) => {
  try {
    const { txHash, userAddress } = req.body;
    if (!txHash) {
      return errorResponse(res, "Transaction hash is required.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const txResult = await verifyTransaction(txHash);
    if (!txResult.verified) {
      return errorResponse(
        res,
        "Reward claim transaction verification failed on Ethereum Sepolia.",
        txResult,
        400,
        ERROR_CODES.BLOCKCHAIN_ERROR
      );
    }

    const address = (userAddress || txResult.from).toLowerCase();
    const profile = await LoyaltyProfile.findOneAndUpdate(
      { userAddress: address },
      {
        $inc: { claimedMilestonesCount: 1 },
        $push: {
          history: {
            type: "milestone_claim",
            rewardAmountWei: ethers.parseEther("0.05").toString(),
            txHash,
            description: "Claimed 0.05 ETH milestone reward",
            timestamp: new Date(),
          },
        },
      },
      { upsert: true, new: true }
    );

    return successResponse(res, "Reward claim successfully verified.", {
      verified: true,
      profile,
    });
  } catch (error) {
    next(error);
  }
};
