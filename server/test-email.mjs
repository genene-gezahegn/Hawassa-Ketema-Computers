import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEmailConfigured, sendEmail } from './src/utils/email.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env') });

if (!isEmailConfigured()) {
  throw new Error('Set RESEND_API_KEY and AUTH_EMAIL_FROM in server/.env first.');
}
if (!process.env.RESEND_TEST_TO) {
  throw new Error('Set RESEND_TEST_TO to an inbox you control before sending a test email.');
}

await sendEmail({
  to: process.env.RESEND_TEST_TO,
  subject: 'Hawassa-Ketema email delivery test',
  text: 'Resend accepted this test message. Check the recipient inbox to confirm delivery.',
});
console.log('Resend accepted the test email. Check the recipient inbox to confirm delivery.');
