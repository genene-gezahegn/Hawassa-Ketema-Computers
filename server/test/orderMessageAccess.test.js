import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessOrderMessages } from '../src/utils/orderMessageAccess.js';

const order = { customerId: 'customer-1', deliveryPersonId: 'driver-1' };

test('order messages are limited to the owner, assigned driver, and store staff', () => {
  assert.equal(canAccessOrderMessages({ id: 'customer-1', role: 'customer' }, order), true);
  assert.equal(canAccessOrderMessages({ id: 'customer-2', role: 'customer' }, order), false);
  assert.equal(canAccessOrderMessages({ id: 'driver-1', role: 'delivery_person' }, order), true);
  assert.equal(canAccessOrderMessages({ id: 'driver-2', role: 'delivery_person' }, order), false);
  assert.equal(canAccessOrderMessages({ id: 'employee-1', role: 'employee' }, order), true);
  assert.equal(canAccessOrderMessages({ id: 'admin-1', role: 'admin' }, order), true);
  assert.equal(canAccessOrderMessages({ id: 'user-1', role: 'unknown' }, order), false);
});
