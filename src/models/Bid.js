import mongoose from "mongoose";

const BidSchema = new mongoose.Schema(
  {
    auctionId: {
      type: Number,
      required: true,
      index: true,
    },
    bidder: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    amount: {
      type: String,
      required: true,
    },
    amountInEth: {
      type: Number,
      required: true,
    },
    paymentToken: {
      type: String,
      required: true,
      lowercase: true,
    },
    txHash: {
      type: String,
      required: true,
      index: true,
    },
    blockNumber: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

BidSchema.index({ auctionId: 1, amountInEth: -1 });

export const Bid = mongoose.model("Bid", BidSchema);
