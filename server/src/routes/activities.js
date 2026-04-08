const express = require("express");
const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const { auth, requireRole, isAdmin } = require("../middleware/auth");

const router = express.Router();

// Get all activities with filters
router.get("/", auth, async (req, res) => {
  try {
    const { 
      action, 
      user, 
      targetType,
      severity, 
      startDate, 
      endDate, 
      search,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const query = {};
    
    // Text search filter (searches userName, action, description, and vendor details)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { userName: searchRegex },
        { action: searchRegex },
        { description: searchRegex },
        { targetType: searchRegex },
        { 'details.companyName': searchRegex },
        { 'details.businessEmail': searchRegex }
      ];
    }
    
    // Action filter
    if (action) query.action = action;

    // Target type filter
    if (targetType) query.targetType = targetType;
    
    // User filter
    if (user) {
      if (mongoose.Types.ObjectId.isValid(user)) {
        query.user = user;
      } else {
        const userRegex = new RegExp(user.trim(), 'i');
        query.userName = userRegex;
      }
    }
    
    // Severity filter
    if (severity) query.severity = severity;
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    const activities = await Activity.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Debug: Log user-related activities
    console.log('Activities query:', query);
    console.log('User activities found:', activities.filter(a => a.action.includes('user')).length);
    activities.forEach(activity => {
      if (activity.action.includes('user')) {
        console.log('User activity:', {
          action: activity.action,
          description: activity.description,
          userName: activity.userName,
          createdAt: activity.createdAt
        });
      }
    });
    
    // Add formatted description to each activity
    const activitiesWithFormatted = activities.map(activity => {
      const activityObj = activity.toObject();
      try {
        activityObj.formattedDescription = activity.getFormattedDescription();
      } catch (err) {
        console.error('Error formatting description:', err);
        activityObj.formattedDescription = activity.description;
      }
      return activityObj;
    });
    
    const total = await Activity.countDocuments(query);
    
    return res.json({
      activities: activitiesWithFormatted,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load activities" });
  }
});

// Get recent activities for dashboard
router.get("/recent", auth, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const activities = await Activity.getRecentActivities(parseInt(limit));
    
    // Add formatted description to each activity
    const activitiesWithFormatted = activities.map(activity => {
      const activityObj = activity.toObject();
      try {
        activityObj.formattedDescription = activity.getFormattedDescription();
      } catch (err) {
        console.error('Error formatting description:', err);
        activityObj.formattedDescription = activity.description;
      }
      return activityObj;
    });
    
    return res.json(activitiesWithFormatted);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load recent activities" });
  }
});

// Get activity statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    
    const [actionStats, recentActivities] = await Promise.all([
      Activity.getActivityStats(start, end),
      Activity.getRecentActivities(10)
    ]);
    
    return res.json({
      actionStats,
      recentActivities
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load activity statistics" });
  }
});

// Get activities by action type
router.get("/by-action/:action", auth, async (req, res) => {
  try {
    const { action } = req.params;
    const { limit = 50 } = req.query;
    
    const activities = await Activity.getActivitiesByAction(action, parseInt(limit));
    
    return res.json(activities);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load activities by action" });
  }
});

// Bulk delete activities (admin, super_admin only)
router.delete("/bulk", auth, isAdmin, async (req, res) => {
  try {
    const { ids, olderThan } = req.body || {};
    
    let deletedCount = 0;
    
    if (Array.isArray(ids) && ids.length > 0) {
      const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ message: "One or more activity IDs are invalid" });
      }

      // Delete specific activities by IDs
      const result = await Activity.deleteMany({ _id: { $in: ids } });
      deletedCount = result.deletedCount;
    } else if (olderThan) {
      const parsedDate = new Date(olderThan);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid 'olderThan' date" });
      }

      // Delete activities older than specified date
      const result = await Activity.deleteMany({ 
        createdAt: { $lt: parsedDate }
      });
      deletedCount = result.deletedCount;
    } else {
      return res.status(400).json({ message: "Either 'ids' or 'olderThan' must be provided" });
    }
    
    // Do not fail deletion if activity logging fails
    try {
      await Activity.logActivity({
        action: 'activity_deleted',
        description: `Bulk deleted ${deletedCount} activity logs`,
        details: {
          deletedCount,
          criteria: ids ? 'specific_ids' : 'older_than',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        },
        user: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        severity: 'high'
      });
    } catch (logErr) {
      console.error('Failed to write activity log for bulk delete:', logErr);
    }
    
    return res.json({ 
      message: "Activities deleted successfully",
      deletedCount 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete activities" });
  }
});

// Delete activity (admin, super_admin only)
router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const activity = await Activity.findByIdAndDelete(id);
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }
    
    // Log the deletion of activity
    await Activity.logActivity({
      action: 'activity_deleted',
      description: `Deleted activity log: ${activity.action}`,
      details: {
        deletedActivity: activity.toObject(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      severity: 'medium'
    });
    
    return res.json({ message: "Activity deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete activity" });
  }
});

// Helper function to log activities (can be used by other routes)
const logActivity = async (action, description, user, details = {}) => {
  try {
    await Activity.logActivity({
      action,
      description,
      details,
      user: user.id,
      userName: user.name,
      userRole: user.role,
      ipAddress: details.ipAddress || '',
      userAgent: details.userAgent || '',
      targetId: details.targetId,
      targetType: details.targetType,
      severity: details.severity || 'low'
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};

module.exports = router;
module.exports.logActivity = logActivity;
