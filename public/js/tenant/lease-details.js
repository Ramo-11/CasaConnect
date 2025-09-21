// public/js/tenant-lease-details.js

// Simple lease details page functionality for tenants
(function () {
    'use strict';

    window.viewLeaseDocument = function (documentId) {
        if (!documentId) {
            PM.NotificationManager.error('Document not found');
            return;
        }
        window.open(`/api/documents/${documentId}/view`, '_blank');
    };

    window.downloadLeaseDocument = function (documentId) {
        if (!documentId) {
            PM.NotificationManager.error('Document not found');
            return;
        }
        window.open(`/api/documents/${documentId}/download`, '_blank');
    };

    // Initialize on page load
    PM.ready(() => {
        // Animate progress bar on load
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            const targetWidth = progressFill.style.width;
            progressFill.style.width = '0%';
            progressFill.style.transition = 'width 1s ease-in-out';

            setTimeout(() => {
                progressFill.style.width = targetWidth;
            }, 100);
        }

        // Add print functionality
        const printButton = document.createElement('button');
        printButton.className = 'btn btn-secondary';
        printButton.innerHTML = '<i class="fas fa-print"></i> Print';
        printButton.onclick = function () {
            window.print();
        };

        // Add print button to header actions if not already there
        const headerActions = document.querySelector('.header-actions');
        if (headerActions && !document.querySelector('.btn-print')) {
            printButton.classList.add('btn-print');
            headerActions.appendChild(printButton);
        }

        // Add countdown timer for lease expiration if less than 30 days
        const daysRemainingElement = document.querySelector('.info-item span.text-warning');
        if (daysRemainingElement) {
            const daysText = daysRemainingElement.textContent.trim();
            const days = parseInt(daysText);

            if (days <= 30 && days > 0) {
                // Update daily at midnight
                const updateCountdown = () => {
                    const now = new Date();
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(0, 0, 0, 0);

                    const timeUntilMidnight = tomorrow - now;

                    setTimeout(() => {
                        location.reload(); // Refresh page to update days
                    }, timeUntilMidnight);
                };

                updateCountdown();
            }
        }
    });

    // Print styles
    const printStyles = `
        @media print {
            .header-actions,
            .btn,
            .document-actions {
                display: none !important;
            }
            
            .tenant-container {
                padding: 0;
            }
            
            .card {
                box-shadow: none;
                border: 1px solid #e5e7eb;
                page-break-inside: avoid;
            }
            
            .lease-details-grid {
                display: block;
            }
            
            .card {
                margin-bottom: 20px;
            }
        }
    `;

    // Add print styles to head
    const styleSheet = document.createElement('style');
    styleSheet.textContent = printStyles;
    document.head.appendChild(styleSheet);
})();
