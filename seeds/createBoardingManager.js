const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

if (!baseUri) {
    console.error('MongoDB URI is not defined - will not connect');
    return;
}

process.env.MONGODB_URI = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;

mongoose.connect(process.env.MONGODB_URI);

async function createBoardingManager() {
    const user = await User.create({
        firstName: 'Boarding',
        lastName: 'Manager',
        email: 'boarding@casaconnect.com',
        password: 'Boarding123!',
        phone: '(555) 111-1111',
        role: 'boarding_manager',
        isActive: true,
    });

    console.log('Boarding Manager Created:', user.email);
    process.exit();
}

createBoardingManager();
