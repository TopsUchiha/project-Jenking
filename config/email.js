import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@smokeyz-bbq.com';
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL || 'smokersandgrillsb@gmail.com';
const BUSINESS_NAME = process.env.BUSINESS_NAME || 'Smokeyz BBQ';

if (!SENDGRID_API_KEY) {
  console.warn('[EMAIL] WARNING: SENDGRID_API_KEY not set. Email features disabled.');
}

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function sendOrderConfirmation(customer, order, items) {
  if (!SENDGRID_API_KEY) return false;
  
  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHTML(item.product_name)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">Qty: ${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price_at_purchase * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Inter, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #c4622d; margin-bottom: 20px;">Order Confirmation</h1>
          
          <p>Hello ${escapeHTML(customer.full_name)},</p>
          <p>Your order has been received. We will be in touch shortly with a payment link.</p>
          
          <div style="background: #f5f3f0; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="color: #2a2a2a; margin-top: 0;">Order Details</h3>
            <p><strong>Order Number:</strong> #${String(order.id).padStart(6, '0')}</p>
            <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #2a2a2a; color: white;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Quantity</th>
                <th style="padding: 10px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>${itemsHTML}</tbody>
          </table>
          
          <div style="text-align: right; padding: 10px 0;">
            <p><strong>Subtotal:</strong> $${order.subtotal.toFixed(2)}</p>
            <p><strong>Tax:</strong> $${order.tax.toFixed(2)}</p>
            <p><strong>Shipping:</strong> $${order.shipping.toFixed(2)}</p>
            <h3 style="color: #c4622d; border-top: 2px solid #eee; padding-top: 10px;">Total: $${order.total.toFixed(2)}</h3>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <h4>Next Steps</h4>
            <p>Our team will review your custom smoker requirements and send you a payment link within 24 hours.</p>
            <p>Questions? Contact us at ${escapeHTML(BUSINESS_EMAIL)}</p>
          </div>
          
          <footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            <p>&copy; ${new Date().getFullYear()} ${BUSINESS_NAME}. All rights reserved.</p>
          </footer>
        </div>
      </body>
    </html>
  `;

  try {
    await sgMail.send({
      to: customer.email,
      from: SENDER_EMAIL,
      subject: `Order Confirmation #${String(order.id).padStart(6, '0')} - ${BUSINESS_NAME}`,
      html
    });
    return true;
  } catch (err) {
    console.error('[EMAIL] Order confirmation failed:', err.message);
    return false;
  }
}

export async function sendPaymentLink(customer, order, paymentLink, paymentMethod) {
  if (!SENDGRID_API_KEY) return false;

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Inter, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #c4622d; margin-bottom: 20px;">Payment Required</h1>
          
          <p>Hello ${escapeHTML(customer.full_name)},</p>
          <p>Your custom smoker is ready for payment. Click the button below to complete your purchase:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${escapeHTML(paymentLink)}" style="display: inline-block; background: #c4622d; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: 600;">Pay Now: $${order.total.toFixed(2)}</a>
          </div>
          
          <div style="background: #f5f3f0; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4 style="color: #2a2a2a; margin-top: 0;">Order Summary</h4>
            <p><strong>Order Number:</strong> #${String(order.id).padStart(6, '0')}</p>
            <p><strong>Total Amount:</strong> $${order.total.toFixed(2)}</p>
            <p><strong>Payment Method:</strong> ${escapeHTML(paymentMethod)}</p>
          </div>
          
          <p><strong>Important:</strong> This link expires in 30 days. If you do not complete payment by then, please contact us to renew the link.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <h4>Questions?</h4>
            <p>Contact us at ${escapeHTML(BUSINESS_EMAIL)} or call ${process.env.BUSINESS_PHONE || 'N/A'}</p>
          </div>
          
          <footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            <p>&copy; ${new Date().getFullYear()} ${BUSINESS_NAME}. All rights reserved.</p>
          </footer>
        </div>
      </body>
    </html>
  `;

  try {
    await sgMail.send({
      to: customer.email,
      cc: BUSINESS_EMAIL,
      from: SENDER_EMAIL,
      subject: `Payment Link for Order #${String(order.id).padStart(6, '0')} - ${BUSINESS_NAME}`,
      html
    });
    return true;
  } catch (err) {
    console.error('[EMAIL] Payment link failed:', err.message);
    return false;
  }
}

export async function sendAdminNotification(subject, htmlContent) {
  if (!SENDGRID_API_KEY) return false;

  try {
    await sgMail.send({
      to: BUSINESS_EMAIL,
      from: SENDER_EMAIL,
      subject: `[${BUSINESS_NAME}] ${subject}`,
      html: htmlContent
    });
    return true;
  } catch (err) {
    console.error('[EMAIL] Admin notification failed:', err.message);
    return false;
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
