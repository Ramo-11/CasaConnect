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
        this.loadUnitExpenses(unitId);
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
    },

    loadUnitExpenses(unitId) {
        fetch(`/api/manager/unit/${unitId}/expenses`)
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    const container = document.getElementById('unitExpensesList');
                    const totalEl = document.getElementById('unitExpenseTotal');

                    totalEl.textContent = `Total: $${data.data.total.toFixed(2)}`;

                    if (data.data.expenses.length > 0) {
                        // Calculate some stats
                        const thisMonth = new Date().getMonth();
                        const thisYear = new Date().getFullYear();
                        let monthlyTotal = 0;
                        let expensesByCategory = {};

                        data.data.expenses.forEach((expense) => {
                            const expDate = new Date(expense.date);
                            if (
                                expDate.getMonth() === thisMonth &&
                                expDate.getFullYear() === thisYear
                            ) {
                                monthlyTotal += expense.amount;
                            }

                            const category = expense.category || 'other';
                            expensesByCategory[category] = (expensesByCategory[category] || 0) + 1;
                        });

                        // Build the HTML
                        let html = `
                        <div class="expense-summary">
                            <div class="expense-stat">
                                <span class="expense-stat-label">Total Expenses</span>
                                <span class="expense-stat-value">$${data.data.total.toFixed(
                                    2
                                )}</span>
                            </div>
                            <div class="expense-stat">
                                <span class="expense-stat-label">This Month</span>
                                <span class="expense-stat-value">$${monthlyTotal.toFixed(2)}</span>
                            </div>
                            <div class="expense-stat">
                                <span class="expense-stat-label">Total Records</span>
                                <span class="expense-stat-value">${data.data.expenses.length}</span>
                            </div>
                        </div>
                        <div class="expense-items">
                    `;

                        data.data.expenses.forEach((expense) => {
                            const date = new Date(expense.date);
                            const formattedDate = date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                            });

                            html += `
                            <div class="expense-item">
                                <span class="expense-date">${formattedDate}</span>
                                <div>
                                    <span class="expense-desc ${
                                        !expense.description ? 'no-description' : ''
                                    }">
                                        ${expense.description || 'No description provided'}
                                    </span>
                                    ${
                                        expense.category
                                            ? `<span class="expense-category ${expense.category}">${expense.category}</span>`
                                            : ''
                                    }
                                </div>
                                <span class="expense-amount">$${expense.amount.toFixed(2)}</span>
                            </div>
                        `;
                        });

                        html += '</div>';
                        container.innerHTML = html;
                    } else {
                        container.innerHTML = `
                        <div class="no-expenses">
                            <i class="fas fa-receipt"></i>
                            <p>No expenses recorded for this unit</p>
                            <a href="/manager/expenses" class="btn btn-primary btn-small">
                                Add First Expense
                            </a>
                        </div>
                    `;
                    }
                }
            })
            .catch((error) => {
                console.error('Failed to load expenses:', error);
                document.getElementById('unitExpensesList').innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i>
                    Failed to load expenses. Please try again later.
                </div>
            `;
            });
    },
};

// Global function for navigation
window.navigateBack = () => {
    window.location.href = `/manager/units/${UnitDetailsManager.unitId}`;
};
