import { Order } from "../models/Order.js";
import { NFT } from "../models/NFT.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { ERROR_CODES } from "../config/constants.js";

/**
 * Get User Orders (Purchases & Sales)
 * GET /api/orders/user/:address
 */
export const getUserOrders = async (req, res, next) => {
  try {
    const address = req.params.address.toLowerCase();
    const { role = "all" } = req.query; // 'buyer', 'seller', 'all'

    let query = {};
    if (role === "buyer") {
      query = { buyer: address };
    } else if (role === "seller") {
      query = { seller: address };
    } else {
      query = { $or: [{ buyer: address }, { seller: address }] };
    }

    const orders = await Order.find(query).sort({ createdAt: -1 }).lean();

    const enriched = await Promise.all(
      orders.map(async (order) => {
        const nft = await NFT.findOne({ tokenId: order.tokenId }).lean();
        return {
          ...order,
          nft,
          userRole: order.buyer === address ? "buyer" : "seller",
        };
      })
    );

    return successResponse(res, "Orders retrieved successfully.", enriched);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Order Details & Transaction Certificate
 * GET /api/orders/:orderId
 */
export const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return errorResponse(res, "Order receipt not found.", null, 404, ERROR_CODES.NOT_FOUND);
    }

    const nft = await NFT.findOne({ tokenId: order.tokenId }).lean();

    return successResponse(res, "Order certificate retrieved successfully.", {
      order,
      nft,
      blockchainVerification: {
        network: "Ethereum Sepolia",
        chainId: 11155111,
        txHash: order.txHash,
        blockNumber: order.blockNumber,
        explorerUrl: `https://sepolia.etherscan.io/tx/${order.txHash}`,
      },
    });
  } catch (error) {
    next(error);
  }
};
