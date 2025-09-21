// Expense Management JavaScript

PM.ready(() => {
    initializeExpenseForm();
});

function initializeExpenseForm() {
    const form = document.getElementById('addExpenseForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = form.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoading = submitBtn.querySelector('.btn-loading');

            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-flex';
            submitBtn.disabled = true;

            try {
                const formData = new FormData(form);
                const response = await PM.APIClient.post('/api/manager/expense', formData);

                if (response.success) {
                    PM.NotificationManager.success('Expense added successfully!');
                    closeAddExpenseModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.error || 'Failed to add expense');
                }
            } catch (error) {
                PM.NotificationManager.error(error.message);
                btnText.style.display = 'inline-flex';
                btnLoading.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }
}

function openAddExpenseModal() {
    PM.ModalManager.openModal('addExpenseModal');
}

function closeAddExpenseModal() {
    PM.ModalManager.closeModal('addExpenseModal');
    document.getElementById('addExpenseForm').reset();
}

async function deleteExpense(expenseId) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
        const response = await PM.APIClient.delete(`/api/manager/expense/${expenseId}`);

        if (response.success) {
            PM.NotificationManager.success('Expense deleted successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.error || 'Failed to delete expense');
        }
    } catch (error) {
        PM.NotificationManager.error(error.message);
    }
}

function viewReceipt(receiptId) {
    window.open(`/api/documents/${receiptId}/view`, '_blank');
}
