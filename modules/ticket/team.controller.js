const UserAppRole = require("../auth/userAppRole.model");
const Role = require("../role/role.model");
const Ticket = require("./ticket.model");
const User = require("../auth/auth.model");
const Service = require("../serviceCategory/service.model");
const mongoose = require("mongoose");

// exports.getTeamDashboard = async (req, res) => {
//     try {
//         const adminRole = req.user.roles.find(r => r.role === "ADMIN");

//         if (!adminRole || !adminRole.service) {
//             return res.status(403).json({ message: "No service assigned" });
//         }

//         const serviceId = new mongoose.Types.ObjectId(adminRole.service);

//         const employeeRole = await Role.findOne({
//             name: "EMPLOYEE",
//             app: "TICKET_SYSTEM"
//         });

//         if (!employeeRole)
//             return res.status(400).json({ message: "Employee role missing" });

//         const teamData = await UserAppRole.aggregate([
//             {
//                 $match: {
//                     role: employeeRole._id,
//                     service: serviceId
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "users",
//                     localField: "userId",
//                     foreignField: "_id",
//                     as: "user"
//                 }
//             },
//             { $unwind: "$user" },

//             {
//                 $lookup: {
//                     from: "tickets",
//                     let: { userId: "$user._id" },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: {
//                                     $and: [
//                                         {
//                                             $in: [
//                                                 "$$userId",
//                                                 {
//                                                     $map: {
//                                                         input: "$assignedTo",
//                                                         as: "a",
//                                                         in: "$$a.user"
//                                                     }
//                                                 }
//                                             ]
//                                         },
//                                         { $eq: ["$service", serviceId] }
//                                     ]
//                                 }
//                             }
//                         }
//                     ],
//                     as: "tickets"
//                 }
//             },

//             {
//                 $addFields: {
//                     activeTickets: {
//                         $size: {
//                             $filter: {
//                                 input: "$tickets",
//                                 as: "t",
//                                 cond: {
//                                     $gt: [
//                                         {
//                                             $size: {
//                                                 $filter: {
//                                                     input: "$$t.assignedTo",
//                                                     as: "a",
//                                                     cond: {
//                                                         $and: [
//                                                             { $eq: ["$$a.user", "$user._id"] },
//                                                             { $in: ["$$a.status", ["OPEN", "IN_PROGRESS"]] }
//                                                         ]
//                                                     }
//                                                 }
//                                             }
//                                         },
//                                         0
//                                     ]
//                                 }
//                             }
//                         }
//                     },

//                     inProgress: {
//                         $size: {
//                             $filter: {
//                                 input: "$tickets",
//                                 as: "t",
//                                 cond: {
//                                     $gt: [
//                                         {
//                                             $size: {
//                                                 $filter: {
//                                                     input: "$$t.assignedTo",
//                                                     as: "a",
//                                                     cond: {
//                                                         $and: [
//                                                             { $eq: ["$$a.user", "$user._id"] },
//                                                             { $eq: ["$$a.status", "IN_PROGRESS"] }
//                                                         ]
//                                                     }
//                                                 }
//                                             }
//                                         },
//                                         0
//                                     ]
//                                 }
//                             }
//                         }
//                     },

//                     completed: {
//                         $size: {
//                             $filter: {
//                                 input: "$tickets",
//                                 as: "t",
//                                 cond: {
//                                     $gt: [
//                                         {
//                                             $size: {
//                                                 $filter: {
//                                                     input: "$$t.assignedTo",
//                                                     as: "a",
//                                                     cond: {
//                                                         $and: [
//                                                             { $eq: ["$$a.user", "$user._id"] },
//                                                             { $eq: ["$$a.status", "RESOLVED"] }
//                                                         ]
//                                                     }
//                                                 }
//                                             }
//                                         },
//                                         0
//                                     ]
//                                 }
//                             }
//                         }
//                     }
//                 }
//             },

//             {
//                 $project: {
//                     _id: "$user._id",
//                     name: "$user.name",
//                     empId: "$user.institutionId",
//                     email: "$user.email",
//                     phone: "$user.phone",
//                     activeTickets: 1,
//                     inProgress: 1,
//                     completed: 1,
//                     status: {
//                         $cond: [
//                             { $gt: ["$activeTickets", 5] },
//                             "busy",
//                             "available"
//                         ]
//                     }
//                 }
//             }
//         ]);

//         // Summary
//         const totalMembers = teamData.length;
//         const totalActiveTickets = teamData.reduce(
//             (sum, m) => sum + m.activeTickets,
//             0
//         );
//         const totalBusy = teamData.filter(m => m.status === "busy").length;
//         const totalAvailable = totalMembers - totalBusy;

//         res.json({
//             summary: {
//                 totalMembers,
//                 totalAvailable,
//                 totalBusy,
//                 totalActiveTickets
//             },
//             members: teamData
//         });

//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// };


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

    // 1️Auth DB
    const teamMembers = await UserAppRole.find({
      role: employeeRole._id,
      service: serviceId
    }).populate("userId");

    const userIds = teamMembers.map(m => m.userId._id);

    // 2️ Ticket DB
    const tickets = await Ticket.find({
      service: serviceId,
      "assignedTo.user": { $in: userIds }
    });

    // 3️Merge
    let totalActiveTickets = 0;

    const members = teamMembers.map(member => {
      const uid = member.userId._id.toString();

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
        _id: member.userId._id,
        name: member.userId.name,
        empId: member.userId.institutionId,
        email: member.userId.email,
        phone: member.userId.phone || "N/A",
        profileImage: member.userId.profileImage,
        activeTickets,
        completed,
        status: activeTickets > 0 ? "busy" : "available"
      };
    });

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

        const adminRole = req.user.roles.find(
            r => r.role === "ADMIN"
        );

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