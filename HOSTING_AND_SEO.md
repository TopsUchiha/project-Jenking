# Smokeyz BBQ - Hosting & SEO Configuration Guide

## Domain Setup
**Domain:** bbqsmokerz.com
**Registrar:** (Your choice: GoDaddy, Namecheap, Route53, etc.)

### DNS Configuration

#### Vercel Hosting (Recommended)
1. In Vercel dashboard, add domain "bbqsmokerz.com"
2. Vercel will provide nameservers or CNAME records
3. Update domain registrar to use Vercel's nameservers:
   ```
   ns1.vercel.com
   ns2.vercel.com
   ```
4. SSL/TLS: Automatic via Let's Encrypt (free)

#### Alternative: Cloudflare (Better for SEO + DDoS protection)
1. Create Cloudflare account
2. Add site: bbqsmokerz.com
3. Cloudflare provides nameservers (2 nameservers)
4. Update domain registrar to Cloudflare nameservers
5. Point to Vercel via CNAME:
   ```
   www CNAME cname.vercel-dns.com
   @ A 76.76.19.19 (Vercel IP)
   ```
6. Enable "Full" SSL mode in Cloudflare
7. Cloudflare benefits:
   - Free SSL/TLS
   - DDoS protection
   - Global CDN (faster worldwide)
   - Better SEO (security badges)

### SSL/TLS Certificate
- Vercel: Free automatic SSL
- Cloudflare: Free automatic SSL
- **CRITICAL:** Always use HTTPS (https://bbqsmokerz.com)

## Technical SEO Checklist

### On-Page SEO

✅ **Metadata (Already in server.js)**
```javascript
// Each page should have:
res.set('X-UA-Compatible', 'IE=edge');
res.set('viewport', 'width=device-width, initial-scale=1.0');

// Meta tags in HTML head:
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Custom built BBQ smokers...">
<meta name="keywords" content="bbq smokers, custom smokers, barrel smokers, offset smokers">
<title>Smokeyz BBQ | Custom Built Professional BBQ Smokers</title>
```

✅ **Open Graph Tags (Social Sharing)**
```html
<meta property="og:title" content="Smokeyz BBQ | Custom Built Smokers">
<meta property="og:description" content="Premium handcrafted BBQ smokers...">
<meta property="og:image" content="https://bbqsmokerz.com/og-image.jpg">
<meta property="og:url" content="https://bbqsmokerz.com">
<meta property="og:type" content="website">
```

✅ **Schema Markup (JSON-LD)**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Smokeyz BBQ",
  "image": "https://bbqsmokerz.com/logo.png",
  "description": "Custom built BBQ smokers",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "2008 N Avenue H",
    "addressLocality": "Freeport",
    "addressRegion": "TX",
    "postalCode": "77541",
    "addressCountry": "US"
  },
  "telephone": "+1-917-543-0678",
  "email": "smokersandgrillsb@gmail.com",
  "url": "https://bbqsmokerz.com",
  "sameAs": [
    "https://facebook.com/smokeyzbbq",
    "https://instagram.com/smokeyzbbq"
  ]
}
</script>
```

✅ **Robots.txt** (Already created)
- Location: `/public/robots.txt`
- Allows crawling of public pages
- Disallows admin, API, database access

✅ **Sitemap.xml** (Already created)
- Location: `/public/sitemap.xml`
- Lists all important pages
- Priority and change frequency included

✅ **Mobile Optimization**
- Responsive design (works on all devices)
- Fast loading times (<2 seconds)
- Touch-friendly buttons
- Readable font sizes

✅ **Page Speed**
- Images optimized
- CSS minified
- JavaScript bundled
- Database queries optimized with indexes
- Vercel CDN for global speed

## Server Configuration (server.js)

Add these security and SEO headers:

```javascript
// Security headers
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");
  next();
});

