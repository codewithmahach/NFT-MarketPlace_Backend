import mongoose from "mongoose";

const NonceSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    nonce: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index to auto-expire
    },
  },
  {
    timestamps: true,
  }
);

export const Nonce = mongoose.model("Nonce", NonceSchema);
