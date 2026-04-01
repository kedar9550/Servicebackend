const User = require("./auth.model");
const UserAppRole = require("./userAppRole.model");
require("../role/role.model");
require("../role/permission.model");

const loginUser = async (id, password, app) => {

  //console.log("Incoming id:", id);

  const user = await User.findOne({
    institutionId: id
  });

  //console.log("User found:", user)

  if (!user) throw new Error("User not found");

  const match = await user.comparePassword(password);
  //console.log("Password match:", match);

  if (!match) throw new Error("Invalid password");

  const mappings = await UserAppRole.find({
    userId: user._id,
    app
  }).populate({
    path: "role",
    populate: { path: "permissions" }
  });

  if (!mappings.length)
    throw new Error("No role assigned");

  const roles = mappings.map(m => ({
    role: m.role.name,
    service: m.service,
    permissions: m.role.permissions.map(p => p.key)
  }));

  return {
    user,
    roles
  };
};

module.exports = { loginUser };
