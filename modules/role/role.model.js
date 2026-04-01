const mongoose = require("mongoose");
const authDB = require("../../config/db/authDB");
const RoleSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    uppercase: true,
    trim: true

  },

  app: {                   
    type: String,
    required: true,
    uppercase: true
  },

  permissions: {
  type:[{
    type: mongoose.Schema.Types.ObjectId,
    ref:"Permission"
  }],
  default:[]
}


}, { timestamps: true });

RoleSchema.index({ name:1, app:1 }, { unique:true });


module.exports = authDB.model("Role", RoleSchema);
