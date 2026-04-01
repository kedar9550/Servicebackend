const User = require("./auth.model");
const UserAppRole = require("./userAppRole.model");
require("../role/role.model");
require("../role/permission.model");

const loginUser = async (id, password, app) => {
    console.log(`🔐 Login attempt for ID: ${id} on app: ${app}`);

    const user = await User.findOne({
        institutionId: id
    });

    if (!user) {
        console.warn(`❌ Login failed: User not found for ID: ${id}`);
        throw new Error("User not found");
    }

    const match = await user.comparePassword(password);
    if (!match) {
        console.warn(`❌ Login failed: Invalid password for ID: ${id}`);
        throw new Error("Invalid password");
    }

    const mappings = await UserAppRole.find({
        userId: user._id,
        app
    }).populate({
        path: "role",
        populate: { path: "permissions" }
    });

    if (!mappings.length) {
        console.warn(`❌ Login failed: No role assigned for user ${id} in app ${app}`);
        throw new Error("No role assigned");
    }

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
