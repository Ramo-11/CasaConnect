const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    description: {
        type: String,
        trim: true,
        default: null,
    },
    unit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Unit',
        default: null, // null means general expense not tied to a unit
    },
    category: {
        type: String,
        enum: ['maintenance', 'repair', 'utilities', 'supplies', 'other'],
        default: 'other',
    },
    receipt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        default: null,
    },
    date: {
        type: Date,
        required: true,
        default: Date.now,
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for faster queries
expenseSchema.index({ unit: 1, date: -1 });
expenseSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
