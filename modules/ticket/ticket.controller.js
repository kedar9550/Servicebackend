const Ticket = require("./ticket.model");
const User = require('../auth/auth.model')
const Comment = require("./comment.model");
const Activity = require("./activity.model");
const fs = require("fs");
const path = require("path");
const { hasTicketAccess } = require("./ticket.access");
const UserAppRole = require("../auth/userAppRole.model");
const Role = require("../role/role.model");
const Notification = require("../notification/notification.model");
const socketService = require("../../services/socket.service");

const deleteTicketAttachments = (ticket) => {
  if (ticket.attachments && ticket.attachments.length > 0) {
    ticket.attachments.forEach(file => {
      try {
        if (file.filePath && fs.existsSync(file.filePath)) {
          fs.unlinkSync(file.filePath);
        }
      } catch (err) {
        console.error("Error deleting attachment:", err);
      }
    });
    try {
      if (ticket.attachments[0] && ticket.attachments[0].filePath) {
        const dir = path.dirname(ticket.attachments[0].filePath);
        if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
          fs.rmdirSync(dir);
        }
      }
    } catch (err) {
      console.error("Error deleting ticket directory:", err);
    }
    ticket.attachments = [];
  }
};

exports.createTicket = async (req, res) => {
  try {

    const { title, description, service } = req.body;

    if (!title || !description || !service)
      return res.status(400).json({ message: "All fields required" });

    const attachments = req.files?.map(file => ({
      fileName: file.originalname,
      storedName: file.filename,
      filePath: file.path,
      fileType: file.mimetype
    })) || [];

    const ticket = await Ticket.create({
      ticketNumber: req.ticketNumber,
      title,
      description,
      service,
      createdBy: req.user._id,
      attachments
    });

    await Activity.create({
      ticket: ticket._id,
      action: "TICKET_CREATED",
      performedBy: req.user._id
    });

    try {
      const adminRole = await Role.findOne({ name: "ADMIN", app: "TICKET_SYSTEM" });
      if (adminRole) {
        const adminUsers = await UserAppRole.find({ role: adminRole._id, service: service });
        const io = socketService.getIO();
        for (let admin of adminUsers) {
          const notif = await Notification.create({
            user: admin.userId,
            title: "New Ticket Created",
            message: `Ticket ${ticket.ticketNumber} has been created.`,
            ticketId: ticket._id,
            type: "TICKET_CREATED"
          });
          io.to(`user_${admin.userId}`).emit("new_notification", notif);
        }
      }
    } catch (notifErr) { console.error("Notification Error:", notifErr); }

    res.status(201).json({
      message: "Ticket created successfully",
      ticket
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




exports.getMyTickets = async (req, res) => {
  try {
    //console.log(req.user._id)
    const tickets = await Ticket.find({
      createdBy: req.user._id
    })
      .populate("service", "name") // get service name
      .sort({ createdAt: -1 });

    res.status(200).json(tickets);

    //console.log(tickets)

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



exports.getTicketById = async (req, res) => {
  try {
    // 1️ Get ticket (no populate for users)
    const ticket = await Ticket.findById(req.params.id)
      .populate("service", "name")
      .lean();

    //console.log("ADMIN ROLES:", req.user.roles);
    //console.log("TICKET SERVICE:", ticket.service);

    if (!ticket)
      return res.status(404).json({ message: "Ticket not found" });

    if (!hasTicketAccess(req, ticket)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // 3️ Fetch creator details
    const createdUser = await User.findById(ticket.createdBy)
      .select("name email")
      .lean();

    ticket.createdBy = createdUser;

    // 4️ Fetch assigned users
    const assignedIds = ticket.assignedTo.map(a => a.user);

    const assignedUsers = await User.find({
      _id: { $in: assignedIds }
    }).select("name email").lean();

    ticket.assignedTo = ticket.assignedTo.map(a => {
      const user = assignedUsers.find(
        u => u._id.toString() === a.user.toString()
      );

      return {
        ...a,
        user
      };
    });

    // 5️ Get comments
    const comments = await Comment.find({
      ticket: ticket._id
    }).lean().sort({ createdAt: 1 });

    // 6️Collect unique user IDs from comments
    const userIds = [
      ...new Set(comments.map(c => c.user.toString()))
    ];

    // 7️ Fetch all users in ONE query
    const users = await User.find({
      _id: { $in: userIds }
    })
      .select("name")
      .lean();

    // 8️Create lookup map
    const userMap = {};
    users.forEach(u => {
      userMap[u._id.toString()] = u;
    });

    // 9️ Attach user + role to comments
    const commentsWithUser = comments.map(c => {
      const user = userMap[c.user.toString()];

      return {
        ...c,
        user,
        role:
          user?._id?.toString() === createdUser._id.toString()
            ? "User"
            : "Support Agent"
      };
    });


    // 10️ Get activities
    const activities = await Activity.find({
      ticket: ticket._id
    }).lean().sort({ createdAt: 1 });

    // Collect unique performedBy IDs
    const activityUserIds = [
      ...new Set(activities.map(a => a.performedBy.toString()))
    ];

    // Fetch all users in one query
    const activityUsers = await User.find({
      _id: { $in: activityUserIds }
    })
      .select("name")
      .lean();

    // Create lookup map
    const activityUserMap = {};
    activityUsers.forEach(u => {
      activityUserMap[u._id.toString()] = u;
    });

    // Attach user to activities
    const activitiesWithUser = activities.map(a => ({
      ...a,
      performedBy: activityUserMap[a.performedBy.toString()]
    }));

    // 11 Send response
    res.status(200).json({
      success: true,
      data: {
        ticket,
        comments: commentsWithUser,
        activities: activitiesWithUser
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {

    const { message } = req.body;

    if (!message)
      return res.status(400).json({ message: "Message required" });

    const comment = await Comment.create({
      ticket: req.params.id,
      user: req.user._id,
      message
    });

    const populatedComment = await Comment.findById(comment._id).populate("user", "name email profileImage").lean();
    populatedComment.role = req.user.roles?.some(r => r.role === "ADMIN" || r.role === "EMPLOYEE") ? "Support Agent" : "User";

    try {
      const io = socketService.getIO();
      io.to(`ticket_${req.params.id}`).emit("new_message", populatedComment);

      const ticket = await Ticket.findById(req.params.id);
      const adminRole = await Role.findOne({ name: "ADMIN", app: "TICKET_SYSTEM" });
      const adminUsers = adminRole ? await UserAppRole.find({ role: adminRole._id, service: ticket.service }) : [];
      let participants = new Set([ticket.createdBy.toString()]);
      ticket.assignedTo.forEach(a => participants.add(a.user.toString()));
      adminUsers.forEach(a => participants.add(a.userId.toString()));

      participants.delete(req.user._id.toString()); // Remove sender

      for (let userId of participants) {
        const notif = await Notification.create({
          user: userId,
          title: "New Message",
          message: `New message on Ticket ${ticket.ticketNumber}`,
          ticketId: ticket._id,
          type: "NEW_COMMENT"
        });
        io.to(`user_${userId}`).emit("new_notification", notif);
      }
    } catch(err) { console.error("Socket emit error on addComment:", err); }

    res.status(201).json(populatedComment);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.downloadAttachment = async (req, res) => {
  try {
    const { ticketId, fileId } = req.params;
    const ticket = await Ticket.findById(ticketId);
    if (!ticket)
      return res.status(404).json({ message: "Ticket not found" });

    if (!hasTicketAccess(req, ticket)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const file = ticket.attachments.id(fileId);
    if (!file)
      return res.status(404).json({ message: "File not found" });
    res.download(file.filePath, file.fileName);


  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.assignTicket = async (req, res) => {
  try {
    const { employees, priority, dueDate } = req.body;

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket)
      return res.status(404).json({ message: "Ticket not found" });

    if (!Array.isArray(employees) || employees.length === 0)
      return res.status(400).json({ message: "Select at least one employee" });

    //  update priority if provided
    if (priority)
      ticket.priority = priority;

    if (dueDate) {
      const selected = new Date(dueDate);
      const now = new Date();

      // Remove time part for accurate comparison
      now.setHours(0, 0, 0, 0);

      if (selected < now) {
        return res.status(400).json({
          message: "Due date cannot be in the past"
        });
      }
    }

    ticket.assignedTo = employees.map(empId => ({
      user: empId,
      status: "ASSIGNED",
      dueDate: dueDate ? new Date(dueDate) : null,
      updatedAt: new Date()
    }));

    ticket.status = "ASSIGNED";

    await ticket.save();

    await Activity.create({
      ticket: ticket._id,
      action: "TICKET_ASSIGNED",
      performedBy: req.user._id,
      metadata: { employees, priority }
    });

    try {
      const io = socketService.getIO();
      for (let empId of employees) {
        const notif = await Notification.create({
          user: empId,
          title: "Ticket Assigned",
          message: `You have been assigned to Ticket ${ticket.ticketNumber}.`,
          ticketId: ticket._id,
          type: "TICKET_ASSIGNED"
        });
        io.to(`user_${empId}`).emit("new_notification", notif);
      }
    } catch (err) { console.error("Notification error:", err); }

    res.json({ message: "Ticket assigned successfully" });
  } catch (error) {
    console.error("Assign Ticket Error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateAssignmentStatus = async (req, res) => {

  const { status, note } = req.body;
  const userId = req.user._id;

  if (status === "ASSIGNED") {
    return res.status(400).json({ message: "Cannot change ticket status back to ASSIGNED." });
  }

  const ticket = await Ticket.findById(req.params.id);

  if (!ticket)
    return res.status(404).json({ message: "Ticket not found" });

  const assignment = ticket.assignedTo.find(
    a => a.user.toString() === userId.toString()
  );

  if (!assignment)
    return res.status(403).json({ message: "Not assigned" });

  if (assignment.status === "RESOLVED" || assignment.status === "REJECTED") {
    return res.status(400).json({ message: "Cannot change status once it is marked as resolved or rejected." });
  }

  assignment.status = status;
  assignment.note = note;
  assignment.updatedAt = new Date();

  //  Recalculate overall ticket status
  const statuses = ticket.assignedTo.map(a => a.status);

  if (statuses.every(s => s === "RESOLVED")) {
    ticket.status = "RESOLVED";
    deleteTicketAttachments(ticket);
  } else if (statuses.some(s => s === "IN_PROGRESS"))
    ticket.status = "IN_PROGRESS";
  else if (statuses.some(s => s === "REJECTED"))
    ticket.status = "OPEN"; // stays open until admin decision
  else
    ticket.status = "OPEN";

  await ticket.save();

  await Activity.create({
    ticket: ticket._id,
    action: "STATUS_UPDATED",
    performedBy: userId,
    metadata: { status, note }
  });

  try {
    const io = socketService.getIO();
    const userNotif = await Notification.create({
      user: ticket.createdBy,
      title: "Ticket Status Updated",
      message: `Ticket ${ticket.ticketNumber} status updated to ${status}.`,
      ticketId: ticket._id,
      type: "STATUS_UPDATED"
    });
    io.to(`user_${ticket.createdBy}`).emit("new_notification", userNotif);

    const adminRole = await Role.findOne({ name: "ADMIN", app: "TICKET_SYSTEM" });
    if (adminRole) {
      const adminUsers = await UserAppRole.find({ role: adminRole._id, service: ticket.service });
      for (let admin of adminUsers) {
        if (admin.userId.toString() !== userId.toString()) {
          const adminNotif = await Notification.create({
            user: admin.userId,
            title: "Ticket Status Updated",
            message: `Ticket ${ticket.ticketNumber} status updated to ${status}.`,
            ticketId: ticket._id,
            type: "STATUS_UPDATED"
          });
          io.to(`user_${admin.userId}`).emit("new_notification", adminNotif);
        }
      }
    }
  } catch(err) { console.error("Notification Error:", err); }

  res.json({ message: "Status updated" });
};

exports.adminRejectTicket = async (req, res) => {

  const ticket = await Ticket.findById(req.params.id);

  ticket.status = "REJECTED";
  deleteTicketAttachments(ticket);

  await ticket.save();

  await Activity.create({
    ticket: ticket._id,
    action: "TICKET_REJECTED",
    performedBy: req.user._id
  });

  res.json({ message: "Ticket rejected" });
};


exports.getUnassignedTickets = async (req, res) => {
  try {

    //console.log("REQ USER:", req.user);

    const adminRole = req.user?.roles?.find(r => r.role === "ADMIN");

    if (!adminRole || !adminRole.service)
      return res.status(403).json({ message: "No service scope" });

    const mongoose = require("mongoose");
    const serviceId = new mongoose.Types.ObjectId(adminRole.service);

    const tickets = await Ticket.find({
      service: serviceId,
      $or: [
        { assignedTo: { $exists: false } },
        { assignedTo: { $size: 0 } }
      ]
    })
      .populate("service", "name")
      .sort({ createdAt: -1 });

    res.json(tickets);

  } catch (error) {
    console.error("Unassigned Tickets Error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getAllDepartmentTickets = async (req, res) => {
  try {
    const adminRole = req.user?.roles?.find(r => r.role === "ADMIN");

    if (!adminRole || !adminRole.service)
      return res.status(403).json({ message: "No service scope" });

    const mongoose = require("mongoose");
    const serviceId = new mongoose.Types.ObjectId(adminRole.service);

    const tickets = await Ticket.find({
      service: serviceId
    })
      .populate("service", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Cross-DB User Population
    const userIds = [];
    tickets.forEach(ticket => {
      if (ticket.assignedTo) {
        ticket.assignedTo.forEach(a => userIds.push(a.user));
      }
    });
    const users = await User.find({ _id: { $in: userIds } }).select("name").lean();
    const userMap = {};
    users.forEach(u => userMap[u._id.toString()] = u.name);

    const formatted = tickets.map(ticket => {
      const assignedUsers = ticket.assignedTo && ticket.assignedTo.length > 0
        ? ticket.assignedTo
            .map(a => userMap[a.user?.toString()])
            .filter(Boolean)
            .join(', ')
        : "Unassigned";

      return {
        ...ticket,
        assignedDevs: assignedUsers
      };
    });

    res.json(formatted);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
 
exports.getTicketsByService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const mongoose = require("mongoose");
 
    const tickets = await Ticket.find({
      service: new mongoose.Types.ObjectId(serviceId)
    })
      .populate("service", "name")
      .sort({ createdAt: -1 })
      .lean();
 
    // Cross-DB User Population for Assigned To
    const allUserIds = [];
    tickets.forEach(t => {
      t.assignedTo?.forEach(a => {
        if (a.user) allUserIds.push(a.user);
      });
    });
 
    const uniqueUserIds = [...new Set(allUserIds.map(id => id.toString()))];
    const users = await User.find({ _id: { $in: uniqueUserIds } }).select("name").lean();
    const userMap = {};
    users.forEach(u => userMap[u._id.toString()] = u.name);
 
    const formatted = tickets.map(ticket => {
      const assignedUsers = ticket.assignedTo && ticket.assignedTo.length > 0
        ? ticket.assignedTo
            .map(a => userMap[a.user?.toString()])
            .filter(Boolean)
            .join(', ')
        : "Unassigned";
 
      return {
        ...ticket,
        assignedDevs: assignedUsers,
        dueDate: ticket.assignedTo?.[0]?.dueDate || null
      };
    });
 
    res.json(formatted);
 
  } catch (error) {
    console.error("Tickets By Service Error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getDeptAssignedTickets = async (req, res) => {
  try {
    const adminRole = req.user?.roles?.find(r => r.role === "ADMIN");

    if (!adminRole || !adminRole.service)
      return res.status(403).json({ message: "No service scope" });

    const mongoose = require("mongoose");
    const serviceId = new mongoose.Types.ObjectId(adminRole.service);

    const tickets = await Ticket.find({
      service: serviceId,
      "assignedTo.0": { $exists: true } // Checks if the array has at least 1 element
    })
      .populate("service", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Cross-DB User Population
    const userIds = [];
    tickets.forEach(ticket => {
      ticket.assignedTo.forEach(a => userIds.push(a.user));
    });
    const users = await User.find({ _id: { $in: userIds } }).select("name").lean();
    const userMap = {};
    users.forEach(u => userMap[u._id.toString()] = u.name);

    const formatted = tickets.map(ticket => {
      // Map native object IDs to fetched Auth names
      const assignedUsers = ticket.assignedTo
        .map(a => userMap[a.user?.toString()])
        .filter(Boolean)
        .join(', ');

      // Grab values from the specific active assignments
      const activeAssignment = ticket.assignedTo[0] || {};

      return {
        _id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        priority: ticket.priority,
        assignedDevs: assignedUsers,
        assignedPriority: ticket.priority,
        assignedDueDate: activeAssignment.dueDate || null,
        status: ticket.status,
        createdAt: ticket.createdAt,
        rawAssignments: ticket.assignedTo
      }
    });

    res.json(formatted);

  } catch (error) {
    console.error("Assigned Tickets Error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getAssignedTickets = async (req, res) => {
  try {

    const tickets = await Ticket.find({
      "assignedTo.user": req.user._id
    })
      .populate("service", "name")
      .sort({ createdAt: -1 });

    const formatted = tickets.map(ticket => {

      const myAssignment = ticket.assignedTo.find(
        a => a.user.toString() === req.user._id.toString()
      );

      return {
        _id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        priority: ticket.priority,

        //  FIX HERE
        dueDate: myAssignment?.dueDate || null,

        status: myAssignment?.status || "ASSIGNED",
        service: ticket.service,
        createdAt: ticket.createdAt
      };
    });

    res.json(formatted);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRejectedForApproval = async (req, res) => {
  try {
    const adminRole = req.user.roles.find(r => r.role === "ADMIN");

    if (!adminRole?.service)
      return res.status(403).json({ message: "No service scope" });

    const tickets = await Ticket.find({
      service: adminRole.service,
      "assignedTo.status": "REJECTED",
      status: { $ne: "REJECTED" }
    })
      .populate("service", "name")
      .lean();

    // Cross-DB Population logic for user names
    const userIds = [];
    tickets.forEach(ticket => {
      ticket.assignedTo.forEach(a => {
        if (a.status === "REJECTED") userIds.push(a.user);
      });
    });

    const users = await User.find({ _id: { $in: userIds } }).select("name").lean();
    const userMap = {};
    users.forEach(u => userMap[u._id.toString()] = u.name);

    const formatted = tickets.map(ticket => {
      const rejectedAssignment = ticket.assignedTo.find(
        a => a.status === "REJECTED"
      );

      const rejectedUserName = rejectedAssignment 
        ? (userMap[rejectedAssignment.user?.toString()] || "Unknown")
        : "N/A";

      return {
        _id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        service: ticket.service,
        rejectedBy: { name: rejectedUserName },
        employeeNote: rejectedAssignment?.note || "",
        dueDate: rejectedAssignment?.dueDate || null,
        createdAt: ticket.createdAt
      };
    });

    res.json(formatted);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDepartmentReports = async (req, res) => {
  try {
    const { 
      dateRange, 
      startDate, 
      endDate, 
      serviceId: requestedServiceId, 
      priority 
    } = req.query;

    const adminRole = req.user?.roles?.find(r => r.role === "ADMIN");
    const superAdminRole = req.user?.roles?.find(r => r.role === "SUPER_ADMIN");

    if (!adminRole && !superAdminRole)
      return res.status(403).json({ message: "No administrative scope" });

    const mongoose = require("mongoose");
    let query = {};

    // 1. Role-based Service Filtering
    if (superAdminRole) {
      if (requestedServiceId && requestedServiceId !== 'all') {
        query.service = new mongoose.Types.ObjectId(requestedServiceId);
      }
    } else {
      // Dept Admin is restricted to their assigned service
      if (!adminRole.service) return res.status(403).json({ message: "No service scope" });
      query.service = new mongoose.Types.ObjectId(adminRole.service);
    }

    // 2. Date Range Filtering
    if (dateRange && dateRange !== 'all') {
      let start = new Date();
      let end = new Date();

      if (dateRange === 'last10days') start.setDate(start.getDate() - 10);
      else if (dateRange === 'last30days') start.setDate(start.getDate() - 30);
      else if (dateRange === 'last3months') start.setMonth(start.getMonth() - 3);
      else if (dateRange === 'last6months') start.setMonth(start.getMonth() - 6);
      else if (dateRange === 'lastyear') start.setFullYear(start.getFullYear() - 1);
      else if (dateRange === 'custom' && startDate) {
        start = new Date(startDate);
        if (endDate) end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      }

      if (dateRange !== 'custom' || startDate) {
        query.createdAt = { $gte: start, $lte: end };
      }
    }

    // 3. Priority Filtering
    if (priority && priority !== 'all') {
      query.priority = priority.toUpperCase();
    }

    // Exclude rejected tickets from reports
    query.status = { $ne: "REJECTED" };

    const tickets = await Ticket.find(query)
      .populate("service", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Cross-DB User Population for Assigned To
    const allUserIds = [];
    tickets.forEach(t => {
      t.assignedTo?.forEach(a => {
        if (a.user) allUserIds.push(a.user);
      });
    });

    const uniqueUserIds = [...new Set(allUserIds.map(id => id.toString()))];
    const users = await User.find({ _id: { $in: uniqueUserIds } }).select("name").lean();
    const userMap = {};
    users.forEach(u => userMap[u._id.toString()] = u.name);

    const totalTickets = tickets.length;
    let resolved = 0;
    let inProgress = 0;
    let pending = 0;
    let assigned = 0;
    let overdueTickets = 0;

    // Last 30 days map
    const trendMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      trendMap[dateStr] = { date: dateStr, created: 0, closed: 0 };
    }

    // console.log(`--- Reporting Diagnostic: Total Tickets Found: ${tickets.length} ---`);
    tickets.forEach(ticket => {
      // console.log(`Ticket: ${ticket.ticketNumber}, Status: ${ticket.status}`);
      // 1. Resolve Count: Only count "RESOLVED" (exclude "CLOSED" to match user perception)
      if (ticket.status === "RESOLVED") {
        resolved++;
      } 
      else if (ticket.status === "IN_PROGRESS") inProgress++;
      else if (ticket.status === "ASSIGNED") assigned++;
      else if (ticket.status === "OPEN" || ticket.status === "UNASSIGNED") pending++;

      // 2. Overdue: Check against assignment due dates (matching table logic)
      if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
        const dueDate = ticket.assignedTo?.[0]?.dueDate;
        if (dueDate && new Date(dueDate) < new Date()) {
          overdueTickets++;
        }
      }

      // 3. Trends mapping
      const createdDateStr = `${new Date(ticket.createdAt).getDate().toString().padStart(2, '0')}-${(new Date(ticket.createdAt).getMonth() + 1).toString().padStart(2, '0')}`;
      if (trendMap[createdDateStr]) {
        trendMap[createdDateStr].created += 1;
      }

      if (ticket.status === "RESOLVED") {
        const closedDateStr = `${new Date(ticket.updatedAt).getDate().toString().padStart(2, '0')}-${(new Date(ticket.updatedAt).getMonth() + 1).toString().padStart(2, '0')}`;
        if (trendMap[closedDateStr]) {
          trendMap[closedDateStr].closed += 1;
        }
      }
    });

    const resolutionRate = totalTickets > 0 ? ((resolved / totalTickets) * 100).toFixed(1) : 0;
    const avgHandlingTime = resolved > 0 ? 1.5 : 0; // Mock average 1.5 Days for advanced UI visual demo

    const trendData = Object.values(trendMap);

    const statusData = [
      { name: "Unassigned", value: pending, color: "#f97316" },
      { name: "Assigned", value: assigned, color: "#3b82f6" },
      { name: "In Progress", value: inProgress, color: "#eab308" },
      { name: "Resolved", value: resolved, color: "#22c55e" }
    ];

    const recentTickets = tickets.slice(0, 30).map(t => {
      const assignedUser = t.assignedTo?.find(a => a.status !== "REJECTED")?.user;
      const userName = assignedUser ? (userMap[assignedUser.toString()] || "--") : "--";

      return {
        _id: t._id,
        ticketNumber: t.ticketNumber,
        title: t.title,
        assignedTo: userName,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        updatedAt: t.status === "RESOLVED" || t.status === "CLOSED" ? t.updatedAt : null,
        dueDate: t.assignedTo?.[0]?.dueDate || null
      }
    });

    res.json({
      departmentName: tickets.length > 0 ? tickets[0].service?.name : "Department",
      summary: {
        resolutionRate: `${resolutionRate}%`,
        avgHandlingTime: `${avgHandlingTime} Days`,
        overdueTickets
      },
      trendData,
      statusData,
      recentTickets
    });

  } catch (error) {
    console.error("Department Reports Error:", error);
    res.status(500).json({ message: error.message });
  }
};