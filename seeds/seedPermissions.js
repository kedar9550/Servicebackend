require("dotenv").config();
const mongoose = require("mongoose");

const authDB = require("../config/db/authDB");
const Permission = require("../modules/role/permission.model");

const permissions = [
  { key: "CREATE_TICKET" },
  { key: "ASSIGN_TICKET" },
  { key: "CHANGE_PRIORITY" },
  { key: "VIEW_ALL_TICKETS" },
  { key: "VIEW_ALL_ANALYTICS" },
  { key: "CREATE_SERVICE" },
  { key: "DELETE_SERVICE" },
  { key: "MANAGE_SUBADMINS" },
  { key: "VIEW_ASSIGNED_TICKETS" },
  { key: "COMMENT_TICKET" },
  { key: "UPDATE_STATUS" },
  { key: "REJECT_TICKET" }
];

const run = async () => {
  for (const perm of permissions) {
    await Permission.updateOne(
      { key: perm.key },
      { $setOnInsert: perm },
      { upsert: true }
    );
  }

  console.log("✅ Permissions seeded safely");
  process.exit();
};

run();