require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const authDB = require("./config/db/authDB");
const Role = require("./modules/role/role.model");

const run = async () => {
  try {
    const roles = await Role.find({});
    fs.writeFileSync("roles_output.json", JSON.stringify(roles, null, 2));
    console.log("Roles written to roles_output.json");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
};

run();
