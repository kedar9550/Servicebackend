const mongoose = require("mongoose");
const ticketDB = require("../../config/db/ticketDB");

const commentSchema = new mongoose.Schema({

  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ticket",
    required: true
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true // from auth DB
  },

  message: {
    type: String,
    required: true
  }

}, { timestamps: true });
commentSchema.index({ ticket: 1 });

module.exports = ticketDB.model("Comment", commentSchema);