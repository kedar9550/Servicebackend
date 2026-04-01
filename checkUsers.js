require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const authDB = require("./config/db/authDB");
const User = require("./modules/auth/auth.model");

const run = async () => {
  try {
    const countTotal = await User.countDocuments({});
    const countWithId = await User.countDocuments({ institutionId: { $exists: true } });
    const sampleWithId = await User.findOne({ institutionId: { $exists: true } });
    
    const result = {
      totalUsers: countTotal,
      usersWithInstitutionId: countWithId,
      sampleUser: sampleWithId
    };
    
    fs.writeFileSync("stats_output.json", JSON.stringify(result, null, 2));
    console.log("Stats written to stats_output.json");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
};

run();
