const deliveryTransitions = {
  unassigned: ['assigned'],
  assigned: ['accepted', 'unassigned'],
  accepted: ['out_for_delivery'],
  out_for_delivery: ['delivered', 'failed'],
  failed: ['out_for_delivery', 'returned', 'assigned'],
  delivered: [],
  returned: [],
};

export function canTransitionDeliveryStatus(currentStatus, nextStatus) {
  return deliveryTransitions[currentStatus]?.includes(nextStatus) ?? false;
}
