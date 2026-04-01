require("dotenv").config();

const Permission = require("../modules/role/permission.model");
const Role = require("../modules/role/role.model");

const run = async () => {

  const allPermissions = await Permission.find();

  const getPermIds = (keys) =>
    allPermissions
      .filter(p => keys.includes(p.key))
      .map(p => p._id);

  // SUPER ADMIN → all permissions
  await Role.updateOne(
    { name: "SUPER_ADMIN" },
    {
      $setOnInsert: {
        name: "SUPER_ADMIN",
        app: "TICKET_SYSTEM",
        permissions: allPermissions.map(p => p._id)
      }
    },
    { upsert: true }
  );

  // ADMIN (Service Scoped)
  await Role.updateOne(
    { name: "ADMIN" },
    {
      $setOnInsert: {
        name: "ADMIN",
        app: "TICKET_SYSTEM",
        permissions: getPermIds([
          "ASSIGN_TICKET",
          "CHANGE_PRIORITY",
          "VIEW_ALL_TICKETS",
          "VIEW_ALL_ANALYTICS"
        ])
      }
    },
    { upsert: true }
  );

  // EMPLOYEE
  await Role.updateOne(
    { name: "EMPLOYEE" },
    {
      $setOnInsert: {
        name: "EMPLOYEE",
        app: "TICKET_SYSTEM",
        permissions: getPermIds([
          "VIEW_ASSIGNED_TICKETS",
          "COMMENT_TICKET",
          "UPDATE_STATUS",
          "REJECT_TICKET"
        ])
      }
    },
    { upsert: true }
  );

  // USER
  await Role.updateOne(
    { name: "USER" },
    {
      $setOnInsert: {
        name: "USER",
        app: "TICKET_SYSTEM",
        permissions: getPermIds([
          "CREATE_TICKET",
          "COMMENT_TICKET"
        ])
      }
    },
    { upsert: true }
  );

  console.log("✅ Roles seeded safely");
  process.exit();
};

run();