const express = require("express");
const router = express.Router();

const ticketController = require("./ticket.controller");
const protect = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/permission.middleware");
const upload = require("../../middlewares/upload.middleware");
const generateTicketNumber = require('../../middlewares/ticketNumber.middleware')

const maxFiles = parseInt(process.env.MAX_TICKET_FILES) || 5;

router.post(
  "/",
  protect,
  authorize("CREATE_TICKET"),
  generateTicketNumber,
  upload.array("attachments", maxFiles),
  ticketController.createTicket
);

router.get(
  "/my",
  protect,
  ticketController.getMyTickets
);

// ✅ STATIC ROUTES FIRST
router.get(
  "/unassigned",
  protect,
  authorize("ASSIGN_TICKET"),
  ticketController.getUnassignedTickets
);

router.get(
  "/dept-assigned",
  protect,
  authorize("ASSIGN_TICKET"),
  ticketController.getDeptAssignedTickets
);

router.get(
  "/dept-all",
  protect,
  authorize("ASSIGN_TICKET"),
  ticketController.getAllDepartmentTickets
);

router.get(
  "/assigned",
  protect,
  ticketController.getAssignedTickets
);

router.get(
  "/reports",
  protect,
  authorize("ASSIGN_TICKET"),
  ticketController.getDepartmentReports
);

router.get(
  "/rejected-requests",
  protect,
  authorize("ASSIGN_TICKET"),
  ticketController.getRejectedForApproval
);

// ✅ SERVICE SPECIFIC TICKETS
router.get(
  "/service/:serviceId",
  protect,
  ticketController.getTicketsByService
);

// ✅ THEN DYNAMIC ROUTES
router.get(
  "/:id",
  protect,
  ticketController.getTicketById
);

router.post(
  "/:id/comments",
  protect,
  ticketController.addComment
);

router.put(
  "/:id/assign",
  protect,
  authorize("ASSIGN_TICKET"),
  ticketController.assignTicket
);

router.put(
  "/:id/update-status",
  protect,
  ticketController.updateAssignmentStatus
);

router.put(
  "/:id/admin-reject",
  protect,
  authorize("ASSIGN_TICKET"),
  ticketController.adminRejectTicket
);

router.get(
  "/:ticketId/attachments/:fileId",
  protect,
  ticketController.downloadAttachment
);

module.exports = router;