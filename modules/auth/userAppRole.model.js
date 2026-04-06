const mongoose = require("mongoose");
const ticketDB = require("../../config/db/ticketDB");

const UserAppRoleSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  app: {
    type: String,
    required: true,
    uppercase: true
  },

  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: true
  },

  service: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
    // only required for ADMIN & EMPLOYEE
  }

}, { timestamps: true });

UserAppRoleSchema.index(
  { userId: 1, app: 1, service: 1, role: 1 },
  { unique: true }
);

module.exports = ticketDB.model("UserAppRole", UserAppRoleSchema);
