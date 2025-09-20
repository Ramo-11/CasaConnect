// Unit Details Page JavaScript

CasaConnect.ready(() => {
    const unitElement = document.querySelector('[data-unit-id]');
    if (unitElement) {
        const unitId = unitElement.getAttribute('data-unit-id');
        UnitDetailsManager.init(unitId);
    }
});

const UnitDetailsManager = {
    unitId: null,

    init(unitId) {
        this.unitId = unitId;
        this.initializePrintStyles();
    },

    initializePrintStyles() {
        const printStyles = `
            @media print {
                .header-actions,
                .action-button,
                .btn,
                .modal {
                    display: none !important;
                }
                
                .details-grid {
                    grid-template-columns: 1fr !important;
                }
                
                .card {
                    page-break-inside: avoid;
                }
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = printStyles;
        document.head.appendChild(styleSheet);
    }
};

// Global function for navigation
window.navigateBack = () => {
    window.location.href = `/manager/units/${UnitDetailsManager.unitId}`;
};