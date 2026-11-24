export function hasDeliveryPermission(role, permissions, permission) {
  return role === 'admin'
    || (role === 'employee' && Array.isArray(permissions) && permissions.includes(permission));
}
