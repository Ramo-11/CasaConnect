const mongoose = require('mongoose');
const User = require('../models/User');
const Unit = require('../models/Unit');
const Lease = require('../models/Lease');
const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
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

async function createComprehensiveTestData() {
    try {
        console.log('🚀 Starting comprehensive test data creation...\n');

        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await User.deleteMany({});
        await Unit.deleteMany({});
        await Lease.deleteMany({});
        await Payment.deleteMany({});
        await ServiceRequest.deleteMany({});
        console.log('✅ Existing data cleared\n');

        // 1. Create Admin
        console.log('👑 Creating admin user...');
        const admin = await User.create({
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@sahabpm.com',
            password: 'Admin123!',
            phone: '(317) 555-0001',
            role: 'manager',
            isActive: true,
        });
        console.log('✅ Admin created:', admin.email);

        // 2. Create Units (30 units)
        console.log('\n🏢 Creating 30 units...');
        const buildings = ['Building A', 'Building B', 'Building C'];
        const propertyTypes = ['apartment', 'studio', 'townhouse', 'condo'];
        const units = [];

        for (let i = 1; i <= 30; i++) {
            const building = buildings[Math.floor((i - 1) / 10)];
            const unitNumber = `${String.fromCharCode(65 + Math.floor((i - 1) / 10))}${String(
                i
            ).padStart(2, '0')}`;
            const bedrooms = [0, 1, 1, 2, 2, 2, 3, 3][Math.floor(Math.random() * 8)];
            const bathrooms = bedrooms === 0 ? 1 : Math.min(bedrooms, 2);
            const squareFeet = bedrooms === 0 ? 450 : 500 + bedrooms * 300;
            const monthlyRent = bedrooms === 0 ? 700 : 800 + bedrooms * 350;

            units.push({
                unitNumber,
                streetAddress: `${1000 + i * 10} Main Street`,
                city: 'Indianapolis',
                state: 'IN',
                zipCode: '46201',
                building,
                propertyType: propertyTypes[Math.floor(Math.random() * propertyTypes.length)],
                bedrooms,
                bathrooms,
                squareFeet,
                monthlyRent,
                amenities: [
                    'Central AC',
                    'Heating',
                    ...(bedrooms >= 2 ? ['Dishwasher', 'Washer/Dryer'] : []),
                    ...(Math.random() > 0.5 ? ['Parking'] : []),
                ],
            });
        }

        const createdUnits = await Unit.create(units);
        console.log(`✅ Created ${createdUnits.length} units`);

        // 3. Create Restricted Managers and assign units
        console.log('\n👔 Creating 2 restricted managers...');
        const manager1Units = createdUnits.slice(0, 12).map((u) => u._id);
        const manager2Units = createdUnits.slice(12, 24).map((u) => u._id);

        const manager1 = await User.create({
            firstName: 'Manager',
            lastName: 'One',
            email: 'manager1@sahabpm.com',
            password: 'Manager123!',
            phone: '(317) 555-0002',
            role: 'restricted_manager',
            isActive: true,
            assignedUnits: manager1Units,
        });

        const manager2 = await User.create({
            firstName: 'Manager',
            lastName: 'Two',
            email: 'manager2@sahabpm.com',
            password: 'Manager123!',
            phone: '(317) 555-0003',
            role: 'restricted_manager',
            isActive: true,
            assignedUnits: manager2Units,
        });

        console.log('✅ Manager 1 created:', manager1.email, '- Units: 0-11');
        console.log('✅ Manager 2 created:', manager2.email, '- Units: 12-23');

        // 4. Create Tenants (25 tenants)
        console.log('\n👥 Creating 25 tenants...');
        const firstNames = [
            'John',
            'Jane',
            'Michael',
            'Sarah',
            'David',
            'Emily',
            'Robert',
            'Lisa',
            'William',
            'Jennifer',
            'James',
            'Mary',
            'Christopher',
            'Patricia',
            'Daniel',
            'Linda',
            'Matthew',
            'Barbara',
            'Anthony',
            'Elizabeth',
            'Mark',
            'Susan',
            'Donald',
            'Jessica',
            'Steven',
        ];
        const lastNames = [
            'Smith',
            'Johnson',
            'Williams',
            'Brown',
            'Jones',
            'Garcia',
            'Miller',
            'Davis',
            'Rodriguez',
            'Martinez',
            'Hernandez',
            'Lopez',
            'Gonzalez',
            'Wilson',
            'Anderson',
            'Thomas',
            'Taylor',
            'Moore',
            'Jackson',
            'Martin',
            'Lee',
            'Thompson',
            'White',
            'Harris',
            'Clark',
        ];

        const tenants = [];
        for (let i = 0; i < 25; i++) {
            const isActive = i < 23; // 2 inactive tenants
            tenants.push({
                firstName: firstNames[i],
                lastName: lastNames[i],
                email: `tenant${i + 1}@example.com`,
                password: 'Tenant123!',
                phone: `(317) 555-${String(1000 + i).padStart(4, '0')}`,
                role: 'tenant',
                isActive,
                suspendedAt: !isActive ? new Date(2024, 8, 15) : null,
                suspendedBy: !isActive ? admin._id : null,
            });
        }

        const createdTenants = await User.create(tenants);
        console.log(
            `✅ Created ${createdTenants.length} tenants (${
                createdTenants.filter((t) => t.isActive).length
            } active, ${createdTenants.filter((t) => !t.isActive).length} suspended)`
        );

        // 5. Create Leases
        console.log('\n📋 Creating leases...');
        const currentYear = new Date().getFullYear();
        const leases = [];

        // Active leases (18 tenants with active leases)
        for (let i = 0; i < 18; i++) {
            const tenant = createdTenants[i];
            const unit = createdUnits[i];
            const startMonth = Math.floor(Math.random() * 6); // Started 0-5 months ago

            leases.push({
                tenant: tenant._id,
                unit: unit._id,
                startDate: new Date(currentYear, startMonth, 1),
                endDate: new Date(currentYear + 1, startMonth, 0), // 1 year lease
                monthlyRent: unit.monthlyRent,
                securityDeposit: unit.monthlyRent,
                status: 'active',
                rentDueDay: 1,
                lateFeeAmount: 50,
                gracePeriodDays: 5,
            });
        }

        // Expired leases (2 tenants with expired leases)
        for (let i = 18; i < 20; i++) {
            const tenant = createdTenants[i];
            const unit = createdUnits[i];

            leases.push({
                tenant: tenant._id,
                unit: unit._id,
                startDate: new Date(currentYear - 1, 0, 1),
                endDate: new Date(currentYear, 2, 31), // Ended in March
                monthlyRent: unit.monthlyRent,
                securityDeposit: unit.monthlyRent,
                status: 'expired',
                rentDueDay: 1,
                lateFeeAmount: 50,
                gracePeriodDays: 5,
            });
        }

        // Terminated leases (2 tenants with terminated leases)
        for (let i = 20; i < 22; i++) {
            const tenant = createdTenants[i];
            const unit = createdUnits[i];

            leases.push({
                tenant: tenant._id,
                unit: unit._id,
                startDate: new Date(currentYear, 0, 1),
                endDate: new Date(currentYear + 1, 0, 0),
                monthlyRent: unit.monthlyRent,
                securityDeposit: unit.monthlyRent,
                status: 'terminated',
                terminatedAt: new Date(currentYear, 5, 15),
                terminatedBy: admin._id,
                rentDueDay: 1,
                lateFeeAmount: 50,
                gracePeriodDays: 5,
                notes: 'Lease terminated due to violation of terms',
            });
        }

        const createdLeases = await Lease.create(leases);
        console.log(`✅ Created ${createdLeases.length} leases:`);
        console.log(`   - Active: ${createdLeases.filter((l) => l.status === 'active').length}`);
        console.log(`   - Expired: ${createdLeases.filter((l) => l.status === 'expired').length}`);
        console.log(
            `   - Terminated: ${createdLeases.filter((l) => l.status === 'terminated').length}`
        );
        console.log(`   - Unassigned units: ${createdUnits.length - createdLeases.length}`);
        console.log(`   - Tenants without leases: ${createdTenants.length - createdLeases.length}`);

        // 6. Create Payments
        console.log('\n💰 Creating payment records...');
        const currentMonth = new Date().getMonth() + 1;
        const payments = [];

        // Create varied payment patterns for active leases
        for (let i = 0; i < 18; i++) {
            const lease = createdLeases[i];
            const startMonth = new Date(lease.startDate).getMonth() + 1;

            for (let month = startMonth; month <= currentMonth; month++) {
                const paymentScenario = i % 6;

                switch (paymentScenario) {
                    case 0: // Always pays on time
                        if (month < currentMonth) {
                            payments.push({
                                tenant: lease.tenant,
                                unit: lease.unit,
                                type: 'rent',
                                amount: lease.monthlyRent,
                                paymentMethod: 'ach',
                                status: 'completed',
                                month,
                                year: currentYear,
                                paidDate: new Date(currentYear, month - 1, 1),
                                transactionId: `TXN-${Date.now()}-${Math.random()
                                    .toString(36)
                                    .substr(2, 9)}`,
                            });
                        }
                        break;

                    case 1: // Missed one payment
                        if (month !== startMonth + 2 && month < currentMonth) {
                            payments.push({
                                tenant: lease.tenant,
                                unit: lease.unit,
                                type: 'rent',
                                amount: lease.monthlyRent,
                                paymentMethod: 'credit_card',
                                status: 'completed',
                                month,
                                year: currentYear,
                                paidDate: new Date(currentYear, month - 1, 5),
                                transactionId: `TXN-${Date.now()}-${Math.random()
                                    .toString(36)
                                    .substr(2, 9)}`,
                            });
                        }
                        break;

                    case 2: // Partial payments
                        if (month < currentMonth) {
                            const amount =
                                month === startMonth + 1
                                    ? lease.monthlyRent * 0.6
                                    : lease.monthlyRent;
                            payments.push({
                                tenant: lease.tenant,
                                unit: lease.unit,
                                type: 'rent',
                                amount,
                                paymentMethod: 'cash',
                                status: 'completed',
                                month,
                                year: currentYear,
                                paidDate: new Date(currentYear, month - 1, 10),
                                transactionId: `TXN-${Date.now()}-${Math.random()
                                    .toString(36)
                                    .substr(2, 9)}`,
                            });
                        }
                        break;

                    case 3: // Late payments
                        if (month < currentMonth) {
                            payments.push({
                                tenant: lease.tenant,
                                unit: lease.unit,
                                type: 'rent',
                                amount: lease.monthlyRent,
                                paymentMethod: 'debit_card',
                                status: 'completed',
                                month,
                                year: currentYear,
                                paidDate: new Date(currentYear, month - 1, 15),
                                transactionId: `TXN-${Date.now()}-${Math.random()
                                    .toString(36)
                                    .substr(2, 9)}`,
                            });

                            // Add late fee
                            if (month > startMonth) {
                                payments.push({
                                    tenant: lease.tenant,
                                    unit: lease.unit,
                                    type: 'late_fee',
                                    amount: 50,
                                    paymentMethod: 'debit_card',
                                    status: 'completed',
                                    month,
                                    year: currentYear,
                                    paidDate: new Date(currentYear, month - 1, 15),
                                    transactionId: `TXN-${Date.now()}-${Math.random()
                                        .toString(36)
                                        .substr(2, 9)}`,
                                });
                            }
                        }
                        break;

                    case 4: // Missing recent months
                        if (month < currentMonth - 1) {
                            payments.push({
                                tenant: lease.tenant,
                                unit: lease.unit,
                                type: 'rent',
                                amount: lease.monthlyRent,
                                paymentMethod: 'check',
                                status: 'completed',
                                month,
                                year: currentYear,
                                paidDate: new Date(currentYear, month - 1, 3),
                                transactionId: `TXN-${Date.now()}-${Math.random()
                                    .toString(36)
                                    .substr(2, 9)}`,
                            });
                        }
                        break;

                    case 5: // Mostly good, one partial
                        if (month < currentMonth) {
                            const amount =
                                month === startMonth + 3
                                    ? lease.monthlyRent * 0.75
                                    : lease.monthlyRent;
                            payments.push({
                                tenant: lease.tenant,
                                unit: lease.unit,
                                type: 'rent',
                                amount,
                                paymentMethod: 'ach',
                                status: 'completed',
                                month,
                                year: currentYear,
                                paidDate: new Date(currentYear, month - 1, 2),
                                transactionId: `TXN-${Date.now()}-${Math.random()
                                    .toString(36)
                                    .substr(2, 9)}`,
                            });
                        }
                        break;
                }
            }
        }

        await Payment.create(payments);
        console.log(`✅ Created ${payments.length} payment records`);

        // 7. Create Service Requests
        console.log('\n🔧 Creating service requests...');
        const categories = [
            'electrical',
            'plumbing',
            'hvac',
            'appliance',
            'general_repair',
            'other',
        ];
        const priorities = ['low', 'medium', 'high', 'emergency'];
        const statuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
        const locations = [
            'kitchen',
            'living_room',
            'bedroom_master',
            'bedroom_other',
            'bathroom_master',
            'bathroom_other',
            'laundry',
            'exterior',
        ];

        const serviceRequestTemplates = [
            {
                category: 'plumbing',
                titles: [
                    'Leaky faucet in kitchen',
                    'Clogged bathroom sink',
                    'Running toilet',
                    'Low water pressure',
                ],
                description:
                    'The {location} has a {issue} that needs attention. It started {timeframe} and is getting worse.',
            },
            {
                category: 'electrical',
                titles: [
                    'Outlet not working',
                    'Light fixture flickering',
                    'Circuit breaker keeps tripping',
                    'Light switch broken',
                ],
                description:
                    'There is an electrical issue in the {location}. {details} This is a safety concern.',
            },
            {
                category: 'hvac',
                titles: [
                    'AC not cooling properly',
                    'Heater not working',
                    'Strange noise from HVAC',
                    'Thermostat malfunction',
                ],
                description:
                    'The {system} is not functioning correctly. {details} The temperature is uncomfortable.',
            },
            {
                category: 'appliance',
                titles: [
                    'Refrigerator not cooling',
                    'Dishwasher not draining',
                    'Oven not heating',
                    'Washing machine leaking',
                ],
                description:
                    'The {appliance} in the {location} is malfunctioning. {details} This is affecting daily activities.',
            },
            {
                category: 'general_repair',
                titles: [
                    'Door handle broken',
                    "Window won't close",
                    'Cabinet door loose',
                    'Loose floor tile',
                ],
                description: 'There is damage to the {item} in the {location}. {details}',
            },
        ];

        const serviceRequests = [];

        // Create 40 service requests with varied statuses
        for (let i = 0; i < 40; i++) {
            const tenant = createdTenants[i % 18]; // Only use tenants with active leases
            const lease = createdLeases.find((l) => l.tenant.toString() === tenant._id.toString());

            if (!lease) continue;

            const template =
                serviceRequestTemplates[Math.floor(Math.random() * serviceRequestTemplates.length)];
            const title = template.titles[Math.floor(Math.random() * template.titles.length)];
            const location = locations[Math.floor(Math.random() * locations.length)];
            const priority = priorities[Math.floor(Math.random() * priorities.length)];

            let status;
            if (i < 8) status = 'pending';
            else if (i < 15) status = 'assigned';
            else if (i < 22) status = 'in_progress';
            else if (i < 35) status = 'completed';
            else status = 'cancelled';

            const daysAgo = Math.floor(Math.random() * 30) + 1;
            const createdDate = new Date();
            createdDate.setDate(createdDate.getDate() - daysAgo);

            const request = {
                tenant: tenant._id,
                unit: lease.unit,
                category: template.category,
                priority,
                title,
                description: `Issue with ${title.toLowerCase()} in the ${location.replace(
                    '_',
                    ' '
                )}. This needs to be addressed soon.`,
                status,
                location,
                fee: 10,
                isPaid: status === 'completed' && Math.random() > 0.3,
                createdAt: createdDate,
                updatedAt: createdDate,
            };

            if (status === 'completed') {
                request.completedAt = new Date(createdDate.getTime() + 3 * 24 * 60 * 60 * 1000);
                request.paymentDate = request.isPaid ? request.completedAt : null;
            }

            if (status !== 'pending' && status !== 'cancelled') {
                // Assign to manager for assigned/in_progress/completed
                request.assignedTo = Math.random() > 0.5 ? manager1._id : manager2._id;
                request.assignedBy = admin._id;
            }

            if (Math.random() > 0.7) {
                request.notes = [
                    {
                        author: admin._id,
                        content: 'Initial inspection completed. Scheduling repair.',
                        createdAt: new Date(createdDate.getTime() + 24 * 60 * 60 * 1000),
                    },
                ];
            }

            serviceRequests.push(request);
        }

        await ServiceRequest.create(serviceRequests);
        console.log(`✅ Created ${serviceRequests.length} service requests:`);
        console.log(
            `   - Pending: ${serviceRequests.filter((r) => r.status === 'pending').length}`
        );
        console.log(
            `   - Assigned: ${serviceRequests.filter((r) => r.status === 'assigned').length}`
        );
        console.log(
            `   - In Progress: ${serviceRequests.filter((r) => r.status === 'in_progress').length}`
        );
        console.log(
            `   - Completed: ${serviceRequests.filter((r) => r.status === 'completed').length}`
        );
        console.log(
            `   - Cancelled: ${serviceRequests.filter((r) => r.status === 'cancelled').length}`
        );

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✨ COMPREHENSIVE TEST DATA CREATED SUCCESSFULLY ✨');
        console.log('='.repeat(60));

        console.log('\n📊 Summary:');
        console.log(`   👑 Admin: 1`);
        console.log(`   👔 Restricted Managers: 2`);
        console.log(`   🏢 Units: ${createdUnits.length}`);
        console.log(
            `      - With active leases: ${
                createdLeases.filter((l) => l.status === 'active').length
            }`
        );
        console.log(`      - Available: ${createdUnits.length - createdLeases.length}`);
        console.log(`   👥 Tenants: ${createdTenants.length}`);
        console.log(`      - Active: ${createdTenants.filter((t) => t.isActive).length}`);
        console.log(`      - Suspended: ${createdTenants.filter((t) => !t.isActive).length}`);
        console.log(
            `      - With active leases: ${
                createdLeases.filter((l) => l.status === 'active').length
            }`
        );
        console.log(
            `      - Without leases: ${
                createdTenants.length - createdLeases.filter((l) => l.status === 'active').length
            }`
        );
        console.log(`   📋 Leases: ${createdLeases.length}`);
        console.log(`      - Active: ${createdLeases.filter((l) => l.status === 'active').length}`);
        console.log(
            `      - Expired: ${createdLeases.filter((l) => l.status === 'expired').length}`
        );
        console.log(
            `      - Terminated: ${createdLeases.filter((l) => l.status === 'terminated').length}`
        );
        console.log(`   💰 Payments: ${payments.length}`);
        console.log(`   🔧 Service Requests: ${serviceRequests.length}`);

        console.log('\n🔑 Login Credentials:');
        console.log('   Admin:');
        console.log('      Email: admin@sahabpm.com');
        console.log('      Password: Admin123!');
        console.log('\n   Restricted Manager 1:');
        console.log('      Email: manager1@sahabpm.com');
        console.log('      Password: Manager123!');
        console.log('      Units: A01-A12 (Building A)');
        console.log('\n   Restricted Manager 2:');
        console.log('      Email: manager2@sahabpm.com');
        console.log('      Password: Manager123!');
        console.log('      Units: B01-B12 (Building B)');
        console.log('\n   Sample Tenant:');
        console.log('      Email: tenant1@example.com');
        console.log('      Password: Tenant123!');

        console.log('\n🎯 Test Scenarios Available:');
        console.log('   ✓ Active leases with various payment patterns');
        console.log('   ✓ Expired and terminated leases');
        console.log('   ✓ Tenants without units');
        console.log('   ✓ Units without tenants');
        console.log('   ✓ Suspended tenant accounts');
        console.log('   ✓ Service requests in all statuses');
        console.log('   ✓ Partial and missed payments');
        console.log('   ✓ Late fees');
        console.log('   ✓ Restricted manager access control');

        console.log('\n✅ Ready for testing!\n');
    } catch (error) {
        console.error('❌ Error creating test data:', error);
        console.error(error.stack);
    } finally {
        mongoose.connection.close();
        process.exit();
    }
}

createComprehensiveTestData();
