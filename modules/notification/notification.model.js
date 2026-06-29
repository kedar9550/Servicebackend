const mongoose = require("mongoose");
const ticketDB = require("../../config/db/ticketDB");

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User"
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ticket",
    default: null
  },
  type: {
    type: String,
    enum: ["TICKET_CREATED", "TICKET_ASSIGNED", "STATUS_UPDATED", "NEW_COMMENT", "FEEDBACK_REQUEST"],
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null,
    expires: 604800 // 7 days in seconds
  }
}, { timestamps: true });

notificationSchema.index({ user: 1, isRead: 1 });

notificationSchema.post("save", async function (doc, next) {
  try {
    const User = require("../auth/auth.model");
    const { sendPushNotification } = require("../notifications/firebase");
    
    console.log(`Notification post-save hook triggered for user ID: ${doc.user}`);
    
    const user = await User.findById(doc.user);
    if (user) {
      const hasTokens = user.fcmTokens && user.fcmTokens.length > 0;
      console.log(`User found: ${user.email}, FCM Tokens exists: ${hasTokens}`);
      if (hasTokens) {
        const invalidTokens = await sendPushNotification(user.fcmTokens, doc.title, doc.message, {
          ticketId: doc.ticketId ? doc.ticketId.toString() : "",
          type: doc.type
        });
        
        // Clean up invalid tokens from the user's document
        if (invalidTokens && invalidTokens.length > 0) {
          console.log(`Cleaning up ${invalidTokens.length} invalid tokens for user ${user.email}`);
          await User.updateOne(
            { _id: user._id },
            { $pull: { fcmTokens: { $in: invalidTokens } } }
          );
        }
      } else {
        console.log(`Skipping push notification: User ${user.email} has no FCM tokens.`);
      }
    } else {
      console.log(`User ${doc.user} not found in database.`);
    }
  } catch (err) {
    console.error("Error in notification post save hook:", err);
  }
  next();
});

module.exports = ticketDB.model("Notification", notificationSchema);
