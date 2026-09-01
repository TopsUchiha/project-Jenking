import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '8h';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[AUTH] ERROR: JWT_SECRET must be set and at least 32 characters');
  process.exit(1);
}

export async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  } catch (err) {
    console.error('[AUTH] Hash error:', err.message);
    throw err;
  }
}

export async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    console.error('[AUTH] Verify error:', err.message);
    return false;
  }
}

export function generateToken(payload) {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
      issuer: 'smokeyz-bbq',
      audience: 'admin'
    });
  } catch (err) {
    console.error('[AUTH] Token generation error:', err.message);
    throw err;
  }
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'smokeyz-bbq',
      audience: 'admin'
    });
  } catch (err) {
    return null;
  }
}

export function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{1,63}$/.test(trimmed) && trimmed.length <= 254;
}

export function validateString(val, minLen, maxLen) {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length >= minLen && trimmed.length <= maxLen;
}

export function validatePhone(phone) {
  if (typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  return trimmed.length >= 7 && trimmed.length <= 30;
}

export function validatePrice(price) {
  const num = parseFloat(price);
  return Number.isFinite(num) && num > 0;
}

// validateInt — boolean check only (use for non-ID numeric validation)
export function validateInt(val, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = parseInt(String(val), 10);
  return Number.isFinite(num) && num >= min && num <= max;
}

// parseIntParam — parses AND validates; returns the integer or null.
// Use this everywhere an ID or numeric param is read from a request
// and then passed directly to a database query.
export function parseIntParam(val, min = 1) {
  const num = parseInt(String(val), 10);
  if (!Number.isFinite(num) || num < min) return null;
  return num;
}

// XSS Prevention helper
export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Validate image URL (prevent javascript: protocol)
export function validateImageURL(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) return '';
  return (trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) ? trimmed : '';
}
