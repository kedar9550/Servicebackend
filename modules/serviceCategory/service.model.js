const mongoose = require("mongoose");
const ticketDB = require("../../config/db/ticketDB");

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
 

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true 
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

module.exports = ticketDB.model("Service", serviceSchema);