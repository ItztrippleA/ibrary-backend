export function welcomeEmail(firstName: string, verifyUrl: string) {
  return {
    subject: 'Welcome to iBrary',
    html: `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Welcome to iBrary, your secondary-school learning app.</p>
      <p>Confirm your email to finish creating your account:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    `,
  };
}

export function resetEmail(firstName: string, token: string) {
  return {
    subject: 'Reset your iBrary password',
    html: `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Use this token to set a new password. It expires in one hour.</p>
      <p><strong>${escapeHtml(token)}</strong></p>
    `,
  };
}

export function receiptEmail(
  firstName: string,
  planName: string,
  amountNaira: string,
) {
  return {
    subject: 'Your iBrary subscription receipt',
    html: `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>You are subscribed to ${escapeHtml(planName)}.</p>
      <p>Amount paid: ${escapeHtml(amountNaira)}.</p>
      <p>Open the profile tab to view your subscription.</p>
    `,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
