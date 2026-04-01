const mongoose = require("mongoose");
const ticketDB = require("../../config/db/ticketDB");


const ticketSchema = new mongoose.Schema({

  ticketNumber: {
    type: String,
    unique: true,
    required: true
  },

  title: { type: String, required: true },
  description: { type: String, required: true },

  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  assignedTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    status: {
      type: String,
      enum: ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REJECTED"],
      default: "OPEN"
    },
    dueDate: {
      type: Date,
      default: null
    },
    note: String,
    updatedAt: Date
  }],

  attachments: [{
    fileName: String,      // original
    storedName: String,    // saved filename
    filePath: String,
    fileType: String
  }],

  priority: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH"],
    default: "MEDIUM"
  },

  status: {
    type: String,
    enum: ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REJECTED", "CLOSED"],
    default: "OPEN"
  }

}, { timestamps: true });


module.exports = ticketDB.model("Ticket", ticketSchema);