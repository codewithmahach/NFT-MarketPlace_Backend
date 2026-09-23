import { uploadJSONToPinata } from "../services/pinataService.js";

/**
 * Generate ERC-1155 & ERC-2981 Standard Metadata & Pin to Pinata IPFS
 */
const DEFAULT_CATEGORY_IMAGES = {
  watches: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
  cars: "https://images.unsplash.com/photo-1592198084033-aade902d1aae?auto=format&fit=crop&w=1200&q=80",
  jewelry: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80",
  handbags: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80",
  art: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80",
  shoes: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1200&q=80",
  spirits: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1200&q=80",
  antiques: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
  fashion: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1200&q=80",
  luxury: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
};

export const generateNFTMetadata = async ({
  name,
  category,
  description,
  image,
  attributes = [],
  initialSupply = 10,
  maxSupply = 10,
  royaltyBps = 500,
  creator = "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
}) => {
  const catKey = (category || "luxury").toLowerCase();
  const formattedCategory = category
    ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
    : "Luxury";

  const resolvedImage = image || DEFAULT_CATEGORY_IMAGES[catKey] || DEFAULT_CATEGORY_IMAGES.luxury;

  // Build standard luxury traits
  const defaultAttributes = [
    { trait_type: "Category", value: formattedCategory },
    { trait_type: "Authenticity", value: "Verified Dealer Certificate" },
    { trait_type: "Token Standard", value: "ERC-1155 Multi-Token" },
    { trait_type: "Royalty", value: `${(royaltyBps / 100).toFixed(1)}%` },
  ];

  const mergedAttributes = [
    ...defaultAttributes,
    ...(Array.isArray(attributes) ? attributes : []),
  ];

  const metadata = {
    name: name || "ChainArt Luxury Collectible",
    description:
      description ||
      `Authentic ${formattedCategory} asset tokenized on ChainArt with on-chain provenance and ERC-2981 royalty guarantee.`,
    image: resolvedImage,
    external_url: "https://chainart.luxury",
    category: formattedCategory.toLowerCase(),
    attributes: mergedAttributes,
    properties: {
      initialSupply: parseInt(initialSupply, 10),
      maxSupply: parseInt(maxSupply, 10),
      royaltyBps: parseInt(royaltyBps, 10),
      creator,
    },
  };

  // Pin JSON to Pinata IPFS
  const pinRes = await uploadJSONToPinata(metadata, `${(name || "NFT").replace(/[^a-zA-Z0-9]/g, "_")}_metadata.json`);

  return {
    tokenURI: pinRes.tokenURI,
    ipfsHash: pinRes.ipfsHash,
    gatewayUrl: pinRes.gatewayUrl,
    isPinata: pinRes.isPinata,
    metadata,
  };
};

