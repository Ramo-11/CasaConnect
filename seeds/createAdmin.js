const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

// check that baseUri is not empty
if (!baseUri) {
    logger.error('MongoDB URI is not defined - will not connect');
    return;
}
process.env.MONGODB_URI = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;

mongoose.connect(process.env.MONGODB_URI);

async function createAdmin() {
    const admin = await User.create({
        firstName: 'Admin',
        lastName: 'Manager',
        email: 'omarh5877@gmail.com',
        password: 'Admin123!',
        phone: '(555) 000-0000',
        role: 'manager',
        isActive: true,
    });

    process.exit();
}

createAdmin();
