import mongoose from "mongoose";

const BlockchainEventSchema = new mongoose.Schema(
  {
    contractAddress: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    contractName: {
      type: String,
      required: true,
    },
    eventName: {
      type: String,
      required: true,
      index: true,
    },
    blockNumber: {
      type: Number,
      required: true,
      index: true,
    },
    logIndex: {
      type: Number,
      required: true,
    },
    transactionHash: {
      type: String,
      required: true,
      index: true,
    },
    args: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    processed: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for idempotency
BlockchainEventSchema.index({ transactionHash: 1, logIndex: 1 }, { unique: true });
BlockchainEventSchema.index({ eventName: 1, blockNumber: -1 });

export const BlockchainEvent = mongoose.model("BlockchainEvent", BlockchainEventSchema);
