// Admin → Verifications: approve or reject requests for a verified badge.
import React, { useState } from 'react';
import { api } from '../../api';
import { Link } from '../../router';
import { Badge, Button, Card, EmptyState, PageHeader, StatusBadge, useApi } from '../../components/ui';
import { CheckBadgeIcon, CheckIcon, StoreIcon, UserCircleIcon, XIcon } from '../../components/Icons';
import { formatDateTime, timeAgo } from '../../lib/format';
import type { Verification } from './types';
import { AsyncView, FilterPills, refreshAdminCounts, useRunner } from './shared';

export const VerificationsSection: React.FC = () => {
  const state = useApi<Verification[]>('/admin/verifications');
  const [filter, setFilter] = useState('pending');
  const { run, busy } = useRunner();

  const decide = (v: Verification, status: 'approved' | 'rejected') =>
    run(
      `${status}:${v.id}`,
      async () => {
        await api.post(`/admin/verifications/${v.id}`, { status });
        state.setData(list => (list ?? []).map(x => (x.id === v.id ? { ...x, status, decidedAt: new Date().toISOString() } : x)));
        refreshAdminCounts();
      },
      status === 'approved' ? `${v.type === 'shop' ? v.shopName || 'The shop' : v.userName} is now verified.` : 'Request rejected. They have been notified.',
    );

  return (
    <>
      <PageHeader
        title="Verifications"
        subtitle="Artists and shops can ask for a verified badge. Check their profile looks genuine (real work, real address) before approving."
      />
      <AsyncView state={state}>
        {list => {
          const pending = list.filter(v => v.status === 'pending');
          const visible = filter === 'pending' ? pending : list;
          return (
            <>
              <FilterPills
                className="mb-4"
                value={filter}
                onChange={setFilter}
                options={[
                  { id: 'pending', label: 'Waiting', count: pending.length },
                  { id: 'all', label: 'All requests' },
                ]}
              />
              {visible.length === 0 ? (
                <Card>
                  <EmptyState icon={<CheckBadgeIcon className="w-12 h-12" />} title={filter === 'pending' ? 'All caught up' : 'No requests yet'}>
                    {filter === 'pending' ? 'There are no verification requests waiting for you.' : 'Requests appear here when artists or shops ask to be verified.'}
                  </EmptyState>
                </Card>
              ) : (
                <div className="space-y-3">
                  {visible.map(v => {
                    const isShop = v.type === 'shop';
                    const profileUrl = isShop && v.shopId ? `/shops/${v.shopId}` : `/artists/${v.userId}`;
                    return (
                      <Card key={v.id} className="!p-4 sm:!p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <span className="w-11 h-11 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
                            {isShop ? <StoreIcon className="w-6 h-6" /> : <UserCircleIcon className="w-6 h-6" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-brand-dark dark:text-white">{isShop ? v.shopName || 'Deleted shop' : v.userName}</span>
                              <Badge tone={isShop ? 'blue' : 'brand'}>{isShop ? 'Shop' : 'Artist'}</Badge>
                              {v.status !== 'pending' && <StatusBadge status={v.status} />}
                            </div>
                            <p className="text-sm text-brand-gray">
                              {isShop && `Owner: ${v.userName} · `}
                              <Link to={`/admin/users?q=${encodeURIComponent(v.userEmail)}`} className="hover:text-brand-primary">
                                {v.userEmail}
                              </Link>{' '}
                              · requested {timeAgo(v.createdAt)}
                              {v.decidedAt && ` · decided ${formatDateTime(v.decidedAt)}`}
                            </p>
                            {v.note && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">“{v.note}”</p>}
                          </div>
                          <div className="flex flex-wrap gap-2 flex-shrink-0">
                            <a
                              href={profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm font-semibold px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              View {isShop ? 'shop' : 'profile'}
                            </a>
                            {v.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => decide(v, 'rejected')}
                                  loading={busy(`rejected:${v.id}`)}
                                  disabled={busy(`approved:${v.id}`)}
                                >
                                  <XIcon className="w-4 h-4" /> Reject
                                </Button>
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => decide(v, 'approved')}
                                  loading={busy(`approved:${v.id}`)}
                                  disabled={busy(`rejected:${v.id}`)}
                                >
                                  <CheckIcon className="w-4 h-4" /> Approve
                                </Button>
                              </>
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
    </>
  );
};
