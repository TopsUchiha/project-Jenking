# Deploy Smokeyz BBQ to Vercel (bbqsmokerz.com)

## Step 1: Prepare Your Repository

### Initialize Git (if not already done)
```bash
git init
git add .
git commit -m "Initial commit: Smokeyz BBQ Express application"
```

### Push to GitHub
1. Create account at github.com
2. Create new repository "smokeyz-bbq"
3. Push your code:
```bash
git remote add origin https://github.com/YOUR_USERNAME/smokeyz-bbq.git
git branch -M main
git push -u origin main
```

## Step 2: Set Up Vercel

### Create Vercel Account
1. Go to vercel.com
2. Sign up with GitHub account
3. Authorize Vercel to access your GitHub repositories

### Import Project to Vercel
1. In Vercel dashboard, click "New Project"
2. Select your "smokeyz-bbq" repository
3. Click "Import"

### Configure Environment Variables
In Vercel project settings, add these environment variables:

```
NODE_ENV = production
JWT_SECRET = (generate: openssl rand -hex 32)
ADMIN_EMAIL = smokersandgrillsb@gmail.com
ADMIN_PASSWORD = (your secure password)
SENDGRID_API_KEY = (from SendGrid account)
SENDER_EMAIL = noreply@bbqsmokerz.com
BUSINESS_EMAIL = smokersandgrillsb@gmail.com
BUSINESS_PHONE = +1 (917) 543-0678
```

**IMPORTANT:** Keep these values secret. Never commit .env to Git.

### Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Your site will be at: https://smokeyz-bbq.vercel.app (temporary)

## Step 3: Connect Domain (bbqsmokerz.com)

### Purchase Domain
1. Go to GoDaddy, Namecheap, or your registrar
2. Search for "bbqsmokerz.com"
3. Purchase domain

### Connect Domain to Vercel

#### Option A: Update Nameservers (Recommended)
1. In Vercel project → Settings → Domains
2. Add domain "bbqsmokerz.com"
3. Vercel will show nameservers
4. Go to your domain registrar
5. Update nameservers to Vercel's:
   ```
   ns1.vercel.com
   ns2.vercel.com
   ```
6. Wait 24-48 hours for DNS propagation

#### Option B: CNAME Records (For existing registrar)
1. In Vercel project → Settings → Domains
2. Add domain "bbqsmokerz.com"
3. Select "CNAME" option
4. Go to your domain registrar
5. Add CNAME record:
   ```
   www CNAME cname.vercel-dns.com
   @ A 76.76.19.19
   ```

### Verify Domain
1. In Vercel settings, check domain status
2. Should show "Valid Configuration" within minutes
3. SSL certificate auto-generated (HTTPS enabled)

## Step 4: Set Up Cloudflare (Optional but Recommended)

Cloudflare provides:
- DDoS protection
- Global CDN (faster worldwide)
- Extra security headers
- SEO benefits

### Cloudflare Setup
1. Create account at cloudflare.com
2. Add site: bbqsmokerz.com
3. Cloudflare provides nameservers
4. Go to your domain registrar
5. Update nameservers to Cloudflare's
6. In Cloudflare dashboard:
   - SSL/TLS: Set to "Full"
   - Security: "High"
   - Performance: Enable caching
   - Rules: Add rate limiting

### Point Cloudflare to Vercel
In Cloudflare DNS settings, add:
```
CNAME record:
Name: www
Content: cname.vercel-dns.com
TTL: Auto
Proxy: Proxied (orange cloud)

A record (for root domain):
Name: @
Content: 76.76.19.19
TTL: Auto
Proxy: Proxied (orange cloud)
```

## Step 5: Initialize Database

SSH into your Vercel deployment and run:
```bash
npm run seed
```

This will:
- Create admin user with your credentials
- Add 172 customer reviews
- Set up shipping settings ($149 default)
- Create payment methods

## Step 6: Test Everything

### Test Website
1. Visit https://bbqsmokerz.com
2. Check all pages load correctly
3. Test responsive design on mobile
4. Check that images load

### Test Admin Panel
1. Visit https://bbqsmokerz.com/admin-portal
2. Login with your admin credentials
3. Test all admin features:
   - View dashboard
   - Add product
   - View orders
   - Manage customers
   - View messages
   - Update shipping fee

### Test Email
1. Fill out contact form
2. Check that:
   - Email sent to customer (confirmation)
   - Email sent to admin (notification)
   - Message appears in admin panel

### Test Security
1. Run Google PageSpeed Insights
2. Check HTTPS is active (green lock icon)
3. Verify security headers in browser DevTools

## Step 7: Set Up Google Services

### Google Search Console
1. Visit https://search.google.com/search-console
2. Add property: bbqsmokerz.com
3. Verify via DNS record (Cloudflare → DNS)
4. Submit sitemap: https://bbqsmokerz.com/sitemap.xml
5. Monitor crawl errors

### Google Business Profile
1. Visit https://business.google.com
2. Create business profile
3. Add address: 2008 N Avenue H, Freeport, TX 77541
4. Add phone: +1 (917) 543-0678
5. Add website: https://bbqsmokerz.com
6. Request review verification

### Google Analytics 4
1. Visit https://analytics.google.com
2. Create GA4 property for bbqsmokerz.com
3. Copy measurement ID (G-XXXXXXXXXX)
4. Add to all HTML pages in `<head>`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

## Step 8: Monitor Performance

### Weekly Checks
- [ ] Check Google Search Console for errors
- [ ] Review Google Analytics traffic
- [ ] Monitor Vercel deployment logs
- [ ] Test contact form
- [ ] Check website speed

### Monthly Checks
- [ ] Update content and products
- [ ] Monitor SEO rankings
- [ ] Review customer messages
- [ ] Optimize images and pages
- [ ] Build backlinks

## Step 9: Scale & Grow

### Social Media
- Set up Facebook business page
- Set up Instagram business profile
- Share posts 2-3x per week
- Engage with followers

### Content Marketing
- Write blog posts about BBQ
- Create YouTube videos
- Share customer testimonials
- Publish smoking tips/guides

### Local Marketing
- Get local directory listings
- Reach out to BBQ competitions
- Partner with local businesses
- Sponsor local events

## Troubleshooting

### Domain Not Working
- Wait 24-48 hours for DNS propagation
- Check nameserver update in registrar
- Verify domain added in Vercel settings
- Check SSL certificate status (Vercel → Domains)

### Database Issues
- Check DATABASE_URL environment variable
- Verify database.db exists
- Run `npm run seed` again
- Check database permissions

### Email Not Sending
- Verify SENDGRID_API_KEY is correct
- Check sender email is verified in SendGrid
- Monitor SendGrid logs
- Test with different email format

### Slow Performance
- Enable Cloudflare caching
- Optimize images
- Check Vercel analytics
- Monitor database query performance

## Support

**Vercel Support:** https://vercel.com/support
**Cloudflare Support:** https://support.cloudflare.com
**Google Search Console Help:** https://support.google.com/webmasters

---

**Deployment Complete!** Your site is now live at https://bbqsmokerz.com with:
✅ HTTPS/SSL (secure)
✅ Global CDN (fast)
✅ Automatic scaling
✅ SEO optimized
✅ Admin dashboard
✅ Email notifications
✅ 172 customer reviews
✅ Mobile responsive

Now focus on:
1. Building backlinks
2. Creating content
3. Getting customer reviews
4. Growing social media
5. Optimizing for search
