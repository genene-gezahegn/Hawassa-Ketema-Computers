export function canAccessOrderMessages(user, order) {
  if (user.role === 'admin' || user.role === 'employee') return true;
  if (user.role === 'customer') return order.customerId === user.id;
  if (user.role === 'delivery_person') return order.deliveryPersonId === user.id;
  return false;
}
