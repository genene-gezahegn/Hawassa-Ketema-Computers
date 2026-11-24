const resendEndpoint = 'https://api.resend.com/emails';

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.AUTH_EMAIL_FROM?.trim());
}

export function validateEmailConfiguration() {
  const hasApiKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasSender = Boolean(process.env.AUTH_EMAIL_FROM?.trim());
  if (hasApiKey !== hasSender) {
    throw new Error('RESEND_API_KEY and AUTH_EMAIL_FROM must be configured together.');
  }
}

export async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    throw new Error('Password reset email is not configured.');
  }

  const response = await fetch(resendEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM.trim(),
      to,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const error = new Error(`Resend rejected the email request with status ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }
}

export async function sendNotificationEmail({ to, subject, text }) {
  if (!isEmailConfigured()) {
    console.warn(`[Email] ${subject} notification not sent: email is not configured.`);
    return 'not_configured';
  }

  try {
    await sendEmail({ to, subject, text });
    return 'sent';
  } catch (error) {
    console.error(
      '[Email notification] Resend error:',
      error.statusCode ?? '',
      error.message,
    );
    return 'failed';
  }
}