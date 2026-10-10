// "Contact us" form: visitors reach the site owner without the owner's email address being published.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDb, newId, nowIso } from '../db';
import { badRequest, parse } from '../http';
import { config } from '../config';
import { getSettings } from '../settings';
import { notifyAdmins } from '../notify';
import { sendEmail } from '../email';

export const contactRouter = Router();

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.isProduction ? 5 : 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: "You've sent several messages already. Please wait a while before sending another." },
});

contactRouter.post('/contact', limiter, (req, res) => {
  const body = parse(
    z.object({
      name: z.string().trim().min(1, 'Please enter your name').max(100).transform(v => v.replace(/[\r\n\t]+/g, ' ')),
      email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
      message: z.string().trim().min(10, 'Please write a little more').max(5000),
      website: z.string().max(200).optional(), // honeypot: real people never fill this hidden field
    }),
    req.body,
  );
  if (body.website) throw badRequest('Your message could not be sent.');
  const id = newId();
  getDb()
    .prepare('insert into contact_messages (id, name, email, message, user_id, created_at) values (?, ?, ?, ?, ?, ?)')
    .run(id, body.name, body.email, body.message, req.user?.id ?? null, nowIso());

  notifyAdmins(`New message from ${body.name} via the contact form.`, '/admin/inbox');
  const settings = getSettings();
  const admins = getDb().prepare("select email from users where role = 'admin' and status = 'active'").all() as { email: string }[];
  const recipients = settings.contactEmail ? [settings.contactEmail] : admins.map(a => a.email);
  for (const to of recipients) {
    sendEmail({
      to,
      replyTo: body.email,
      subject: `Contact form: message from ${body.name}`,
      lines: [`From: ${body.name} <${body.email}>`, ...body.message.split('\n'), 'Reply to this email to answer them directly.'],
      action: { label: 'Open inbox', url: `${config.appUrl}/admin/inbox` },
    });
  }
  res.status(201).json({ ok: true });
});
