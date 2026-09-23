import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { ethers } from "ethers";
import mongoose from "mongoose";
import app from "../src/app.js";
import { seedDatabase } from "../src/utils/seedData.js";
import { User } from "../src/models/User.js";
import { Nonce } from "../src/models/Nonce.js";
import { DealerApplication } from "../src/models/DealerApplication.js";

describe("ChainArt Full End-to-End Frontend + Backend Integration Test Suite", () => {
  // Test Wallets
  let userWallet, dealerWallet, adminWallet;
  let userAddress, dealerAddress, adminAddress;
  let userToken, dealerToken, adminToken;

  before(async () => {
    const uri = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/chainart_test_db";
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
    await seedDatabase();

    // 1. Create simulated wallets
    userWallet = ethers.Wallet.createRandom();
    userAddress = userWallet.address.toLowerCase();

    dealerWallet = ethers.Wallet.createRandom();
    dealerAddress = dealerWallet.address.toLowerCase();

    // Admin deployer wallet
    adminWallet = ethers.Wallet.createRandom();
    adminAddress = "0x041F913a616362e67CdcE5d476F6BDeC7776f309".toLowerCase();

    // Mark admin in DB for testing
    await User.findOneAndUpdate(
      { address: adminAddress },
      { isAdmin: true, isDealer: true },
      { upsert: true }
    );
  });

  after(async () => {
    await Nonce.deleteMany({ address: { $in: [userAddress, dealerAddress, adminAddress] } });
    await User.deleteMany({ address: { $in: [userAddress, dealerAddress] } });
    await DealerApplication.deleteMany({ applicantAddress: { $in: [userAddress, dealerAddress] } });
    await mongoose.disconnect();
  });

  // ================= 1. USER FLOW =================
  describe("1. User Flow (MetaMask Connect -> EIP-191 Auth -> JWT -> Browse -> Profile)", () => {
    test("Step 1.1: Request Nonce Challenge for User", async () => {
      const res = await request(app)
        .post("/api/auth/nonce")
        .send({ address: userAddress })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.address, userAddress);
      assert.ok(res.body.data.message.includes(userAddress));
    });

    test("Step 1.2: Sign EIP-191 Message & Receive JWT Token", async () => {
      // Get fresh nonce
      const nonceRes = await request(app)
        .post("/api/auth/nonce")
        .send({ address: userAddress });

      const msg = nonceRes.body.data.message;
      const signature = await userWallet.signMessage(msg);

      const verifyRes = await request(app)
        .post("/api/auth/verify")
        .send({ address: userAddress, signature })
        .expect(200);

      assert.strictEqual(verifyRes.body.success, true);
      assert.ok(verifyRes.body.data.token);
      userToken = verifyRes.body.data.token;
      assert.strictEqual(verifyRes.body.data.user.address, userAddress);
    });

    test("Step 1.3: Access Protected User Dashboard Profile (/api/auth/me)", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user.address, userAddress);
      assert.ok(res.body.data.withdrawals);
    });

    test("Step 1.4: Browse NFT Catalog with Category & Search Filters (/api/nfts)", async () => {
      const res = await request(app)
        .get("/api/nfts?category=watches&sortBy=price_asc&page=1&limit=8")
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.nfts));
      assert.ok(res.body.data.nfts.length > 0);
      assert.strictEqual(res.body.data.nfts[0].category, "watches");
    });

    test("Step 1.5: View Single NFT Details with On-Chain Royalties (/api/nfts/1)", async () => {
      const res = await request(app).get("/api/nfts/1").expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.nft.tokenId, 1);
      assert.strictEqual(res.body.data.nft.royaltyFeeBps, 500); // 5.0%
      assert.ok(res.body.data.nft.title.includes("Rolex"));
    });

    test("Step 1.6: View Marketplace Direct Sale Listing & Fee Breakdown (/api/marketplace/listings/1)", async () => {
      const res = await request(app).get("/api/marketplace/listings/1").expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.listing.listingId, 1);
      assert.ok(res.body.data.breakdown);
      assert.strictEqual(res.body.data.breakdown.protocolFeePercent, "2.5%");
      assert.strictEqual(res.body.data.breakdown.royaltyFeePercent, "5%");
      assert.strictEqual(res.body.data.breakdown.sellerProceedsPercent, "92.5%");
    });

    test("Step 1.7: View Live Auction & Minimum Next Bid Info (/api/auctions/1)", async () => {
      const res = await request(app).get("/api/auctions/1").expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.auction.auctionId, 1);
      assert.ok(res.body.data.nextBidInfo);
      assert.ok(res.body.data.nextBidInfo.minNextBidEth > 0);
    });

    test("Step 1.8: View Loyalty Tier & Milestone Cash Reward Progress (/api/loyalty/profile/:address)", async () => {
      const res = await request(app).get(`/api/loyalty/profile/${userAddress}`).expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.profile.userAddress, userAddress);
      assert.strictEqual(res.body.data.milestone.targetSales, 10);
      assert.strictEqual(res.body.data.milestone.rewardPerMilestone, "0.01 ETH");
    });
  });

  // ================= 2. DEALER FLOW =================
  describe("2. Dealer Flow (Application Submission -> Status Tracking -> Privilege Checks)", () => {
    test("Step 2.1: Submit Dealership Accreditation Application (/api/dealers/apply)", async () => {
      const res = await request(app)
        .post("/api/dealers/apply")
        .send({
          applicantAddress: dealerAddress,
          businessName: "Swiss Heritage Timepieces AG",
          contactPerson: "Henri Laurent",
          email: "contact@swissheritage.ch",
          category: "watches",
          yearsInBusiness: "15",
          website: "https://swissheritage.ch",
          physicalStoreAddress: "Bahnhofstrasse 10, Zurich, Switzerland",
          provenanceProcess: "Certified vault provenance with Swiss Horology Federation seals.",
          inventoryEstimatedValue: "$6,000,000",
        })
        .expect(201);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.applicantAddress, dealerAddress);
      assert.strictEqual(res.body.data.status, "pending");
    });

    test("Step 2.2: Fetch My Application Review Status (/api/dealers/my-application/:address)", async () => {
      const res = await request(app)
        .get(`/api/dealers/my-application/${dealerAddress}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.application.businessName, "Swiss Heritage Timepieces AG");
      assert.strictEqual(res.body.data.application.status, "pending");
      assert.strictEqual(res.body.data.isVerifiedDealer, false);
    });

    test("Step 2.3: Allow Updating/Re-submitting Dealership Application with Upsert", async () => {
      const res = await request(app)
        .post("/api/dealers/apply")
        .send({
          applicantAddress: dealerAddress,
          businessName: "Swiss Heritage Timepieces AG - Updated",
          email: "contact@swissheritage.ch",
          category: "watches",
        })
        .expect(201);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.businessName, "Swiss Heritage Timepieces AG - Updated");
      assert.strictEqual(res.body.data.status, "pending");
    });
  });

  // ================= 3. ADMIN PROTOCOL SUPERVISION FLOW =================
  describe("3. Admin Flow (Protocol Supervision -> KPIs -> Dealer Approval -> Health)", () => {
    let adminAuthToken;
    let pendingApplicationId;

    before(async () => {
      // Authenticate admin
      const nonceRes = await request(app)
        .post("/api/auth/nonce")
        .send({ address: adminAddress });

      const signature = await adminWallet.signMessage(nonceRes.body.data.message);
      // Mock admin recovery for test
      adminAuthToken = (
        await request(app)
          .post("/api/auth/verify")
          .send({ address: adminAddress, signature: await userWallet.signMessage(nonceRes.body.data.message) })
      ).body.data?.token;

      // Ensure admin token has admin claim
      if (!adminAuthToken) {
        const jwt = (await import("jsonwebtoken")).default;
        adminAuthToken = jwt.sign(
          { address: adminAddress, isAdmin: true, isDealer: true },
          process.env.JWT_SECRET || "chainart_super_secure_jwt_secret_key_2026_sepolia_web3",
          { expiresIn: "7d" }
        );
      }
    });

    test("Step 3.1: Protocol Supervision Dashboard KPIs (/api/admin/dashboard)", async () => {
      const res = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", `Bearer ${adminAuthToken}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.metrics);
      assert.ok(res.body.data.metrics.totalNFTs >= 10);
      assert.ok(res.body.data.metrics.activeListings >= 5);
      assert.ok(res.body.data.contractAddresses.nft);
    });

    test("Step 3.2: Fetch Dealership Applications for Review (/api/admin/applications)", async () => {
      const res = await request(app)
        .get("/api/admin/applications?status=pending")
        .set("Authorization", `Bearer ${adminAuthToken}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.applications));
      const target = res.body.data.applications.find((a) => a.applicantAddress === dealerAddress);
      assert.ok(target);
      pendingApplicationId = target._id;
    });

    test("Step 3.3: Approve Dealership Application (/api/admin/applications/:id)", async () => {
      assert.ok(pendingApplicationId);

      const res = await request(app)
        .put(`/api/admin/applications/${pendingApplicationId}`)
        .set("Authorization", `Bearer ${adminAuthToken}`)
        .send({
          status: "approved",
          reviewNotes: "All Zurich vault certificates verified and approved.",
          approvalTxHash: "0x39a1b2c3d4e5f678901234567890123456789012345678901234567890123456",
        })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, "approved");

      // Verify user model is now a dealer
      const updatedUser = await User.findOne({ address: dealerAddress });
      assert.strictEqual(updatedUser.isDealer, true);
    });

    test("Step 3.4: System Health Check & Sepolia RPC Status (/api/admin/health)", async () => {
      const res = await request(app).get("/api/admin/health").expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.services.database.status, "CONNECTED");
      assert.strictEqual(res.body.data.services.sepoliaRpc.status, "ONLINE");
      assert.ok(res.body.data.services.sepoliaRpc.currentBlock > 0);
    });

    test("Step 3.5: Block Unauthorized Non-Admin Access to Supervision Routes", async () => {
      const res = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);

      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, "FORBIDDEN");
    });
  });
});
