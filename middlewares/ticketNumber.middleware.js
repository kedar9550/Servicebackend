const { v4: uuidv4 } = require("uuid");

module.exports = (req, res, next) => {
  const shortId = uuidv4().split("-")[0];
  req.ticketNumber = "TKT-" + shortId.toUpperCase();
  next();
};