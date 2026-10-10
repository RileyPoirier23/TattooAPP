// Direct messages between users.
import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth';
import { getDb, newId, nowIso } from '../db';
import { badRequest, forbidden, notFound, parse } from '../http';
import { saveImage, upload } from '../uploads';
import { emit } from '../events';
import { getSettings } from '../settings';
import type { Conversation, Message } from '../../shared/types';

export const messagesRouter = Router();

const toMessage = (m: any): Message => ({
  id: m.id,
  conversationId: m.conversation_id,
  senderId: m.sender_id,
  content: m.content,
  attachmentUrl: m.attachment_url,
  createdAt: m.created_at,
});

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function findOrCreateConversation(userId: string, otherId: string): string {
  const db = getDb();
  const [a, b] = pair(userId, otherId);
  const existing = db.prepare('select id from conversations where user_a = ? and user_b = ?').get(a, b) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = newId();
  db.prepare('insert into conversations (id, user_a, user_b, created_at) values (?, ?, ?, ?)').run(id, a, b, nowIso());
  return id;
}

function insertMessage(conversationId: string, senderId: string, content: string, attachmentUrl: string | null): Message {
  const db = getDb();
  const id = newId();
  const now = nowIso();
  db.transaction(() => {
    db.prepare('insert into messages (id, conversation_id, sender_id, content, attachment_url, created_at) values (?, ?, ?, ?, ?, ?)')
      .run(id, conversationId, senderId, content, attachmentUrl, now);
    db.prepare('update conversations set last_message_at = ? where id = ?').run(now, conversationId);
  })();
  return { id, conversationId, senderId, content, attachmentUrl, createdAt: now };
}

/** Used for automated messages such as aftercare instructions. */
export function sendSystemMessage(fromId: string, toId: string, content: string) {
  const conversationId = findOrCreateConversation(fromId, toId);
  const msg = insertMessage(conversationId, fromId, content, null);
  emit(toId, 'message', msg);
  emit(fromId, 'message', msg);
  return msg;
}

function loadConversation(id: string, userId: string) {
  const c = getDb().prepare('select * from conversations where id = ?').get(id) as any;
  if (!c || (c.user_a !== userId && c.user_b !== userId)) throw notFound('Conversation not found.');
  return { ...c, otherId: c.user_a === userId ? c.user_b : c.user_a };
}

messagesRouter.get('/conversations', (req, res) => {
  const user = requireUser(req);
  const rows = getDb()
    .prepare(
      `select c.id, u.id other_id, u.name other_name, u.avatar_url other_avatar, u.role other_role,
         (select content from messages m where m.conversation_id = c.id order by created_at desc limit 1) last_content,
         (select attachment_url from messages m where m.conversation_id = c.id order by created_at desc limit 1) last_attachment,
         (select sender_id from messages m where m.conversation_id = c.id order by created_at desc limit 1) last_sender,
         c.last_message_at,
         (select count(*) from messages m where m.conversation_id = c.id and m.sender_id != @me and m.read_at is null) unread
       from conversations c join users u on u.id = case when c.user_a = @me then c.user_b else c.user_a end
       where c.user_a = @me or c.user_b = @me
       order by coalesce(c.last_message_at, c.created_at) desc`,
    )
    .all({ me: user.id }) as any[];
  const list: Conversation[] = rows.map(r => ({
    id: r.id,
    otherUser: { id: r.other_id, name: r.other_name, avatarUrl: r.other_avatar, role: r.other_role },
    lastMessage: r.last_message_at
      ? { content: r.last_content || (r.last_attachment ? '📷 Photo' : ''), createdAt: r.last_message_at, senderId: r.last_sender }
      : null,
    unreadCount: r.unread,
  }));
  res.json(list);
});

messagesRouter.post('/conversations', (req, res) => {
  const user = requireUser(req);
  if (!getSettings().features.messaging) throw forbidden('Messaging is currently turned off.');
  const { userId } = parse(z.object({ userId: z.string().min(1) }), req.body);
  if (userId === user.id) throw badRequest("You can't message yourself.");
  const other = getDb().prepare("select id from users where id = ? and status = 'active'").get(userId);
  if (!other) throw notFound('User not found.');
  res.json({ id: findOrCreateConversation(user.id, userId) });
});

messagesRouter.get('/conversations/:id/messages', (req, res) => {
  const user = requireUser(req);
  const c = loadConversation(req.params.id, user.id);
  const db = getDb();
  const rows = db
    .prepare('select * from (select * from messages where conversation_id = ? order by created_at desc limit 500) order by created_at')
    .all(c.id) as any[];
  const changed = db
    .prepare('update messages set read_at = ? where conversation_id = ? and sender_id != ? and read_at is null')
    .run(nowIso(), c.id, user.id).changes;
  if (changed) emit(user.id, 'message', { read: c.id });
  res.json(rows.map(toMessage));
});

messagesRouter.post('/conversations/:id/messages', upload.single('image'), (req, res) => {
  const user = requireUser(req);
  if (!getSettings().features.messaging) throw forbidden('Messaging is currently turned off.');
  const c = loadConversation(String(req.params.id), user.id);
  const content = typeof req.body?.content === 'string' ? req.body.content.trim().slice(0, 5000) : '';
  const attachment = req.file ? saveImage(req.file) : null;
  if (!content && !attachment) throw badRequest('Type a message or attach a photo.');
  const msg = insertMessage(c.id, user.id, content, attachment);
  emit(c.otherId, 'message', msg);
  emit(user.id, 'message', msg);
  res.status(201).json(msg);
});
