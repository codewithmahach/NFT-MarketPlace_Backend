# ChainArt NFT Marketplace — Backend API & Event Indexer Documentation

ChainArt is an upgradeable, loyalty-based multi-token (ERC-1155) luxury NFT marketplace deployed on **Ethereum Sepolia**.

---

## 1. Network & Smart Contract Architecture

* **Network**: Ethereum Sepolia Testnet
* **Chain ID**: `11155111` (`0xaa36a7`)
* **Deployer / Protocol Treasury**: `0x041F913a616362e67CdcE5d476F6BDeC7776f309`

### Deployed UUPS Proxy Addresses

| Smart Contract | Proxy Address | Implementation Address |
| :--- | :--- | :--- |
| **ChainArtNFT** (ERC-1155 + ERC-2981) | `0x0f111da5e9364656F54b5F402F1B8D2598808ba5` | `0x64BC14cc505A5B02fA605cEaC63b60535Ff416FC` |
| **ChainArtMarketplace** (Direct Sales) | `0x09671389c8666615F76CE06445465fb9b840110A` | `0x84Bb6Ed2db4882023b433cbd83961719f1Ee21c1` |
| **ChainArtAuction** (English Auctions) | `0x6770771d0cB72f6853741d2Fa21A30817F5987d0` | `0x03a7109Ea5bE9C600AF7812A3112BFAEdE5bfA0E` |
| **ChainArtLoyalty** (Loyalty Rewards) | `0xa6c74aE1348932243B1C9f757755D27E652eE306` | `0x4d36c2df498d49010333dfc5817D647C02bB3113` |
| **MockUSDT** (ERC-20 Stablecoin) | `0xd077a400968890eacc75cdc901f0356c943e4fdb` | N/A |

---

## 2. Standard API Response Structure

All backend responses follow a unified JSON envelope:

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... },
  "error": null,
  "timestamp": "2026-09-16T15:30:00.000Z"
}
```

In case of error:

```json
{
  "success": false,
  "message": "Human readable error description",
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "details": { ... }
  },
  "timestamp": "2026-09-16T15:30:00.000Z"
}
```

---

## 3. Cryptographic Wallet Authentication (EIP-191)

ChainArt authenticates users cryptographically using personal message signing with zero gas costs.

```
┌────────┐               ┌─────────┐               ┌────────────────┐
│ Client │               │ Backend │               │ Smart Contract │
└───┬────┘               └───┬─────┘               └───────┬────────┘
    │   POST /auth/nonce     │                             │
    │ ──────────────────────>│                             │
    │   Returns Nonce Msg    │                             │
    │ <──────────────────────│                             │
    │                        │                             │
    │ Sign EIP-191 message   │                             │
    │ (Metamask / Web3)      │                             │
    │                        │                             │
    │   POST /auth/verify    │                             │
    │ ──────────────────────>│                             │
    │                        │  Verify ethers.verifyMessage│
    │                        │  Check hasRole(DEALER/ADMIN)│
    │                        │ ───────────────────────────>│
    │                        │ <───────────────────────────│
    │   Returns Bearer JWT   │                             │
    │ <──────────────────────│                             │
```

### 3.1. Request Authentication Nonce
* **URL**: `/api/auth/nonce`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "address": "0x041F913a616362e67CdcE5d476F6BDeC7776f309"
  }
  ```
* **Response `data`**:
  ```json
  {
    "address": "0x041f913a616362e67cdce5d476f6bdec7776f309",
    "nonce": "a8f94e2b71c0d3819e01",
    "message": "Welcome to ChainArt NFT Marketplace!\n\nPlease sign this message...",
    "expiresAt": "2026-09-16T15:40:00.000Z"
  }
  ```

### 3.2. Verify Signature & Issue JWT
* **URL**: `/api/auth/verify`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "address": "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    "signature": "0x4355c47d63924e...71c"
  }
  ```
* **Response `data`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "address": "0x041f913a616362e67cdce5d476f6bdec7776f309",
      "username": "ChainArt Protocol Admin",
      "isDealer": true,
      "isAdmin": true
    }
  }
  ```

