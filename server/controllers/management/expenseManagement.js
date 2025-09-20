const Expense = require('../../../models/Expense');
const Unit = require('../../../models/Unit');
const Document = require('../../../models/Document');
const { logger } = require('../../logger');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../services/storageService');

// Get Expenses Page
exports.getExpenses = async (req, res) => {
    try {
        const units = await Unit.find().sort('unitNumber');
        const expenses = await Expense.find()
            .populate('unit', 'unitNumber')
            .populate('addedBy', 'firstName lastName')
            .sort('-date');

        // Calculate totals
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const thisMonthExpenses = expenses
            .filter((exp) => {
                const expDate = new Date(exp.date);
                const now = new Date();
                return (
                    expDate.getMonth() === now.getMonth() &&
                    expDate.getFullYear() === now.getFullYear()
                );
            })
            .reduce((sum, exp) => sum + exp.amount, 0);

        res.render('manager/expenses', {
            title: 'Expense Management',
            layout: 'layout',
            additionalCSS: ['manager/expenses.css'],
            additionalJS: ['manager/expenses.js'],
            user: req.session.user || { role: 'manager' },
            units,
            expenses,
            totalExpenses,
            thisMonthExpenses,
            path: req.path,
        });
    } catch (error) {
        logger.error(`Get expenses error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load expenses',
        });
    }
};

// Create Expense (API)
exports.createExpense = async (req, res) => {
    try {
        const { amount, description, unit, category, date } = req.body;
        const receipt = req.file;

        const expenseData = {
            amount: parseFloat(amount),
            description: description || null,
            unit: unit && unit !== 'none' ? unit : null,
            category: category || 'other',
            date: date || new Date(),
            addedBy: req.session.userId,
        };

        // Handle receipt upload if provided
        if (receipt) {
            try {
                const uploadResult = await uploadToCloudinary(receipt.buffer, {
                    folder: 'receipts',
                    resource_type: 'auto',
                });

                // Create document record for receipt
                const document = new Document({
                    title: `Receipt - ${description || 'Expense'}`,
                    type: 'invoice',
                    fileName: receipt.originalname,
                    url: uploadResult.secure_url,
                    size: receipt.size,
                    mimeType: receipt.mimetype,
                    relatedTo: {
                        model: 'Expense',
                        id: null, // Will update after expense creation
                    },
                    uploadedBy: req.session.userId,
                });

                await document.save();
                expenseData.receipt = document._id;
            } catch (uploadError) {
                logger.error(`Receipt upload error: ${uploadError}`);
                // Continue without receipt
            }
        }

        const expense = new Expense(expenseData);
        await expense.save();

        // Update receipt document with expense ID if exists
        if (expense.receipt) {
            await Document.findByIdAndUpdate(expense.receipt, {
                'relatedTo.id': expense._id,
            });
        }

        res.json({
            success: true,
            message: 'Expense added successfully',
            data: expense,
        });
    } catch (error) {
        logger.error(`Create expense error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to create expense',
        });
    }
};

// Delete Expense (API)
exports.deleteExpense = async (req, res) => {
    try {
        const { expenseId } = req.params;
        const expense = await Expense.findById(expenseId);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        // Delete receipt if exists
        if (expense.receipt) {
            const document = await Document.findById(expense.receipt);
            if (document && document.url) {
                await deleteFromCloudinary(document.url);
                await Document.findByIdAndDelete(expense.receipt);
            }
        }

        await Expense.findByIdAndDelete(expenseId);

        res.json({
            success: true,
            message: 'Expense deleted successfully',
        });
    } catch (error) {
        logger.error(`Delete expense error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to delete expense',
        });
    }
};

// Get Unit Expenses (API)
exports.getUnitExpenses = async (req, res) => {
    try {
        const { unitId } = req.params;
        const expenses = await Expense.find({ unit: unitId })
            .populate('addedBy', 'firstName lastName')
            .sort('-date')
            .select('amount description date category receipt'); // Explicitly select fields

        const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        res.json({
            success: true,
            data: {
                expenses,
                total,
            },
        });
    } catch (error) {
        logger.error(`Get unit expenses error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to get unit expenses',
        });
    }
};
