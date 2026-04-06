const UserAppRole = require("../auth/userAppRole.model");
const Role = require("../role/role.model");
const Ticket = require("./ticket.model");
const User = require("../auth/auth.model");
const Service = require("../serviceCategory/service.model");
const mongoose = require("mongoose");

exports.getTeamDashboard = async (req, res) => {
  try {
    const adminRole = req.user.roles.find(r => r.role === "ADMIN");
    if (!adminRole?.service)
      return res.status(403).json({ message: "No service assigned" });

    const serviceId = new mongoose.Types.ObjectId(adminRole.service);

    const serviceDoc = await Service.findById(serviceId).lean();
    const serviceName = serviceDoc ? serviceDoc.name : "Department";

    const employeeRole = await Role.findOne({
      name: "EMPLOYEE",
      app: "TICKET_SYSTEM"
    });

    // 1️ ticketDB — UserAppRole fetch (NO populate — cross-DB fix)
    const teamMappings = await UserAppRole.find({
      role: employeeRole._id,
      service: serviceId
    }).lean();

    const userIds = teamMappings.map(m => m.userId);

    // 2️ commonusersDB — Users manually fetch
    const users = await User.find({
      _id: { $in: userIds }
    }).lean();

    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    // 3️ ticketDB — Tickets fetch
    const tickets = await Ticket.find({
      service: serviceId,
      "assignedTo.user": { $in: userIds },
      status: { $ne: "REJECTED" }
    }).lean();

    // 4️ Merge
    let totalActiveTickets = 0;

    const members = teamMappings.map(mapping => {
      const uid = mapping.userId.toString();
      const userData = userMap[uid];

      if (!userData) return null;

      const activeTicketsList = tickets.filter(ticket =>
        ticket.assignedTo.some(a =>
          a.user.toString() === uid &&
          ["OPEN", "IN_PROGRESS"].includes(a.status)
        )
      );

      const completedTicketsList = tickets.filter(ticket =>
        ticket.assignedTo.some(a =>
          a.user.toString() === uid &&
          a.status === "RESOLVED"
        )
      );

      const activeTickets = activeTicketsList.length;
      const completed = completedTicketsList.length;
      totalActiveTickets += activeTickets;

      return {
        _id: userData._id,
        name: userData.name,
        empId: userData.institutionId,
        email: userData.email,
        phone: userData.phone || "N/A",
        profileImage: userData.profileImage,
        activeTickets,
        completed,
        status: activeTickets > 0 ? "busy" : "available"
      };
    }).filter(Boolean);

    const totalMembers = members.length;
    const totalBusy = members.filter(m => m.status === "busy").length;
    const totalAvailable = totalMembers - totalBusy;

    res.json({
      serviceName,
      summary: {
        totalMembers,
        totalAvailable,
        totalBusy,
        totalActiveTickets
      },
      members
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addTeamMember = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId)
      return res.status(400).json({ message: "UserId required" });

    const adminRole = req.user.roles.find(r => r.role === "ADMIN");

    if (!adminRole || !adminRole.service) {
      return res.status(403).json({ message: "No service scope found" });
    }

    const serviceId = new mongoose.Types.ObjectId(adminRole.service);

    const employeeRole = await Role.findOne({
      name: "EMPLOYEE",
      app: "TICKET_SYSTEM"
    });

    if (!employeeRole)
      return res.status(400).json({ message: "Employee role missing" });

    const exists = await UserAppRole.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      role: employeeRole._id,
      service: serviceId
    });

    if (exists)
      return res.status(400).json({
        message: "User already in this service team"
      });

    await UserAppRole.create({
      userId: new mongoose.Types.ObjectId(userId),
      role: employeeRole._id,
      service: serviceId,
      app: "TICKET_SYSTEM"
    });

    res.json({ message: "Team member added successfully" });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Duplicate role assignment"
      });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.removeTeamMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminRole = req.user.roles.find(r => r.role === "ADMIN");

    if (!adminRole || !adminRole.service) {
      return res.status(403).json({ message: "No service assigned" });
    }

    const serviceId = new mongoose.Types.ObjectId(adminRole.service);

    const employeeRole = await Role.findOne({
      name: "EMPLOYEE",
      app: "TICKET_SYSTEM"
    });

    await UserAppRole.findOneAndDelete({
      userId: new mongoose.Types.ObjectId(userId),
      service: serviceId,
      role: employeeRole._id
    });

    res.json({ message: "Team member removed successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};