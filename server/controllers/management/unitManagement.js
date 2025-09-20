const Unit = require('../../../models/Unit');
const User = require('../../../models/User');
const Lease = require('../../../models/Lease');
const { logger } = require('../../logger');

// Get Units List
exports.getUnits = async (req, res) => {
    try {
        // Get tenants without active leases for lease creation
        const availableTenantsForLease = await User.aggregate([
            { $match: { role: 'tenant' } },
            {
                $lookup: {
                    from: 'leases',
                    localField: '_id',
                    foreignField: 'tenant',
                    pipeline: [{ $match: { status: 'active' } }],
                    as: 'activeLeases',
                },
            },
            { $match: { activeLeases: { $size: 0 } } },
            { $project: { firstName: 1, lastName: 1, email: 1 } },
        ]);

        const units = await Unit.find().sort('unitNumber');

        // For each unit, find if it has an active lease
        const unitsWithTenants = await Promise.all(
            units.map(async (unit) => {
                const activeLease = await Lease.findOne({
                    unit: unit._id,
                    status: 'active',
                }).populate('tenant', 'firstName lastName email phone');

                return {
                    ...unit.toObject(),
                    currentTenant: activeLease ? activeLease.tenant : null,
                    status: activeLease ? 'occupied' : 'available',
                };
            })
        );

        // Get available units for lease creation (units without active leases)
        const availableUnitsForLease = unitsWithTenants
            .filter((unit) => unit.status === 'available')
            .map((unit) => ({
                _id: unit._id,
                unitNumber: unit.unitNumber,
                monthlyRent: unit.monthlyRent,
                streetAddress: unit.streetAddress,
            }));

        res.render('manager/units', {
            title: 'Units Management',
            layout: 'layout',
            additionalCSS: ['manager/units.css'],
            additionalJS: ['manager/units.js'],
            user: req.session.user || { role: 'manager' },
            googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
            units: unitsWithTenants,
            availableTenants: availableTenantsForLease,
            availableTenantsForLease,
            availableUnitsForLease,
            path: req.path,
        });
    } catch (error) {
        logger.error(`Get units error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load units',
        });
    }
};

exports.getAvailableUnits = async (req, res) => {
    try {
        const availableUnits = await Unit.find({ status: 'available' });
        res.json({
            success: true,
            data: availableUnits,
        });
    } catch (error) {
        logger.error(`Get available units error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to get available units',
        });
    }
};

// Create Unit (API)
exports.createUnit = async (req, res) => {
    try {
        const unitData = req.body;

        // Check if unit number already exists
        const existingUnit = await Unit.findOne({
            unitNumber: unitData.unitNumber,
        });
        if (existingUnit) {
            return res.status(400).json({
                success: false,
                message: 'Unit number already exists',
            });
        }

        // Clean up optional fields
        if (!unitData.building || unitData.building === '') {
            delete unitData.building;
        }
        if (!unitData.floor || unitData.floor === '') {
            delete unitData.floor;
        }

        // Remove status field - it will be determined by lease existence
        delete unitData.status;
        delete unitData.currentTenant;

        const unit = new Unit(unitData);
        await unit.save();

        res.json({
            success: true,
            message: 'Unit created successfully',
            data: unit,
        });
    } catch (error) {
        logger.error(`Create unit error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to create unit',
        });
    }
};

// Get Single Unit (API)
exports.getUnit = async (req, res) => {
    try {
        const { unitId } = req.params;
        const unit = await Unit.findById(unitId);

        if (!unit) {
            return res.status(404).json({
                success: false,
                message: 'Unit not found',
            });
        }

        // Get active lease if exists
        const activeLease = await Lease.findOne({
            unit: unitId,
            status: 'active',
        }).populate('tenant', 'firstName lastName email phone');

        const unitData = {
            ...unit.toObject(),
            currentTenant: activeLease ? activeLease.tenant : null,
            activeLease: activeLease,
        };

        res.json({
            success: true,
            data: unitData,
        });
    } catch (error) {
        logger.error(`Get unit error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to get unit',
        });
    }
};

