// Navigation and Footer JavaScript

document.addEventListener('DOMContentLoaded', function () {
    // User Dropdown Toggle
    const userDropdownToggle = document.getElementById('userDropdownToggle');
    const userDropdown = document.querySelector('.user-dropdown');

    if (userDropdownToggle) {
        userDropdownToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function (e) {
            if (!userDropdown.contains(e.target)) {
                userDropdown.classList.remove('active');
            }
        });
    }

    // Mobile Menu Toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    const body = document.body;

    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener('click', function () {
            mobileMenu.classList.add('active');
            body.style.overflow = 'hidden';
        });

        mobileMenuClose.addEventListener('click', function () {
            mobileMenu.classList.remove('active');
            body.style.overflow = '';
        });

        // Close mobile menu when clicking outside
        mobileMenu.addEventListener('click', function (e) {
            if (e.target === mobileMenu) {
                mobileMenu.classList.remove('active');
                body.style.overflow = '';
            }
        });
    }

    // Add active state to current page nav item
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach((item) => {
        const href = item.getAttribute('href');
        if (href && currentPath.includes(href)) {
            item.classList.add('active');
        }
    });

    // Smooth scroll for navbar when scrolling
    let lastScrollTop = 0;
    const navbar = document.querySelector('.main-navbar');

    if (navbar) {
        window.addEventListener('scroll', function () {
            let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scrolling down
                navbar.style.transform = 'translateY(-100%)';
            } else {
                // Scrolling up
                navbar.style.transform = 'translateY(0)';
            }

            lastScrollTop = scrollTop;
        });

        // Add transition for smooth animation
        navbar.style.transition = 'transform 0.3s ease-in-out';
    }

    // Add notification badge support (for future use)
    function addNotificationBadge(menuItemSelector, count) {
        const menuItem = document.querySelector(menuItemSelector);
        if (menuItem && count > 0) {
            const badge = document.createElement('span');
            badge.className = 'nav-badge';
            badge.textContent = count > 99 ? '99+' : count;
            menuItem.appendChild(badge);
        }
    }

    // Keyboard navigation support
    document.addEventListener('keydown', function (e) {
        // ESC key closes dropdowns and mobile menu
        if (e.key === 'Escape') {
            userDropdown?.classList.remove('active');
            if (mobileMenu?.classList.contains('active')) {
                mobileMenu.classList.remove('active');
                body.style.overflow = '';
            }
        }
    });

    // Add loading state to navigation items when clicked
    navItems.forEach((item) => {
        item.addEventListener('click', function (e) {
            // Don't add loading for dropdown toggles
            if (!this.hasAttribute('data-toggle')) {
                this.style.opacity = '0.7';
                this.style.pointerEvents = 'none';
            }
        });
    });
});

// Export utility functions for use in other scripts
window.NavUtils = {
    // Close all dropdowns
    closeAllDropdowns: function () {
        document.querySelectorAll('.user-dropdown').forEach((dropdown) => {
            dropdown.classList.remove('active');
        });
    },

    // Show notification in nav
    showNavNotification: function (message, type = 'info') {
        // This can be extended to show inline notifications in the navbar
        console.log(`Nav notification: ${message} (${type})`);
    },

    // Update user info in navbar
    updateUserInfo: function (userData) {
        const userName = document.querySelector('.user-name');
        const userRole = document.querySelector('.user-role');

        if (userName && userData.name) {
            userName.textContent = userData.name;
        }
        if (userRole && userData.role) {
            userRole.textContent = userData.role;
        }
    },
};
