const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const usermodel = require("../modules/auth/auth.model");

let io;

module.exports = {
  init: (httpServer) => {
    io = socketIo(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URI,
        credentials: true
      }
    });

    io.use(async (socket, next) => {
      try {
        const cookiesStr = socket.request.headers.cookie;
        if (!cookiesStr) return next(new Error("Authentication error: No cookies"));
        
        let token = null;
        const cookies = cookiesStr.split(';');
        for (let c of cookies) {
            const [key, val] = c.trim().split('=');
            if (key === 'token') {
                token = val;
                break;
            }
        }

        if (!token) return next(new Error("Authentication error: No token"));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userdata = await usermodel.findById(decoded.userId);
        if (!userdata) return next(new Error("Authentication error: User not found"));

        socket.user = {
          _id: decoded.userId,
          roles: decoded.roles,
          name: userdata.name
        };
        next();
      } catch (err) {
        next(new Error("Authentication error: Invalid token"));
      }
    });

    io.on("connection", (socket) => {
      // console.log(`Socket connected: ${socket.id} (User: ${socket.user._id})`);
      
      // Join user specific room
      socket.join(`user_${socket.user._id}`);

      // Handle joining ticket room
      socket.on("join_ticket", (ticketId) => {
        socket.join(`ticket_${ticketId}`);
        // console.log(`User ${socket.user._id} joined ticket_${ticketId}`);
      });

      // Handle leaving ticket room (optional)
      socket.on("leave_ticket", (ticketId) => {
        socket.leave(`ticket_${ticketId}`);
        // console.log(`User ${socket.user._id} left ticket_${ticketId}`);
      });

      socket.on("disconnect", () => {
        // console.log(`Socket disconnected: ${socket.id}`);
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  }
};
