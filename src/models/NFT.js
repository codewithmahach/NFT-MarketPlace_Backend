import mongoose from "mongoose";

const NFTAttributeSchema = new mongoose.Schema(
  {
    trait_type: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const NFTOwnerSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, lowercase: true },
    balance: { type: Number, required: true, default: 1 },
  },
  { _id: false }
);

const NFTSchema = new mongoose.Schema(
  {
    tokenId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    contractAddress: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    creator: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: "text",
    },
    description: {
      type: String,
      default: "",
      trim: true,
      index: "text",
    },
    category: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    image: {
      type: String,
      required: true,
    },
    imageData: {
      type: String,
      default: "",
    },
    metadataJSON: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    animationUrl: {
      type: String,
      default: "",
    },
    attributes: [NFTAttributeSchema],
    tokenUri: {
      type: String,
      default: "",
    },
    maxSupply: {
      type: Number,
      default: 1,
    },
    totalSupply: {
      type: Number,
      default: 1,
    },
    initialSupply: {
      type: Number,
      default: 1,
    },
    royaltyRecipient: {
      type: String,
      lowercase: true,
      default: "",
    },
    royaltyFeeBps: {
      type: Number,
      default: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    owners: [NFTOwnerSchema],
    activeListingId: {
      type: Number,
      default: null,
    },
    activeAuctionId: {
      type: Number,
      default: null,
    },
    viewsCount: {
      type: Number,
      default: 0,
    },
    favoritesCount: {
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
    demoNotice: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

NFTSchema.index({ category: 1, createdAt: -1 });
NFTSchema.index({ "owners.address": 1 });

export const NFT = mongoose.model("NFT", NFTSchema);
