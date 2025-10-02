const mongoose = require('mongoose');
const User = require('../models/User');
const Unit = require('../models/Unit');
const Lease = require('../models/Lease');
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

// The actual data from your spreadsheet
const data = [
    { unit: '401', tenant: '', phone: '', endDate: '12/31/2025', rent: 1050 },
    {
        unit: '402',
        tenant: 'Erica Carer',
        phone: '463-298-8101',
        endDate: '12/31/2025',
        rent: 1050,
    },
    { unit: '403', tenant: 'CHRIS WOOD', phone: '317-754-7464', endDate: '12/31/2025', rent: 1200 },
    {
        unit: '404',
        tenant: 'ANGELA DECKARD',
        phone: '812-276-6718',
        endDate: '12/31/2025',
        rent: 1200,
    },
    {
        unit: '405',
        tenant: 'MONIKA BARBER',
        phone: '317-756-8546',
        endDate: '12/31/2025',
        rent: 1200,
    },
    {
        unit: '406',
        tenant: 'MOHAMAD ALBYROOTY',
        phone: '317-744-4097',
        endDate: '12/31/2025',
        rent: 1200,
    },
    { unit: '501', tenant: '', phone: '', endDate: '12/31/2025', rent: 0 },
    { unit: '502', tenant: '', phone: '', endDate: '12/31/2025', rent: 0 },
    {
        unit: '503',
        tenant: 'SABASTIAN ASHLEY',
        phone: '765-561-1480',
        endDate: '12/31/2025',
        rent: 1000,
    },
    {
        unit: '504',
        tenant: 'BRIAN SCOTT',
        phone: '317-590-0600',
        endDate: '12/31/2025',
        rent: 1000,
    },
    {
        unit: '505',
        tenant: 'BILLY WALLACE',
        phone: '317-491-3671',
        endDate: '12/31/2025',
        rent: 1200,
    },
    {
        unit: '506',
        tenant: 'GHILLIN GREEN',
        phone: '317-798-6862',
        endDate: '12/31/2025',
        rent: 1000,
    },
    {
        unit: '601',
        tenant: 'CASSANDAR COMACHO, SEAN COMACHO',
        phone: '317-600-9298',
        endDate: '12/31/2025',
        rent: 1050,
    },
    { unit: '602', tenant: '', phone: '', endDate: '12/31/2025', rent: 0 },
    {
        unit: '603',
        tenant: 'DEHAVEN HARDMEN',
        phone: '765-568-4876',
        endDate: '12/31/2025',
        rent: 1000,
    },
    {
        unit: '604',
        tenant: 'BUSKIRK CONNER RAY',
        phone: '317-345-1035',
        endDate: '12/31/2025',
        rent: 1200,
    },
    {
        unit: '605',
        tenant: 'DOMINQUE BRUCE',
        phone: '317-730-0212',
        endDate: '12/31/2025',
        rent: 1200,
    },
    {
        unit: '606',
        tenant: 'MIZHER ALKHALIFA',
        phone: '765-559-2443',
        endDate: '12/31/2025',
        rent: 1200,
    },
];

// Helper function to parse name
function parseName(fullName) {
    if (!fullName || fullName.trim() === '') {
        return { firstName: '', lastName: '' };
    }

    // Handle multiple tenants (take first one)
    if (fullName.includes(',')) {
        const names = fullName.split(',');
        fullName = names[0].trim();
    }

    const nameParts = fullName.trim().split(' ');

    if (nameParts.length === 1) {
        return { firstName: nameParts[0], lastName: 'Unknown' };
    }

    // First word is first name, rest is last name
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    return { firstName, lastName };
}

// Helper function to format phone
function formatPhone(phone) {
    if (!phone || phone.trim() === '') {
        return '(000) 000-0000';
    }

    // Take first phone if multiple
    if (phone.includes('AND') || (phone.includes('-') && phone.split('-').length > 3)) {
        phone = phone.split(/AND|,/)[0].trim();
    }

    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    if (digits.length >= 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }

    return phone;
}

// Helper function to create email from name
function createEmail(firstName, lastName, unitNumber) {
    if (!firstName || firstName === '') {
        return `tenant${unitNumber}@placeholder.com`;
    }

    const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');

    return `${cleanFirst}.${cleanLast}@example.com`;
}

// Get or create the restricted manager
async function getOrCreateManager() {
    let manager = await User.findOne({ email: 'manager1@sahabpm.com' });

    if (!manager) {
        console.log('⚠️  Manager1 not found, creating...');
        manager = await User.create({
            firstName: 'Manager',
            lastName: 'One',
            email: 'manager1@sahabpm.com',
            password: 'Manager123!',
            phone: '(317) 555-0001',
            role: 'restricted_manager',
            isActive: true,
            assignedUnits: [], // Will be populated with created units
        });
        console.log('✅ Created manager1@sahabpm.com\n');
    } else {
        console.log('✅ Found existing manager1@sahabpm.com\n');
    }

    return manager;
}

