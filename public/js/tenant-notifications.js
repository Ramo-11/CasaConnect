// Tenant Notifications Management

const TenantNotifications = {
    panel: null,
    badge: null,
    
    init() {
        this.panel = document.getElementById('notificationsPanel');
        this.badge = document.querySelector('.notification-badge');
        this.bindEvents();
        this.startPolling();
    },
    
    bindEvents() {
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notifications-dropdown')) {
                this.closePanel();
            }
        });
        
        // Mark as read when clicking notification
        document.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                this.markAsRead(item.dataset.id);
            });
        });
    },
    
    togglePanel() {
        if (this.panel.style.display === 'none') {
            this.panel.style.display = 'block';
            this.loadNotifications();
        } else {
            this.closePanel();
        }
    },
    
    closePanel() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
    },
    
    async loadNotifications() {
        try {
            const response = await CasaConnect.APIClient.get('/api/tenant/notifications?unreadOnly=true');
            if (response.success) {
                this.updateNotificationsList(response.data);
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    },
    
    updateNotificationsList(notifications) {
        const listContainer = document.querySelector('.notifications-list');
        if (!listContainer) return;
        
        if (notifications.length === 0) {
            listContainer.innerHTML = '<p class="no-notifications">No new notifications</p>';
            this.updateBadge(0);
            return;
        }
        
        const html = notifications.map(n => `
            <div class="notification-item priority-${n.priority}" data-id="${n.id}">
                <div class="notification-icon">
                    <i class="fas fa-${this.getIcon(n.type)}"></i>
                </div>
                <div class="notification-content">
                    <h5>${n.title}</h5>
                    <p>${n.message}</p>
                    <span class="notification-time">${n.timeAgo}</span>
                </div>
            </div>
        `).join('');
        
        listContainer.innerHTML = html;
        this.updateBadge(notifications.length);
        this.bindEvents(); // Rebind events for new elements
    },
    
    async markAsRead(notificationId) {
        try {
            const response = await CasaConnect.APIClient.post(`/api/tenant/notification/${notificationId}/read`);
            if (response.success) {
                const item = document.querySelector(`[data-id="${notificationId}"]`);
                if (item) {
                    item.classList.add('read');
                }
                this.updateBadgeCount(-1);
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    },
    
    async markAllAsRead() {
        try {
            const response = await CasaConnect.APIClient.post('/api/tenant/notifications/mark-all-read');
            if (response.success) {
                document.querySelectorAll('.notification-item').forEach(item => {
                    item.classList.add('read');
                });
                this.updateBadge(0);
                CasaConnect.NotificationManager.success('All notifications marked as read');
            }
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    },
    
    updateBadge(count) {
        if (this.badge) {
            if (count > 0) {
                this.badge.textContent = count;
                this.badge.style.display = 'block';
            } else {
                this.badge.style.display = 'none';
            }
        }
    },
    
    updateBadgeCount(delta) {
        if (this.badge) {
            const current = parseInt(this.badge.textContent) || 0;
            const newCount = Math.max(0, current + delta);
            this.updateBadge(newCount);
        }
    },
    
    getIcon(type) {
        const icons = {
            'payment_received': 'check-circle',
            'payment_due': 'exclamation-circle',
            'payment_failed': 'times-circle',
            'service_request_updated': 'tools',
            'service_request_completed': 'check',
            'maintenance_scheduled': 'calendar',
            'announcement': 'bullhorn',
            'system': 'info-circle'
        };
        return icons[type] || 'bell';
    },
    
    startPolling() {
        // Poll for new notifications every 30 seconds
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.checkForNewNotifications();
            }
        }, 30000);
    },
    
    async checkForNewNotifications() {
        try {
            const response = await CasaConnect.APIClient.get('/api/tenant/notifications?unreadOnly=true');
            if (response.success) {
                const count = response.data.length;
                this.updateBadge(count);
                
                // Show browser notification for high priority
                response.data.forEach(n => {
                    if (n.priority === 'high' && !this.notifiedIds.has(n.id)) {
                        this.showBrowserNotification(n);
                        this.notifiedIds.add(n.id);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to check notifications:', error);
        }
    },
    
    notifiedIds: new Set(),
    
    showBrowserNotification(notification) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico'
            });
        }
    }
};

// Initialize on page load
CasaConnect.ready(() => {
    TenantNotifications.init();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// Global functions for onclick handlers
window.toggleNotifications = () => TenantNotifications.togglePanel();
window.markAllAsRead = () => TenantNotifications.markAllAsRead();