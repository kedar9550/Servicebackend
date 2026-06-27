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
    
    const user = await User.findById(doc.user);
    if (user && user.fcmToken) {
      await sendPushNotification(user.fcmToken, doc.title, doc.message, {
        ticketId: doc.ticketId ? doc.ticketId.toString() : "",
        type: doc.type
      });
    }
  } catch (err) {
    console.error("Error in notification post save hook:", err);
  }
  next();
});

module.exports = ticketDB.model("Notification", notificationSchema);
