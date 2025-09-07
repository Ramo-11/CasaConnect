// Common JavaScript - Used across all pages

// DOM Ready Helper
function ready(fn) {
    if (document.readyState !== "loading") {
        fn();
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}

// Modal Management
class ModalManager {
    static openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add("active");
            document.body.style.overflow = "hidden";
            return modal;
        }
    }

    static closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove("active");
            document.body.style.overflow = "";
        }
    }

    static closeAllModals() {
        document.querySelectorAll(".modal.active").forEach((modal) => {
            modal.classList.remove("active");
        });
        document.body.style.overflow = "";
    }

    static init() {
        // Close on outside click
        document.addEventListener("click", (e) => {
            if (e.target.classList.contains("modal")) {
                e.target.classList.remove("active");
                document.body.style.overflow = "";
            }
        });

        // Close on ESC key
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.closeAllModals();
            }
        });

        // Close buttons
        document.querySelectorAll(".modal-close").forEach((btn) => {
            btn.addEventListener("click", () => {
                const modal = btn.closest(".modal");
                if (modal) {
                    modal.classList.remove("active");
                    document.body.style.overflow = "";
                }
            });
        });
    }
}

// Notification System
class NotificationManager {
    static show(message, type = "info", duration = 5000, persistent = false) {
        const notification = document.createElement("div");
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Add to container or create one
        let container = document.getElementById("notification-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "notification-container";
            document.body.appendChild(container);
        }

        container.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add("show"), 10);

        // Close button
        const closeBtn = notification.querySelector(".notification-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                notification.classList.remove("show");
                setTimeout(() => notification.remove(), 300);
            });
        }

        if (!persistent) {
            // Auto remove
            setTimeout(() => {
                notification.classList.remove("show");
                setTimeout(() => notification.remove(), 2000);
            }, duration);
        }

        return notification;
    }

    static success(message, duration) {
        return this.show(message, "success", duration);
    }

    static error(message, durationOrPersistent) {
        // If boolean true is passed, make it persistent
        if (durationOrPersistent === true) {
            return this.show(message, "error", 5000, true);
        }
        return this.show(message, "error", durationOrPersistent);
    }

    static warning(message, durationOrPersistent) {
        // If boolean true is passed, make it persistent
        if (durationOrPersistent === true) {
            return this.show(message, "warning", 5000, true);
        }
        return this.show(message, "warning", durationOrPersistent);
    }

    static info(message, duration) {
        return this.show(message, "info", duration);
    }
}

// Form Utilities
class FormUtils {
    static formatCardNumber(input) {
        let value = input.value.replace(/\D/g, "");
        let formattedValue = value.match(/.{1,4}/g)?.join(" ") || value;
        input.value = formattedValue;
    }

    static formatExpiry(input) {
        let value = input.value.replace(/\D/g, "");
        if (value.length >= 2) {
            value = value.slice(0, 2) + "/" + value.slice(2, 4);
        }
        input.value = value;
    }

    static formatCurrency(input) {
        let value = parseFloat(input.value.replace(/[^0-9.-]/g, ""));
        if (!isNaN(value)) {
            input.value = value.toFixed(2);
        }
    }

    static formatPhone(input) {
        let value = input.value.replace(/\D/g, "");
        if (value.length > 0) {
            if (value.length <= 3) {
                value = `(${value}`;
            } else if (value.length <= 6) {
                value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
            } else {
                value = `(${value.slice(0, 3)}) ${value.slice(
                    3,
                    6
                )}-${value.slice(6, 10)}`;
            }
        }
        input.value = value;
    }

    static validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    static validatePhone(phone) {
        const cleaned = phone.replace(/\D/g, "");
        return cleaned.length === 10;
    }

    static serializeForm(form) {
        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        return data;
    }
}

// API Helper
class APIClient {
    static async request(url, options = {}) {
        const defaultOptions = {
            headers: {
                "Content-Type": "application/json",
            },
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, config);

            // Try to parse the response as JSON regardless of status
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                // If response is not JSON, create a basic error structure
                data = {
                    success: false,
                    message: response.statusText || "Request failed",
                };
            }

            if (!response.ok) {
                // If the backend sent an error message, use it
                const errorMessage =
                    data.message ||
                    data.error ||
                    `HTTP error! status: ${response.status}`;
                console.error("API request failed:", errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                    status: response.status,
                };
            }

