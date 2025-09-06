// public/js/tenant/notifications.js
// Notification handling module

const TenantNotifications = {
    pollInterval: null,
    unreadCount: 0,
    
    init() {
        this.setupNotificationBell();
        this.loadNotifications();
        this.startPolling();
    },
    
    setupNotificationBell() {
        const bell = document.querySelector('.notification-bell');
        if (bell) {
            bell.addEventListener('click', () => {
                this.toggleNotificationPanel();
            });
        }
        
        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('notificationsPanel');
            const bell = document.querySelector('.notification-bell');
            
            if (panel && !panel.contains(e.target) && !bell.contains(e.target)) {
                panel.style.display = 'none';
            }
        });
    },
    
    toggleNotificationPanel() {
        const panel = document.getElementById('notificationsPanel');
        if (!panel) return;
        
        const isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? 'block' : 'none';
        
        if (isHidden) {
            this.loadNotifications();
        }
    },
    
    async loadNotifications() {
        try {
            const response = await CasaConnect.APIClient.get('/api/tenant/notifications?unreadOnly=false');
            if (response.success) {
                this.updateNotificationDisplay(response.data);
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    },
    
    updateNotificationDisplay(notifications) {
        const panel = document.getElementById('notificationsPanel');
        if (!panel) return;
        
        const listContainer = panel.querySelector('.notifications-list');
        const badge = document.querySelector('.notification-badge');
        
        // Update unread count
        this.unreadCount = notifications.filter(n => !n.isRead).length;
        
        if (badge) {
            badge.textContent = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
        
        // Update list
        if (notifications.length === 0) {
            listContainer.innerHTML = '<p class="no-notifications">No new notifications</p>';
            return;
        }
        
        listContainer.innerHTML = notifications.map(notification => `
            <div class="notification-item priority-${notification.priority} ${notification.isRead ? 'read' : ''}" 
                 data-id="${notification.id}"
                 onclick="TenantNotifications.markAsRead('${notification.id}')">
                <div class="notification-icon">
                    <i class="fas fa-${this.getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <h5>${notification.title}</h5>
                    <p>${notification.message}</p>
                    <span class="notification-time">${notification.timeAgo}</span>
                </div>
            </div>
        `).join('');
    },
    
    getNotificationIcon(type) {
        const icons = {
            'payment_received': 'check-circle',
            'payment_due': 'exclamation-circle',
            'payment_failed': 'times-circle',
            'service_request_new': 'tools',
            'service_request_assigned': 'user-check',
            'service_request_updated': 'sync',
            'service_request_completed': 'check',
            'maintenance_scheduled': 'calendar',
            'announcement': 'bullhorn',
            'system': 'info-circle'
        };
        return icons[type] || 'bell';
    },
    
    async markAsRead(notificationId) {
        try {
            const response = await CasaConnect.APIClient.post(
                `/api/tenant/notification/${notificationId}/read`
            );
            
            if (response.success) {
                // Update UI
                const item = document.querySelector(`[data-id="${notificationId}"]`);
                if (item) {
                    item.classList.add('read');
                }
                
                // Update count
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateBadge();
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    },
    
    async markAllAsRead() {
        try {
            const response = await CasaConnect.APIClient.post('/api/tenant/notifications/mark-all-read');
            
            if (response.success) {
                // Update all items
                document.querySelectorAll('.notification-item').forEach(item => {
                    item.classList.add('read');
                });
                
                // Reset count
                this.unreadCount = 0;
                this.updateBadge();
                
                CasaConnect.NotificationManager.success('All notifications marked as read');
            }
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    },
    
    updateBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            badge.textContent = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
    },
    
    startPolling() {
        // Poll for new notifications every 2 minutes
        this.pollInterval = setInterval(() => {
            this.checkForNewNotifications();
        }, 120000);
    },
    
    async checkForNewNotifications() {
        try {
            const response = await CasaConnect.APIClient.get('/api/tenant/notifications?unreadOnly=true');
            if (response.success && response.data.length > this.unreadCount) {
                // New notifications received
                this.loadNotifications();
                
                // Show browser notification if permitted
                if (Notification.permission === 'granted') {
                    const latestNotification = response.data[0];
                    new Notification('CasaConnect', {
                        body: latestNotification.message,
                        icon: '/favicon.ico'
                    });
                }
            }
        } catch (error) {
            console.error('Failed to check for notifications:', error);
        }
    },
    
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },
    
    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }
};

// Global exports
window.TenantNotifications = TenantNotifications;
window.toggleNotifications = () => TenantNotifications.toggleNotificationPanel();
window.markAllAsRead = () => TenantNotifications.markAllAsRead();