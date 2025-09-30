const mongoose = require('mongoose');
const User = require('../models/User');
const Unit = require('../models/Unit');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
    console.log(`In prod mode`);
} else {
    console.log(`In dev mode`);
}

const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

if (!baseUri) {
    console.error('MongoDB URI is not defined - will not connect');
    process.exit(1);
}

process.env.MONGODB_URI = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;

mongoose.connect(process.env.MONGODB_URI);

async function createRestrictedManager() {
    try {
        const allUnits = await Unit.find().select('_id unitNumber');

        // Get all assigned unit IDs from users
        const usersWithUnits = await User.find({
            assignedUnits: { $exists: true, $ne: [] },
        }).select('assignedUnits');

        const assignedUnitIds = new Set(
            usersWithUnits.flatMap((user) => user.assignedUnits.map((id) => id.toString()))
        );

        // Filter only unassigned units
        const unassignedUnits = allUnits.filter(
            (unit) => !assignedUnitIds.has(unit._id.toString())
        );

        // Take first 3 unassigned units
        const unitsToAssign = unassignedUnits.slice(0, 3);

        if (unitsToAssign.length === 0) {
            console.error('No unassigned units found.');
            process.exit(1);
        }

        const restrictedManager = await User.create({
            firstName: 'First',
            lastName: 'Manager',
            email: 'sahab@sahab-solutions.com',
            password: 'Manager123!',
            phone: '(555) 222-2222',
            role: 'restricted_manager',
            isActive: true,
            assignedUnits: unitsToAssign.map((u) => u._id),
        });

        console.log('Restricted Manager Created:', restrictedManager.email);
        console.log('Assigned Units:', unitsToAssign.map((u) => u.unitNumber).join(', '));
        console.log('\nLogin credentials:');
        console.log('Email: restricted@sahabpm.com');
        console.log('Password: Restricted123!');

        process.exit();
    } catch (error) {
        console.error('Error creating restricted manager:', error);
        process.exit(1);
    }
}

createRestrictedManager();
