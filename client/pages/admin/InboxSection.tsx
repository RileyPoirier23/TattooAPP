// Admin → Inbox: messages visitors sent through the "Contact us" form.
import React, { useCallback, useState } from 'react';
import { api } from '../../api';
import { useStore } from '../../store';
import { Badge, Button, Card, EmptyState, Notice, PageHeader } from '../../components/ui';
import { InboxStackIcon, TrashIcon } from '../../components/Icons';
import { formatDateTime, timeAgo } from '../../lib/format';
import { AsyncView, ConfirmModal, FilterPills, LinkButton, Pager, SearchInput, refreshAdminCounts, useDebounced, usePaged, useRunner, type Paged } from './shared';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  userId: string | null;
  status: 'new' | 'replied' | 'archived';
  createdAt: string;
}

type InboxPage = Paged<ContactMessage> & { counts: Record<string, number> };

const STATUS_LABELS: Record<ContactMessage['status'], string> = { new: 'New', replied: 'Replied', archived: 'Archived' };

export const InboxSection: React.FC = () => {
  const settings = useStore(s => s.config?.settings);
  const [status, setStatus] = useState('new');
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const state = usePaged<InboxPage>('/admin/contact-messages', { status, q: dq });
  const [deleting, setDeleting] = useState<ContactMessage | null>(null);
  const { run, busy } = useRunner();
  const closeDelete = useCallback(() => setDeleting(null), []);
  const counts = state.data?.counts ?? {};

  const setMessageStatus = (m: ContactMessage, next: ContactMessage['status']) =>
    run(`status:${m.id}`, async () => {
      await api.patch(`/admin/contact-messages/${m.id}`, { status: next });
      await state.reload();
      refreshAdminCounts();
    });

  const confirmDelete = (m: ContactMessage) =>
    run(
      'delete',
      async () => {
        await api.del(`/admin/contact-messages/${m.id}`);
        await state.reload();
        refreshAdminCounts();
      },
      'Message deleted.',
    );

  const replyLink = (m: ContactMessage) =>
    `mailto:${m.email}?subject=${encodeURIComponent(`Re: your message to ${settings?.siteName ?? 'us'}`)}&body=${encodeURIComponent(
      `Hi ${m.name},\n\n\n\n---\nYou wrote on ${formatDateTime(m.createdAt)}:\n${m.message.split('\n').map(l => `> ${l}`).join('\n')}`,
    )}`;

  return (
    <>
      <PageHeader title="Inbox" subtitle="Messages people sent with the “Contact us” form. Reply by email; their address is filled in for you." />
      {!settings?.contactEmail && (
        <Notice tone="info" className="mb-6">
          New messages are also emailed to every admin. To send them to a different address, set a <strong>contact email</strong> in Customize.
        </Notice>
      )}
      <div className="space-y-3 mb-4">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, email or message" loading={dq !== q.trim()} className="sm:max-w-md" />
        <FilterPills
          value={status}
          onChange={setStatus}
          options={[
            { id: 'new', label: 'New', count: counts.new },
            { id: 'replied', label: 'Replied' },
            { id: 'archived', label: 'Archived' },
            { id: '', label: 'All' },
          ]}
        />
      </div>
      <AsyncView state={state}>
        {({ items, total, pageSize }) =>
          items.length === 0 ? (
            <Card>
              <EmptyState icon={<InboxStackIcon className="w-12 h-12" />} title={dq ? 'No matches' : status === 'new' ? 'No new messages' : 'Nothing here'}>
                {dq ? 'Try a different search.' : 'Messages from the contact form will appear here.'}
              </EmptyState>
            </Card>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map(m => (
                  <li key={m.id} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-brand-dark dark:text-white flex flex-wrap items-center gap-2">
                          {m.name}
                          {m.userId && <Badge tone="blue">Has an account</Badge>}
                          {m.status !== 'new' && <Badge>{STATUS_LABELS[m.status]}</Badge>}
                        </p>
                        <a href={`mailto:${m.email}`} className="text-sm text-brand-primary break-all">
                          {m.email}
                        </a>
                      </div>
                      <span className="text-xs text-brand-gray" title={formatDateTime(m.createdAt)}>
                        {timeAgo(m.createdAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">{m.message}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <LinkButton href={replyLink(m)} primary className="!px-3 !py-1.5" onClick={() => m.status === 'new' && setMessageStatus(m, 'replied')}>
                        Reply by email
                      </LinkButton>
                      {m.status === 'new' && (
                        <Button size="sm" variant="outline" loading={busy(`status:${m.id}`)} onClick={() => setMessageStatus(m, 'replied')}>
                          Mark as replied
                        </Button>
                      )}
                      {m.status !== 'archived' ? (
                        <Button size="sm" variant="ghost" disabled={busy(`status:${m.id}`)} onClick={() => setMessageStatus(m, 'archived')}>
                          Archive
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={busy(`status:${m.id}`)} onClick={() => setMessageStatus(m, 'new')}>
                          Move back to new
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => setDeleting(m)} aria-label={`Delete message from ${m.name}`}>
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <Pager page={state.page} pageSize={pageSize} total={total} onPage={state.setPage} noun={total === 1 ? 'message' : 'messages'} />
            </Card>
          )
        }
      </AsyncView>
      {deleting && (
        <ConfirmModal title="Delete this message?" confirmLabel="Delete" onClose={closeDelete} onConfirm={() => confirmDelete(deleting)}>
          <p>The message from {deleting.name} will be permanently deleted.</p>
        </ConfirmModal>
      )}
    </>
  );
};