### 3.3. Get Profile & Pending Withdrawals
* **URL**: `/api/auth/me`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <token>`
* **Response `data`**:
  ```json
  {
    "user": { ... },
    "withdrawals": {
      "marketplacePendingEth": "0.12",
      "auctionPendingEth": "0.00",
      "totalPendingEth": "0.12"
    }
  }
  ```

---

## 4. NFT Catalog & Collections

### 4.1. Browse NFTs with Filters & Search
* **URL**: `/api/nfts`
* **Method**: `GET`
* **Query Parameters**:
  * `category`: `watches`, `cars`, `jewelry`, `handbags`, `art`, `shoes`, `spirits`, `antiques`, `fashion`
  * `search`: string keyword
  * `status`: `listed`, `auction`, `all`
  * `sortBy`: `newest`, `price_asc`, `price_desc`, `popular`
  * `page`: integer (default: `1`)
  * `limit`: integer (default: `24`)

### 4.2. Get NFT Details by Token ID
* **URL**: `/api/nfts/:tokenId`
* **Method**: `GET`
* **Response `data`**:
  * Returns full metadata, trait attributes, current active listing, active auction, and full on-chain order history.

### 4.3. Get Luxury Categories
* **URL**: `/api/nfts/categories`
* **Method**: `GET`
* **Response**: Returns 9 categories with real-time item counts and preview banners.

---

## 5. Marketplace Direct Sales

### 5.1. Browse Active Direct Sale Listings
* **URL**: `/api/marketplace/listings`
* **Method**: `GET`
* **Query Parameters**: `category`, `paymentToken`, `minPrice`, `maxPrice`, `sortBy`, `page`, `limit`

### 5.2. Get Single Listing & Fee Calculation Breakdown
* **URL**: `/api/marketplace/listings/:listingId`
* **Method**: `GET`
* **Response `data.breakdown`**:
  ```json
  {
    "priceEth": "0.12",
    "protocolFeeEth": "0.003",
    "protocolFeePercent": "2.5%",
    "royaltyFeeEth": "0.006",
    "royaltyFeePercent": "5.0%",
    "royaltyRecipient": "0x041F913a616362e67CdcE5d476F6BDeC7776f309",
    "sellerProceedsEth": "0.111",
    "sellerProceedsPercent": "92.5%"
  }
  ```

### 5.3. Verify Purchase Receipt
* **URL**: `/api/marketplace/verify-purchase`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "txHash": "0x..."
  }
  ```

---

## 6. English Auctions & Live Bidding

### 6.1. Get Active Auctions
* **URL**: `/api/auctions`
* **Method**: `GET`
* **Query Parameters**: `category`, `sortBy` (`ending_soon`, `highest_bid`, `newest`), `page`, `limit`

### 6.2. Get Single Auction with Live Next Bid Info
* **URL**: `/api/auctions/:auctionId`
* **Method**: `GET`
* **Response `data.nextBidInfo`**:
  ```json
  {
    "minNextBidEth": 0.084,
    "isReserveMet": true,
    "hasStarted": true,
    "hasEnded": false
  }
  ```

### 6.3. Verify Placed Bid
* **URL**: `/api/auctions/verify-bid`
* **Method**: `POST`
* **Request Body**: `{ "txHash": "0x..." }`

---

## 7. Loyalty Program & Milestones

### 7.1. Get User Loyalty Profile & Progress
* **URL**: `/api/loyalty/profile/:address`
* **Method**: `GET`
* **Response `data`**:
  ```json
  {
    "profile": {
      "totalPoints": 2450,
      "currentTier": "Platinum",
      "tierBadge": "💎",
      "feeDiscountPercent": "30%"
    },
    "milestone": {
      "targetSales": 10,
      "currentSalesInMilestone": 4,
      "percentToNextMilestone": 40,
      "totalCompletedMilestones": 1,
      "claimedMilestones": 1,
      "unclaimedMilestones": 0,
      "isClaimEligible": false,
      "claimableRewardEth": "0.00",
      "rewardPerMilestone": "0.05 ETH"
    }
  }
  ```

### 7.2. Loyalty Leaderboard
* **URL**: `/api/loyalty/leaderboard`
* **Method**: `GET`

---

## 8. Dealership Application & Verification Portal

### 8.1. Submit Dealership Application
* **URL**: `/api/dealers/apply`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "applicantAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "businessName": "Aura Timepieces & Haute Horlogerie",
    "contactPerson": "Alexander Vance",
    "email": "concierge@auratimepieces.luxury",
    "category": "watches",
    "yearsInBusiness": "12",
    "website": "https://auratimepieces.luxury",
    "physicalStoreAddress": "Rue du Rhône 42, 1204 Geneva, Switzerland",
    "provenanceProcess": "Vault custody certificates authenticated by Swiss Horology Federation.",
    "inventoryEstimatedValue": "$4,500,000"
  }
  ```

### 8.2. Check My Application Status
* **URL**: `/api/dealers/my-application/:address`
* **Method**: `GET`

---

## 9. Admin Supervision Console

*All routes require Bearer JWT token with `ADMIN_ROLE` or `DEFAULT_ADMIN_ROLE`.*

### 9.1. Supervision Dashboard Metrics
* **URL**: `/api/admin/dashboard`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <admin_token>`
* Returns real-time metrics: Total Volume, Protocol Fees, Active Listings, Active Auctions, Pending Applications.

### 9.2. Review Dealership Application
* **URL**: `/api/admin/applications/:id`
* **Method**: `PUT`
* **Request Body**:
  ```json
  {
    "status": "approved",
    "reviewNotes": "Credentials and physical store verified.",
    "approvalTxHash": "0x..."
  }
  ```

### 9.3. Live Indexed Events Feed
* **URL**: `/api/admin/events`
* **Method**: `GET`
* **Query Parameters**: `eventName`, `contractName`, `page`, `limit`

### 9.4. System Health & RPC Status
* **URL**: `/api/admin/health`
* **Method**: `GET`
