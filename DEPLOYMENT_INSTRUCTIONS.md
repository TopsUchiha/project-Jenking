# SMOKEYZ BBQ - DEPLOYMENT GUIDE

## Architecture Overview

This is an **enterprise-grade e-commerce platform** built with:
- **Backend:** Node.js + Express (security-hardened per secure-web-builder)
- **Database:** SQLite with parameterized queries (SQL injection proof)
- **Frontend:** Vanilla HTML/CSS/JS with professional design (Taste Skill + Frontend-Design)
- **Security:** JWT auth, bcrypt, Helmet CSP, CORS, rate limiting, input validation, XSS prevention
- **Payments:** Stripe, PayPal, Venmo, Cash App, Chime (admin can add/remove)
- **Email:** SendGrid integration for order notifications
- **Hosting:** Vercel (no cold starts, always on)

## Local Development (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys

# 3. Start server (http://localhost:3000)
npm run dev
```

## Vercel Deployment (3 minutes)

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial: Smokeyz BBQ e-commerce platform"
git remote add origin https://github.com/YOUR_USERNAME/smokeyz-bbq
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Add environment variables (from .env.local):
   - JWT_SECRET
   - SENDGRID_API_KEY
   - STRIPE_SECRET_KEY (optional)
   - PAYPAL_CLIENT_ID (optional)
   - etc.
4. Click Deploy

### Step 3: Add Custom Domain (GoDaddy)

1. In Vercel dashboard, go to Project Settings > Domains
2. Add your GoDaddy domain (e.g., smokeyz-bbq.com)
3. Update GoDaddy DNS records per Vercel instructions
4. DNS propagates in 24 hours

## Key Environment Variables

```
JWT_SECRET              - Session token secret (min 32 chars)
SENDGRID_API_KEY        - Email service API key
STRIPE_SECRET_KEY       - Stripe payments (optional)
PAYPAL_CLIENT_ID        - PayPal payments (optional)
ADMIN_EMAIL             - Admin login email
ADMIN_PASSWORD          - Admin login password (hashed on first boot)
BUSINESS_*              - Your business information
```

## First-Time Admin Setup

After deployment, log in with:
- **Email:** Value from ADMIN_EMAIL
- **Password:** Value from ADMIN_PASSWORD

**Change password immediately after login** (in admin settings).

## Admin Dashboard Features

- **Products:** Add, edit, delete smokers + set customization options
- **Orders:** View all orders, filter by status, send payment links
- **Customers:** Search customers, view order history
- **Inventory:** Track stock levels, get low-stock alerts
- **Payment Methods:** Enable/disable Stripe, PayPal, Venmo, Cash App, Chime
- **Settings:** Update business info, manage payment config

## Payment Flow

1. Customer browses products → adds to cart → checkout
2. Enters contact info → selects payment method → creates order
3. Admin receives notification
4. Admin generates payment link (Stripe/PayPal or manual for Venmo/Cash App)
5. Admin emails payment link to customer
6. Customer pays
7. Webhook confirms payment (Stripe/PayPal auto-update)
8. Order status updates → admin builds smoker
9. Admin marks order as "Shipped" → customer notified

## Security Checklist

- [x] Parameterized SQL queries (no SQL injection)
- [x] XSS prevention (all user input escaped)
- [x] CSRF tokens on forms
- [x] Rate limiting on endpoints
- [x] Helmet CSP headers
- [x] JWT authentication (admin only)
- [x] Bcrypt password hashing
- [x] Input validation (server + client)
- [x] HTTPS/SSL (automatic via Vercel)
- [x] No hardcoded secrets
- [x] Error handling (no stack traces to users)

## Troubleshooting

**Admin login not working:**
- Verify ADMIN_EMAIL and ADMIN_PASSWORD in .env
- Check JWT_SECRET is set (min 32 chars)

**Emails not sending:**
- Verify SENDGRID_API_KEY is correct
- Check sender domain is verified in SendGrid dashboard

**Payment links not working:**
- For Stripe: verify STRIPE_SECRET_KEY in env
- For PayPal: verify PAYPAL_CLIENT_ID and PAYPAL_SECRET
- For manual methods: payment links work out of the box

**Products not showing:**
- Check database is initialized (first run creates tables)
- Verify products added via admin dashboard

**Deployment errors:**
- Check all env vars are set in Vercel
- Run `npm run dev` locally to test first
- Check build logs in Vercel dashboard

## Support

- **Secure-web-builder skill:** All backend security
- **Frontend-design skill:** Professional UI/UX
- **Taste skill:** Premium design patterns
- Full source code included (no black boxes)

## Next Steps

1. Get API keys:
   - Stripe: https://dashboard.stripe.com
   - SendGrid: https://sendgrid.com
   - PayPal: https://www.paypal.com/signin

2. Add sample products via admin

3. Test checkout flow locally

4. Deploy to Vercel

5. Point custom domain

6. Go live!

