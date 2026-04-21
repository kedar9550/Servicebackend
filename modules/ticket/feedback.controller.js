const Feedback = require("./feedback.model");
const Ticket = require("./ticket.model");
const User = require("../auth/auth.model");
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

exports.getAllFeedback = async (req, res) => {
  try {
    // Check if the user is a Super Admin
    const roles = req.user?.roles || [];
    const isSuperAdmin = roles.some(r => r.role === "SUPER_ADMIN");
    
    let query = {};
    
    if (!isSuperAdmin) {
      // Collect all service IDs from Admin roles
      const adminServices = roles
        .filter(r => r.role === "ADMIN" && r.service)
        .map(r => r.service.toString());

      if (adminServices.length > 0) {
        // Find tickets belonging to any of these services
        const tickets = await Ticket.find({ service: { $in: adminServices } }).select("_id");
        const ticketIds = tickets.map(t => t._id);
        query = { ticket: { $in: ticketIds } };
      } else {
        // If no appropiate role found, return empty (or restrict access)
        return res.status(200).json({ success: true, data: [] });
      }
    }

    const feedbacks = await Feedback.find(query)
      .populate({
        path: "ticket",
        select: "ticketNumber title service assignedTo status updatedAt",
        populate: {
          path: "service",
          select: "name"
        }
      })
      .sort({ createdAt: -1 })
      .lean();

    // Manual User and Technician Population (Cross-DB)
    const userIds = new Set();
    feedbacks.forEach(f => {
      if (f.user) userIds.add(f.user.toString());
      if (f.ticket?.assignedTo) {
        f.ticket.assignedTo.forEach(a => {
          if (a.user) userIds.add(a.user.toString());
        });
      }
    });

    const uniqueUserIds = [...userIds];
    const users = await User.find({ _id: { $in: uniqueUserIds } })
      .select("name profileImage department institutionId")
      .lean();
    
    const userMap = {};
    users.forEach(u => userMap[u._id.toString()] = u);

    const populatedFeedbacks = feedbacks.map(f => {
      // Populate feedback user
      const fbUser = userMap[f.user.toString()] || { name: "Unknown User" };
      
      // Populate technicians in assignedTo
      if (f.ticket?.assignedTo) {
        f.ticket.assignedTo = f.ticket.assignedTo.map(a => ({
          ...a,
          user: userMap[a.user.toString()] || { name: "Unknown" }
        }));
      }

      return {
        ...f,
        user: fbUser
      };
    });

    // --- Feedback Summary Generation ---
    const totalFeedback = populatedFeedbacks.length;
    let sumRating = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let feedbackCommentsCount = 0;

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const satisfactionDistribution = {
      "Very Satisfied": 0,
      "Satisfied": 0,
      "Neutral": 0,
      "Dissatisfied": 0,
      "Very Dissatisfied": 0
    };

    // Trend mapping (Last 30 Days)
    const feedbackTrendMap = {};
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        feedbackTrendMap[dateStr] = { date: dateStr, count: 0 };
    }

    populatedFeedbacks.forEach(f => {
      sumRating += f.rating;
      if (f.rating >= 4) positiveCount++;
      if (f.rating <= 2) negativeCount++;
      if (f.comments && f.comments.trim().length > 0) feedbackCommentsCount++;

      if (ratingDistribution[f.rating] !== undefined) ratingDistribution[f.rating]++;
      if (satisfactionDistribution[f.satisfaction] !== undefined) satisfactionDistribution[f.satisfaction]++;

      const feedbackDateStr = `${new Date(f.createdAt).getDate().toString().padStart(2, '0')}-${(new Date(f.createdAt).getMonth() + 1).toString().padStart(2, '0')}`;
      if (feedbackTrendMap[feedbackDateStr]) {
          feedbackTrendMap[feedbackDateStr].count += 1;
      }
    });

    const averageRating = totalFeedback > 0 ? (sumRating / totalFeedback).toFixed(1) : 0;
    const positivePercent = totalFeedback > 0 ? ((positiveCount / totalFeedback) * 100).toFixed(1) : 0;
    const negativePercent = totalFeedback > 0 ? ((negativeCount / totalFeedback) * 100).toFixed(1) : 0;

    const feedbackSummary = {
      averageRating,
      totalFeedback,
      positiveFeedback: { count: positiveCount, percentage: positivePercent },
      negativeFeedback: { count: negativeCount, percentage: negativePercent },
      commentsCount: feedbackCommentsCount,
      ratingDistribution,
      satisfactionDistribution
    };

    res.status(200).json({
      success: true,
      summary: feedbackSummary,
      trendData: Object.values(feedbackTrendMap),
      data: populatedFeedbacks
    });

  } catch (error) {
    console.error("Get All Feedback Error:", error);
    res.status(500).json({ message: error.message });
  }
};
