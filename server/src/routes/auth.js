import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { authenticate } from '../middleware/auth.js';
const router = Router();
const registerSchema = z.object({ fullName:z.string().trim().min(2).max(120), email:z.string().trim().email().max(255), password:z.string().min(8).max(72), phone:z.string().trim().max(30).optional() });
const loginSchema = z.object({ email:z.string().trim().email(), password:z.string().min(1).max(72) });
const googleSchema = z.object({ credential:z.string().min(1).max(10000) });
const publicUser = (u) => ({ id:u.id, fullName:u.full_name, email:u.email, phone:u.phone, role:u.role });
const issueToken = (u) => jwt.sign({ role:u.role }, process.env.JWT_SECRET, { subject:u.id, expiresIn:process.env.JWT_EXPIRES_IN || '1d' });

router.post('/register', asyncHandler(async (req,res) => {
  const data = registerSchema.parse(req.body);
  const hash = await bcrypt.hash(data.password, Number(process.env.BCRYPT_ROUNDS || 12));
  let result;
  try { result = await pool.query('INSERT INTO users(full_name,email,phone,password_hash,role) VALUES($1,$2,$3,$4,\'customer\') RETURNING id,full_name,email,phone,role', [data.fullName,data.email.toLowerCase(),data.phone || null,hash]); }
  catch (e) { if (e.code === '23505') throw new HttpError(409,'An account with this email already exists.'); throw e; }
  const user=result.rows[0]; res.status(201).json({ user:publicUser(user), token:issueToken(user) });
}));
router.post('/login', asyncHandler(async (req,res) => {
  const data=loginSchema.parse(req.body); const { rows }=await pool.query('SELECT * FROM users WHERE email=$1', [data.email.toLowerCase()]); const user=rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(data.password,user.password_hash))) throw new HttpError(401,'Email or password is incorrect.');
  res.json({ user:publicUser(user), token:issueToken(user) });
}));
router.get('/google/config', (_req,res) => res.json({ clientId:process.env.GOOGLE_CLIENT_ID || null }));
router.post('/google', asyncHandler(async (req,res) => {
  const { credential } = googleSchema.parse(req.body);
  if (!process.env.GOOGLE_CLIENT_ID) throw new HttpError(503, 'Google sign-in is temporarily unavailable. Please sign in with your email and password.');
  let googleUser;
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Google rejected the credential.');
    googleUser = await response.json();
  } catch {
    throw new HttpError(401, 'Google sign-in could not be verified. Please try again.');
  }
  if (
    googleUser.aud !== process.env.GOOGLE_CLIENT_ID ||
    !['accounts.google.com', 'https://accounts.google.com'].includes(googleUser.iss) ||
    Number(googleUser.exp) <= Math.floor(Date.now() / 1000) ||
    (googleUser.email_verified !== 'true' && googleUser.email_verified !== true) ||
    typeof googleUser.sub !== 'string' ||
    typeof googleUser.email !== 'string'
  ) {
    throw new HttpError(401, 'Google sign-in could not be verified. Please try again.');
  }
  const email = googleUser.email.trim().toLowerCase();
  let { rows } = await pool.query(
    'SELECT id,full_name,email,phone,role,is_active FROM users WHERE email=$1',
    [email],
  );
  let user = rows[0];
  if (user) {
    if (!user.is_active) throw new HttpError(403, 'This account has been deactivated.');
    if (user.role !== 'customer') throw new HttpError(403, 'Please use the administrator sign-in.');
  } else {
    const name = (typeof googleUser.name === 'string' ? googleUser.name : email.split('@')[0]).trim().slice(0, 120);
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), Number(process.env.BCRYPT_ROUNDS || 12));
    try {
      const created = await pool.query(
        "INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,'customer') RETURNING id,full_name,email,phone,role,is_active",
        [name || email, email, passwordHash],
      );
      user = created.rows[0];
    } catch (error) {
      if (error.code !== '23505') throw error;
      ({ rows } = await pool.query(
        'SELECT id,full_name,email,phone,role,is_active FROM users WHERE email=$1',
        [email],
      ));
      user = rows[0];
      if (!user || !user.is_active || user.role !== 'customer') {
        throw new HttpError(403, 'This Google account cannot be used to sign in.');
      }
    }
  }
  res.json({ user:publicUser(user), token:issueToken(user) });
}));
router.get('/me', authenticate, (req,res)=>res.json({user:{id:req.user.id,fullName:req.user.full_name,email:req.user.email,phone:req.user.phone,role:req.user.role}}));

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  currentPassword: z.string().min(1).max(72).optional(),
  newPassword: z.string().min(8).max(72).optional(),
  confirmPassword: z.string().min(8).max(72).optional(),
}).refine((d) => !d.newPassword || d.currentPassword, {
  message: 'Current password is required to set a new password.',
  path: ['currentPassword'],
}).refine((d) => !d.newPassword || d.newPassword === d.confirmPassword, {
  message: 'New password and confirm password do not match.',
  path: ['confirmPassword'],
});

router.patch('/me', authenticate, asyncHandler(async (req, res) => {
  const data = updateProfileSchema.parse(req.body);
  const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
  const user = rows[0];
  if (!user) throw new HttpError(404, 'Account not found.');

  if (data.newPassword) {
    if (!user.password_hash) throw new HttpError(400, 'Password change is not available for Google sign-in accounts.');
    const matches = await bcrypt.compare(data.currentPassword, user.password_hash);
    if (!matches) throw new HttpError(400, 'Current password is incorrect.');
  }

  const setClauses = [];
  const values = [];
  let idx = 1;
  if (data.fullName !== undefined)  { setClauses.push(`full_name=$${idx++}`);     values.push(data.fullName); }
  if (data.phone !== undefined)     { setClauses.push(`phone=$${idx++}`);          values.push(data.phone || null); }
  if (data.newPassword)             { const h = await bcrypt.hash(data.newPassword, Number(process.env.BCRYPT_ROUNDS || 12)); setClauses.push(`password_hash=$${idx++}`); values.push(h); }

  if (setClauses.length === 0) return res.json({ user: publicUser(user) });

  setClauses.push(`updated_at=NOW()`);
  values.push(req.user.id);
  const result = await pool.query(
    `UPDATE users SET ${setClauses.join(',')} WHERE id=$${idx} RETURNING id,full_name,email,phone,role`,
    values,
  );
  res.json({ user: publicUser(result.rows[0]) });
}));

export default router;
