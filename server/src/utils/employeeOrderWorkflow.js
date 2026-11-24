const employeeOrderTransitions = {
  pending: ['confirmed'],
  confirmed: ['processing'],
  processing: ['ready'],
  ready: [],
  completed: [],
  cancelled: [],
};

export function canTransitionEmployeeOrderStatus(currentStatus, nextStatus) {
  return employeeOrderTransitions[currentStatus]?.includes(nextStatus) ?? false;
}
