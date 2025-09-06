const nodemailer = require('nodemailer');
const { logger } = require('../logger');

class EmailService {
    constructor() {
        this.transporter = this.createTransporter();
    }

    createTransporter() {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    async sendRentPaymentConfirmation(tenant, payment, lease) {
        try {
            const paymentDate = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
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
                                    <td style="font-family: monospace;">${payment.transactionId}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <p>Please keep this email for your records.</p>
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                        
                        <p style="color: #6b7280; font-size: 14px;">
                            CasaConnect Property Management<br>
                            If you have questions, contact us at ${process.env.SUPPORT_EMAIL || 'support@casaconnect.com'}
                        </p>
                    </div>
                </div>
            `;

            await this.transporter.sendMail({
                from: `"CasaConnect" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: `Rent Payment Confirmation - Unit ${lease.unit.unitNumber}`,
                html
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
                day: 'numeric'
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
                        
                        ${serviceRequest.priority === 'emergency' ? 
                            '<p style="color: #ef4444;"><strong>For emergencies, please also call: (555) 123-4567</strong></p>' : ''
                        }
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                        
                        <p style="color: #6b7280; font-size: 14px;">
                            CasaConnect Property Management<br>
                            Track your request status in your tenant dashboard
                        </p>
                    </div>
                </div>
            `;

            await this.transporter.sendMail({
                from: `"CasaConnect" <${process.env.EMAIL_USER}>`,
                to: tenant.email,
                subject: `Service Request Received - ${serviceRequest.title}`,
                html
            });

            logger.info(`Service request confirmation sent to ${tenant.email}`);
        } catch (error) {
            logger.error(`Failed to send service request email: ${error.message}`);
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