const Notification = require('../../../models/Notification');
const { logger } = require('../../logger');

// Get Notifications (AJAX)
exports.getNotifications = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const { unreadOnly = false } = req.query;
    
    const query = { recipient: tenantId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    const notifications = await Notification.find(query)
      .sort('-createdAt')
      .limit(20)
      .lean();
    
    res.json({
      success: true,
      data: notifications.map(n => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        priority: n.priority,
        isRead: n.isRead,
        createdAt: n.createdAt,
        timeAgo: getTimeAgo(n.createdAt)
      }))
    });
    
  } catch (error) {
    logger.error(`Notifications error: ${error}`);
    res.json({ 
      success: false, 
      error: 'Failed to get notifications' 
    });
  }
};

// Mark Notification as Read
exports.markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const tenantId = req.session?.userId;
    
    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: tenantId
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    await notification.markAsRead();
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error(`Mark notification error: ${error}`);
    res.json({ 
      success: false, 
      error: 'Failed to mark notification' 
    });
  }
};

// Mark All as Read
exports.markAllRead = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    
    await Notification.updateMany(
      { recipient: tenantId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error(`Mark all notifications error: ${error}`);
    res.json({ 
      success: false, 
      error: 'Failed to mark all notifications as read' 
    });
  }
};

// Helper function
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return interval + ' years ago';
  if (interval === 1) return '1 year ago';
  
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return interval + ' months ago';
  if (interval === 1) return '1 month ago';
  
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return interval + ' days ago';
  if (interval === 1) return '1 day ago';
  
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return interval + ' hours ago';
  if (interval === 1) return '1 hour ago';
  
  interval = Math.floor(seconds / 60);
  if (interval > 1) return interval + ' minutes ago';
  if (interval === 1) return '1 minute ago';
  
  return 'Just now';
}

module.exports = exports;