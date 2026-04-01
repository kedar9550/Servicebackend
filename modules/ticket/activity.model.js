const mongoose = require("mongoose");
const ticketDB = require("../../config/db/ticketDB");

const activitySchema = new mongoose.Schema({

  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ticket",
    required: true
  },

  action: {
    type: String,
    required: true
  },

  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  metadata: Object

}, { timestamps: true });

activitySchema.index({ ticket: 1 });

module.exports = ticketDB.model("Activity", activitySchema);
