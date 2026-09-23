import express from "express";
import multer from "multer";
import {
  getAllNFTs,
  getNFTById,
  getCategories,
  getFeaturedNFTs,
  getUserNFTs,
  generateMetadata,
  registerMintedNFT,
  uploadNFTImage,
  syncNFTSupply,
} from "../controllers/nftController.js";
import { optionalAuth, authenticateJWT } from "../middleware/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WEBP, GIF, SVG) are allowed."), false);
    }
  },
});

const router = express.Router();

router.get("/", optionalAuth, getAllNFTs);
router.get("/categories", getCategories);
router.get("/featured", getFeaturedNFTs);
router.get("/user/:address", getUserNFTs);
router.post("/upload-image", optionalAuth, upload.single("image"), uploadNFTImage);
router.post("/generate-metadata", optionalAuth, generateMetadata);
router.post("/sync-minted", optionalAuth, registerMintedNFT);
router.post("/sync-supply", optionalAuth, syncNFTSupply);
router.get("/:tokenId", optionalAuth, getNFTById);

export default router;
