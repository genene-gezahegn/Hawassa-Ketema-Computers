import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { isEmailConfigured, sendEmail } from '../utils/email.js';
import { authenticate } from '../middleware/auth.js';
const router = Router();
const registerSchema = z.object({ fullName:z.string().trim().min(2).max(120), email:z.string().trim().email().max(255), password:z.string().min(8).max(72), phone:z.string().trim().max(30).optional() });
const loginSchema = z.object({ email:z.string().trim().email(), password:z.string().min(1).max(72) });
const forgotPasswordSchema = z.object({ email:z.string().trim().email().max(255) });
const resetPasswordSchema = z.object({ token:z.string().regex(/^[a-f0-9]{64}$/), password:z.string().min(8).max(72) });
const googleSchema = z.object({ credential:z.string().min(1).max(10000) });
const publicUser = (u) => ({ id:u.id, fullName:u.full_name, email:u.email, phone:u.phone, role:u.role });
const issueToken = (u) => jwt.sign({ role:u.role }, process.env.JWT_SECRET, { subject:u.id, expiresIn:process.env.JWT_EXPIRES_IN || '1d' });
const hashResetToken = (token) => createHash('sha256').update(token).digest('hex');
const resetEmailHtml = (url) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Reset your password</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#b91c1c;padding:28px 32px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#fff;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
              <span style="font-size:14px;font-weight:900;color:#b91c1c;line-height:36px;display:block;">HK</span>
            </td>
            <td style="padding-left:12px;">
              <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.3px;">Hawassa-Ketema Computers</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#111827;letter-spacing:-0.5px;">Reset your password</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">We received a request to reset the password for your account. Click the button below to choose a new password. This link expires in <strong>30 minutes</strong>.</p>
          <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#b91c1c;">
            <a href="${url.replace(/&/g, '&amp;')}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">Reset password</a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">If the button does not work, copy and paste this link into your browser:<br>
            <a href="${url.replace(/&/g, '&amp;')}" style="color:#b91c1c;word-break:break-all;">${url.replace(/&/g, '&amp;')}</a>
          </p>
          <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">© 2026 Hawassa-Ketema Computers · Hawassa, Ethiopia</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

async function sendPasswordResetEmail(toEmail, resetUrl) {
  try {
    await sendEmail({
      to: toEmail,
      subject: 'Reset your Hawassa-Ketema Computers password',
      html: resetEmailHtml(resetUrl),
    });
  } catch (error) {
    console.error('[Email] Resend request failed:', error.statusCode ?? '', error.message);
    throw new HttpError(502, 'The password reset email could not be sent. Please try again later.');
  }
}

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
router.post('/forgot-password', asyncHandler(async (req,res) => {
  const data = forgotPasswordSchema.parse(req.body);
  if (!isEmailConfigured()) {
    throw new HttpError(503, 'Password reset email is not configured. Contact the store administrator.');
  }
  const { rows } = await pool.query(
    "SELECT id,email FROM users WHERE email=$1 AND role='customer' AND is_active=true",
    [data.email.toLowerCase()],
  );
  const user = rows[0];
  if (user) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    await pool.query(
      'UPDATE users SET password_reset_token_hash=$1,password_reset_expires_at=NOW()+INTERVAL \'30 minutes\' WHERE id=$2',
      [tokenHash, user.id],
    );
    const clientUrl = process.env.CLIENT_URL || (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
    const resetUrl = new URL('/', clientUrl);
    resetUrl.searchParams.set('resetToken', token);
    try {
      await sendPasswordResetEmail(user.email, resetUrl.toString());
    } catch (error) {
      await pool.query(
        'UPDATE users SET password_reset_token_hash=NULL,password_reset_expires_at=NULL WHERE id=$1 AND password_reset_token_hash=$2',
        [user.id, tokenHash],
      );
      throw error;
    }
  }
  res.json({ message: 'If an active customer account exists for that email, a password reset link has been sent.' });
}));
router.post('/reset-password', asyncHandler(async (req,res) => {
  const data = resetPasswordSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, Number(process.env.BCRYPT_ROUNDS || 12));
  const result = await pool.query(
    "UPDATE users SET password_hash=$1,password_reset_token_hash=NULL,password_reset_expires_at=NULL,updated_at=NOW() WHERE password_reset_token_hash=$2 AND password_reset_expires_at>NOW() AND role='customer' AND is_active=true RETURNING id",
    [passwordHash, hashResetToken(data.token)],
  );
  if (!result.rowCount) throw new HttpError(400, 'This password reset link is invalid or has expired. Request a new link.');
  res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
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