async function importRealData() {
    try {
        console.log('🚀 Starting import of real property data...\n');

        // Get or create manager
        const manager = await getOrCreateManager();
        const unitIds = [];

        let createdUnits = 0;
        let createdTenants = 0;
        let createdLeases = 0;
        let skippedUnits = 0;

        for (const row of data) {
            console.log(`\n📍 Processing Unit ${row.unit}...`);

            // Check if unit already exists
            let unit = await Unit.findOne({ unitNumber: row.unit });

            if (unit) {
                console.log(`   ⏭️  Unit ${row.unit} already exists, skipping unit creation`);
                skippedUnits++;
                unitIds.push(unit._id); // Still add to manager's units
            } else {
                // Create unit
                const bedrooms = row.rent >= 1200 ? 2 : row.rent >= 1000 ? 1 : 1;
                const bathrooms = bedrooms >= 2 ? 1.5 : 1;
                const squareFeet = bedrooms === 2 ? 800 : 600;

                unit = await Unit.create({
                    unitNumber: row.unit,
                    streetAddress: `${row.unit} Main Street`,
                    city: 'Indianapolis',
                    state: 'IN',
                    zipCode: '46201',
                    propertyType: 'apartment',
                    bedrooms,
                    bathrooms,
                    squareFeet,
                    monthlyRent: row.rent || 1000,
                    amenities: ['Central AC', 'Heating'],
                });

                console.log(`   ✅ Created unit ${row.unit}`);
                createdUnits++;
                unitIds.push(unit._id);
            }

            // If no tenant data, skip lease creation
            if (!row.tenant || row.tenant.trim() === '') {
                console.log(`   ⏭️  No tenant data for unit ${row.unit}, skipping lease`);
                continue;
            }

            // Parse tenant name
            const { firstName, lastName } = parseName(row.tenant);
            const phone = formatPhone(row.phone);
            const email = createEmail(firstName, lastName, row.unit);

            // Check if tenant already exists by email
            let tenant = await User.findOne({ email });

            if (tenant) {
                console.log(`   ⏭️  Tenant ${firstName} ${lastName} already exists`);
            } else {
                // Create tenant
                tenant = await User.create({
                    firstName,
                    lastName,
                    email,
                    password: 'Tenant123!', // Default password
                    phone,
                    role: 'tenant',
                    isActive: true,
                });

                console.log(`   ✅ Created tenant: ${firstName} ${lastName}`);
                console.log(`      Email: ${email}`);
                console.log(`      Phone: ${phone}`);
                createdTenants++;
            }

            // Check if lease already exists for this unit
            const existingLease = await Lease.findOne({
                unit: unit._id,
                status: 'active',
            });

            if (existingLease) {
                console.log(`   ⏭️  Active lease already exists for unit ${row.unit}, skipping`);
                continue;
            }

            // Create lease
            const endDate = new Date(row.endDate);
            const startDate = new Date(2025, 0, 1); // January 1, 2025

            const lease = await Lease.create({
                tenant: tenant._id,
                unit: unit._id,
                startDate,
                endDate,
                monthlyRent: row.rent || unit.monthlyRent,
                securityDeposit: row.rent || unit.monthlyRent,
                status: 'active',
                rentDueDay: 1,
                lateFeeAmount: 50,
                gracePeriodDays: 5,
            });

            console.log(`   ✅ Created lease for unit ${row.unit}`);
            console.log(`      Rent: $${lease.monthlyRent}`);
            console.log(
                `      Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
            );
            createdLeases++;
        }

        // Update manager's assigned units
        if (unitIds.length > 0) {
            await User.findByIdAndUpdate(manager._id, {
                $addToSet: { assignedUnits: { $each: unitIds } },
            });
            console.log(`\n👔 Assigned ${unitIds.length} units to manager1@sahabpm.com`);
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✨ IMPORT COMPLETED ✨');
        console.log('='.repeat(60));
        console.log(`\n📊 Summary:`);
        console.log(`   🏢 Units created: ${createdUnits}`);
        console.log(`   🏢 Units skipped (already exist): ${skippedUnits}`);
        console.log(`   👥 Tenants created: ${createdTenants}`);
        console.log(`   📋 Leases created: ${createdLeases}`);
        console.log(
            `   ⏭️  Empty units (no tenant): ${
                data.filter((d) => !d.tenant || d.tenant.trim() === '').length
            }`
        );
        console.log(`   👔 Units assigned to manager1: ${unitIds.length}`);

        console.log('\n🔑 Login Credentials:');
        console.log('   Manager:');
        console.log('      Email: manager1@sahabpm.com');
        console.log('      Password: Manager123!');
        console.log('\n   Default Tenant Password: Tenant123!');

        console.log('\n📧 Sample tenant emails:');
        data.slice(0, 5).forEach((row) => {
            if (row.tenant) {
                const { firstName, lastName } = parseName(row.tenant);
                const email = createEmail(firstName, lastName, row.unit);
                console.log(`   ${row.tenant} -> ${email}`);
            }
        });

        console.log(
            '\n✅ Import complete! You can now log in with tenant or manager credentials.\n'
        );
    } catch (error) {
        console.error('❌ Error importing data:', error);
        console.error(error.stack);
    } finally {
        mongoose.connection.close();
        process.exit();
    }
}

importRealData();
