import { Notification } from "../models/Notification.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { ERROR_CODES } from "../config/constants.js";

/**
 * Get User Notifications
 * GET /api/notifications
 */
export const getNotifications = async (req, res, next) => {
  try {
    const address = req.user?.address;
    if (!address) {
      return successResponse(res, "Notifications retrieved.", {
        notifications: [],
        unreadCount: 0,
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      });
    }

    const { page = 1, limit = 20, unreadOnly = "false" } = req.query;

    const query = { recipient: address };
    if (unreadOnly === "true") {
      query.read = false;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(parsedLimit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: address, read: false }),
    ]);

    return successResponse(res, "Notifications retrieved.", {
      notifications,
      unreadCount,
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
 * Mark Single Notification as Read
 * PUT /api/notifications/:id/read
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const address = req.user.address;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: address },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return errorResponse(res, "Notification not found.", null, 404, ERROR_CODES.NOT_FOUND);
    }

    return successResponse(res, "Notification marked as read.", notification);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark All Notifications as Read
 * PUT /api/notifications/read-all
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    const address = req.user.address;

    const result = await Notification.updateMany({ recipient: address, read: false }, { read: true });

    return successResponse(res, "All notifications marked as read.", {
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};
