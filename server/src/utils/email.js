import nodemailer from 'nodemailer';

const requiredEmailVariables = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_APP_PASSWORD'];
let transport;

export function isEmailConfigured() {
  return requiredEmailVariables.every((name) => Boolean(process.env[name]?.trim()));
}

export function getEmailTransport() {
  if (!isEmailConfigured()) return null;

  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST.trim(),
      port: Number(process.env.EMAIL_PORT || 465),
      secure: process.env.EMAIL_SECURE?.toLowerCase() !== 'false',
      auth: {
        user: process.env.EMAIL_USER.trim(),
        pass: process.env.EMAIL_APP_PASSWORD.trim(),
      },
    });
  }
  return transport;
}

export async function sendEmail({ to, subject, html, text }, mailTransport = getEmailTransport()) {
  if (!mailTransport) {
    throw new Error('Email transport is not configured.');
  }

  return mailTransport.sendMail({
    from: process.env.EMAIL_FROM || `Hawassa-Ketema Computers <${process.env.EMAIL_USER}>`,
    to,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  });
}

export async function sendNotificationEmail({ to, subject, text }, mailTransport = getEmailTransport()) {
  if (!mailTransport) {
    console.warn(`[Email] ${subject} notification not sent: email is not configured.`);
    return 'not_configured';
  }

  try {
    await sendEmail({ to, subject, text }, mailTransport);
    return 'sent';
  } catch (error) {
    console.error(
      '[Email notification] SMTP error:',
      error.code ?? '',
      error.command ?? '',
      error.responseCode ?? '',
    );
    return 'failed';
  }
}
