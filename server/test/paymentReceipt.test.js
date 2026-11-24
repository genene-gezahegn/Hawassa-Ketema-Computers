import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePaymentReceipt } from '../src/utils/paymentReceipt.js';
import { assertOrderPaymentVerified } from '../src/utils/orderPayment.js';

test('accepts supported receipt signatures and permits a reference without a file', () => {
  const fixtures = [
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
    ['application/pdf', Buffer.from('%PDF-1.7')],
  ];

  for (const [mime, bytes] of fixtures) {
    assert.deepEqual(decodePaymentReceipt(mime, bytes.toString('base64')), bytes);
  }
  assert.equal(decodePaymentReceipt(undefined, undefined), null);
});

test('rejects mismatched, invalid, and oversized receipt uploads', () => {
  assert.throws(() => decodePaymentReceipt('image/png', undefined), /provided together/);
  assert.throws(() => decodePaymentReceipt('image/png', Buffer.from('not a PNG').toString('base64')), /does not match/);
  assert.throws(() => decodePaymentReceipt('image/jpeg', 'not-valid-base64'), /valid and 5 MB or smaller/);

  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
  oversized.set([0xff, 0xd8, 0xff]);
  assert.throws(
    () => decodePaymentReceipt('image/jpeg', oversized.toString('base64')),
    /valid and 5 MB or smaller/,
  );
});

test('requires a manually transferred order payment to be verified before fulfillment', async () => {
  const pendingClient = { query: async () => ({ rows: [{ status: 'pending_review' }] }) };
  await assert.rejects(
    assertOrderPaymentVerified(pendingClient, { id: 'order-1', paymentMethod: 'Bank transfer' }, 'Payment required.'),
    error => error.status === 409,
  );

  const verifiedClient = { query: async () => ({ rows: [{ status: 'verified' }] }) };
  await assert.doesNotReject(
    assertOrderPaymentVerified(verifiedClient, { id: 'order-1', paymentMethod: 'Bank transfer' }, 'Payment required.'),
  );
  await assert.rejects(
    assertOrderPaymentVerified(pendingClient, { id: 'order-2', paymentMethod: 'Manual bank transfer' }, 'Payment required.'),
    error => error.status === 409,
  );
});
