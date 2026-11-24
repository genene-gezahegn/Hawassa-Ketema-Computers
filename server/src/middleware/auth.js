import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please log in to continue.');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch { throw new HttpError(401, 'Your session is invalid or expired. Please log in again.'); }
  const { rows } = await pool.query('SELECT id, full_name, email, phone, role, is_active FROM users WHERE id = $1', [payload.sub]);
  if (!rows[0] || !rows[0].is_active) throw new HttpError(401, 'This account is unavailable.');
  req.user = rows[0]; next();
});
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to perform this action.'));
  next();
};
