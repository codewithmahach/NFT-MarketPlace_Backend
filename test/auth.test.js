import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { ethers } from "ethers";
import mongoose from "mongoose";
import app from "../src/app.js";
import { Nonce } from "../src/models/Nonce.js";
import { User } from "../src/models/User.js";

describe("ChainArt Authentication Test Suite", () => {
  let testWallet;
  let testAddress;

  before(async () => {
    const uri = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/chainart_test_db";
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
    // Generate fresh random test wallet
    testWallet = ethers.Wallet.createRandom();
    testAddress = testWallet.address.toLowerCase();
  });

  after(async () => {
    // Cleanup test records
    await Nonce.deleteMany({ address: testAddress });
    await User.deleteMany({ address: testAddress });
    await mongoose.disconnect();
  });

  test("1. Generate EIP-191 Nonce Challenge", async () => {
    const res = await request(app)
      .post("/api/auth/nonce")
      .send({ address: testAddress })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.address, testAddress);
    assert.ok(res.body.data.nonce);
    assert.ok(res.body.data.message.includes(testAddress));
  });

  test("2. Reject Invalid Address Format for Nonce", async () => {
    const res = await request(app)
      .post("/api/auth/nonce")
      .send({ address: "invalid-eth-address" })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, "VALIDATION_ERROR");
  });

  test("3. Verify Valid Wallet Signature and Issue JWT Token", async () => {
    // Fetch nonce
    const nonceRes = await request(app)
      .post("/api/auth/nonce")
      .send({ address: testAddress });

    const messageToSign = nonceRes.body.data.message;

    // Cryptographically sign message with wallet
    const signature = await testWallet.signMessage(messageToSign);

    // Verify signature
    const verifyRes = await request(app)
      .post("/api/auth/verify")
      .send({
        address: testAddress,
        signature,
      })
      .expect(200);

    assert.strictEqual(verifyRes.body.success, true);
    assert.ok(verifyRes.body.data.token);
    assert.strictEqual(verifyRes.body.data.user.address, testAddress);
  });

  test("4. Prevent Replay Attack with Used Nonce", async () => {
    // Attempting to reuse same signature must fail because nonce was deleted
    const signature = await testWallet.signMessage("dummy-message");

    const replayRes = await request(app)
      .post("/api/auth/verify")
      .send({
        address: testAddress,
        signature,
      })
      .expect(400);

    assert.strictEqual(replayRes.body.success, false);
    assert.strictEqual(replayRes.body.error.code, "NONCE_EXPIRED");
  });

  test("5. Access Protected Profile with Valid JWT Bearer", async () => {
    // Get fresh nonce and token
    const nonceRes = await request(app)
      .post("/api/auth/nonce")
      .send({ address: testAddress });

    const signature = await testWallet.signMessage(nonceRes.body.data.message);
    const verifyRes = await request(app)
      .post("/api/auth/verify")
      .send({ address: testAddress, signature });

    const token = verifyRes.body.data.token;

    // Call protected endpoint
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.strictEqual(meRes.body.success, true);
    assert.strictEqual(meRes.body.data.user.address, testAddress);
    assert.ok(meRes.body.data.withdrawals);
  });

  test("6. Reject Protected Endpoint Request with Missing/Invalid Token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token-12345")
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, "UNAUTHORIZED");
  });
});
