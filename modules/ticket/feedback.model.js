const mongoose = require("mongoose");
const ticketDB = require("../../config/db/ticketDB");

const feedbackSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ticket",
    required: true,
    unique: true // One feedback per ticket
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  satisfaction: {
    type: String,
    enum: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"],
    required: true
  },
  comments: {
    type: String,
    maxLength: 500
  }
}, { timestamps: true });

module.exports = ticketDB.model("Feedback", feedbackSchema);
