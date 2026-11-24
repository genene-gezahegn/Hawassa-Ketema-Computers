import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionEmployeeOrderStatus } from '../src/utils/employeeOrderWorkflow.js';

test('employees can confirm, process, and ready orders in sequence', () => {
  assert.equal(canTransitionEmployeeOrderStatus('pending', 'confirmed'), true);
  assert.equal(canTransitionEmployeeOrderStatus('confirmed', 'processing'), true);
  assert.equal(canTransitionEmployeeOrderStatus('processing', 'ready'), true);
});

test('employees cannot skip order fulfillment steps or change terminal orders', () => {
  assert.equal(canTransitionEmployeeOrderStatus('pending', 'processing'), false);
  assert.equal(canTransitionEmployeeOrderStatus('pending', 'ready'), false);
  assert.equal(canTransitionEmployeeOrderStatus('confirmed', 'ready'), false);
  assert.equal(canTransitionEmployeeOrderStatus('ready', 'processing'), false);
  assert.equal(canTransitionEmployeeOrderStatus('completed', 'ready'), false);
  assert.equal(canTransitionEmployeeOrderStatus('cancelled', 'confirmed'), false);
});
