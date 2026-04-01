require("dotenv").config();
const mongoose = require("mongoose");

const UserAppRole =
  require("../modules/auth/userAppRole.model");

const Role =
  require("../modules/role/role.model");

const run = async () => {

  const userId =
    new mongoose.Types.ObjectId("69c39feb80a684492e692bcb");

  const superAdminRole =
    await Role.findOne({
      name: "SUPER_ADMIN",
      app: "TICKET_SYSTEM"
    });

  await UserAppRole.create({
    userId,
    app: "TICKET_SYSTEM",
    role: superAdminRole._id
  });

  console.log("✅ Super Admin assigned");
  process.exit();
};

run();