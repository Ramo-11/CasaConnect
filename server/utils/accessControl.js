const User = require('../../models/User');
const { logger } = require('../logger');

/**
 * Get the units accessible by a manager
 * Returns null for full managers (all units accessible)
 * Returns array of unit IDs for restricted managers
 */
exports.getManagerAccessibleUnits = async (userId, userRole) => {
    if (userRole === 'restricted_manager') {
        const manager = await User.findById(userId).select('assignedUnits');
        return manager?.assignedUnits || [];
    }
    // Full access for manager/supervisor
    return null;
};

/**
 * Check if a manager has access to a specific unit
 */
exports.canAccessUnit = async (userId, userRole, unitId) => {
    if (userRole === 'restricted_manager') {
        const manager = await User.findById(userId).select('assignedUnits');
        return manager?.assignedUnits?.some((id) => id.toString() === unitId.toString()) || false;
    }
    // Full access for manager/supervisor
    return true;
};

/**
 * Apply unit filter to a query for restricted managers
 */
exports.applyUnitFilter = (filter, accessibleUnits) => {
    if (accessibleUnits !== null) {
        filter.unit = { $in: accessibleUnits };
    }
    return filter;
};

/**
 * Apply tenant filter to a query for restricted managers
 * Only shows tenants with active leases on accessible units
 */
exports.applyTenantFilter = async (accessibleUnits) => {
    if (accessibleUnits !== null) {
        const Lease = require('../../models/Lease');
        const activeLeases = await Lease.find({
            unit: { $in: accessibleUnits },
            status: 'active',
        }).select('tenant');

        return activeLeases.map((lease) => lease.tenant);
    }
    return null;
};
