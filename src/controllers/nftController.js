import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { NFT } from "../models/NFT.js";
import { UploadedImage } from "../models/UploadedImage.js";
import { Listing } from "../models/Listing.js";
import { Auction } from "../models/Auction.js";
import { Order } from "../models/Order.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { CATEGORIES, ERROR_CODES } from "../config/constants.js";
import { getContractInstance } from "../config/contracts.js";
import { generateNFTMetadata } from "../utils/metadataHelper.js";
import { uploadFileToPinata } from "../services/pinataService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../../public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const getBackendBaseUrl = (req) => {
  if (process.env.BACKEND_PUBLIC_URL && process.env.BACKEND_PUBLIC_URL.trim() !== "") {
    return process.env.BACKEND_PUBLIC_URL.trim().replace(/\/+$/, "");
  }
  if (req) {
    const host = req.get("host");
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
      return `${protocol}://${host}`;
    }
  }
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
};

/**
 * Get All NFTs with Filters & Search
 * GET /api/nfts
 */
export const getAllNFTs = async (req, res, next) => {
  try {
    const {
      category,
      search,
      status, // 'listed', 'auction', 'all'
      minPrice,
      maxPrice,
      sortBy = "newest", // 'newest', 'price_asc', 'price_desc', 'popular'
      page = 1,
      limit = 24,
    } = req.query;

    const query = { isActive: true };

    if (category && category !== "all") {
      query.category = category.toLowerCase();
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    if (status === "listed") {
      query.activeListingId = { $ne: null };
    } else if (status === "auction") {
      query.activeAuctionId = { $ne: null };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    let sortOptions = { createdAt: -1 };
    if (sortBy === "popular") {
      sortOptions = { viewsCount: -1, favoritesCount: -1 };
    }

    const [nfts, total] = await Promise.all([
      NFT.find(query).sort(sortOptions).skip(skip).limit(parsedLimit).lean(),
      NFT.countDocuments(query),
    ]);

    // Attach active listing and auction details
    const enrichedNFTs = await Promise.all(
      nfts.map(async (nft) => {
        let activeListing = null;
        let activeAuction = null;

        if (nft.activeListingId) {
          activeListing = await Listing.findOne({ listingId: nft.activeListingId, isActive: true }).lean();
        }
        if (!activeListing) {
          activeListing = await Listing.findOne({ tokenId: nft.tokenId, isActive: true }).sort({ createdAt: -1 }).lean();
        }

        if (nft.activeAuctionId) {
          activeAuction = await Auction.findOne({ auctionId: nft.activeAuctionId, settled: false, cancelled: false }).lean();
        }
        if (!activeAuction) {
          activeAuction = await Auction.findOne({ tokenId: nft.tokenId, settled: false, cancelled: false }).sort({ createdAt: -1 }).lean();
        }

        return {
          ...nft,
          activeListing,
          activeAuction,
        };
      })
    );

    return successResponse(res, "NFTs retrieved successfully.", {
      nfts: enrichedNFTs,
      pagination: {
        page: parseInt(page, 10),
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get NFT Details by Token ID
 * GET /api/nfts/:tokenId
 */
export const getNFTById = async (req, res, next) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return errorResponse(res, "Invalid token ID.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Increment view count
    const nft = await NFT.findOneAndUpdate(
      { tokenId },
      { $inc: { viewsCount: 1 } },
      { new: true }
    ).lean();

    if (!nft) {
      return errorResponse(res, `NFT #${tokenId} not found.`, null, 404, ERROR_CODES.NOT_FOUND);
    }

    // Fetch active listing, active auction, and sales history
    const [activeListing, activeAuction, history] = await Promise.all([
      Listing.findOne({ tokenId, isActive: true }).lean(),
      Auction.findOne({ tokenId, settled: false, cancelled: false }).lean(),
      Order.find({ tokenId }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    return successResponse(res, "NFT details retrieved successfully.", {
      nft,
      activeListing,
      activeAuction,
      history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Categories with Metadata and Item Counts
 * GET /api/nfts/categories
 */
export const getCategories = async (req, res, next) => {
  try {
    const categoryCounts = await NFT.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    categoryCounts.forEach((c) => {
      countMap[c._id.toLowerCase()] = c.count;
    });

    const categoryData = CATEGORIES.map((cat) => ({
      id: cat,
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      count: countMap[cat] || 0,
      banner: `/images/categories/${cat}/banner.jpg`,
    }));

    return successResponse(res, "Categories retrieved successfully.", categoryData);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Featured Luxury NFTs
 * GET /api/nfts/featured
 */
export const getFeaturedNFTs = async (req, res, next) => {
  try {
    const featured = await NFT.find({ isActive: true })
      .sort({ favoritesCount: -1, viewsCount: -1 })
      .limit(8)
      .lean();

    const enriched = await Promise.all(
      featured.map(async (nft) => {
        const listing = await Listing.findOne({ tokenId: nft.tokenId, isActive: true }).lean();
        const auction = await Auction.findOne({ tokenId: nft.tokenId, settled: false, cancelled: false }).lean();
        return { ...nft, activeListing: listing, activeAuction: auction };
      })
    );

    return successResponse(res, "Featured NFTs retrieved successfully.", enriched);
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Owned or Created NFTs
 * GET /api/nfts/user/:address
 */
export const getUserNFTs = async (req, res, next) => {
  try {
    const address = req.params.address.toLowerCase();
    const { type = "owned" } = req.query; // 'owned', 'created'

    let query = {};
    if (type === "created") {
      query = { creator: address };
    } else {
      query = { "owners.address": address, "owners.balance": { $gt: 0 } };
    }

    const nfts = await NFT.find(query).sort({ createdAt: -1 }).lean();

    const enrichedNFTs = await Promise.all(
      nfts.map(async (nft) => {
        let activeListing = null;
        let activeAuction = null;

        if (nft.activeListingId) {
          activeListing = await Listing.findOne({
            listingId: nft.activeListingId,
            isActive: true,
          }).lean();
        } else {
          activeListing = await Listing.findOne({
            tokenId: nft.tokenId,
            isActive: true,
          }).lean();
        }

        if (nft.activeAuctionId) {
          activeAuction = await Auction.findOne({
            auctionId: nft.activeAuctionId,
            settled: false,
            cancelled: false,
          }).lean();
        } else {
          activeAuction = await Auction.findOne({
            tokenId: nft.tokenId,
            settled: false,
            cancelled: false,
          }).lean();
        }

        return {
          ...nft,
          activeListing,
          activeAuction,
        };
      })
    );

    return successResponse(res, "User NFTs retrieved successfully.", enrichedNFTs);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate Standardized IPFS Metadata URI
 * POST /api/nfts/generate-metadata
 */
export const generateMetadata = async (req, res, next) => {
  try {
    const {
      name,
      category,
      description,
      image,
      attributes,
      initialSupply,
      maxSupply,
      royaltyBps,
      creator,
    } = req.body;

    if (!name || !category) {
      return errorResponse(res, "Name and category are required.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const { tokenURI, metadata } = await generateNFTMetadata({
      name,
      category,
      description,
      image,
      attributes,
      initialSupply,
      maxSupply,
      royaltyBps,
      creator: creator || (req.user ? req.user.address : undefined),
    });

    return successResponse(res, "Metadata generated successfully.", {
      tokenURI,
      metadata,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register / Sync Newly Minted NFT
 * POST /api/nfts/sync-minted
 */
export const registerMintedNFT = async (req, res, next) => {
  try {
    const {
      tokenId,
      title,
      name,
      category,
      description,
      image,
      initialSupply,
      maxSupply,
      tokenUri,
      metadataURI,
      royaltyFeeBps,
      creator,
      txHash,
    } = req.body;

    const nftTitle = title || name || "Luxury Asset";
    const nftCategory = (category || "Watches").toLowerCase();
    const nftCreator = (creator || (req.user ? req.user.address : "")).toLowerCase();
    const tId = parseInt(tokenId, 10);

    if (isNaN(tId)) {
      return errorResponse(res, "Valid tokenId is required for sync.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const existing = await NFT.findOne({ tokenId: tId });
    const finalImage = image || (existing && existing.image && !existing.image.startsWith("/images/categories/") ? existing.image : "") || `/images/categories/${nftCategory}/${nftTitle.toLowerCase().replace(/\s+/g, "_")}.jpg`;

    const nft = await NFT.findOneAndUpdate(
      { tokenId: tId },
      {
        tokenId: tId,
        contractAddress: "0xF9CFB066E7c755a22D9C632d941BCC29dd3C196f".toLowerCase(),
        creator: nftCreator,
        title: nftTitle,
        description: description || "",
        category: nftCategory,
        image: finalImage,
        tokenUri: tokenUri || metadataURI || "",
        initialSupply: parseInt(initialSupply, 10) || 1,
        maxSupply: parseInt(maxSupply, 10) || parseInt(initialSupply, 10) || 1,
        totalSupply: parseInt(initialSupply, 10) || 1,
        royaltyFeeBps: parseInt(royaltyFeeBps, 10) || 500,
        owners: [{ address: nftCreator, balance: parseInt(initialSupply, 10) || 1 }],
        txHash: txHash || "",
        isActive: true,
        isVerifiedOnChain: true,
      },
      { upsert: true, new: true }
    );

    return successResponse(res, "Minted NFT registered successfully.", nft);
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Image File to Pinata IPFS & Persist to MongoDB Atlas
 * POST /api/nfts/upload-image
 */
export const uploadNFTImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, "No image file provided.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const { originalname, mimetype, buffer } = req.file;
    const customName = req.body.name || originalname;

    // 1. Save uploaded image permanently to local public/uploads directory
    const ext = path.extname(originalname) || (mimetype.includes("jpeg") ? ".jpg" : mimetype.includes("png") ? ".png" : mimetype.includes("webp") ? ".webp" : ".jpg");
    const safeFileName = `nft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    const filePath = path.join(uploadsDir, safeFileName);
    fs.writeFileSync(filePath, buffer);

    const base64Data = buffer.toString("base64");
    const dataUri = `data:${mimetype || "image/jpeg"};base64,${base64Data}`;

    // 2. Upload to Pinata IPFS (or generate cryptographic IPFS CID)
    const uploadResult = await uploadFileToPinata(buffer, originalname, mimetype, customName);

    // 3. PERSIST IN MONGODB ATLAS (So restarts on Render never lose this image!)
    await UploadedImage.findOneAndUpdate(
      { filename: safeFileName },
      {
        filename: safeFileName,
        mimetype: mimetype || "image/jpeg",
        base64Data,
        size: buffer.length,
        ipfsHash: uploadResult.ipfsHash || "",
        uploader: (req.user ? req.user.address : "").toLowerCase(),
      },
      { upsert: true, new: true }
    );

    const baseUrl = getBackendBaseUrl(req);
    const publicImageUrl = `${baseUrl}/uploads/${safeFileName}`;
    const gatewayUrl = uploadResult.isPinata ? uploadResult.gatewayUrl : publicImageUrl;

    return successResponse(res, "Image uploaded and stored permanently.", {
      ipfsUri: uploadResult.ipfsUri,
      ipfsHash: uploadResult.ipfsHash,
      gatewayUrl: gatewayUrl,
      localUrl: publicImageUrl,
      dataUri: dataUri,
      filename: safeFileName,
      isPinata: uploadResult.isPinata,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Standard ERC-1155 OpenSea/MetaMask Metadata JSON
 * GET /api/nfts/:tokenId/metadata
 * GET /api/nfts/:tokenId/token-uri.json
 */
export const getNFTMetadata = async (req, res, next) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: "Invalid tokenId" });
    }

    const nft = await NFT.findOne({ tokenId }).lean();
    if (!nft) {
      return res.status(404).json({ error: `NFT #${tokenId} not found` });
    }

    const baseUrl = getBackendBaseUrl(req);
    let resolvedImage = nft.image;
    if (resolvedImage && resolvedImage.startsWith("/uploads/")) {
      resolvedImage = `${baseUrl}${resolvedImage}`;
    } else if (resolvedImage && (resolvedImage.includes("localhost:5000") || resolvedImage.includes("localhost:10000"))) {
      resolvedImage = resolvedImage.replace(/http:\/\/localhost:\d+/, baseUrl);
    }

    const metadata = {
      name: nft.title || `Luxury Asset #${nft.tokenId}`,
      description: nft.description || `Verified luxury ${nft.category} asset tokenized on ChainArt with on-chain provenance.`,
      image: resolvedImage,
      external_url: `https://chainart.luxury/nft/${nft.tokenId}`,
      category: nft.category,
      properties: {
        category: nft.category,
        creator: nft.creator,
        initialSupply: nft.initialSupply || 10,
        maxSupply: nft.maxSupply || 10,
        royaltyFeeBps: nft.royaltyFeeBps || 500,
        contractAddress: nft.contractAddress,
      },
      attributes: (nft.attributes && nft.attributes.length > 0)
        ? nft.attributes
        : [
            { trait_type: "Category", value: nft.category },
            { trait_type: "Brand / Creator", value: nft.brand || "Verified Brand Dealer" },
            { trait_type: "Total Supply", value: `${nft.totalSupply || 10} Editions` },
            { trait_type: "Standard", value: "ERC-1155 Verified" },
          ],
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.json(metadata);
  } catch (error) {
    next(error);
  }
};

/**
 * Sync / Increment NFT Supply after mintMore
 * POST /api/nfts/sync-supply
 */
export const syncNFTSupply = async (req, res, next) => {
  try {
    const { tokenId, addedAmount, recipient } = req.body;
    const tId = parseInt(tokenId, 10);
    const amount = parseInt(addedAmount, 10);

    if (isNaN(tId) || isNaN(amount) || amount <= 0) {
      return errorResponse(res, "Valid tokenId and positive addedAmount are required.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const nft = await NFT.findOne({ tokenId: tId });
    if (!nft) {
      return errorResponse(res, `NFT #${tId} not found.`, null, 404, ERROR_CODES.NOT_FOUND);
    }

    const targetAddress = (recipient || (req.user ? req.user.address : nft.creator)).toLowerCase();

    // Increment supply
    nft.totalSupply = (nft.totalSupply || nft.initialSupply || 1) + amount;
    nft.initialSupply = (nft.initialSupply || 1) + amount;

    // Update owner balance
    const ownerIndex = nft.owners.findIndex((o) => o.address.toLowerCase() === targetAddress);
    if (ownerIndex >= 0) {
      nft.owners[ownerIndex].balance += amount;
    } else {
      nft.owners.push({ address: targetAddress, balance: amount });
    }

    await nft.save();

    return successResponse(res, `Supply for Token #${tId} updated successfully.`, nft);
  } catch (error) {
    next(error);
  }
};


