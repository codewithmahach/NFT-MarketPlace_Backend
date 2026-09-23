import mongoose from "mongoose";

const AuctionSchema = new mongoose.Schema(
  {
    auctionId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    seller: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    tokenId: {
      type: Number,
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    startingPrice: {
      type: String,
      required: true,
    },
    startingPriceInEth: {
      type: Number,
      required: true,
    },
    reservePrice: {
      type: String,
      default: "0",
    },
    reservePriceInEth: {
      type: Number,
      default: 0,
    },
    highestBid: {
      type: String,
      default: "0",
    },
    highestBidInEth: {
      type: Number,
      default: 0,
      index: true,
    },
    highestBidder: {
      type: String,
      lowercase: true,
      default: "0x0000000000000000000000000000000000000000",
      index: true,
    },
    paymentToken: {
      type: String,
      required: true,
      lowercase: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
      index: true,
    },
    settled: {
      type: Boolean,
      default: false,
      index: true,
    },
    cancelled: {
      type: Boolean,
      default: false,
      index: true,
    },
    bidsCount: {
      type: Number,
      default: 0,
    },
    minBidIncrement: {
      type: String,
      default: "0",
    },
    minBidIncrementInEth: {
      type: Number,
      default: 0,
    },
    txHash: {
      type: String,
      default: "",
    },
    blockNumber: {
      type: Number,
      default: 0,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
    isVerifiedOnChain: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

AuctionSchema.index({ settled: 1, cancelled: 1, endTime: 1 });
AuctionSchema.index({ seller: 1, settled: 1 });
AuctionSchema.index({ tokenId: 1, settled: 1 });

export const Auction = mongoose.model("Auction", AuctionSchema);
