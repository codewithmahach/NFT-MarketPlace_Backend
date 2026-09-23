import { DealerApplication } from "../models/DealerApplication.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { ERROR_CODES, CONTRACT_ADDRESSES } from "../config/constants.js";
import { logger } from "../utils/logger.js";

/**
 * Submit Dealership Application
 * POST /api/dealers/apply
 */
export const submitApplication = async (req, res, next) => {
  try {
    const payload = req.body;
    const applicantAddress = (payload.applicantAddress || (req.user && req.user.address) || "").toLowerCase();

    if (!applicantAddress) {
      return errorResponse(res, "Applicant wallet address is required.", null, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Upsert or update application so re-submitting updates the record to pending
    const application = await DealerApplication.findOneAndUpdate(
      { applicantAddress },
      {
        ...payload,
        applicantAddress,
        status: "pending",
        submittedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Notify admins
    const treasury = CONTRACT_ADDRESSES.treasury.toLowerCase();
    await Notification.create({
      recipient: treasury,
      title: "New Dealership Application Received",
      message: `${payload.businessName} (${applicantAddress.slice(0, 6)}...${applicantAddress.slice(-4)}) has applied for Dealer status in ${payload.category}.`,
      type: "dealer_applied",
      data: { applicationId: application._id, applicantAddress },
    });

    logger.info(`📝 Dealership application received from ${applicantAddress} for ${payload.businessName}`);

    return successResponse(
      res,
      "Dealership application submitted successfully. Our protocol review team will evaluate your credentials.",
      application,
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Dealership Applications (Inspector / Admin Query)
 * GET /api/dealers/applications
 */
export const getAllApplications = async (req, res, next) => {
  try {
    const { status, category, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;
    if (category && category !== "all") query.category = category.toLowerCase();

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    const [applications, total] = await Promise.all([
      DealerApplication.find(query).sort({ submittedAt: -1 }).skip(skip).limit(parsedLimit).lean(),
      DealerApplication.countDocuments(query),
    ]);

    return successResponse(res, "Dealership applications retrieved successfully.", {
      applications,
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
 * Get My Dealership Application Status
 * GET /api/dealers/my-application/:address
 */
export const getMyApplication = async (req, res, next) => {
  try {
    const address = req.params.address.toLowerCase();

    const application = await DealerApplication.findOne({ applicantAddress: address })
      .sort({ submittedAt: -1 })
      .lean();

    const user = await User.findOne({ address }).lean();

    return successResponse(res, "Dealership application status retrieved.", {
      application,
      isVerifiedDealer: user ? user.isDealer : false,
      dealershipVerifiedAt: user ? user.dealershipVerifiedAt : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get List of Verified Luxury Dealers
 * GET /api/dealers/verified
 */
export const getDealersList = async (req, res, next) => {
  try {
    const [users, applications] = await Promise.all([
      User.find({ isDealer: true }).select("address username bio avatar dealershipVerifiedAt").lean(),
      DealerApplication.find({ status: "approved" }).lean(),
    ]);

    const appMap = new Map();
    for (const app of applications) {
      appMap.set(app.applicantAddress.toLowerCase(), app);
    }

    const dealers = users.map((u) => {
      const app = appMap.get(u.address.toLowerCase());
      return {
        address: u.address,
        businessName: app?.businessName || u.username || `Dealer ${u.address.slice(0, 6)}...`,
        category: app?.category || "Luxury",
        avatar: u.avatar || "",
        bio: u.bio || "",
        dealershipVerifiedAt: u.dealershipVerifiedAt || app?.reviewedAt || app?.createdAt,
      };
    });

    // Also include approved applications that might not have a full User record yet
    for (const app of applications) {
      const addr = app.applicantAddress.toLowerCase();
      if (!dealers.some((d) => d.address.toLowerCase() === addr)) {
        dealers.push({
          address: addr,
          businessName: app.businessName,
          category: app.category || "Luxury",
          avatar: "",
          bio: "",
          dealershipVerifiedAt: app.reviewedAt || app.createdAt,
        });
      }
    }

    return successResponse(res, "Verified dealers retrieved successfully.", dealers);
  } catch (error) {
    next(error);
  }
};
