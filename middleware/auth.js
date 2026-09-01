import { verifyToken } from '../config/auth.js';

export function requireAuth(req, res, next) {
  const token = req.cookies.admin_token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  req.admin = payload;
  next();
}

export function optionalAuth(req, res, next) {
  const token = req.cookies.admin_token;
  
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.admin = payload;
    }
  }

  next();
}
