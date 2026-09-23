import mongoose from "mongoose";

const ListingSchema = new mongoose.Schema(
  {
    listingId: {
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
    initialQuantity: {
      type: Number,
      default: 1,
    },
    price: {
      type: String, // Wei representation as string to avoid precision loss
      required: true,
    },
    priceInEth: {
      type: Number, // Parsed decimal for sorting and filtering
      required: true,
      index: true,
    },
    paymentToken: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    isDirectSale: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isCancelled: {
      type: Boolean,
      default: false,
    },
    isSoldOut: {
      type: Boolean,
      default: false,
    },
    saleSequence: {
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
    expiresAt: {
      type: Date,
      default: null,
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

ListingSchema.index({ isActive: 1, priceInEth: 1 });
ListingSchema.index({ seller: 1, isActive: 1 });
ListingSchema.index({ tokenId: 1, isActive: 1 });

export const Listing = mongoose.model("Listing", ListingSchema);
