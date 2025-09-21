const mongoose = require('mongoose');
const User = require('../models/User');
const Unit = require('../models/Unit');
const Lease = require('../models/Lease');
const Payment = require('../models/Payment');
const { logger } = require('../server/logger');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

if (!baseUri) {
    console.error('MongoDB URI is not defined - will not connect');
    process.exit(1);
}
process.env.MONGODB_URI = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;

mongoose.connect(process.env.MONGODB_URI);

async function createSampleData() {
    try {
        console.log('Creating sample data...');

        // Create units
        const units = await Unit.create([
            {
                unitNumber: '101',
                streetAddress: '123 Main St',
                city: 'Indianapolis',
                state: 'IN',
                zipCode: '46201',
                propertyType: 'apartment',
                bedrooms: 2,
                bathrooms: 1,
                squareFeet: 800,
                monthlyRent: 1000,
            },
            {
                unitNumber: '102',
                streetAddress: '123 Main St',
                city: 'Indianapolis',
                state: 'IN',
                zipCode: '46201',
                propertyType: 'apartment',
                bedrooms: 1,
                bathrooms: 1,
                squareFeet: 600,
                monthlyRent: 800,
            },
            {
                unitNumber: '103',
                streetAddress: '123 Main St',
                city: 'Indianapolis',
                state: 'IN',
                zipCode: '46201',
                propertyType: 'apartment',
                bedrooms: 2,
                bathrooms: 2,
                squareFeet: 900,
                monthlyRent: 1200,
            },
            {
                unitNumber: '104',
                streetAddress: '123 Main St',
                city: 'Indianapolis',
                state: 'IN',
                zipCode: '46201',
                propertyType: 'apartment',
                bedrooms: 3,
                bathrooms: 2,
                squareFeet: 1100,
                monthlyRent: 1500,
            },
            {
                unitNumber: '105',
                streetAddress: '123 Main St',
                city: 'Indianapolis',
                state: 'IN',
                zipCode: '46201',
                propertyType: 'apartment',
                bedrooms: 1,
                bathrooms: 1,
                squareFeet: 550,
                monthlyRent: 750,
            },
        ]);

        console.log(`Created ${units.length} units`);

        // Create tenants
        const tenants = await User.create([
            {
                firstName: 'John',
                lastName: 'Smith',
                email: 'john.smith@example.com',
                password: 'Password123!',
                phone: '(555) 111-1111',
                role: 'tenant',
                isActive: true,
            },
            {
                firstName: 'Sarah',
                lastName: 'Johnson',
                email: 'sarah.johnson@example.com',
                password: 'Password123!',
                phone: '(555) 222-2222',
                role: 'tenant',
                isActive: true,
            },
            {
                firstName: 'Michael',
                lastName: 'Williams',
                email: 'michael.williams@example.com',
                password: 'Password123!',
                phone: '(555) 333-3333',
                role: 'tenant',
                isActive: true,
            },
            {
                firstName: 'Emily',
                lastName: 'Davis',
                email: 'emily.davis@example.com',
                password: 'Password123!',
                phone: '(555) 444-4444',
                role: 'tenant',
                isActive: true,
            },
            {
                firstName: 'Robert',
                lastName: 'Brown',
                email: 'robert.brown@example.com',
                password: 'Password123!',
                phone: '(555) 555-5555',
                role: 'tenant',
                isActive: true,
            },
        ]);

        console.log(`Created ${tenants.length} tenants`);

        // Create leases (all active)
        const currentYear = new Date().getFullYear();
        const leases = await Lease.create([
            {
                tenant: tenants[0]._id,
                unit: units[0]._id,
                startDate: new Date(currentYear, 0, 1), // Jan 1
                endDate: new Date(currentYear, 11, 31), // Dec 31
                monthlyRent: 1000,
                securityDeposit: 1000,
                status: 'active',
                rentDueDay: 1,
            },
            {
                tenant: tenants[1]._id,
                unit: units[1]._id,
                startDate: new Date(currentYear, 0, 1),
                endDate: new Date(currentYear, 11, 31),
                monthlyRent: 800,
                securityDeposit: 800,
                status: 'active',
                rentDueDay: 1,
            },
            {
                tenant: tenants[2]._id,
                unit: units[2]._id,
                startDate: new Date(currentYear, 2, 1), // Started in March
                endDate: new Date(currentYear, 11, 31),
                monthlyRent: 1200,
                securityDeposit: 1200,
                status: 'active',
                rentDueDay: 1,
            },
            {
                tenant: tenants[3]._id,
                unit: units[3]._id,
                startDate: new Date(currentYear, 0, 1),
                endDate: new Date(currentYear, 11, 31),
                monthlyRent: 1500,
                securityDeposit: 1500,
                status: 'active',
                rentDueDay: 1,
            },
            {
                tenant: tenants[4]._id,
                unit: units[4]._id,
                startDate: new Date(currentYear, 5, 1), // Started in June
                endDate: new Date(currentYear, 11, 31),
                monthlyRent: 750,
                securityDeposit: 750,
                status: 'active',
                rentDueDay: 1,
            },
        ]);

        console.log(`Created ${leases.length} leases`);

        // Create varied payment records
        const currentMonth = new Date().getMonth() + 1;
        const payments = [];

        // Tenant 1 (John Smith - Unit 101) - Mostly pays on time, missed one month
        for (let month = 1; month <= currentMonth; month++) {
            if (month !== 3) {
                // Missed March
                payments.push({
                    tenant: tenants[0]._id,
                    unit: units[0]._id,
                    type: 'rent',
                    amount: 1000,
                    paymentMethod: 'ach',
                    status: 'completed',
                    month: month,
                    year: currentYear,
                    paidDate: new Date(currentYear, month - 1, 5),
                });
            }
        }

        // Tenant 2 (Sarah Johnson - Unit 102) - Always pays on time
        for (let month = 1; month <= currentMonth; month++) {
            payments.push({
                tenant: tenants[1]._id,
                unit: units[1]._id,
                type: 'rent',
                amount: 800,
                paymentMethod: 'credit_card',
                status: 'completed',
                month: month,
                year: currentYear,
                paidDate: new Date(currentYear, month - 1, 1),
            });
        }

        // Tenant 3 (Michael Williams - Unit 103) - Started in March, partial payments
        for (let month = 3; month <= currentMonth; month++) {
            if (month === 4) {
                // Partial payment in April
                payments.push({
                    tenant: tenants[2]._id,
                    unit: units[2]._id,
                    type: 'rent',
                    amount: 800, // Paid only 800 out of 1200
                    paymentMethod: 'cash',
                    status: 'completed',
                    month: month,
                    year: currentYear,
                    paidDate: new Date(currentYear, month - 1, 10),
                });
            } else if (month === 5) {
                // Another partial payment in May
                payments.push({
                    tenant: tenants[2]._id,
                    unit: units[2]._id,
                    type: 'rent',
                    amount: 600, // Paid only 600 out of 1200
                    paymentMethod: 'cash',
                    status: 'completed',
                    month: month,
                    year: currentYear,
                    paidDate: new Date(currentYear, month - 1, 15),
                });
            } else if (month !== currentMonth) {
                // Skip current month (not paid yet)
                payments.push({
                    tenant: tenants[2]._id,
                    unit: units[2]._id,
                    type: 'rent',
                    amount: 1200,
                    paymentMethod: 'check',
                    status: 'completed',
                    month: month,
                    year: currentYear,
                    paidDate: new Date(currentYear, month - 1, 8),
                });
            }
        }

        // Tenant 4 (Emily Davis - Unit 104) - Frequently late, some partial payments
        for (let month = 1; month <= currentMonth; month++) {
            if (month === 2) {
                // Partial payment in February
                payments.push({
                    tenant: tenants[3]._id,
                    unit: units[3]._id,
                    type: 'rent',
                    amount: 1000, // Paid only 1000 out of 1500
                    paymentMethod: 'debit_card',
                    status: 'completed',
                    month: month,
                    year: currentYear,
                    paidDate: new Date(currentYear, month - 1, 20),
                });
            } else if (month === 6) {
                // Partial payment in June
                payments.push({
                    tenant: tenants[3]._id,
                    unit: units[3]._id,
                    type: 'rent',
                    amount: 750, // Paid only 750 out of 1500
                    paymentMethod: 'cash',
                    status: 'completed',
                    month: month,
                    year: currentYear,
                    paidDate: new Date(currentYear, month - 1, 25),
                });
            } else if (month < currentMonth - 1) {
                payments.push({
                    tenant: tenants[3]._id,
                    unit: units[3]._id,
                    type: 'rent',
                    amount: 1500,
                    paymentMethod: 'ach',
                    status: 'completed',
                    month: month,
                    year: currentYear,
                    paidDate: new Date(currentYear, month - 1, 15),
                });
            }
            // Missing last two months
        }

        // Tenant 5 (Robert Brown - Unit 105) - Started in June, all paid
        for (let month = 6; month <= currentMonth; month++) {
            if (month < currentMonth) {
                // Don't pay current month yet
                payments.push({
                    tenant: tenants[4]._id,
                    unit: units[4]._id,
                    type: 'rent',
                    amount: 750,
                    paymentMethod: 'ach',
                    status: 'completed',
                    month: month,
                    year: currentYear,
                    paidDate: new Date(currentYear, month - 1, 3),
                });
            }
        }

        await Payment.create(payments);
        console.log(`Created ${payments.length} payment records`);

        console.log('\n=== Sample Data Created Successfully ===');
        console.log('\nTenant Summary:');
        console.log('1. John Smith (Unit 101) - $1000/mo - Missed March');
        console.log('2. Sarah Johnson (Unit 102) - $800/mo - All paid on time');
        console.log(
            '3. Michael Williams (Unit 103) - $1200/mo - Started March, partial payments in April ($400 due) and May ($600 due)'
        );
        console.log(
            '4. Emily Davis (Unit 104) - $1500/mo - Partial payments in Feb ($500 due) and June ($750 due), missing recent months'
        );
        console.log(
            '5. Robert Brown (Unit 105) - $750/mo - Started June, all paid except current month'
        );

        console.log('\nYou can now view the Payment Records from the dashboard!');
    } catch (error) {
        console.error('Error creating sample data:', error);
    } finally {
        mongoose.connection.close();
        process.exit();
    }
}

createSampleData();
