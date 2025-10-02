const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

if (!baseUri) {
    console.error('MongoDB URI is not defined');
    process.exit(1);
}

console.log(`dbName: ${dbName}`);

process.env.MONGODB_URI = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;
mongoose.connect(process.env.MONGODB_URI);

async function createManager1() {
    try {
        // Check if manager already exists
        const existingManager = await User.findOne({ email: 'manager1@sahabpm.com' });

        if (existingManager) {
            console.log('❌ Manager1 already exists with email: manager1@sahabpm.com');
            console.log('   Use a different email or delete the existing user first.');
            process.exit(1);
        }

        const manager = await User.create({
            firstName: 'Manager',
            lastName: 'One',
            email: 'manager1@sahabpm.com',
            password: 'Manager123!',
            phone: '(317) 555-0001',
            role: 'restricted_manager',
            isActive: true,
            assignedUnits: [],
        });

        console.log('✅ Manager1 created successfully!');
        console.log('   Email:', manager.email);
        console.log('   Password: Manager123!');
        console.log('   Role:', manager.role);
    } catch (error) {
        if (error.code === 11000) {
            console.error('❌ Error: Email already exists in database');
        } else {
            console.error('❌ Error:', error.message);
        }
    } finally {
        mongoose.connection.close();
        process.exit();
    }
}

createManager1();
