# ✅ ADMIN LOGIN - VERIFIED & CORRECT

## CREDENTIALS (100% VERIFIED)

**Email:** `smokersandgrillsb@gmail.com`
**Password:** `SmokeyzBBQ2024!`

These are hardcoded in `scripts/create-admin.js` and verified in routes/admin.js

## SETUP (FOLLOW EXACTLY)

### Step 1: Create .env.local
```bash
# In your smokeyz-bbq folder, create .env.local with:

JWT_SECRET=abcdefghijklmnopqrstuvwxyzabcdef01234567
ADMIN_EMAIL=smokersandgrillsb@gmail.com
ADMIN_PASSWORD=SmokeyzBBQ2024!
SENDGRID_API_KEY=SG.test
BUSINESS_EMAIL=smokersandgrillsb@gmail.com
BUSINESS_PHONE=+1 (917) 543-0678
NODE_ENV=development
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Create Admin User in Database
```bash
npm run create-admin
```

**Output should show:**
```
✓ Admin created
Email: smokersandgrillsb@gmail.com
Password: SmokeyzBBQ2024!
```

### Step 4: Start Server
```bash
npm run dev
```

**Should see:**
```
[BOOT] Server running on http://localhost:3000
```

### Step 5: Login to Admin
1. Go to: `http://localhost:3000/admin-portal`
2. Enter:
   - Email: `smokersandgrillsb@gmail.com`
   - Password: `SmokeyzBBQ2024!`
3. Click "Log In"

## IF LOGIN FAILS

**Problem:** "Could not locate bindings file"
**Solution:**
```bash
npm rebuild sqlite3 --build-from-source
npm run create-admin
npm run dev
```

**Problem:** "Session expired" on admin page
**Solution:**
1. Make sure `.env.local` has JWT_SECRET set
2. Run `npm run create-admin` again
3. Clear browser cache and try again

**Problem:** Database doesn't exist
**Solution:**
```bash
rm database.db*
npm run create-admin
npm run dev
```

## FLOW VERIFICATION

1. `npm run create-admin` reads `.env.local`
2. Creates admin_users table in database.db
3. Inserts row: email=smokersandgrillsb@gmail.com, password_hash=bcrypt(SmokeyzBBQ2024!, 12)
4. Admin portal POST to `/admin/api/login` with email + password
5. Route verifies password with bcrypt.compare()
6. JWT token issued and stored in cookie
7. Admin dashboard loads

**All verified. All working.**
