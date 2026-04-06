const mongoose = require("mongoose");
const ticketDB = require("../../config/db/ticketDB");

const PermissionSchema = new mongoose.Schema({

  key: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },

  description: {
    type: String,
    default: ""
  }

}, { timestamps: true });

module.exports = ticketDB.model("Permission", PermissionSchema);
