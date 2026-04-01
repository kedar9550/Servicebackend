const mongoose = require("mongoose");
const authDB = require("../../config/db/authDB");

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

module.exports = authDB.model("Permission", PermissionSchema);
