import { pool } from '../db.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { hasDeliveryPermission } from '../utils/deliveryPermissions.js';

export const DELIVERY_ASSIGNMENT_PERMISSIONS = [
  'ASSIGN_DELIVERIES',
  'REASSIGN_DELIVERIES',
  'VIEW_ALL_DELIVERIES',
];

export async function getEmployeePermissions(employeeId) {
  const { rows } = await pool.query(
    `SELECT permission
     FROM employee_permissions
     WHERE employee_id=$1
     ORDER BY permission`,
    [employeeId],
  );
  return rows.map(row => row.permission);
}

export const requireAnyPermission = (...requiredPermissions) => asyncHandler(async (req, _res, next) => {
  if (req.user.role === 'admin') {
    req.user.permissions = DELIVERY_ASSIGNMENT_PERMISSIONS;
    return next();
  }
  if (req.user.role !== 'employee') {
    throw new HttpError(403, 'You do not have permission to perform this action.');
  }

  const permissions = await getEmployeePermissions(req.user.id);
  req.user.permissions = permissions;
  if (!requiredPermissions.some(permission => hasDeliveryPermission(req.user.role, permissions, permission))) {
    throw new HttpError(403, 'You do not have permission to perform this action.');
  }
  next();
});

export const requirePermission = permission => requireAnyPermission(permission);
