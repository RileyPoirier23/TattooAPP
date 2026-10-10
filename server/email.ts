// Outgoing email via SMTP (configured in Admin → Settings, or SMTP_URL). Logs instead when not configured.
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
      });
  cached = { key, transport: t };
  return t;
}

export function emailReady(): boolean {
  return !!(config.smtpUrl || getSecrets().smtpHost);
}

function fromAddress(): string {
  const s = getSecrets();
  const from = config.smtpFrom || s.smtpFrom || s.smtpUser;
  return from.includes('<') ? from : `${getSettings().siteName} <${from}>`;
}

export interface EmailInput {
  to: string;
  subject: string;
  /** Plain-text paragraphs. */
  lines: string[];
  action?: { label: string; url: string };
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
  const t = transport();
  const { text, html } = renderEmail(input);
  if (!t) {
    console.log(`[email] (SMTP not configured) to=${input.to} subject="${input.subject}"\n${text}`);
    return;
  }
  await t.sendMail({ from: fromAddress(), to: input.to, subject: input.subject, text, html });
}
