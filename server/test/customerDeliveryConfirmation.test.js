import test from 'node:test';
import assert from 'node:assert/strict';
import { canRespondToDeliveryConfirmation } from '../src/utils/customerDeliveryConfirmation.js';

test('allows a response only after delivery and while confirmation is pending', () => {
  assert.equal(canRespondToDeliveryConfirmation('delivered', 'awaiting_confirmation'), true);
});

test('rejects responses before delivery and after any customer response', () => {
  for (const deliveryStatus of ['unassigned', 'assigned', 'accepted', 'out_for_delivery', 'failed']) {
    assert.equal(canRespondToDeliveryConfirmation(deliveryStatus, 'awaiting_confirmation'), false);
  }
  assert.equal(canRespondToDeliveryConfirmation('delivered', 'customer_confirmed'), false);
  assert.equal(canRespondToDeliveryConfirmation('delivered', 'issue_reported'), false);
});
