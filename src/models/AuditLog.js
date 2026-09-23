import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    actorAddress: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    target: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", AuditLogSchema);
