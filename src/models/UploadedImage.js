import mongoose from "mongoose";

const UploadedImageSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    mimetype: {
      type: String,
      default: "image/jpeg",
    },
    base64Data: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      default: 0,
    },
    ipfsHash: {
      type: String,
      default: "",
    },
    uploader: {
      type: String,
      lowercase: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export const UploadedImage = mongoose.model("UploadedImage", UploadedImageSchema);
