# Updates Applied to Smokeyz BBQ V1

## Database Updates
- ✅ Added `shipping_settings` table (admin-controlled base_fee)
- ✅ Added `reviews` table (172 customer reviews)
- ✅ Added `read` field to `contact_messages` table

## Seed Script Updates
- ✅ Initialize shipping_settings with $149 base fee
- ✅ Add 172 pre-seeded reviews (realistic distribution)
- ✅ Maintains all existing functionality

## Required Admin Route Updates (Manual)

### Add to routes/admin.js:

```javascript
// GET /admin/api/shipping - Get shipping settings
router.get('/shipping', requireAuth, async (req, res) => {
  try {
    const settings = await get('SELECT * FROM shipping_settings LIMIT 1');
    res.json({ success: true, shipping: settings });
  } catch (err) {
    console.error('[ADMIN] Shipping GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch shipping settings' });
  }
});

// PUT /admin/api/shipping - Update shipping fee
router.put('/shipping', requireAuth, async (req, res) => {
  try {
    const { base_fee } = req.body;
    if (typeof base_fee !== 'number' || base_fee < 0) {
      return res.status(400).json({ error: 'Invalid base_fee' });
    }
    
    await run(
      "UPDATE shipping_settings SET base_fee = ?, updated_at = datetime('now')",
      [base_fee]
    );
    res.json({ success: true, message: 'Shipping fee updated' });
  } catch (err) {
    console.error('[ADMIN] Shipping PUT error:', err.message);
    res.status(500).json({ error: 'Failed to update shipping' });
  }
});

// GET /admin/api/messages - Get all contact messages
router.get('/messages', requireAuth, async (req, res) => {
  try {
    const messages = await all(
      'SELECT * FROM contact_messages ORDER BY created_at DESC'
    );
    res.json({ success: true, messages });
  } catch (err) {
    console.error('[ADMIN] Messages GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// PUT /admin/api/messages/:id/read - Mark message as read
router.put('/messages/:id/read', requireAuth, async (req, res) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid message ID' });
    
    await run("UPDATE contact_messages SET read = 1 WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Mark read error:', err.message);
    res.status(500).json({ error: 'Failed to update message' });
  }
});
```

## Admin Dashboard Updates (public/admin-app.js)

Add these dashboard sections:

1. **Shipping Settings Tab**
   - Display current shipping fee
   - Allow admin to update fee
   - Show when it was last updated

2. **Messages Tab** (Primary Feature)
   - Display all contact_messages
   - Show: customer name, email, phone, message, date
   - Mark as read functionality
   - Email notifications (handled by config/email.js)

## Text Updates (Remove Em-Dashes)

The following need "em-dash to proper punctuation" conversion:
- All HTML pages
- All JavaScript UI text
- All database seed text (already updated)

Example: "set-and-forget" → "set and forget"

## To Complete These Updates:

1. Backup your current version
2. Run: `npm run seed` (adds reviews, shipping settings)
3. Manually add the admin routes (copy/paste above)
4. Update admin dashboard UI to show new tabs
5. Remove em-dashes from all text
6. Test admin functionality

## Files Modified
- ✅ config/db.js (added tables)
- ✅ scripts/seed.js (added reviews + shipping)
- ⏳ routes/admin.js (needs routes added)
- ⏳ public/admin-app.js (needs UI update)
- ⏳ All HTML files (em-dash removal)

## Testing

After updates:
```bash
npm run seed
npm run dev
# Visit http://localhost:3000/admin-portal
# Login and test shipping + messages tabs
```
