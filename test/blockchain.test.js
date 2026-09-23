import { test, describe } from "node:test";
import assert from "node:assert";
import { ethers } from "ethers";
import { getProvider, getContractInstance } from "../src/config/contracts.js";
import { CONTRACT_ADDRESSES, ROLES } from "../src/config/constants.js";

describe("ChainArt Blockchain & Sepolia Smart Contracts Test Suite", () => {
  test("1. Verify Sepolia RPC Provider Connectivity", async () => {
    const provider = getProvider();
    const network = await provider.getNetwork();
    assert.strictEqual(Number(network.chainId), 11155111);
    const blockNumber = await provider.getBlockNumber();
    assert.ok(blockNumber > 0);
  });

  test("2. Verify ChainArtNFT Deployed Proxy & Roles", async () => {
    const nft = getContractInstance("nft");
    const adminRole = await nft.ADMIN_ROLE();
    const dealerRole = await nft.DEALER_ROLE();

    assert.strictEqual(adminRole, ROLES.ADMIN_ROLE);
    assert.strictEqual(dealerRole, ROLES.DEALER_ROLE);

    // Verify Deployer has DEFAULT_ADMIN_ROLE
    const deployer = "0x041F913a616362e67CdcE5d476F6BDeC7776f309";
    const isDeployerAdmin = await nft.hasRole(ROLES.DEFAULT_ADMIN_ROLE, deployer);
    assert.strictEqual(isDeployerAdmin, true);
  });

  test("3. Verify ChainArtMarketplace Deployed Proxy", async () => {
    const marketplace = getContractInstance("marketplace");
    const feeBps = await marketplace.platformFeeBps();
    assert.strictEqual(Number(feeBps), 250); // 2.5%

    const treasury = await marketplace.treasury();
    assert.strictEqual(treasury.toLowerCase(), CONTRACT_ADDRESSES.treasury.toLowerCase());
  });

  test("4. Verify ChainArtAuction Deployed Proxy", async () => {
    const auction = getContractInstance("auction");
    const feeBps = await auction.platformFeeBps();
    assert.strictEqual(Number(feeBps), 250); // 2.5%

    const treasury = await auction.treasury();
    assert.strictEqual(treasury.toLowerCase(), CONTRACT_ADDRESSES.treasury.toLowerCase());
  });

  test("5. Verify ChainArtLoyalty Deployed Proxy & Milestones", async () => {
    const loyalty = getContractInstance("loyalty");
    const rewardETH = await loyalty.rewardAmountETH();
    assert.strictEqual(rewardETH.toString(), ethers.parseEther("0.01").toString());

    const salePoints = await loyalty.SALE_POINTS();
    assert.strictEqual(Number(salePoints), 10);

    const purchasePoints = await loyalty.PURCHASE_POINTS();
    assert.strictEqual(Number(purchasePoints), 5);

    const activitiesPerReward = await loyalty.ACTIVITIES_PER_REWARD();
    assert.strictEqual(Number(activitiesPerReward), 10);
  });
});
