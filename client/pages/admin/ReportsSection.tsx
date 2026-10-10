// Admin → Reports: things members flagged (people, shops, bookings). Resolve or dismiss with a note.
import React, { useCallback, useState } from 'react';
import { api } from '../../api';
import { Link } from '../../router';
import { Badge, Button, Card, EmptyState, PageHeader, StatusBadge, Textarea, useApi } from '../../components/ui';
import { CheckIcon, FlagIcon } from '../../components/Icons';
import { formatDateTime, timeAgo } from '../../lib/format';
import type { AdminReport } from './types';
import { AsyncView, Dialog, FilterPills, refreshAdminCounts, useRunner } from './shared';

type Decision = 'resolved' | 'dismissed' | 'pending';

const DECISION_COPY: Record<Decision, { title: string; button: string; help: string; toast: string }> = {
  resolved: {
    title: 'Mark as resolved',
    button: 'Mark resolved',
    help: 'Use this when you took action, e.g. suspended the account or removed content.',
    toast: 'Report resolved.',
  },
  dismissed: {
    title: 'Dismiss report',
    button: 'Dismiss',
    help: 'Use this when no action is needed.',
    toast: 'Report dismissed.',
  },
  pending: {
    title: 'Reopen report',
    button: 'Reopen',
    help: 'Moves the report back to the waiting list.',
    toast: 'Report reopened.',
  },
};

/** Where the admin can look into the reported thing. */
function targetLink(r: AdminReport): { to: string; label: string; external?: boolean } | null {
  if (r.targetType === 'shop') return { to: `/shops/${r.targetId}`, label: 'View shop', external: true };
  if (r.targetType === 'user') {
    const email = r.target.match(/\(([^()\s]+@[^()\s]+)\)$/)?.[1];
    return { to: `/admin/users?q=${encodeURIComponent(email ?? r.target)}`, label: 'Find in Users' };
  }
  if (r.targetType === 'booking') return { to: '/admin/bookings', label: 'Open Bookings' };
  return null;
}

const DecisionModal: React.FC<{ report: AdminReport; decision: Decision; onClose: () => void; onDone: (r: AdminReport) => void }> = ({
  report, decision, onClose, onDone,
}) => {
  const [note, setNote] = useState(report.adminNote);
  const { run, busy } = useRunner();
  const copy = DECISION_COPY[decision];
  const save = () =>
    run(
      'decide',
      async () => {
        await api.patch(`/admin/reports/${report.id}`, { status: decision, adminNote: note.trim() });
        onDone({ ...report, status: decision, adminNote: note.trim() });
        refreshAdminCounts();
        onClose();
      },
      copy.toast,
    );
  return (
    <Dialog
      title={copy.title}
      onClose={onClose}
      closeDisabled={busy('decide')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy('decide')}>
            Cancel
          </Button>
          <Button variant={decision === 'resolved' ? 'success' : 'primary'} onClick={save} loading={busy('decide')}>
            {copy.button}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">{copy.help}</p>
        <Textarea
          label="Note for your records (optional)"
          rows={3}
          maxLength={2000}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Spoke to the artist, suspended the account for 2 weeks."
          hint="Only admins can see this."
        />
      </div>
    </Dialog>
  );
};

export const ReportsSection: React.FC = () => {
  const state = useApi<AdminReport[]>('/admin/reports');
  const [filter, setFilter] = useState('pending');
  const [deciding, setDeciding] = useState<{ report: AdminReport; decision: Decision } | null>(null);
  const closeDecide = useCallback(() => setDeciding(null), []);
  const onDone = useCallback(
    (r: AdminReport) => state.setData(list => (list ?? []).map(x => (x.id === r.id ? r : x))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.setData],
  );

  return (
    <>
      <PageHeader title="Reports" subtitle="Members can report people, shops and bookings. Look into each one, then resolve or dismiss it." />
      <AsyncView state={state}>
        {list => {
          const count = (s: string) => list.filter(r => r.status === s).length;
          const visible = filter === 'all' ? list : list.filter(r => r.status === filter);
          return (
            <>
              <FilterPills
                className="mb-4"
                value={filter}
                onChange={setFilter}
                options={[
                  { id: 'pending', label: 'Waiting', count: count('pending') },
                  { id: 'resolved', label: 'Resolved' },
                  { id: 'dismissed', label: 'Dismissed' },
                  { id: 'all', label: 'All' },
                ]}
              />
              {visible.length === 0 ? (
                <Card>
                  <EmptyState icon={<FlagIcon className="w-12 h-12" />} title={filter === 'pending' ? 'Nothing to review' : 'No reports here'}>
                    {filter === 'pending' ? 'No one has reported anything that needs your attention.' : 'Reports with this status will show up here.'}
                  </EmptyState>
                </Card>
              ) : (
                <div className="space-y-3">
                  {visible.map(r => {
                    const link = targetLink(r);
                    return (
                      <Card key={r.id} className="!p-4 sm:!p-5">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone="red" className="capitalize">
                                {r.targetType}
                              </Badge>
                              <span className="font-semibold text-brand-dark dark:text-white break-words">{r.target}</span>
                              <StatusBadge status={r.status} />
                            </div>
                            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{r.reason}</p>
                            <p className="mt-2 text-xs text-brand-gray">
                              Reported by {r.reporterName}
                              {r.reporterEmail && ` (${r.reporterEmail})`} · <span title={formatDateTime(r.createdAt)}>{timeAgo(r.createdAt)}</span>
                            </p>
                            {r.adminNote && (
                              <p className="mt-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-gray-700 dark:text-gray-300">
                                <span className="font-semibold">Your note:</span> {r.adminNote}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 flex-shrink-0">
                            {link &&
                              (link.external ? (
                                <a
                                  href={link.to}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-sm font-semibold px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                  {link.label}
                                </a>
                              ) : (
                                <Link
                                  to={link.to}
                                  className="inline-flex items-center text-sm font-semibold px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                  {link.label}
                                </Link>
                              ))}
                            {r.status === 'pending' ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => setDeciding({ report: r, decision: 'dismissed' })}>
                                  Dismiss
                                </Button>
                                <Button size="sm" variant="success" onClick={() => setDeciding({ report: r, decision: 'resolved' })}>
                                  <CheckIcon className="w-4 h-4" /> Resolve
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => setDeciding({ report: r, decision: 'pending' })}>
                                Reopen
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          );
        }}
      </AsyncView>
      {deciding && <DecisionModal report={deciding.report} decision={deciding.decision} onClose={closeDecide} onDone={onDone} />}
    </>
  );
};
