const Service = require("./service.model");
const User = require("../auth/auth.model");
const Role = require("../role/role.model");
const UserAppRole = require("../auth/userAppRole.model");
const Ticket = require("../ticket/ticket.model");


// CREATE SERVICE



exports.createService = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name)
      return res.status(400).json({ message: "Service name required" });

    const existing = await Service.findOne({ name });

    if (existing)
      return res.status(400).json({ message: "Service already exists" });

    const service = await Service.create({
      name,
      createdBy: req.user._id
    });

    res.status(201).json({
      message: "Service created successfully",
      service
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }


};


exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const service = await Service.findByIdAndUpdate(
      id,
      { name },
      { new: true }
    );

    if (!service)
      return res.status(404).json({ message: "Service not found" });

    res.json({
      message: "Service updated successfully",
      service
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET SERVICE BY ID
exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);

    if (!service)
      return res.status(404).json({ message: "Service not found" });

    res.json(service);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL SERVICES
exports.getServices = async (req, res) => {
  const services = await Service.find();
  res.json(services);
};

// DELETE SERVICE
exports.deleteService = async (req, res) => {
  const { id } = req.params;

  await Service.findByIdAndDelete(id);
  res.json({ message: "Service deleted" });
};

exports.assignAdminToService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { user_id } = req.body;
    // console.log("BODY:", req.body);
    // console.log("PARAMS:", req.params);


    if (!user_id)
      return res.status(400).json({ message: "User ID required" });

    const service = await Service.findById(serviceId);
    if (!service)
      return res.status(404).json({ message: "Service not found" });

    const user = await User.findById(user_id);

    if (!user)
      return res.status(404).json({
        message: "User not found. Please create user first."
      });

    const adminRole = await Role.findOne({
      name: "ADMIN",
      app: "TICKET_SYSTEM"
    });

    const alreadyAssigned = await UserAppRole.findOne({
      userId: user._id,
      app: "TICKET_SYSTEM",
      service: serviceId
    });

    if (alreadyAssigned)
      return res.status(400).json({
        message: "Already assigned as admin"
      });

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

    const adminRole = await Role.findOne({
      name: "ADMIN",
      app: "TICKET_SYSTEM"
    });

    const admins = await UserAppRole.find({
      service: serviceId,
      role: adminRole._id
    })
      .populate("userId", "name institutionId email");

    res.json(admins);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.removeAdmin = async (req, res) => {
  try {
    const { serviceId, userId } = req.params;

    await UserAppRole.findOneAndDelete({
      service: serviceId,
      userId
    });

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

    // 1️ Aggregate Tickets (ticketDB)
    const ticketStats = await Ticket.aggregate([
      {
        $match: { service: { $in: serviceIds } }
      },
      {
        $group: {
          _id: "$service",
          totalTickets: { $sum: 1 }
        }
      }
    ]);

    // 2️ Get Role IDs
    const adminRole = await Role.findOne({
      name: "ADMIN",
      app: "TICKET_SYSTEM"
    });

    const employeeRole = await Role.findOne({
      name: "EMPLOYEE",
      app: "TICKET_SYSTEM"
    });

    // 3️Aggregate Employees per Service
    const employeeStats = await UserAppRole.aggregate([
      {
        $match: {
          service: { $in: serviceIds },
          role: employeeRole._id
        }
      },
      {
        $group: {
          _id: "$service",
          totalEmployees: { $sum: 1 }
        }
      }
    ]);

    // 4️Aggregate Admins per Service
    const adminStats = await UserAppRole.aggregate([
      {
        $match: {
          service: { $in: serviceIds },
          role: adminRole._id
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: "$user"
      },
      {
        $group: {
          _id: "$service",
          admins: {
            $push: {
              name: "$user.name",
              institutionId: "$user.institutionId",
              email: "$user.email"
            }
          }
        }
      }
    ]);

    // 5️ Convert to Map for Fast Merge
    const ticketMap = Object.fromEntries(
      ticketStats.map(t => [t._id.toString(), t.totalTickets])
    );

    const employeeMap = Object.fromEntries(
      employeeStats.map(e => [e._id.toString(), e.totalEmployees])
    );

    const adminMap = Object.fromEntries(
      adminStats.map(a => [a._id.toString(), a.admins])
    );

    // 6️ Final Merge
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