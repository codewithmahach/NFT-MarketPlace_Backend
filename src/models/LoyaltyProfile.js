import mongoose from "mongoose";

const LoyaltyHistoryItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["sale_reward", "purchase_reward", "auction_reward", "milestone_claim"],
      required: true,
    },
    points: {
      type: Number,
      default: 0,
    },
    rewardAmountWei: {
      type: String,
      default: "0",
    },
    txHash: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const LoyaltyProfileSchema = new mongoose.Schema(
  {
    userAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    totalPoints: {
      type: Number,
      default: 0,
      index: true,
    },
    currentTier: {
      type: String,
      enum: ["Bronze", "Silver", "Gold", "Platinum"],
      default: "Bronze",
      index: true,
    },
    completedSalesCount: {
      type: Number,
      default: 0,
    },
    claimedMilestonesCount: {
      type: Number,
      default: 0,
    },
    pendingRewardsWei: {
      type: String,
      default: "0",
    },
    history: [LoyaltyHistoryItemSchema],
  },
  {
    timestamps: true,
  }
);

LoyaltyProfileSchema.index({ totalPoints: -1 });

export const LoyaltyProfile = mongoose.model("LoyaltyProfile", LoyaltyProfileSchema);
