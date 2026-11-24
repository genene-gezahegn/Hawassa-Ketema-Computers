import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionDeliveryStatus } from '../src/utils/deliveryWorkflow.js';

test('allows only valid delivery workflow transitions', () => {
  assert.equal(canTransitionDeliveryStatus('assigned', 'accepted'), true);
  assert.equal(canTransitionDeliveryStatus('accepted', 'out_for_delivery'), true);
  assert.equal(canTransitionDeliveryStatus('out_for_delivery', 'delivered'), true);
  assert.equal(canTransitionDeliveryStatus('out_for_delivery', 'failed'), true);
  assert.equal(canTransitionDeliveryStatus('failed', 'returned'), true);
  assert.equal(canTransitionDeliveryStatus('failed', 'assigned'), true);
});

test('rejects skipped, repeated, and terminal delivery transitions', () => {
  assert.equal(canTransitionDeliveryStatus('assigned', 'delivered'), false);
  assert.equal(canTransitionDeliveryStatus('accepted', 'failed'), false);
  assert.equal(canTransitionDeliveryStatus('delivered', 'failed'), false);
  assert.equal(canTransitionDeliveryStatus('returned', 'assigned'), false);
});
