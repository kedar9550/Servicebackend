const mongoose = require("mongoose");

console.log("⏳ Attempting to connect to Auth Database...");

const authDB = mongoose.createConnection(
    process.env.AUTH_DB
);

authDB.on("connected", () => {
    console.log("✅ Auth DB Connected Successfully");
});

authDB.on("error", (err) => {
    console.error("❌ Auth DB Connection Error:", err.message);
    console.log("Tip: Check if your MongoDB Atlas Network Access allows Render's IP (0.0.0.0/0)!");
});

authDB.on("disconnected", () => {
    console.log("⚠️ Auth DB Disconnected");
});

module.exports = authDB;