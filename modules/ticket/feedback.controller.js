const Feedback = require("./feedback.model");
const Ticket = require("./ticket.model");
const Notification = require("../notification/notification.model");

exports.submitFeedback = async (req, res) => {
  try {
    const { ticketId, rating, satisfaction, comments } = req.body;

    if (!ticketId || !rating || !satisfaction) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    // Ensure user owns the ticket
    if (ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Create feedback
    const feedback = await Feedback.create({
      user: req.user._id,
      ticket: ticketId,
      rating,
      satisfaction,
      comments
    });

    // Mark the ticket as CLOSED after feedback
    ticket.status = "CLOSED";
    await ticket.save();

    // Mark associated FEEDBACK_REQUEST notifications as read
    await Notification.updateMany(
      { 
        user: req.user._id, 
        ticketId: ticketId, 
        type: "FEEDBACK_REQUEST" 
      },
      { isRead: true, readAt: new Date() }
    );

    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: feedback
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Feedback already submitted for this ticket" });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.getPendingFeedback = async (req, res) => {
  try {
    // Find tickets that are RESOLVED and created by this user
    const resolvedTickets = await Ticket.find({
      createdBy: req.user._id,
      status: "RESOLVED"
    }).populate("service", "name").lean();

    // Find tickets that already have feedback
    const feedbacks = await Feedback.find({ user: req.user._id }).select("ticket").lean();
    const feedbackTicketIds = feedbacks.map(f => f.ticket.toString());

    // Filter resolved tickets that don't have feedback yet
    const pending = resolvedTickets.filter(t => !feedbackTicketIds.includes(t._id.toString()));

    res.status(200).json({
      success: true,
      data: pending
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
