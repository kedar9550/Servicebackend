require('dotenv').config();
const Permission = require('../modules/role/permission.model');

const permissions = [
  'CREATE_TICKET','ASSIGN_TICKET','CHANGE_PRIORITY','VIEW_ALL_TICKETS','VIEW_ALL_ANALYTICS','CREATE_SERVICE','DELETE_SERVICE','MANAGE_SUBADMINS','VIEW_ASSIGNED_TICKETS','COMMENT_TICKET','UPDATE_STATUS','REJECT_TICKET'
];

(async () => {
  try {
    for (const key of permissions) {
      await Permission.updateOne({ key }, { $setOnInsert: { key } }, { upsert: true });
    }
    console.log('✅ Permissions seeded (fix)');
    process.exit();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
