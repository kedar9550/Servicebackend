const mongoose = require("mongoose");

console.log("⏳ Attempting to connect to Common Users Database...");

const commonusersDB = mongoose.createConnection(
    process.env.COMMON_USERS_DB
);

commonusersDB.on("connected", () => {
    console.log("✅ Common Users DB Connected Successfully");
});

commonusersDB.on("error", (err) => {
    console.error("❌ Common Users DB Connection Error:", err.message);
    console.log("Tip: Check if your MongoDB Atlas Network Access allows Render's IP (0.0.0.0/0)!");
});

commonusersDB.on("disconnected", () => {
    console.log("⚠️ Common Users DB Disconnected");
});

module.exports = commonusersDB;