// View Unit Details Page
exports.viewUnit = async (req, res) => {
    try {
        const { unitId } = req.params;
        const unit = await Unit.findById(unitId);

        if (!unit) {
            return res.status(404).render('error', {
                title: 'Unit Not Found',
                message: 'Unit not found',
            });
        }

        // Get active lease with tenant info
        const activeLease = await Lease.findOne({
            unit: unitId,
            status: 'active',
        }).populate('tenant', 'firstName lastName email phone');

        // Get lease history
        const leaseHistory = await Lease.find({
            unit: unitId,
        })
            .populate('tenant', 'firstName lastName')
            .sort('-createdAt')
            .limit(10);

        // Get available tenants for lease creation (ADD THIS)
        const availableTenantsForLease = await User.aggregate([
            { $match: { role: 'tenant' } },
            {
                $lookup: {
                    from: 'leases',
                    localField: '_id',
                    foreignField: 'tenant',
                    pipeline: [{ $match: { status: 'active' } }],
                    as: 'activeLeases',
                },
            },
            { $match: { activeLeases: { $size: 0 } } },
            { $project: { firstName: 1, lastName: 1, email: 1 } },
        ]);

        // For available units, since this unit is available, include it (ADD THIS)
        const availableUnitsForLease = [
            {
                _id: unit._id,
                unitNumber: unit.unitNumber,
                monthlyRent: unit.monthlyRent,
                streetAddress: unit.streetAddress,
            },
        ];

        res.render('manager/unit-details', {
            title: `Unit ${unit.unitNumber}`,
            layout: 'layout',
            additionalCSS: ['manager/unit-common.css', 'manager/unit-details.css'],
            additionalJS: ['manager/unit-details.js'],
            user: req.session.user || { role: 'manager' },
            unit,
            activeLease,
            leaseHistory,
            availableTenantsForLease,
            availableUnitsForLease,
            path: req.path,
        });
    } catch (error) {
        logger.error(`View unit error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load unit details',
        });
    }
};

exports.updateUnit = async (req, res) => {
    try {
        const { unitId } = req.params;
        const updates = req.body;

        delete updates.status;
        delete updates.currentTenant;

        const unit = await Unit.findByIdAndUpdate(
            unitId,
            { ...updates, updatedAt: new Date() },
            { new: true }
        );

        if (!unit) {
            return res.status(404).json({
                success: false,
                message: 'Unit not found',
            });
        }

        res.json({
            success: true,
            message: 'Unit updated successfully',
            data: unit,
        });
    } catch (error) {
        logger.error(`Update unit error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to update unit',
        });
    }
};

// Edit Unit
exports.editUnit = async (req, res) => {
    try {
        const { unitId } = req.params;
        const unit = await Unit.findById(unitId);

        if (!unit) {
            return res.status(404).render('error', {
                title: 'Unit Not Found',
                message: 'Unit not found',
            });
        }

        const activeLease = await Lease.findOne({
            unit: unitId,
            status: 'active',
        }).populate('tenant');

        res.render('manager/unit-edit', {
            title: `Edit Unit ${unit.unitNumber}`,
            layout: 'layout',
            additionalCSS: ['manager/unit-common.css', 'manager/unit-edit.css'],
            additionalJS: ['manager/unit-edit.js'],
            user: req.session.user || { role: 'manager' },
            googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
            unit,
            activeLease,
            path: req.path,
        });
    } catch (error) {
        logger.error(`Edit unit error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load unit edit form',
        });
    }
};

// Delete Unit (API)
exports.deleteUnit = async (req, res) => {
    try {
        const { unitId } = req.params;

        const unit = await Unit.findById(unitId);
        if (!unit) {
            logger.error('Error deleting unit: Unit not found');
            return res.status(404).json({
                success: false,
                message: 'Unit not found',
            });
        }

        // Check for active leases
        const activeLease = await Lease.findOne({
            unit: unitId,
            status: 'active',
        });

        if (activeLease) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete unit with active lease. Please terminate the lease first.',
            });
        }

        await Unit.findByIdAndDelete(unitId);
        logger.info(`Unit deleted successfully: ${unitId}`);

        res.json({
            success: true,
            message: 'Unit deleted successfully',
        });
    } catch (error) {
        logger.error(`Error deleting unit: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to delete unit',
        });
    }
};

// Get Units Stats (API)
exports.getUnitsStats = async (req, res) => {
    try {
        const units = await Unit.find();

        // Get all active leases to determine occupied units
        const activeLeases = await Lease.find({ status: 'active' });
        const occupiedUnitIds = activeLeases.map((l) => l.unit.toString());

        const stats = {
            total: units.length,
            available: units.filter((u) => !occupiedUnitIds.includes(u._id.toString())).length,
            occupied: occupiedUnitIds.length,
            maintenance: units.filter((u) => u.status === 'maintenance').length,
            reserved: units.filter((u) => u.status === 'reserved').length,
        };

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        logger.error(`Get units stats error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to get units stats',
        });
    }
};
