/**
 * Email helper — sends emails via the backend /api/send-email endpoint.
 * SMTP credentials are read from Firestore siteSettings at runtime.
 */

import { apiUrl } from './api';

interface SmtpConfig {
  host: string;
  port: string;
  user: string;
  pass: string;
  secure?: boolean;
}

interface SendEmailParams {
  smtp?: SmtpConfig;
  resendApiKey?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

async function sendEmail(params: SendEmailParams): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[Email] Server error:', err);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Email] Network error:', err);
    return false;
  }
}

/** Email config object — either Resend or SMTP. */
export interface EmailTransport {
  resendApiKey?: string;
  smtp?: SmtpConfig;
}

/** Build the email transport config from siteSettings. Resend takes priority. */
export function buildEmailTransport(s: {
  emailProvider?: 'resend' | 'smtp';
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
}): EmailTransport | null {
  // Resend preferred
  if (s.emailProvider === 'resend' && s.resendApiKey) {
    return { resendApiKey: s.resendApiKey };
  }
  // SMTP fallback
  if (s.smtpHost && s.smtpUser && s.smtpPass) {
    return {
      smtp: {
        host: s.smtpHost,
        port: s.smtpPort || '587',
        user: s.smtpUser,
        pass: s.smtpPass,
        secure: s.smtpSecure,
      },
    };
  }
  // Auto-detect: if Resend key exists, use it
  if (s.resendApiKey) {
    return { resendApiKey: s.resendApiKey };
  }
  return null;
}

/** Legacy helper — kept for backward compat. */
export function buildSmtp(s: {
  emailProvider?: 'resend' | 'smtp';
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
}): EmailTransport | null {
  return buildEmailTransport(s);
}

// ─── Admin notification ─────────────────────────────────────

export interface InquiryData {
  name: string;
  company: string;
  email: string;
  phone: string;
  vehicleModel: string;
  partNeed: string;
  quantity: string;
  message: string;
}

export function sendAdminNotification(
  transport: EmailTransport,
  notifyEmails: string,
  inquiry: InquiryData,
): Promise<boolean> {
  const to = notifyEmails.split(/[,;]/).map(e => e.trim()).filter(Boolean);
  if (to.length === 0) return Promise.resolve(false);

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:8px;">
  <h2 style="color:#FFB300;margin-top:0;">🔔 New Inquiry from ${inquiry.company || inquiry.name || 'Website'}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:8px 12px;font-weight:bold;color:#333;width:130px;">Name</td><td style="padding:8px 12px;color:#555;">${inquiry.name}</td></tr>
    <tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;color:#333;">Company</td><td style="padding:8px 12px;color:#555;">${inquiry.company}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#333;">Email</td><td style="padding:8px 12px;color:#555;"><a href="mailto:${inquiry.email}">${inquiry.email}</a></td></tr>
    <tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;color:#333;">Phone</td><td style="padding:8px 12px;color:#555;">${inquiry.phone}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#333;">Vehicle Model</td><td style="padding:8px 12px;color:#555;">${inquiry.vehicleModel}</td></tr>
    <tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;color:#333;">Part Need</td><td style="padding:8px 12px;color:#555;">${inquiry.partNeed}</td></tr>
    <tr><td style="padding:8px 12px;font-weight:bold;color:#333;">Quantity</td><td style="padding:8px 12px;color:#555;">${inquiry.quantity}</td></tr>
  </table>
  ${inquiry.message ? `<div style="margin-top:16px;padding:16px;background:#fff;border-radius:6px;border:1px solid #e5e7eb;font-size:14px;color:#333;white-space:pre-wrap;">${inquiry.message}</div>` : ''}
  <p style="margin-top:20px;font-size:12px;color:#999;">Sent from Vida Auto website inquiry form</p>
</div>`;

  return sendEmail({
    ...transport,
    to,
    subject: `[New Inquiry] ${inquiry.company || inquiry.name} — ${inquiry.partNeed || 'General'}`,
    html,
    replyTo: inquiry.email,
  });
}

// ─── Customer auto-reply ────────────────────────────────────

export function sendCustomerAutoReply(
  transport: EmailTransport,
  customerEmail: string,
  customerName: string,
): Promise<boolean> {
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:8px;">
  <h2 style="color:#0A192F;margin-top:0;">Thank you for your inquiry, ${customerName || 'Valued Customer'}!</h2>
  <p style="font-size:15px;color:#333;line-height:1.6;">
    We have received your inquiry and our sales team will get back to you within <strong>24 hours</strong> (business days).
  </p>
  <p style="font-size:15px;color:#333;line-height:1.6;">
    If your request is urgent, feel free to reach us on WhatsApp for a faster response.
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
  <p style="font-size:13px;color:#999;">
    This is an automated message from <strong>Vida Auto</strong>. Please do not reply directly to this email.
  </p>
</div>`;

  return sendEmail({
    ...transport,
    to: customerEmail,
    subject: 'We received your inquiry — Vida Auto',
    html,
  });
}

// ─── Admin reply (from dashboard) ───────────────────────────

export function sendReplyEmail(
  transport: EmailTransport,
  to: string,
  subject: string,
  body: string,
  fromName?: string,
): Promise<boolean> {
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <div style="font-size:15px;color:#333;line-height:1.6;white-space:pre-wrap;">${body}</div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
  <p style="font-size:12px;color:#999;">— ${fromName || 'Vida Auto Team'}</p>
</div>`;

  return sendEmail({
    ...transport,
    to,
    subject,
    html,
    text: body,
  });
}