            return { success: true, data };
        } catch (error) {
            console.error("API request failed:", error);
            return {
                success: false,
                error: error.message || "Network error occurred",
            };
        }
    }

    static get(url) {
        return this.request(url, { method: "GET" });
    }

    static post(url, data) {
        const isFormData = data instanceof FormData;

        return this.request(url, {
            method: "POST",
            body: isFormData ? data : JSON.stringify(data),
            headers: isFormData ? {} : { "Content-Type": "application/json" },
        });
    }

    static put(url, data) {
        return this.request(url, {
            method: "PUT",
            body: JSON.stringify(data),
        });
    }

    static delete(url) {
        return this.request(url, { method: "DELETE" });
    }
}

// Loading State Manager
class LoadingManager {
    static show(element, text = "Loading...") {
        const original = element.innerHTML;
        element.setAttribute("data-original-content", original);
        element.disabled = true;
        element.innerHTML = `<span class="spinner"></span> ${text}`;
        return original;
    }

    static hide(element) {
        const original = element.getAttribute("data-original-content");
        if (original) {
            element.innerHTML = original;
            element.disabled = false;
            element.removeAttribute("data-original-content");
        }
    }
}

// Date Utilities
class DateUtils {
    static formatDate(date, format = "MM/DD/YYYY") {
        const d = new Date(date);
        const month = (d.getMonth() + 1).toString().padStart(2, "0");
        const day = d.getDate().toString().padStart(2, "0");
        const year = d.getFullYear();

        return format
            .replace("MM", month)
            .replace("DD", day)
            .replace("YYYY", year);
    }

    static getDaysUntil(date) {
        const now = new Date();
        const target = new Date(date);
        const diff = target - now;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    static getDaysSince(date) {
        return -this.getDaysUntil(date);
    }

    static isOverdue(date) {
        return new Date(date) < new Date();
    }
}

// Storage Helper
class StorageHelper {
    static get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error("Error reading from localStorage:", e);
            return null;
        }
    }

    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error("Error writing to localStorage:", e);
            return false;
        }
    }

    static remove(key) {
        localStorage.removeItem(key);
    }

    static clear() {
        localStorage.clear();
    }
}

// Debounce Function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle Function
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// Initialize Common Features
ready(() => {
    // Initialize modals
    ModalManager.init();

    // Add notification styles if not present
    if (!document.getElementById("notification-styles")) {
        const styles = document.createElement("style");
        styles.id = "notification-styles";
        styles.textContent = `
      #notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: var(--z-tooltip);
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      }
      
      .notification {
        max-width: 400px;
        padding: 16px;
        border-radius: var(--border-radius-lg);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateX(500px);
        transition: transform var(--transition-normal);
        pointer-events: all;
      }
      
      .notification.show {
        transform: translateX(0);
      }
      
      .notification-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      
      .notification-close {
        background: none;
        border: none;
        color: currentColor;
        font-size: 20px;
        cursor: pointer;
        opacity: 0.7;
        padding: 0;
        width: 24px;
        height: 24px;
        flex-shrink: 0;
      }
      
      .notification-close:hover {
        opacity: 1;
      }
      
      .notification-info {
        background: #dbeafe;
        color: #1e40af;
      }
      
      .notification-success {
        background: #d1fae5;
        color: #065f46;
      }
      
      .notification-warning {
        background: #fed7aa;
        color: #92400e;
      }
      
      .notification-error {
        background: #fee2e2;
        color: #991b1b;
      }
    `;
        document.head.appendChild(styles);
    }

    // Auto-format inputs
    document.querySelectorAll('[data-format="card"]').forEach((input) => {
        input.addEventListener("input", () =>
            FormUtils.formatCardNumber(input)
        );
    });

    document.querySelectorAll('[data-format="expiry"]').forEach((input) => {
        input.addEventListener("input", () => FormUtils.formatExpiry(input));
    });

    document.querySelectorAll('[data-format="currency"]').forEach((input) => {
        input.addEventListener("blur", () => FormUtils.formatCurrency(input));
    });

    document.querySelectorAll('[data-format="phone"]').forEach((input) => {
        input.addEventListener("input", () => FormUtils.formatPhone(input));
    });
});

// Export for use in other files
window.CasaConnect = {
    ready,
    ModalManager,
    NotificationManager,
    FormUtils,
    APIClient,
    LoadingManager,
    DateUtils,
    StorageHelper,
    debounce,
    throttle,
};
