const mongoose = require("mongoose");

const authDB = mongoose.createConnection(
  process.env.AUTH_DB
);

authDB.on("connected", () => {
  console.log("✅ Auth DB Connected");
});

authDB.on("error", (err) => {
  console.error("❌ Auth DB Error:", err.message);
});

authDB.on("disconnected", () => {
  console.log("⚠️ Auth DB Disconnected");
});

module.exports = authDB;