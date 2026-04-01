const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
require("dotenv").config();
const app = express();
const cors = require('cors')
const teamRoutes = require("./modules/ticket/team.routes");

//MIDDLEWARES


const frontendUri = process.env.FRONTEND_URI;
const allowedOrigins = [frontendUri];
if (frontendUri && frontendUri.endsWith("/")) {
  allowedOrigins.push(frontendUri.slice(0, -1));
} else if (frontendUri) {
  allowedOrigins.push(frontendUri + "/");
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));


app.use(logger("dev"));

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});



app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


//ROUTES


// AUTH ROUTES
const authRoutes =
  require("./modules/auth/auth.routes");

// ROLE / PERMISSION ROUTES (optional later)
// const roleRoutes = require("./modules/role/role.routes");

// SERVICE CATEGORY ROUTES
const serviceRoutes =
  require("./modules/serviceCategory/service.routes");

// TICKET ROUTES (later)
const ticketRoutes = require("./modules/ticket/tickt.route");

const notificationRoutes = require("./modules/notification/notification.routes");

// API PREFIX
app.use("/api/auth", authRoutes);
app.use("/api/service", serviceRoutes);
app.use('/api/complaints', ticketRoutes)
app.use("/api/team", teamRoutes);
app.use("/api/notifications", notificationRoutes);



/* ===============================
   HEALTH CHECK (optional)
=================================*/
app.get("/", (req, res) => {
  res.json({
    message: "API running "
  });
});



//404 HANDLER
app.use((req, res, next) => {
  next(createError(404, "Route not found"));
});



// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {

  console.error("Error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server Error"
  });

});

module.exports = app;
