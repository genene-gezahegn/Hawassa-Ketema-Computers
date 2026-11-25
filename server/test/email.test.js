import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  getEmailTransport,
  isEmailConfigured,
  sendEmail,
  sendNotificationEmail,
} from '../src/utils/email.js';

const emailVariables = [
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_SECURE',
  'EMAIL_USER',
  'EMAIL_APP_PASSWORD',
  'EMAIL_FROM',
];
const originalValues = Object.fromEntries(emailVariables.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of emailVariables) {
    if (originalValues[name] === undefined) delete process.env[name];
    else process.env[name] = originalValues[name];
  }
});

test('allows startup without optional SMTP and reports notifications as unconfigured', async () => {
  for (const name of emailVariables) delete process.env[name];
  assert.equal(isEmailConfigured(), false);
  assert.equal(getEmailTransport(), null);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await sendNotificationEmail({
      to: 'customer@example.com',
      subject: 'Order update',
      text: 'Your order was updated.',
    }), 'not_configured');
  } finally {
    console.warn = originalWarn;
  }
});

test('uses the configured sender for optional notification messages', async () => {
  process.env.EMAIL_USER = 'mailer@example.com';
  process.env.EMAIL_FROM = 'Hawassa-Ketema Computers <mailer@example.com>';
  const sentMessages = [];
  const mailTransport = {
    sendMail: async (message) => {
      sentMessages.push(message);
      return { messageId: 'test-message-id' };
    },
  };

  await sendEmail({
    to: 'customer@example.com',
    subject: 'Order update',
    html: '<p>Your order was updated.</p>',
  }, mailTransport);
  assert.equal(await sendNotificationEmail({
    to: 'customer@example.com',
    subject: 'Order update',
    text: 'Your order was updated.',
  }, mailTransport), 'sent');

  assert.deepEqual(sentMessages, [
    {
      from: 'Hawassa-Ketema Computers <mailer@example.com>',
      to: 'customer@example.com',
      subject: 'Order update',
      html: '<p>Your order was updated.</p>',
    },
    {
      from: 'Hawassa-Ketema Computers <mailer@example.com>',
      to: 'customer@example.com',
      subject: 'Order update',
      text: 'Your order was updated.',
    },
  ]);
});

test('logs safe SMTP error details without logging the authentication message', async () => {
  const originalError = console.error;
  const loggedValues = [];
  console.error = (...values) => loggedValues.push(...values);
  try {
    const result = await sendNotificationEmail({
      to: 'customer@example.com',
      subject: 'Order update',
      text: 'Your order was updated.',
    }, {
      sendMail: async () => {
        const error = new Error('private authentication details');
        error.code = 'EAUTH';
        error.command = 'AUTH PLAIN';
        throw error;
      },
    });

    assert.equal(result, 'failed');
    assert.equal(loggedValues.includes('EAUTH'), true);
    assert.equal(loggedValues.includes('AUTH PLAIN'), true);
    assert.equal(loggedValues.includes('private authentication details'), false);
  } finally {
    console.error = originalError;
  }
});

test('creates an optional Gmail SMTP transport without making a network connection', () => {
  process.env.EMAIL_HOST = 'smtp.gmail.com';
  process.env.EMAIL_PORT = '465';
  process.env.EMAIL_SECURE = 'true';
  process.env.EMAIL_USER = 'mailer@gmail.com';
  process.env.EMAIL_APP_PASSWORD = 'test-only-password';
  process.env.EMAIL_FROM = 'Hawassa-Ketema Computers <mailer@gmail.com>';

  assert.equal(isEmailConfigured(), true);
  const transport = getEmailTransport();
  assert.equal(typeof transport.sendMail, 'function');
  assert.equal(transport.transporter.options.host, 'smtp.gmail.com');
  assert.equal(transport.transporter.options.port, 465);
  assert.equal(transport.transporter.options.secure, true);
});
