// Outgoing email: Resend's HTTPS API (works on hosts that block SMTP, e.g. Railway's Hobby plan) or any SMTP
// server — configured in Admin → Settings or via RESEND_API_KEY / SMTP_URL. Logs instead when not configured.
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from './config';
import { getSecrets, getSettings } from './settings';
import { escapeHtml } from './http';

let cached: { key: string; transport: Transporter } | null = null;

function transport(): Transporter | null {
  const s = getSecrets();
  const key = config.smtpUrl || `${s.smtpHost}|${s.smtpPort}|${s.smtpSecure}|${s.smtpUser}|${s.smtpPass}`;
  if (!config.smtpUrl && !s.smtpHost) return null;
  if (cached?.key === key) return cached.transport;
  const t = config.smtpUrl
    ? nodemailer.createTransport(config.smtpUrl)
    : nodemailer.createTransport({
        host: s.smtpHost,
        port: s.smtpPort,
        secure: s.smtpSecure,
        auth: s.smtpUser ? { user: s.smtpUser, pass: s.smtpPass } : undefined,
        // Fail within seconds (e.g. "Send test email" with a wrong host) instead of the default minutes.
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
      });
  cached = { key, transport: t };
  return t;
}

const resendKey = () => config.resendApiKey || getSecrets().resendApiKey;

export function emailReady(): boolean {
  return !!(resendKey() || config.smtpUrl || getSecrets().smtpHost);
}

function fromAddress(): string {
  const s = getSecrets();
  const from = (config.smtpFrom || s.smtpFrom || (resendKey() ? '' : s.smtpUser)).trim();
  if (!from.includes('@')) {
    throw new Error('Set a "From" email address in Admin → Settings → Email (for Resend, use an address on your verified domain).');
  }
  return from.includes('<') ? from : `${getSettings().siteName} <${from}>`;
}

async function sendWithResend(to: string, subject: string, text: string, html: string, replyTo?: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromAddress(), to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Resend rejected the email (${res.status}): ${body.message || res.statusText}`);
  }
}

export interface EmailInput {
  to: string;
  subject: string;
  /** Plain-text paragraphs. */
  lines: string[];
  action?: { label: string; url: string };
  /** Where replies go (e.g. the visitor who sent a contact-form message). */
  replyTo?: string;
}

export function renderEmail({ subject, lines, action }: EmailInput) {
  const site = getSettings();
  const text = [...lines, action ? `${action.label}: ${action.url}` : '', '', `— ${site.siteName}`].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:Arial,Helvetica,sans-serif;color:#101014">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:12px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(subject)}</h1>
      ${lines.map(l => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${escapeHtml(l)}</p>`).join('')}
      ${
        action
          ? `<p style="margin:24px 0 8px"><a href="${escapeHtml(action.url)}" style="background:${escapeHtml(site.primaryColor)};color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;display:inline-block">${escapeHtml(action.label)}</a></p>
             <p style="font-size:12px;color:#777;word-break:break-all">${escapeHtml(action.url)}</p>`
          : ''
      }
    </div>
    <p style="font-size:12px;color:#888;text-align:center;margin-top:16px">${escapeHtml(site.siteName)}</p>
  </div></body></html>`;
  return { text, html };
}

/** Sends an email in the background. Never throws. */
export function sendEmail(input: EmailInput) {
  void sendEmailNow(input).catch(err => console.error('[email] failed:', err?.message || err));
}

export async function sendEmailNow(input: EmailInput) {
  const { text, html } = renderEmail(input);
  if (resendKey()) return sendWithResend(input.to, input.subject, text, html, input.replyTo);
  const t = transport();
  if (!t) {
    // In production, don't write message bodies (which contain private booking / password-reset links) to logs.
    console.log(`[email] (email not configured) to=${input.to} subject="${input.subject}"${config.isProduction ? '' : `\n${text}`}`);
    return;
  }
  await t.sendMail({ from: fromAddress(), to: input.to, subject: input.subject, text, html, replyTo: input.replyTo });
}
