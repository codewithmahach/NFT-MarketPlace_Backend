import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      default: "",
      trim: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    isDealer: {
      type: Boolean,
      default: false,
      index: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    dealershipVerifiedAt: {
      type: Date,
      default: null,
    },
    isPenalized: {
      type: Boolean,
      default: false,
      index: true,
    },
    penaltyReason: {
      type: String,
      default: "",
    },
    penaltyDate: {
      type: Date,
      default: null,
    },
    penaltyType: {
      type: String,
      default: "",
    },
    exclusivityAgreed: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      bidAlerts: { type: Boolean, default: true },
      priceChangeAlerts: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model("User", UserSchema);
