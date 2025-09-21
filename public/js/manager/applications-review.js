// Manager Applications Review JavaScript

PM.ready(() => {
    ApplicationsReview.init();
});

const ApplicationsReview = {
    init() {
        // Initialize filters if needed
    },
};

// Filter Applications
window.filterApplications = () => {
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('applicationSearch').value.toLowerCase();

    const applications = document.querySelectorAll('.application-card');

    applications.forEach((card) => {
        const status = card.getAttribute('data-status');
        const name = card.getAttribute('data-name').toLowerCase();
        const email = card.getAttribute('data-email').toLowerCase();

        let show = true;

        if (statusFilter !== 'all' && status !== statusFilter) {
            show = false;
        }

        if (searchTerm && !name.includes(searchTerm) && !email.includes(searchTerm)) {
            show = false;
        }

        card.style.display = show ? '' : 'none';
    });

    // Check if any results
    const visibleCards = document.querySelectorAll(
        '.application-card:not([style*="display: none"])'
    );
    const emptyState = document.querySelector('.empty-state');

    if (visibleCards.length === 0 && !emptyState) {
        const grid = document.querySelector('.applications-grid');
        const noResults = document.createElement('div');
        noResults.className = 'empty-state no-results';
        noResults.innerHTML = `
            <i class="fas fa-search"></i>
            <h3>No applications match your filters</h3>
            <p>Try adjusting your search criteria</p>
        `;
        grid.appendChild(noResults);
    } else if (visibleCards.length > 0) {
        const noResults = document.querySelector('.no-results');
        if (noResults) noResults.remove();
    }
};

// Review Application
window.reviewApplication = (applicationId) => {
    window.location.href = `/manager/application-review/${applicationId}`;
};
