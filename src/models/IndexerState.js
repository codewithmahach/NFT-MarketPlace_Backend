import mongoose from "mongoose";

const IndexerStateSchema = new mongoose.Schema(
  {
    contractName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastProcessedBlock: {
      type: Number,
      required: true,
      default: 0,
    },
    lastSyncTimestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const IndexerState = mongoose.model("IndexerState", IndexerStateSchema);
