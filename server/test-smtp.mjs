import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEmailConfigured, sendEmail } from './src/utils/email.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env') });

if (!isEmailConfigured()) {
  throw new Error('Set EMAIL_HOST, EMAIL_USER, and EMAIL_APP_PASSWORD in server/.env first.');
}
if (!process.env.EMAIL_TEST_TO) {
  throw new Error('Set EMAIL_TEST_TO to an inbox you control before sending a test email.');
}

await sendEmail({
  to: process.env.EMAIL_TEST_TO,
  subject: 'Hawassa-Ketema SMTP delivery test',
  text: 'Gmail SMTP accepted this test message. Check the recipient inbox to confirm delivery.',
});
console.log('SMTP accepted the test email. Check the recipient inbox to confirm delivery.');
