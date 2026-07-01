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
      app: process.env.APP_NAME || "DIGITAL_SERVICE_SYSTEM"
    });

    // 1️ Fetch Team Mappings with User Details
    const teamMappings = await UserAppRole.find({
      role: employeeRole._id,
      service: serviceId
    }).populate("userId").lean();

    const userIds = teamMappings.map(m => m.userId ? m.userId._id : m.userId);

    // 2️ Tickets fetch
    const tickets = await Ticket.find({
      service: serviceId,
      "assignedTo.user": { $in: userIds },
      status: { $ne: "REJECTED" }
    }).lean();

    // 3️ Merge
    let totalActiveTickets = 0;

    const members = teamMappings.map(mapping => {
      const userData = mapping.userId;
      if (!userData) return null;
      const uid = userData._id.toString();

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
      app: process.env.APP_NAME || "DIGITAL_SERVICE_SYSTEM"
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
      app: process.env.APP_NAME || "DIGITAL_SERVICE_SYSTEM"
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
      app: process.env.APP_NAME || "DIGITAL_SERVICE_SYSTEM"
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