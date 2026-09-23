import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    orderType: {
      type: String,
      enum: ["direct_sale", "auction_won"],
      required: true,
      default: "direct_sale",
      index: true,
    },
    referenceId: {
      type: Number, // listingId or auctionId
      required: true,
    },
    buyer: {
      type: String,
      required: true,
      lowercase: true,
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
    pricePerUnit: {
      type: String,
      required: true,
    },
    totalPrice: {
      type: String,
      required: true,
    },
    totalPriceInEth: {
      type: Number,
      required: true,
    },
    paymentToken: {
      type: String,
      required: true,
      lowercase: true,
    },
    royaltyRecipient: {
      type: String,
      lowercase: true,
      default: "",
    },
    royaltyAmount: {
      type: String,
      default: "0",
    },
    protocolFeeAmount: {
      type: String,
      default: "0",
    },
    sellerProceeds: {
      type: String,
      default: "0",
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

OrderSchema.index({ buyer: 1, createdAt: -1 });
OrderSchema.index({ seller: 1, createdAt: -1 });
OrderSchema.index({ tokenId: 1, createdAt: -1 });

export const Order = mongoose.model("Order", OrderSchema);
