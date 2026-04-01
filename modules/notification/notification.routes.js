const express = require("express");
const router = express.Router();
const notificationController = require("./notification.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

// All notification routes require authentication
router.use(authMiddleware);

router.get("/", notificationController.getUserNotifications);
router.put("/:id/read", notificationController.markAsRead);
router.put("/read-all", notificationController.markAllAsRead); // Added a handy read-all endpoint
router.delete("/:id", notificationController.deleteNotification);

module.exports = router;
