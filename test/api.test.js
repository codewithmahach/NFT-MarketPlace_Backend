import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { seedDatabase } from "../src/utils/seedData.js";
import { DealerApplication } from "../src/models/DealerApplication.js";

describe("ChainArt REST API Endpoints Test Suite", () => {
  const testApplicantAddress = "0x8ba1f109551bd432803012645ac136ddd64dba72";

  before(async () => {
    const uri = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/chainart_test_db";
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
    // Seed initial dataset in test DB
    await seedDatabase();
  });

  after(async () => {
    await DealerApplication.deleteMany({ applicantAddress: testApplicantAddress });
    await mongoose.disconnect();
  });

  test("1. Root Discovery Endpoint (/api)", async () => {
    const res = await request(app).get("/api").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.network, "Ethereum Sepolia");
    assert.strictEqual(res.body.data.chainId, 11155111);
    assert.ok(res.body.data.contracts.nft);
  });

  test("2. Fetch NFTs Catalog with Category Filter & Pagination (/api/nfts)", async () => {
    const res = await request(app)
      .get("/api/nfts?category=watches&page=1&limit=10")
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.nfts));
    assert.ok(res.body.data.nfts.length > 0);
    assert.strictEqual(res.body.data.nfts[0].category, "watches");
    assert.ok(res.body.data.pagination);
  });

  test("3. Fetch Single NFT by Token ID with Details (/api/nfts/1)", async () => {
    const res = await request(app).get("/api/nfts/1").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.nft.tokenId, 1);
    assert.ok(res.body.data.nft.title.includes("Rolex"));
  });

  test("4. Fetch Categories with Item Counts (/api/nfts/categories)", async () => {
    const res = await request(app).get("/api/nfts/categories").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 8);
    const watches = res.body.data.find((c) => c.id === "watches");
    assert.ok(watches);
    assert.ok(watches.count >= 3);
  });

  test("5. Fetch Active Listings with Fee Calculation (/api/marketplace/listings/1)", async () => {
    const res = await request(app).get("/api/marketplace/listings/1").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.listing.listingId, 1);
    assert.ok(res.body.data.breakdown);
    assert.strictEqual(res.body.data.breakdown.protocolFeePercent, "2.5%");
    assert.strictEqual(res.body.data.breakdown.royaltyFeePercent, "5%");
  });

  test("6. Fetch Active Auctions with Minimum Bid Info (/api/auctions/1)", async () => {
    const res = await request(app).get("/api/auctions/1").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.auction.auctionId, 1);
    assert.ok(res.body.data.nextBidInfo);
    assert.ok(res.body.data.nextBidInfo.minNextBidEth > 0);
  });

  test("7. Fetch Loyalty Profile and Milestone Progress (/api/loyalty/profile/:address)", async () => {
    const adminAddress = "0x041F913a616362e67CdcE5d476F6BDeC7776f309";
    const res = await request(app)
      .get(`/api/loyalty/profile/${adminAddress}`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.profile);
    assert.ok(res.body.data.milestone);
    assert.strictEqual(res.body.data.milestone.targetSales, 10);
    assert.strictEqual(res.body.data.milestone.rewardPerMilestone, "0.01 ETH");
  });

  test("8. Submit Dealership Application (/api/dealers/apply)", async () => {
    const res = await request(app)
      .post("/api/dealers/apply")
      .send({
        applicantAddress: testApplicantAddress,
        businessName: "Geneva Vault Horology",
        contactPerson: "Marc Dubois",
        email: "contact@genevavault.ch",
        category: "watches",
        yearsInBusiness: "8",
        inventoryEstimatedValue: "$2,000,000",
      })
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.applicantAddress, testApplicantAddress);
    assert.strictEqual(res.body.data.status, "pending");
  });

  test("9. Fetch Dealership Application Status (/api/dealers/my-application/:address)", async () => {
    const res = await request(app)
      .get(`/api/dealers/my-application/${testApplicantAddress}`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.application.businessName, "Geneva Vault Horology");
  });

  test("10. System Health Status (/api/admin/health)", async () => {
    const res = await request(app).get("/api/admin/health").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.services.database);
    assert.ok(res.body.data.services.sepoliaRpc);
  });
});
