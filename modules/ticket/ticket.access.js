const hasTicketAccess = (req, ticket) => {
  const userId = req.user._id.toString();

  const isCreator =
    ticket.createdBy?.toString() === userId;

  const isAssigned =
    ticket.assignedTo?.some(
  a => a.user.toString() === userId
);

  const hasAdminAccess = req.user.roles.some(role => {
    if (role.role === "SUPER_ADMIN") return true;

    if (
      role.role === "ADMIN" &&
      role.service?.toString() === ticket.service._id.toString()
    ) return true;

    return false;
  });

  return isCreator || isAssigned || hasAdminAccess;
};

module.exports = { hasTicketAccess };