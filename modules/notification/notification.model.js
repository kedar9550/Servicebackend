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
    enum: ["TICKET_CREATED", "TICKET_ASSIGNED", "STATUS_UPDATED", "NEW_COMMENT"],
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

module.exports = ticketDB.model("Notification", notificationSchema);
