module.exports = (permissions, serviceId = null) => {
  return (req, res, next) => {

    const permissionList = Array.isArray(permissions)
      ? permissions
      : [permissions];

    const hasPermission = req.user.roles.some(role => {

      const permissionMatch =
        permissionList.some(p =>
          role.permissions.includes(p)
        );

      const serviceMatch =
        !serviceId ||
        !role.service ||
        role.service?.toString() === serviceId.toString();

      return permissionMatch && serviceMatch;
    });

    if (!hasPermission) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};


























// module.exports = (permission, serviceId = null) => {
//   return (req, res, next) => {

//     const hasPermission = req.user.roles.some(role => {

//       const permissionMatch =
//         role.permissions.includes(permission);

//       const serviceMatch =
//         !serviceId || !role.service ||
//         role.service?.toString() === serviceId.toString();

//       return permissionMatch && serviceMatch;
//     });

//     if (!hasPermission) {
//       return res.status(403).json({ message: "Access denied" });
//     }

//     next();
//   };
// };