// Sitemap route
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// Robots.txt route
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});
```

## Google Integration

### 1. Google Search Console
**URL:** https://search.google.com/search-console

1. Add property: bbqsmokerz.com
2. Verify ownership (via DNS, HTML file, or Google Analytics)
3. Submit sitemap: https://bbqsmokerz.com/sitemap.xml
4. Monitor:
   - Crawl errors
   - Search performance
   - Click-through rates
   - Impressions vs clicks
   - Mobile usability

### 2. Google Business Profile
**URL:** https://business.google.com

1. Create/claim business: Smokeyz BBQ
2. Add details:
   - Business name: Smokeyz BBQ
   - Category: Custom BBQ Smoker Builder / Business Services
   - Address: 2008 N Avenue H, Freeport, TX 77541
   - Phone: +1 (917) 543-0678
   - Website: https://bbqsmokerz.com
   - Hours: Mon-Fri 9am-6pm, Sat 10am-4pm, Sun Closed
   - Description: Professional custom built BBQ smokers
   - Photos: High quality smoker images
   - Videos: Demo/testimonial videos
3. Encourage reviews (critical for rankings)

### 3. Google Analytics 4
**URL:** https://analytics.google.com

1. Create GA4 property for bbqsmokerz.com
2. Add tracking code to all pages:
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
3. Track:
   - User behavior
   - Traffic sources
   - Conversion goals
   - Product page views
   - Contact form submissions

### 4. Google Maps Integration
Add embedded map to contact page:
```html
<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3445.123...&key=YOUR_API_KEY" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
```

## Content Strategy for Rankings

### Target Keywords
**Primary:** "custom BBQ smokers", "custom built smokers", "barrel smokers", "offset smokers"
**Secondary:** "competition BBQ smokers", "professional smokers", "handcrafted smokers"
**Local:** "BBQ smokers near me", "custom smokers Texas", "Freeport smoker builder"

### Page Optimization

#### Home Page
- Title: "Smokeyz BBQ | Custom Built Professional BBQ Smokers"
- Meta: "Premium handcrafted BBQ smokers for competition pitmasters and backyard enthusiasts. 15+ years experience."
- H1: "Custom Built. Real Smoke. Real Flavor."
- Include: 172 reviews, trust indicators

#### Products Page
- Title: "Custom BBQ Smokers | Smokeyz BBQ Product Catalog"
- Meta: "Browse barrel, offset, pellet, hybrid, and kettle smokers. Custom built to order."
- Filter by type
- Customer reviews on each product

#### About Page
- Title: "About Smokeyz BBQ | Premium Custom Smoker Builders"
- Content: Company history, team, achievements
- 172+ reviews
- Trust badges (500+ smokers built, 4.8/5 rating, 15+ years)

#### Contact Page
- Title: "Contact Smokeyz BBQ | Request Custom Build Quote"
- Meta: "Get a personalized quote for your custom smoker build. Call +1 (917) 543-0678"
- Phone number prominently displayed
- Contact form
- Google Map

#### Blog/Guides (Optional but recommended)
Create blog posts for:
- "How to Choose the Right BBQ Smoker"
- "Offset Smoker vs Barrel Smoker: Which Should You Choose?"
- "Competition BBQ Tips from the Pros"
- "Smoking Techniques: Low and Slow vs Hot and Fast"
- "Custom Smoker Customization Options Explained"

## Authority Building

### Backlinks
1. Business directories:
   - Google Business Profile
   - Yelp
   - Chamber of Commerce
   - Local business listings

2. Industry directories:
   - BBQ equipment sites
   - Smoker review sites
   - Competition BBQ organizations

3. Local listings:
   - Texas business directories
   - Freeport area business listings

4. Guest posts:
   - BBQ blogs
   - Competition BBQ websites
   - Business/entrepreneurship blogs

### Reviews
- Google: Encourage customers to review on Google Business Profile
- Yelp: Claim and optimize Yelp listing
- In-site reviews: 172+ customer testimonials
- Incentivize: "Leave a review, get 10% off your next order"

### Social Media
- **Facebook:** https://facebook.com/smokeyzbbq
- **Instagram:** https://instagram.com/smokeyzbbq (photo-heavy platform perfect for smokers)
- **YouTube:** Build channel with:
  - Smoker build videos
  - Smoking technique tutorials
  - Customer testimonials
  - Competition highlights

### Local Mentions
- Local news features
- BBQ competition coverage
- Business spotlights
- Chamber of Commerce mentions

## Performance Targets

| Metric | Target | Tool |
|--------|--------|------|
| Page Load Time | <2 seconds | Google PageSpeed Insights |
| Mobile Score | 90+ | Google PageSpeed Insights |
| Desktop Score | 95+ | Google PageSpeed Insights |
| Core Web Vitals | All "Good" | Google Search Console |
| Search Visibility | Top 10 for "custom BBQ smokers" | Google Search Console |
| Organic Traffic | 100+ visits/month (Month 3) | Google Analytics |
| Conversion Rate | 2-5% (contact forms) | Google Analytics |
| Bounce Rate | <50% | Google Analytics |

## Monthly SEO Tasks

- [ ] Monitor Google Search Console for errors
- [ ] Check Google Business Profile reviews and respond
- [ ] Review Google Analytics traffic trends
- [ ] Update sitemap with new products/pages
- [ ] Check page load speed (PageSpeed Insights)
- [ ] Monitor competitor rankings
- [ ] Publish social media content (2-3x per week)
- [ ] Engage with local community online
- [ ] Respond to customer reviews

## Deployment Checklist

Before going live on bbqsmokerz.com:

- [ ] Domain registered and DNS configured
- [ ] Vercel project created and deployed
- [ ] Cloudflare configured (if using)
- [ ] SSL certificate active (https://)
- [ ] Sitemap.xml accessible
- [ ] Robots.txt configured correctly
- [ ] Google Search Console property created
- [ ] Google Business Profile created and verified
- [ ] Google Analytics 4 installed
- [ ] All metadata tags in HTML head
- [ ] Schema markup on home and business pages
- [ ] Security headers configured
- [ ] 404 page set up
- [ ] Mobile responsiveness tested
- [ ] Page speed optimized
- [ ] All internal links working
- [ ] Social media profiles linked
- [ ] Contact form working
- [ ] Email notifications working

## First 90 Days Strategy

**Month 1:** Setup & Indexing
- Deploy to production
- Submit sitemap to Google Search Console
- Verify Google Business Profile
- Install Google Analytics
- Set up social media profiles

**Month 2:** Content & Authority
- Create 2-3 blog posts
- Build backlink profile (directories, local listings)
- Encourage first customer reviews
- Social media posting cadence
- Monitor Google Search Console

**Month 3:** Optimization & Growth
- Analyze Google Analytics data
- Optimize pages based on search data
- Expand content (more blog posts)
- Build social media following
- Monitor rankings on target keywords

**By Month 4:** Expected Results
- Indexed in Google
- Ranking for some local keywords
- 50-100+ organic visits/month
- 5-10 customer inquiries from organic search
- Established social media presence

## Support

For domain/hosting issues: Contact Vercel or Cloudflare support
For Google issues: Google Search Console help
For SEO questions: SEMrush, Ahrefs, or consult an SEO specialist

---

**Important:** SEO takes time. Rankings typically build over 3-6 months. Consistency and quality content are key to long-term success.
