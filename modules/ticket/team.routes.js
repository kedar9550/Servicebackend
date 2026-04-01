const express = require("express");
const router = express.Router();
const protect = require("../../middlewares/auth.middleware");

const TeamController = require("./team.controller");


router.get("/dashboard", protect, TeamController.getTeamDashboard);
router.post("/add-member", protect, TeamController.addTeamMember);
router.delete("/remove-member/:userId", protect, TeamController.removeTeamMember);

module.exports = router;