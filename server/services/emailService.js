const nodemailer = require('nodemailer');
const { logger } = require('../logger');
const storageService = require('./storageService');
const Document = require('../../models/Document');

class EmailService {
    constructor() {
        this.transporter = this.createTransporter();
    }

    createTransporter() {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
    }

    async sendPasswordResetEmail(user, resetURL) {
        try {
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p>Hi ${user.firstName},</p>
                    <p>You requested to reset your password. Please click the button below to reset it:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetURL}" style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="color: #3b82f6; word-break: break-all;">${resetURL}</p>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="color: #666; font-size: 12px;">This is an automated email. Please do not reply to this message.</p>
                </div>
            `;

            await this.transporter.sendMail({
                from: `"${process.env.APP_NAME || 'Sahab Property Management'}" <${
                    process.env.EMAIL_USER
                }>`,
                to: user.email,
                subject: 'Reset Your Password',
                html,
            });

            logger.info(`Password reset email sent to ${user.email}`);
        } catch (error) {
            logger.error(`Failed to send reset email: ${error.message}`);
            throw error;
        }
    }

    async sendRentPaymentConfirmation(tenant, payment, lease) {
        try {
            const paymentDate = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #d0a764; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0; text-align: center;">Payment Received</h2>
                    </div>
                    
                    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
                        <p>Dear ${tenant.firstName},</p>
                        
                        <p>Your rent payment has been successfully processed.</p>
                        
                        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">Payment Details</h3>
                            <table style="width: 100%;">
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Amount:</strong></td>
                                    <td>$${payment.amount.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Unit:</strong></td>
                                    <td>${lease.unit.unitNumber}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Payment Date:</strong></td>
                                    <td>${paymentDate}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Transaction ID:</strong></td>
                                    <td style="font-family: monospace;">${
                                        payment.transactionId
                                    }</td>
                                </tr>
                            </table>
                        </div>
                        
                        <p>Please keep this email for your records.</p>
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                        
                        <p style="color: #6b7280; font-size: 14px;">
                            PM Property Management<br>
                            If you have questions, contact us at ${
                                process.env.SUPPORT_EMAIL || 'support@sahabpm.com'
                            }
                        </p>
                    </div>
                </div>
            `;

            await this.transporter.sendMail({
                from: `"PM" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: `Rent Payment Confirmation - Unit ${lease.unit.unitNumber}`,
                html,
            });

            logger.info(`Rent payment confirmation sent to ${tenant.email}`);
        } catch (error) {
            logger.error(`Failed to send rent payment email: ${error.message}`);
        }
    }

    async sendServiceRequestConfirmation(tenant, serviceRequest, payment) {
        try {
            const requestDate = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #d0a764; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0; text-align: center;">Service Request Submitted</h2>
                    </div>
                    
                    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
                        <p>Dear ${tenant.firstName},</p>
                        
                        <p>Your service request has been successfully submitted and the $10 service fee has been processed.</p>
                        
                        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">Request Details</h3>
                            <table style="width: 100%;">
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Title:</strong></td>
                                    <td>${serviceRequest.title}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Category:</strong></td>
                                    <td>${serviceRequest.category.replace('_', ' ')}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Priority:</strong></td>
                                    <td>${serviceRequest.priority}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Service Fee:</strong></td>
                                    <td>$10.00</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Request ID:</strong></td>
                                    <td style="font-family: monospace;">${serviceRequest._id}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <p><strong>Description:</strong><br>${serviceRequest.description}</p>
                        
                        <p style="margin-top: 20px;">Our maintenance team will review your request and contact you within 24-48 hours.</p>
                        
                        ${
                            serviceRequest.priority === 'emergency'
                                ? '<p style="color: #ef4444;"><strong>For emergencies, please also call: (555) 123-4567</strong></p>'
                                : ''
                        }
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                        
                        <p style="color: #6b7280; font-size: 14px;">
                            PM Property Management<br>
                            Track your request status in your tenant dashboard
                        </p>
                    </div>
                </div>
            `;

            await this.transporter.sendMail({
                from: `"PM" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: `Service Request Received - ${serviceRequest.title}`,
                html,
            });

            logger.info(`Service request confirmation sent to ${tenant.email}`);
        } catch (error) {
            logger.error(`Failed to send service request email: ${error.message}`);
        }
    }

    async sendLeaseDocument(tenant, lease, unit) {
        try {
            // Fetch the document record to get the filename
            const document = await Document.findById(lease.document);
            if (!document || !document.fileName) {
                throw new Error('Lease document not found');
            }

            // Download the file from Supabase
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

            const { data: fileData, error } = await supabase.storage
                .from('sahabpm')
                .download(document.fileName);

            if (error) throw error;

            // Convert blob to buffer for nodemailer
            const buffer = Buffer.from(await fileData.arrayBuffer());

            // Format dates
            const startDate = new Date(lease.startDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            const endDate = new Date(lease.endDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #d0a764; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0; text-align: center;">Your Lease Agreement</h2>
                    </div>
                    
                    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
                        <p>Dear ${tenant.firstName} ${tenant.lastName},</p>
                        
                        <p>Please find attached your lease agreement for the following property:</p>
                        
                        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #555;">Property Details</h3>
                            <table style="width: 100%;">
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Unit Number:</strong></td>
                                    <td>${unit.unitNumber}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Address:</strong></td>
                                    <td>${unit.streetAddress}, ${unit.city}, ${unit.state} ${
                unit.zipCode
            }</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Type:</strong></td>
                                    <td>${unit.propertyType}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Bedrooms/Bathrooms:</strong></td>
                                    <td>${unit.bedrooms} bed, ${unit.bathrooms} bath</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #0369a1;">Lease Terms</h3>
                            <table style="width: 100%;">
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Lease Period:</strong></td>
                                    <td>${startDate} - ${endDate}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Monthly Rent:</strong></td>
                                    <td>$${lease.monthlyRent.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Security Deposit:</strong></td>
                                    <td>$${lease.securityDeposit.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0;"><strong>Rent Due Day:</strong></td>
                                    <td>${lease.rentDueDay}${
                lease.rentDueDay === 1
                    ? 'st'
                    : lease.rentDueDay === 2
                    ? 'nd'
                    : lease.rentDueDay === 3
                    ? 'rd'
                    : 'th'
            } of each month</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                            <p style="margin: 0;"><strong>Important:</strong> 
                            ${
                                lease.status === 'pending'
                                    ? 'This lease is pending your signature. Please contact our office to complete the signing process.'
                                    : ''
                            }
                            ${
                                lease.status === 'active'
                                    ? 'This is your active lease agreement. Please keep it for your records.'
                                    : ''
                            }
                            </p>
                        </div>
                        
                        <p>You can access your lease agreement and other documents anytime by logging into your tenant portal:</p>
                        
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="${
                                process.env.PORTAL_URL || 'http://localhost:3000'
                            }/tenant/dashboard" 
                            style="background: #d0a764; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Access Tenant Portal
                            </a>
                        </div>
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                        
                        <p style="color: #6b7280; font-size: 14px;">
                            PM Property Management<br>
                            ${
                                process.env.SUPPORT_EMAIL
                                    ? `Email: ${process.env.SUPPORT_EMAIL}`
                                    : 'support@sahabpm.com'
                            }<br>
                            ${
                                process.env.COMPANY_PHONE
                                    ? `Phone: ${process.env.COMPANY_PHONE}`
                                    : ''
                            }
                        </p>
                    </div>
                </div>
            `;

            await this.transporter.sendMail({
                from: `"PM" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: `Lease Agreement - Unit ${unit.unitNumber}`,
                html,
                attachments: [
                    {
                        filename: `Lease_Agreement_Unit_${unit.unitNumber}.pdf`,
                        content: buffer,
                        contentType: 'application/pdf',
                    },
                ],
            });

            logger.info(`Lease document sent to ${tenant.email} for Unit ${unit.unitNumber}`);
        } catch (error) {
            logger.error(`Failed to send lease document email: ${error.message}`);
            throw error;
        }
    }

    async sendCredentialsEmail(tenant, password) {
        try {
            const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #d0a764; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0; text-align: center;">Welcome to PM</h2>
                </div>
                
                <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
                    <p>Dear ${tenant.firstName},</p>

                    <p>Your account has been created successfully. Below are your login credentials:</p>

                    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Portal URL:</strong> ${
                            process.env.PORTAL_URL || 'http://localhost:3000'
                        }</p>
                        <p><strong>Email:</strong> ${tenant.email}</p>
                        <p><strong>Temporary Password:</strong> ${password}</p>
                    </div>

                    <p><strong>Note:</strong> You’ll be required to change your password on first login.</p>

                    <div style="text-align: center; margin: 25px 0;">
                        <a href="${process.env.PORTAL_URL || 'http://localhost:3000'}" 
                            style="background: #d0a764; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Login Now
                        </a>
                    </div>

                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

                    <p style="color: #6b7280; font-size: 14px;">
                        PM Property Management<br>
                        ${process.env.SUPPORT_EMAIL || 'support@sahabpm.com'}
                    </p>
                </div>
            </div>
        `;

            await this.transporter.sendMail({
                from: `"PM" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: 'Your PM Login Credentials',
                html,
            });

            logger.info(`Credentials email sent to ${tenant.email}`);
        } catch (error) {
            logger.error(`Failed to send credentials email: ${error.message}`);
            throw error;
        }
    }

    async sendPaymentReminderEmail(tenant, lease, daysOverdue) {
        // Implementation for payment reminders
    }

    async sendServiceRequestUpdateEmail(tenant, serviceRequest, update) {
        // Implementation for service request updates
    }
}

module.exports = new EmailService();
