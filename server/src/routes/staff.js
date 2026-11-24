/**
 * Staff Management Routes — /api/staff
 * All routes require admin authentication.
 * Handles creation, management, and status of employee and delivery_person accounts.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { HttpError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

const staffRoles = ['employee', 'delivery_person'];
const deliveryPermissions = z.enum([
  'ASSIGN_DELIVERIES',
  'REASSIGN_DELIVERIES',
  'VIEW_ALL_DELIVERIES',
]);
const permissionUpdateSchema = z.object({
  permissions: z.array(deliveryPermissions).max(3)
    .refine(permissions => new Set(permissions).size === permissions.length, 'Permissions must be unique.'),
}).strict().refine(
  ({ permissions }) => !permissions.includes('REASSIGN_DELIVERIES') || permissions.includes('ASSIGN_DELIVERIES'),
  'Reassign permission requires assign permission.',
);

const createStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(['employee', 'delivery_person']),
  password: z.string().min(8).max(72),
});

const updateStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  newPassword: z.string().min(8).max(72).optional(),
});

router.get('/delivery-persons/available', requirePermission('ASSIGN_DELIVERIES'), asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, full_name AS "fullName", email, phone
     FROM users
     WHERE role='delivery_person' AND is_active=true
     ORDER BY full_name`,
  );
  res.json({ deliveryPersons: rows });
}));

router.use(requireRole('admin'));

/* ── GET /api/staff — list all employees and delivery persons ── */
router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name AS "fullName", u.email, u.phone, u.role,
            u.is_active AS "isActive", u.created_at AS "createdAt",
            COALESCE(
              array_agg(ep.permission ORDER BY ep.permission)
                FILTER (WHERE ep.permission IS NOT NULL),
              ARRAY[]::varchar[]
            ) AS permissions
     FROM users u
     LEFT JOIN employee_permissions ep ON ep.employee_id=u.id
     WHERE u.role = ANY($1::text[])
     GROUP BY u.id
     ORDER BY u.role, u.full_name`,
    [staffRoles],
  );
  res.json({ staff: rows });
}));

/* ── POST /api/staff — create employee or delivery person ── */
router.post('/', asyncHandler(async (req, res) => {
  const data = createStaffSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, Number(process.env.BCRYPT_ROUNDS || 12));
  let result;
  try {
    result = await pool.query(
      `INSERT INTO users(full_name, email, phone, password_hash, role)
       VALUES($1, $2, $3, $4, $5)
       RETURNING id, full_name AS "fullName", email, phone, role, is_active AS "isActive", created_at AS "createdAt"`,
      [data.fullName, data.email.toLowerCase(), data.phone || null, passwordHash, data.role],
    );
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'An account with this email already exists.');
    throw e;
  }
  res.status(201).json({ staff: result.rows[0] });
}));

/* ── PUT /api/staff/:id/permissions — replace employee delivery permissions ── */
router.put('/:id/permissions', asyncHandler(async (req, res) => {
  const employeeId = z.string().uuid().parse(req.params.id);
  const { permissions } = permissionUpdateSchema.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: employee } = await client.query(
      `SELECT id FROM users WHERE id=$1 AND role='employee' FOR UPDATE`,
      [employeeId],
    );
    if (!employee[0]) throw new HttpError(404, 'Employee not found.');

    await client.query('DELETE FROM employee_permissions WHERE employee_id=$1', [employeeId]);
    for (const permission of permissions) {
      await client.query(
        `INSERT INTO employee_permissions(employee_id, permission, granted_by)
         VALUES($1, $2, $3)`,
        [employeeId, permission, req.user.id],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ employeeId, permissions });
}));

/* ── GET /api/staff/:id — single staff member ── */
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, full_name AS "fullName", email, phone, role,
            is_active AS "isActive", created_at AS "createdAt"
     FROM users WHERE id = $1 AND role = ANY($2::text[])`,
    [req.params.id, staffRoles],
  );
  if (!rows[0]) throw new HttpError(404, 'Staff member not found.');
  res.json({ staff: rows[0] });
}));

/* ── PATCH /api/staff/:id — update name, phone, or password ── */
router.patch('/:id', asyncHandler(async (req, res) => {
  const data = updateStaffSchema.parse(req.body);
  const { rows: found } = await pool.query(
    'SELECT id FROM users WHERE id = $1 AND role = ANY($2::text[])',
    [req.params.id, staffRoles],
  );
  if (!found[0]) throw new HttpError(404, 'Staff member not found.');

  const setClauses = [];
  const values = [];
  let idx = 1;
  if (data.fullName !== undefined) { setClauses.push(`full_name=$${idx++}`); values.push(data.fullName); }
  if (data.phone !== undefined)    { setClauses.push(`phone=$${idx++}`);     values.push(data.phone || null); }
  if (data.newPassword)            {
    const h = await bcrypt.hash(data.newPassword, Number(process.env.BCRYPT_ROUNDS || 12));
    setClauses.push(`password_hash=$${idx++}`);
    values.push(h);
  }
  if (setClauses.length === 0) {
    const { rows } = await pool.query(
      `SELECT id, full_name AS "fullName", email, phone, role, is_active AS "isActive" FROM users WHERE id=$1`,
      [req.params.id],
    );
    return res.json({ staff: rows[0] });
  }
  setClauses.push(`updated_at=NOW()`);
  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE users SET ${setClauses.join(',')} WHERE id=$${idx}
     RETURNING id, full_name AS "fullName", email, phone, role, is_active AS "isActive"`,
    values,
  );
  res.json({ staff: rows[0] });
}));

/* ── PATCH /api/staff/:id/status — activate / deactivate ── */
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
  const { rows } = await pool.query(
    `UPDATE users SET is_active=$1, updated_at=NOW()
     WHERE id=$2 AND role = ANY($3::text[])
     RETURNING id, full_name AS "fullName", email, role, is_active AS "isActive"`,
    [isActive, req.params.id, staffRoles],
  );
  if (!rows[0]) throw new HttpError(404, 'Staff member not found.');
  res.json({ staff: rows[0] });
}));

export default router;
