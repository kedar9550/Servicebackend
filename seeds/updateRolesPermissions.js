require('dotenv').config();
const Permission = require('../modules/role/permission.model');
const Role = require('../modules/role/role.model');

const run = async () => {
  const allPermissions = await Permission.find();

  const getPermIds = (keys) =>
    allPermissions
      .filter(p => keys.includes(p.key))
      .map(p => p._id);

  // SUPER_ADMIN → all permissions
  await Role.updateOne(
    { name: 'SUPER_ADMIN', app: 'TICKET_SYSTEM' },
    { $set: { permissions: allPermissions.map(p => p._id) } }
  );

  // ADMIN (Service Scoped)
  await Role.updateOne(
    { name: 'ADMIN', app: 'TICKET_SYSTEM' },
    { $set: { permissions: getPermIds([
      'ASSIGN_TICKET',
      'CHANGE_PRIORITY',
      'VIEW_ALL_TICKETS',
      'VIEW_ALL_ANALYTICS'
    ]) } }
  );

  // EMPLOYEE
  await Role.updateOne(
    { name: 'EMPLOYEE', app: 'TICKET_SYSTEM' },
    { $set: { permissions: getPermIds([
      'VIEW_ASSIGNED_TICKETS',
      'COMMENT_TICKET',
      'UPDATE_STATUS',
      'REJECT_TICKET'
    ]) } }
  );

  // USER
  await Role.updateOne(
    { name: 'USER', app: 'TICKET_SYSTEM' },
    { $set: { permissions: getPermIds([
      'CREATE_TICKET',
      'COMMENT_TICKET'
    ]) } }
  );

  console.log('✅ Roles updated with permissions');
  process.exit();
};

run().catch(e => { console.error(e); process.exit(1); });
