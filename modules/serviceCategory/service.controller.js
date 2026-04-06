const Service = require("./service.model");
const User = require("../auth/auth.model");
const Role = require("../role/role.model");
const UserAppRole = require("../auth/userAppRole.model");
const Ticket = require("../ticket/ticket.model");

// CREATE SERVICE
exports.createService = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Service name required" });

    const existing = await Service.findOne({ name });
    if (existing) return res.status(400).json({ message: "Service already exists" });

    const service = await Service.create({ name, createdBy: req.user._id });
    res.status(201).json({ message: "Service created successfully", service });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const service = await Service.findByIdAndUpdate(id, { name }, { new: true });
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json({ message: "Service updated successfully", service });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getServices = async (req, res) => {
  const services = await Service.find();
  res.json(services);
};

exports.deleteService = async (req, res) => {
  await Service.findByIdAndDelete(req.params.id);
  res.json({ message: "Service deleted" });
};

exports.assignAdminToService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ message: "User ID required" });

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });

    // commonusersDB
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ message: "User not found. Please create user first." });

    // ticketDB
    const adminRole = await Role.findOne({ name: "ADMIN", app: "TICKET_SYSTEM" });

    const alreadyAssigned = await UserAppRole.findOne({
      userId: user._id,
      app: "TICKET_SYSTEM",
      service: serviceId
    });
    if (alreadyAssigned) return res.status(400).json({ message: "Already assigned as admin" });

    await UserAppRole.create({
      userId: user._id,
      app: "TICKET_SYSTEM",
      role: adminRole._id,
      service: serviceId
    });

    res.json({ message: "Admin assigned successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getServiceAdmins = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const adminRole = await Role.findOne({ name: "ADMIN", app: "TICKET_SYSTEM" });

    // ticketDB — NO cross-DB populate
    const admins = await UserAppRole.find({ service: serviceId, role: adminRole._id }).lean();

    // commonusersDB — manual fetch
    const userIds = admins.map(a => a.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("name institutionId email").lean();

    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const result = admins.map(a => ({
      ...a,
      userId: userMap[a.userId.toString()] || a.userId
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.removeAdmin = async (req, res) => {
  try {
    const { serviceId, userId } = req.params;
    await UserAppRole.findOneAndDelete({ service: serviceId, userId });
    res.json({ message: "Admin removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getServiceStats = async (req, res) => {
  try {
    const services = await Service.find().lean();
    if (!services.length) return res.json([]);

    const serviceIds = services.map(s => s._id);

    // 1️ Ticket stats — ticketDB
    const ticketStats = await Ticket.aggregate([
      { $match: { service: { $in: serviceIds } } },
      { $group: { _id: "$service", totalTickets: { $sum: 1 } } }
    ]);

    // 2️ Role IDs — ticketDB
    const adminRole = await Role.findOne({ name: "ADMIN", app: "TICKET_SYSTEM" });
    const employeeRole = await Role.findOne({ name: "EMPLOYEE", app: "TICKET_SYSTEM" });

    // 3️ Employee stats — ticketDB
    const employeeStats = await UserAppRole.aggregate([
      { $match: { service: { $in: serviceIds }, role: employeeRole._id } },
      { $group: { _id: "$service", totalEmployees: { $sum: 1 } } }
    ]);

    // 4️ Admin mappings — ticketDB (NO $lookup — cross-DB fix)
    const adminMappings = await UserAppRole.find({
      service: { $in: serviceIds },
      role: adminRole._id
    }).lean();

    // 5️ Fetch admin user details — commonusersDB
    const adminUserIds = adminMappings.map(m => m.userId);
    const adminUsers = await User.find({ _id: { $in: adminUserIds } })
      .select("name institutionId email").lean();

    const adminUserMap = {};
    adminUsers.forEach(u => { adminUserMap[u._id.toString()] = u; });

    // 6️ Group admins by service
    const adminMap = {};
    adminMappings.forEach(m => {
      const sid = m.service.toString();
      if (!adminMap[sid]) adminMap[sid] = [];
      const user = adminUserMap[m.userId.toString()];
      if (user) {
        adminMap[sid].push({
          name: user.name,
          institutionId: user.institutionId,
          email: user.email
        });
      }
    });

    // 7️ Maps
    const ticketMap = Object.fromEntries(ticketStats.map(t => [t._id.toString(), t.totalTickets]));
    const employeeMap = Object.fromEntries(employeeStats.map(e => [e._id.toString(), e.totalEmployees]));

    // 8️ Final merge
    const finalResponse = services.map(service => ({
      ...service,
      totalTickets: ticketMap[service._id.toString()] || 0,
      totalEmployees: employeeMap[service._id.toString()] || 0,
      admins: adminMap[service._id.toString()] || []
    }));

    res.json(finalResponse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};