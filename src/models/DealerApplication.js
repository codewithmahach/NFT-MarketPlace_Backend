import mongoose from "mongoose";

const DealerApplicationSchema = new mongoose.Schema(
  {
    applicantAddress: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      required: true,
    },
    yearsInBusiness: {
      type: String,
      default: "",
    },
    website: {
      type: String,
      default: "",
    },
    socialLinks: {
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      linkedin: { type: String, default: "" },
    },
    physicalStoreAddress: {
      type: String,
      default: "",
    },
    provenanceProcess: {
      type: String,
      default: "",
    },
    inventoryEstimatedValue: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "penalized"],
      default: "pending",
      index: true,
    },
    isPenalized: {
      type: Boolean,
      default: false,
    },
    penaltyReason: {
      type: String,
      default: "",
    },
    penaltyDate: {
      type: Date,
      default: null,
    },
    exclusivityAgreed: {
      type: Boolean,
      default: true,
    },
    reviewedBy: {
      type: String,
      lowercase: true,
      default: null,
    },
    reviewNotes: {
      type: String,
      default: "",
    },
    approvalTxHash: {
      type: String,
      default: "",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

DealerApplicationSchema.index({ status: 1, submittedAt: -1 });

export const DealerApplication = mongoose.model("DealerApplication", DealerApplicationSchema);
