import test from 'node:test';
import assert from 'node:assert/strict';
import { hasDeliveryPermission } from '../src/utils/deliveryPermissions.js';

test('admins always retain delivery assignment authority', () => {
  assert.equal(hasDeliveryPermission('admin', [], 'ASSIGN_DELIVERIES'), true);
  assert.equal(hasDeliveryPermission('admin', [], 'REASSIGN_DELIVERIES'), true);
  assert.equal(hasDeliveryPermission('admin', [], 'VIEW_ALL_DELIVERIES'), true);
});

test('employees only receive explicitly granted delivery permissions', () => {
  const permissions = ['ASSIGN_DELIVERIES'];
  assert.equal(hasDeliveryPermission('employee', permissions, 'ASSIGN_DELIVERIES'), true);
  assert.equal(hasDeliveryPermission('employee', permissions, 'REASSIGN_DELIVERIES'), false);
  assert.equal(hasDeliveryPermission('employee', [], 'ASSIGN_DELIVERIES'), false);
  assert.equal(hasDeliveryPermission('delivery_person', permissions, 'ASSIGN_DELIVERIES'), false);
});
