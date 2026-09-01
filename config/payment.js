import Stripe from 'stripe';
import paypal from 'paypal-rest-sdk';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PAYPAL_MODE = process.env.NODE_ENV === 'production' ? 'live' : 'sandbox';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

let stripeClient = null;
if (STRIPE_SECRET_KEY) {
  stripeClient = new Stripe(STRIPE_SECRET_KEY);
}

if (PAYPAL_CLIENT_ID && PAYPAL_SECRET) {
  paypal.configure({
    mode: PAYPAL_MODE,
    client_id: PAYPAL_CLIENT_ID,
    client_secret: PAYPAL_SECRET
  });
}

// Payment method types available
export const PAYMENT_TYPES = {
  STRIPE: 'stripe',
  PAYPAL: 'paypal',
  VENMO: 'venmo',
  CASHAPP: 'cashapp',
  CHIME: 'chime',
  BANK_TRANSFER: 'bank_transfer',
  CHECK: 'check',
  OTHER: 'other'
};

export async function createStripePaymentLink(order, customer, items) {
  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  const lineItems = items.map(item => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.product_name,
        description: item.customization_selections || 'Custom smoker build'
      },
      unit_amount: Math.round(item.price_at_purchase * 100)
    },
    quantity: item.quantity
  }));

  try {
    const paymentLink = await stripeClient.paymentLinks.create({
      line_items: lineItems,
      metadata: {
        order_id: order.id,
        customer_email: customer.email
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${process.env.WEBSITE_URL || 'http://localhost:3000'}/order-confirmation?order_id=${order.id}`
        }
      }
    });

    return paymentLink.url;
  } catch (err) {
    console.error('[PAYMENT] Stripe link creation failed:', err.message);
    throw err;
  }
}

export async function createPayPalPaymentLink(order, customer, items) {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    throw new Error('PayPal not configured');
  }

  const itemList = {
    items: items.map(item => ({
      name: item.product_name,
      description: item.customization_selections || 'Custom smoker build',
      quantity: item.quantity,
      price: item.price_at_purchase.toFixed(2),
      currency: 'USD'
    }))
  };

  const payment = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal',
      payer_info: {
        email: customer.email,
        first_name: customer.full_name.split(' ')[0],
        last_name: customer.full_name.split(' ').slice(1).join(' '),
        phone: customer.phone
      }
    },
    transactions: [{
      amount: {
        total: order.total.toFixed(2),
        currency: 'USD',
        details: {
          subtotal: order.subtotal.toFixed(2),
          tax: order.tax.toFixed(2),
          shipping: order.shipping.toFixed(2)
        }
      },
      description: `Smokeyz BBQ Order #${String(order.id).padStart(6, '0')}`,
      item_list: itemList
    }],
    redirect_urls: {
      return_url: `${process.env.WEBSITE_URL || 'http://localhost:3000'}/order-confirmation?order_id=${order.id}`,
      cancel_url: `${process.env.WEBSITE_URL || 'http://localhost:3000'}/checkout?order_id=${order.id}`
    }
  };

  return new Promise((resolve, reject) => {
    paypal.payment.create(payment, (err, payment) => {
      if (err) {
        console.error('[PAYMENT] PayPal creation failed:', err.message);
        reject(err);
      } else {
        const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
        resolve(approvalUrl.href);
      }
    });
  });
}

// Venmo, Cash App, Chime require manual handling (manual payment link)
export async function generateManualPaymentLink(order, customer, paymentMethod) {
  const linkData = {
    order_id: order.id,
    customer_email: customer.email,
    amount: order.total,
    method: paymentMethod,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
  };

  // Return a simple link that shows payment instructions
  return `${process.env.WEBSITE_URL || 'http://localhost:3000'}/pay?token=${Buffer.from(JSON.stringify(linkData)).toString('base64')}`;
}

export async function generatePaymentLink(order, customer, items, paymentMethod) {
  try {
    switch (paymentMethod.toLowerCase()) {
      case 'stripe':
        return await createStripePaymentLink(order, customer, items);
      case 'paypal':
        return await createPayPalPaymentLink(order, customer, items);
      case 'venmo':
      case 'cashapp':
      case 'chime':
      case 'bank_transfer':
      case 'check':
      case 'other':
        return await generateManualPaymentLink(order, customer, paymentMethod);
      default:
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
    }
  } catch (err) {
    console.error('[PAYMENT] Link generation failed:', err.message);
    throw err;
  }
}

export async function verifyStripePayment(sessionId) {
  if (!stripeClient) return null;
  
  try {
    const session = await stripeClient.checkout.sessions.retrieve(sessionId);
    return session.payment_status === 'paid' ? session : null;
  } catch (err) {
    console.error('[PAYMENT] Stripe verification failed:', err.message);
    return null;
  }
}

export async function verifyPayPalPayment(paymentId, payerId) {
  return new Promise((resolve, reject) => {
    paypal.payment.execute(paymentId, { payer_id: payerId }, (err, payment) => {
      if (err) {
        console.error('[PAYMENT] PayPal verification failed:', err.message);
        reject(err);
      } else {
        resolve(payment.state === 'approved' ? payment : null);
      }
    });
  });
}
