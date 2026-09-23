import mongoose from "mongoose";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { NFT } from "../models/NFT.js";
import { Listing } from "../models/Listing.js";
import { Auction } from "../models/Auction.js";
import { User } from "../models/User.js";
import { LoyaltyProfile } from "../models/LoyaltyProfile.js";
import { DealerApplication } from "../models/DealerApplication.js";
import { Notification } from "../models/Notification.js";
import { CONTRACT_ADDRESSES } from "../config/constants.js";
import { logger } from "./logger.js";

dotenv.config();

const MOCK_NFTS = [
  // ================= WATCHES =================
  {
    tokenId: 1,
    title: "Rolex Daytona Platinum 950 'Ice Blue' Baguette Dial",
    category: "watches",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 5,
    initialSupply: 5,
    totalSupply: 5,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "Reference 116506 in solid 950 platinum with chestnut brown Cerachrom ceramic bezel, ice blue sunray dial, and factory baguette diamond hour markers.",
    attributes: [
      { trait_type: "Brand", value: "Rolex" },
      { trait_type: "Model", value: "Cosmograph Daytona" },
      { trait_type: "Material", value: "Platinum 950" },
      { trait_type: "Dial", value: "Ice Blue Baguette" },
      { trait_type: "Movement", value: "Calibre 4130" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeAuctionId: 1,
  },
  {
    tokenId: 2,
    title: "Patek Philippe Nautilus 5711/1R Rose Gold",
    category: "watches",
    image: "https://images.unsplash.com/photo-1547996160-71dfa6358260?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 8,
    initialSupply: 8,
    totalSupply: 8,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "Iconic Gerald Genta design in 18k rose gold with warm brown sunburst dial, luminescent markers, and sapphire crystal exhibition caseback.",
    attributes: [
      { trait_type: "Brand", value: "Patek Philippe" },
      { trait_type: "Model", value: "Nautilus 5711" },
      { trait_type: "Material", value: "18k Rose Gold" },
      { trait_type: "Movement", value: "Calibre 26-330 S C" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeListingId: 1,
  },
  {
    tokenId: 3,
    title: "Audemars Piguet Royal Oak 'Jumbo' Extra-Thin",
    category: "watches",
    image: "https://images.unsplash.com/photo-1526045612212-70caf35c14df?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 10,
    initialSupply: 10,
    totalSupply: 10,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "Stainless steel 39mm case with Petite Tapisserie blue dial, octagonal bezel with 8 hexagonal white gold screws.",
    attributes: [
      { trait_type: "Brand", value: "Audemars Piguet" },
      { trait_type: "Model", value: "Royal Oak 16202ST" },
      { trait_type: "Pattern", value: "Petite Tapisserie" },
      { trait_type: "Movement", value: "Calibre 7121" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeListingId: 2,
  },

  // ================= CARS =================
  {
    tokenId: 4,
    title: "Ferrari SF90 Stradale 'Rosso Corsa' Assetto Fiorano",
    category: "cars",
    image: "https://images.unsplash.com/photo-1592198084033-aade902d1aae?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 10,
    initialSupply: 10,
    totalSupply: 10,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "The apex of hybrid supercar engineering. 986 hp twin-turbo V8 with triple electric motors and carbon fiber track specification.",
    attributes: [
      { trait_type: "Brand", value: "Ferrari" },
      { trait_type: "Model", value: "SF90 Stradale" },
      { trait_type: "Top Speed", value: "340 km/h" },
      { trait_type: "Horsepower", value: "986 HP" },
      { trait_type: "Color", value: "Rosso Corsa" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeListingId: 3,
  },
  {
    tokenId: 5,
    title: "Porsche 911 GT3 RS Weissach Package",
    category: "cars",
    image: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 6,
    initialSupply: 6,
    totalSupply: 6,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "Naturally aspirated 4.0-liter flat-six engine producing 518 hp with active DRS rear wing aero and magnesium lightweight wheels.",
    attributes: [
      { trait_type: "Brand", value: "Porsche" },
      { trait_type: "Model", value: "911 GT3 RS" },
      { trait_type: "Package", value: "Weissach" },
      { trait_type: "0-100 km/h", value: "3.0s" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeAuctionId: 2,
  },
  {
    tokenId: 6,
    title: "Lamborghini Revuelto V12 Hybrid Hypercar",
    category: "cars",
    image: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 4,
    initialSupply: 4,
    totalSupply: 4,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "1001 hp electrified V12 powertrain, full carbon aeronautics-inspired monocoque chassis with Y-shaped lighting matrix.",
    attributes: [
      { trait_type: "Brand", value: "Lamborghini" },
      { trait_type: "Engine", value: "6.5L V12 + 3 e-Motors" },
      { trait_type: "Horsepower", value: "1001 HP" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeListingId: 4,
  },

  // ================= JEWELRY =================
  {
    tokenId: 7,
    title: "Cartier Emerald & Diamond Panthère High Jewelry Ring",
    category: "jewelry",
    image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 8,
    initialSupply: 8,
    totalSupply: 8,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "18K yellow gold panthère motif with Colombian emerald eyes, onyx nose, and brilliant pavé diamonds totaling 1.85 carats.",
    attributes: [
      { trait_type: "Brand", value: "Cartier" },
      { trait_type: "Gemstone", value: "Colombian Emerald" },
      { trait_type: "Metal", value: "18k Yellow Gold" },
      { trait_type: "Diamonds", value: "1.85ct F-G VVS" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeAuctionId: 3,
  },
  {
    tokenId: 8,
    title: "Tiffany & Co. Schlumberger Diamond & Sapphire Bird on a Rock",
    category: "jewelry",
    image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 5,
    initialSupply: 5,
    totalSupply: 5,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "Platinum and 18k yellow gold brooch featuring a 42-carat untreated Ceylon blue sapphire crested by a diamond-encrusted bird.",
    attributes: [
      { trait_type: "Brand", value: "Tiffany & Co." },
      { trait_type: "Center Stone", value: "42ct Ceylon Sapphire" },
      { trait_type: "Designer", value: "Jean Schlumberger" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeListingId: 5,
  },

  // ================= HANDBAGS =================
  {
    tokenId: 9,
    title: "Hermès Birkin 30 Himalaya Niloticus Crocodile",
    category: "handbags",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 3,
    initialSupply: 3,
    totalSupply: 3,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "Crafted from Niloticus crocodile with 18k white gold hardware encrusted with 245 brilliant-cut diamonds. The holy grail of luxury handbags.",
    attributes: [
      { trait_type: "Brand", value: "Hermès" },
      { trait_type: "Leather", value: "Matte Niloticus Crocodile" },
      { trait_type: "Hardware", value: "18k White Gold & Diamonds" },
      { trait_type: "Size", value: "30 cm" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeAuctionId: 4,
  },
  {
    tokenId: 10,
    title: "Chanel Classic Double Flap Quilted Caviar Leather",
    category: "handbags",
    image: "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 12,
    initialSupply: 12,
    totalSupply: 12,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "Black diamond-quilted grained calfskin with iconic gold-tone metal chain and double CC turnlock closure.",
    attributes: [
      { trait_type: "Brand", value: "Chanel" },
      { trait_type: "Leather", value: "Black Caviar Calfskin" },
      { trait_type: "Hardware", value: "24k Gold Plated" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeListingId: 6,
  },

  // ================= ART =================
  {
    tokenId: 11,
    title: "Celestial Symphony Impressionist Oil Masterpiece",
    category: "art",
    image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 10,
    initialSupply: 10,
    totalSupply: 10,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "An authentic physical & digital twin masterpiece depicting cosmic harmony rendered in layered oil glazes on Belgian linen.",
    attributes: [
      { trait_type: "Medium", value: "Oil on Linen" },
      { trait_type: "Style", value: "Neo-Impressionism" },
      { trait_type: "Dimensions", value: "120 x 90 cm" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeListingId: 7,
  },

  // ================= SHOES =================
  {
    tokenId: 12,
    title: "Air Jordan 1 Retro High 'Chicago' 1985 OG Sample",
    category: "shoes",
    image: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 15,
    initialSupply: 15,
    totalSupply: 15,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "Original 1985 player-sample specification in pristine collector vault condition with verified provenance certificate.",
    attributes: [
      { trait_type: "Year", value: "1985" },
      { trait_type: "Colorway", value: "White / Black - Red" },
      { trait_type: "Condition", value: "Deadstock Vault Grade" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeListingId: 8,
  },
  {
    tokenId: 13,
    title: "Nike Mag 'Back to the Future' 2016 Auto-Lacing",
    category: "shoes",
    image: "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 3,
    initialSupply: 3,
    totalSupply: 3,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "1 of only 89 pairs created with functional power-lacing system and electroluminescent LED glow outsole.",
    attributes: [
      { trait_type: "Edition", value: "2016 Auto-Lacing" },
      { trait_type: "Rarity", value: "1 of 89 Worldwide" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeAuctionId: 5,
  },

  // ================= SPIRITS =================
  {
    tokenId: 14,
    title: "The Macallan 50-Year-Old Single Malt Scotch Whisky",
    category: "spirits",
    image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 10,
    initialSupply: 10,
    totalSupply: 10,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "Distilled in 1970 and matured for five decades in seasoned sherry oak casks from Jerez, Spain. Encased in solid oak presentation chest.",
    attributes: [
      { trait_type: "Distillery", value: "The Macallan" },
      { trait_type: "Age", value: "50 Years" },
      { trait_type: "Cask", value: "Sherry Seasoned Oak" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeListingId: 9,
  },

  // ================= ANTIQUES =================
  {
    tokenId: 15,
    title: "Leica M3 Gold Edition 1956 Rangefinder Camera",
    category: "antiques",
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 6,
    initialSupply: 6,
    totalSupply: 6,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "Rare 24k gold-plated Leica M3 with matching 50mm Summicron f/2 lens and ostrich leather body covering.",
    attributes: [
      { trait_type: "Brand", value: "Leica" },
      { trait_type: "Plating", value: "24k Gold" },
      { trait_type: "Lens", value: "50mm Summicron f/2" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeAuctionId: 6,
  },

  // ================= FASHION =================
  {
    tokenId: 16,
    title: "Maison Francis Kurkdjian Baccarat Rouge 540 Extrait",
    category: "fashion",
    image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1200&q=80",
    maxSupply: 30,
    initialSupply: 30,
    totalSupply: 30,
    creator: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    description: "Luminous and intense olfactory signature featuring Egyptian Grandiflorum jasmine, saffron, bitter almond, and ambergris.",
    attributes: [
      { trait_type: "Brand", value: "Maison Francis Kurkdjian" },
      { trait_type: "Concentration", value: "Extrait de Parfum (40%)" },
      { trait_type: "Key Notes", value: "Saffron, Jasmine, Ambergris" },
    ],
    royaltyRecipient: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    royaltyFeeBps: 500,
    activeListingId: 10,
  },
];

const SEED_LISTINGS = [
  {
    listingId: 1,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 2,
    quantity: 4,
    price: ethers.parseEther("0.12").toString(),
    priceInEth: 0.12,
    paymentToken: ethers.ZeroAddress,
    isDirectSale: true,
    isActive: true,
  },
  {
    listingId: 2,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 3,
    quantity: 6,
    price: ethers.parseEther("0.095").toString(),
    priceInEth: 0.095,
    paymentToken: ethers.ZeroAddress,
    isDirectSale: true,
    isActive: true,
  },
  {
    listingId: 3,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 4,
    quantity: 8,
    price: ethers.parseEther("0.05").toString(),
    priceInEth: 0.05,
    paymentToken: ethers.ZeroAddress,
    isDirectSale: true,
    isActive: true,
  },
  {
    listingId: 4,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 6,
    quantity: 1,
    price: ethers.parseEther("0.14").toString(),
    priceInEth: 0.14,
    paymentToken: ethers.ZeroAddress,
    isDirectSale: true,
    isActive: true,
  },
  {
    listingId: 5,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 8,
    quantity: 2,
    price: ethers.parseEther("0.088").toString(),
    priceInEth: 0.088,
    paymentToken: ethers.ZeroAddress,
    isDirectSale: true,
    isActive: true,
  },
  {
    listingId: 6,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 10,
    quantity: 5,
    price: ethers.parseEther("0.038").toString(),
    priceInEth: 0.038,
    paymentToken: ethers.ZeroAddress,
    isDirectSale: true,
    isActive: true,
  },
  {
    listingId: 7,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 11,
    quantity: 6,
    price: ethers.parseEther("0.03").toString(),
    priceInEth: 0.03,
    paymentToken: ethers.ZeroAddress,
    isDirectSale: true,
    isActive: true,
  },
  {
    listingId: 8,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 12,
    quantity: 5,
    price: ethers.parseEther("0.04").toString(),
    priceInEth: 0.04,
    paymentToken: ethers.ZeroAddress,
    isDirectSale: true,
    isActive: true,
  },
  {
    listingId: 9,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 14,
    quantity: 5,
    price: ethers.parseEther("0.06").toString(),
    priceInEth: 0.06,
    paymentToken: ethers.ZeroAddress,
    isDirectSale: true,
    isActive: true,
  },
  {
    listingId: 10,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 16,
    quantity: 18,
    price: ethers.parseEther("0.018").toString(),
    priceInEth: 0.018,
    paymentToken: ethers.ZeroAddress,
    isDirectSale: true,
    isActive: true,
  },
];

const SEED_AUCTIONS = [
  {
    auctionId: 1,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 1,
    quantity: 1,
    startingPrice: ethers.parseEther("0.04").toString(),
    startingPriceInEth: 0.04,
    reservePrice: ethers.parseEther("0.07").toString(),
    reservePriceInEth: 0.07,
    highestBid: ethers.parseEther("0.08").toString(),
    highestBidInEth: 0.08,
    highestBidder: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    paymentToken: ethers.ZeroAddress,
    startTime: new Date(Date.now() - 3600 * 1000 * 12),
    endTime: new Date(Date.now() + 3600 * 1000 * 48),
    settled: false,
    cancelled: false,
    bidsCount: 3,
  },
  {
    auctionId: 2,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 5,
    quantity: 1,
    startingPrice: ethers.parseEther("0.05").toString(),
    startingPriceInEth: 0.05,
    reservePrice: ethers.parseEther("0.07").toString(),
    reservePriceInEth: 0.07,
    highestBid: ethers.parseEther("0.075").toString(),
    highestBidInEth: 0.075,
    highestBidder: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    paymentToken: ethers.ZeroAddress,
    startTime: new Date(Date.now() - 3600 * 1000 * 6),
    endTime: new Date(Date.now() + 3600 * 1000 * 72),
    settled: false,
    cancelled: false,
    bidsCount: 2,
  },
  {
    auctionId: 3,
    seller: "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    tokenId: 7,
    quantity: 1,
    startingPrice: ethers.parseEther("0.04").toString(),
    startingPriceInEth: 0.04,
    reservePrice: ethers.parseEther("0.06").toString(),
    reservePriceInEth: 0.06,
    highestBid: ethers.parseEther("0.065").toString(),
    highestBidInEth: 0.065,
    highestBidder: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    paymentToken: ethers.ZeroAddress,
    startTime: new Date(Date.now() - 3600 * 1000 * 24),
    endTime: new Date(Date.now() + 3600 * 1000 * 8),
    settled: false,
    cancelled: false,
    bidsCount: 4,
  },
];

export const seedDatabase = async () => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chainart_marketplace";
    await mongoose.connect(uri);
    logger.info("🌱 Seeding ChainArt database...");

    // Seed Deployer Admin User
    const adminAddress = "0x041F913a616362e67CdcE5d476F6BDeC7776f309".toLowerCase();
    await User.findOneAndUpdate(
      { address: adminAddress },
      {
        address: adminAddress,
        username: "ChainArt Protocol Admin",
        bio: "Official Deployer & Protocol Administrator of ChainArt Luxury Marketplace.",
        isDealer: true,
        isAdmin: true,
        dealershipVerifiedAt: new Date(),
      },
      { upsert: true }
    );

    // Seed NFTs (Marked explicitly as Demo / UI Preview Data)
    for (const nft of MOCK_NFTS) {
      await NFT.findOneAndUpdate(
        { tokenId: nft.tokenId },
        {
          ...nft,
          contractAddress: CONTRACT_ADDRESSES.nft.toLowerCase(),
          creator: nft.creator.toLowerCase(),
          royaltyRecipient: nft.royaltyRecipient.toLowerCase(),
          owners: [{ address: adminAddress, balance: nft.initialSupply }],
          isDemo: true,
          isVerifiedOnChain: false,
          demoNotice: "DEMO PREVIEW: This item is seeded for UI display and layout testing.",
        },
        { upsert: true }
      );
    }
    logger.info(`✅ Seeded ${MOCK_NFTS.length} Luxury NFTs (Flagged: isDemo=true)`);

    // Seed Listings (Marked explicitly as Demo Data)
    for (const listing of SEED_LISTINGS) {
      await Listing.findOneAndUpdate(
        { listingId: listing.listingId },
        {
          ...listing,
          seller: listing.seller.toLowerCase(),
          isDemo: true,
          isVerifiedOnChain: false,
        },
        { upsert: true }
      );
    }
    logger.info(`✅ Seeded ${SEED_LISTINGS.length} Direct Sale Listings (Flagged: isDemo=true)`);

    // Seed Auctions (Marked explicitly as Demo Data)
    for (const auction of SEED_AUCTIONS) {
      await Auction.findOneAndUpdate(
        { auctionId: auction.auctionId },
        {
          ...auction,
          seller: auction.seller.toLowerCase(),
          highestBidder: auction.highestBidder.toLowerCase(),
          isDemo: true,
          isVerifiedOnChain: false,
        },
        { upsert: true }
      );
    }
    logger.info(`✅ Seeded ${SEED_AUCTIONS.length} Live Auctions (Flagged: isDemo=true)`);

    // Seed Sample Loyalty Profile
    await LoyaltyProfile.findOneAndUpdate(
      { userAddress: adminAddress },
      {
        userAddress: adminAddress,
        totalPoints: 2450,
        currentTier: "Platinum",
        completedSalesCount: 14,
        claimedMilestonesCount: 1,
        history: [
          {
            type: "sale_reward",
            points: 10,
            description: "Rolex Daytona Platinum sale bonus",
            timestamp: new Date(Date.now() - 3600 * 1000 * 24),
          },
          {
            type: "milestone_claim",
            points: 0,
            rewardAmountWei: ethers.parseEther("0.05").toString(),
            description: "Claimed Milestone #1 bonus of 0.05 ETH",
            timestamp: new Date(Date.now() - 3600 * 1000 * 12),
          },
        ],
      },
      { upsert: true }
    );

    // Seed Dealer Application
    await DealerApplication.findOneAndUpdate(
      { applicantAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC".toLowerCase() },
      {
        applicantAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC".toLowerCase(),
        businessName: "Aura Timepieces & Haute Horlogerie",
        contactPerson: "Alexander Vance",
        email: "concierge@auratimepieces.luxury",
        phone: "+41 22 819 9000",
        category: "watches",
        yearsInBusiness: "12",
        website: "https://auratimepieces.luxury",
        physicalStoreAddress: "Rue du Rhône 42, 1204 Geneva, Switzerland",
        provenanceProcess: "Vault custody certificates authenticated by Swiss Horology Federation.",
        inventoryEstimatedValue: "$4,500,000",
        status: "pending",
        submittedAt: new Date(),
      },
      { upsert: true }
    );

    logger.info("✨ Database seeding completed successfully!");
  } catch (error) {
    logger.error(`Failed to seed database: ${error.message}`);
  }
};

export const fixKasheeToken5 = async () => {
  try {
    const updated = await NFT.findOneAndUpdate(
      { tokenId: 5 },
      {
        creator: "0xd26f32a37bc7039439a51387abf74c127ccdc659".toLowerCase(),
        title: "Silver Pendent- Premium",
        category: "jewelry",
        image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=80",
        owners: [{ address: "0xd26f32a37bc7039439a51387abf74c127ccdc659".toLowerCase(), balance: 10 }],
      },
      { new: true }
    );
    if (updated) {
      logger.info(`[Migration] Token #5 updated to Kashee's Brand: creator=${updated.creator}`);
    }
  } catch (err) {
    logger.warn(`[Migration] Failed to update Token #5: ${err.message}`);
  }
};

// Run if called directly
if (process.argv[1] && process.argv[1].includes("seedData.js")) {
  seedDatabase().then(() => fixKasheeToken5()).then(() => process.exit(0));
}
