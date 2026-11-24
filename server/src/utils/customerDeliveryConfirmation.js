export function canRespondToDeliveryConfirmation(deliveryStatus, confirmationStatus) {
  return deliveryStatus === 'delivered' && confirmationStatus === 'awaiting_confirmation';
}
