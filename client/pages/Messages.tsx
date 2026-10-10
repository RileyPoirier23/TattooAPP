// Direct messages: conversation list + live chat thread with photo attachments.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage } from '../api';
import { prepareImage } from '../lib/images';
import { Link, navigate } from '../router';
import { useStore } from '../store';
import { formatDateTime, ROLE_LABELS, timeAgo } from '../lib/format';
import { ReportModal } from '../components/ReportModal';
import { Avatar, Button, Card, EmptyState, ErrorBox, PageLoader, Spinner, cx, useApi } from '../components/ui';
import { ArrowLeftIcon, ChatIcon, PaperAirplaneIcon, PaperClipIcon, XIcon } from '../components/Icons';
import type { Conversation, Message } from '../../shared/types';

const Thread: React.FC<{ convo: Conversation; onSent: () => void }> = ({ convo, onSent }) => {
  const me = useStore(s => s.user)!;
  const version = useStore(s => s.messagesVersion);
  const loadUnread = useStore(s => s.loadUnreadMessages);
  const toast = useStore(s => s.toast);
  const { data: messages, setData, error, loading, reload } = useApi<Message[]>(`/conversations/${convo.id}/messages`, [version]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
    if (messages) loadUnread();
  }, [messages, loadUnread]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || (!text.trim() && !file)) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('content', text.trim());
      if (file) fd.append('image', file);
      const msg = await api.post<Message>(`/conversations/${convo.id}/messages`, fd);
      setData(list => (list && !list.some(m => m.id === msg.id) ? [...list, msg] : list));
      setText('');
      setFile(null);
      onSent();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSending(false);
    }
  };

  const profileLink = convo.otherUser.role === 'artist' || convo.otherUser.role === 'dual' ? `/artists/${convo.otherUser.id}` : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <button onClick={() => navigate('/messages')} className="md:hidden p-1 -ml-1" aria-label="Back"><ArrowLeftIcon className="w-6 h-6" /></button>
        <Avatar name={convo.otherUser.name} url={convo.otherUser.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate">{profileLink ? <Link to={profileLink} className="hover:text-brand-primary">{convo.otherUser.name}</Link> : convo.otherUser.name}</p>
          <p className="text-xs text-brand-gray">{ROLE_LABELS[convo.otherUser.role]}</p>
        </div>
        <button onClick={() => setReporting(true)} className="text-xs text-brand-gray hover:text-red-500">Report</button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && <ErrorBox message={error} onRetry={reload} />}
        {loading && !messages && <div className="flex justify-center py-10"><Spinner /></div>}
        {messages?.length === 0 && <p className="text-center text-sm text-brand-gray py-10">Say hi 👋</p>}
        {messages?.map(m => {
          const mine = m.senderId === me.id;
          return (
            <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cx('max-w-[80%] rounded-2xl px-3.5 py-2.5', mine ? 'bg-brand-primary text-on-primary rounded-br-md' : 'bg-gray-100 dark:bg-gray-800 rounded-bl-md')}>
                {m.attachmentUrl && (
                  <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer">
                    <img src={m.attachmentUrl} alt="Attachment" className="rounded-lg mb-1.5 max-h-64 max-w-full" />
                  </a>
                )}
                {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                <p className={cx('text-[10px] mt-1', mine ? 'text-white/70' : 'text-brand-gray')}>{formatDateTime(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="border-t border-gray-200 dark:border-gray-800 p-3">
        {preview && (
          <div className="relative inline-block mb-2">
            <img src={preview} alt="" className="w-20 h-20 object-cover rounded-lg" />
            <button type="button" onClick={() => setFile(null)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5" aria-label="Remove photo"><XIcon className="w-4 h-4" /></button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="p-2.5 rounded-lg text-brand-gray hover:text-brand-primary hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" aria-label="Attach photo">
            <PaperClipIcon className="w-6 h-6" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={async e => {
                const picked = e.target.files?.[0];
                e.target.value = '';
                if (picked) setFile(await prepareImage(picked));
              }}
            />
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
            rows={1}
            placeholder="Write a message…"
            className="flex-1 resize-none rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 max-h-32"
          />
          <Button type="submit" loading={sending} disabled={!text.trim() && !file} className="rounded-full !px-3" aria-label="Send">
            <PaperAirplaneIcon className="w-5 h-5" />
          </Button>
        </div>
      </form>
      {reporting && <ReportModal targetType="user" targetId={convo.otherUser.id} label={convo.otherUser.name} onClose={() => setReporting(false)} />}
    </div>
  );
};

export const MessagesPage: React.FC<{ conversationId?: string }> = ({ conversationId }) => {
  const version = useStore(s => s.messagesVersion);
  const { data, error, loading, reload } = useApi<Conversation[]>('/conversations', [version]);
  const active = data?.find(c => c.id === conversationId);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading && !data) return <PageLoader />;

  return (
    <Card padded={false} className="max-w-6xl mx-auto overflow-hidden h-[calc(100vh-10rem)] min-h-[480px] grid md:grid-cols-[320px_1fr]">
      <aside className={cx('border-r border-gray-200 dark:border-gray-800 flex flex-col min-h-0', conversationId && 'hidden md:flex')}>
        <h1 className="px-4 py-3 text-lg font-bold border-b border-gray-200 dark:border-gray-800">Messages</h1>
        <div className="overflow-y-auto flex-1">
          {data?.length === 0 && (
            <EmptyState icon={<ChatIcon />} title="No conversations yet">Message an artist or shop from their profile page.</EmptyState>
          )}
          {data?.map(c => (
            <Link
              key={c.id}
              to={`/messages/${c.id}`}
              className={cx('flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800/60', c.id === conversationId ? 'bg-brand-primary/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40')}
            >
              <Avatar name={c.otherUser.name} url={c.otherUser.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <p className={cx('truncate', c.unreadCount ? 'font-bold' : 'font-semibold')}>{c.otherUser.name}</p>
                  {c.lastMessage && <span className="text-[11px] text-brand-gray whitespace-nowrap">{timeAgo(c.lastMessage.createdAt)}</span>}
                </div>
                <p className={cx('text-sm truncate', c.unreadCount ? 'text-brand-dark dark:text-white' : 'text-brand-gray')}>{c.lastMessage?.content || 'No messages yet'}</p>
              </div>
              {c.unreadCount > 0 && <span className="w-2.5 h-2.5 rounded-full bg-brand-primary flex-shrink-0" />}
            </Link>
          ))}
        </div>
      </aside>
      <section className={cx('min-h-0', !conversationId && 'hidden md:block')}>
        {active ? (
          <Thread key={active.id} convo={active} onSent={reload} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <EmptyState icon={<ChatIcon />} title={conversationId ? 'Conversation not found' : 'Select a conversation'} />
          </div>
        )}
      </section>
    </Card>
  );
};
