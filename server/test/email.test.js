import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  isEmailConfigured,
  sendEmail,
  sendNotificationEmail,
  validateEmailConfiguration,
} from '../src/utils/email.js';

const originalApiKey = process.env.RESEND_API_KEY;
const originalSender = process.env.AUTH_EMAIL_FROM;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
  if (originalSender === undefined) delete process.env.AUTH_EMAIL_FROM;
  else process.env.AUTH_EMAIL_FROM = originalSender;
  globalThis.fetch = originalFetch;
});

test('requires Resend API key and sender to be configured together', () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.AUTH_EMAIL_FROM;
  assert.equal(isEmailConfigured(), false);
  assert.doesNotThrow(validateEmailConfiguration);

  process.env.RESEND_API_KEY = 'test-key';
  assert.throws(validateEmailConfiguration, /must be configured together/);
});

test('sends email using Resend with the configured sender', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.AUTH_EMAIL_FROM = 'Store <noreply@example.com>';
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200 };
  };

  await sendEmail({
    to: 'customer@example.com',
    subject: 'Reset password',
    html: '<p>Reset link</p>',
  });

  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(request.options.body), {
    from: 'Store <noreply@example.com>',
    to: 'customer@example.com',
    subject: 'Reset password',
    html: '<p>Reset link</p>',
  });
});

test('surfaces provider errors and preserves notification failure status', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.AUTH_EMAIL_FROM = 'noreply@example.com';
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(sendEmail({
      to: 'customer@example.com',
      subject: 'Order update',
      text: 'Your order was updated.',
    }), /status 403/);
    assert.equal(await sendNotificationEmail({
      to: 'customer@example.com',
      subject: 'Order update',
      text: 'Your order was updated.',
    }), 'failed');
  } finally {
    console.error = originalError;
  }
});
