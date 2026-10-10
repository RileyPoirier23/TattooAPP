// Admin → Reviews: artist and shop reviews; hide inappropriate ones.
import React, { useState } from 'react';
import { api } from '../../api';
import { Badge, Button, Card, EmptyState, PageHeader, StarRating, cx, useApi } from '../../components/ui';
import { EyeIcon, StarIcon } from '../../components/Icons';
import { formatDate } from '../../lib/format';
import type { AdminReview } from './types';
import { AsyncView, FilterPills, SearchInput, useRunner } from './shared';

export const ReviewsSection: React.FC = () => {
  const state = useApi<AdminReview[]>('/admin/reviews');
  const [type, setType] = useState('all');
  const [visibility, setVisibility] = useState('all');
  const [q, setQ] = useState('');
  const { run, busy } = useRunner();

  const setHidden = (r: AdminReview, hidden: boolean) =>
    run(
      `${r.type}:${r.id}`,
      async () => {
        await api.patch(`/admin/reviews/${r.type}/${r.id}`, { hidden });
        state.setData(list => (list ?? []).map(x => (x.id === r.id && x.type === r.type ? { ...x, hidden } : x)));
      },
      hidden ? 'Review hidden. It no longer counts toward the rating.' : 'Review is visible again.',
    );

  return (
    <>
      <PageHeader title="Reviews" subtitle="Hide reviews that are abusive, fake or break your rules. Hidden reviews don't count toward ratings and can be shown again any time." />
      <AsyncView state={state}>
        {list => {
          const needle = q.trim().toLowerCase();
          const visible = list.filter(
            r =>
              (type === 'all' || r.type === type) &&
              (visibility === 'all' || (visibility === 'hidden') === r.hidden) &&
              (!needle || [r.text, r.author, r.subject].some(v => v?.toLowerCase().includes(needle))),
          );
          const hiddenCount = list.filter(r => r.hidden).length;
          return (
            <>
              <div className="space-y-3 mb-4">
                <SearchInput value={q} onChange={setQ} placeholder="Search reviews, authors or names" className="sm:max-w-md" />
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                  <FilterPills
                    value={type}
                    onChange={setType}
                    options={[
                      { id: 'all', label: 'All' },
                      { id: 'artist', label: 'Artists' },
                      { id: 'shop', label: 'Shops' },
                    ]}
                  />
                  <FilterPills
                    value={visibility}
                    onChange={setVisibility}
                    options={[
                      { id: 'all', label: 'Any' },
                      { id: 'visible', label: 'Visible' },
                      { id: 'hidden', label: 'Hidden', count: hiddenCount },
                    ]}
                  />
                </div>
              </div>
              {visible.length === 0 ? (
                <Card>
                  <EmptyState icon={<StarIcon className="w-12 h-12" />} title={list.length ? 'No matches' : 'No reviews yet'}>
                    {list.length ? 'Try a different search or filter.' : 'Reviews of artists and shops will appear here.'}
                  </EmptyState>
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {visible.map(r => (
                    <Card key={`${r.type}:${r.id}`} className={cx('!p-4 sm:!p-5 flex flex-col', r.hidden && 'opacity-70')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-brand-dark dark:text-white truncate">{r.subject}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <StarRating value={r.rating} size="w-4 h-4" />
                            <Badge tone={r.type === 'shop' ? 'blue' : 'brand'}>{r.type === 'shop' ? 'Shop' : 'Artist'}</Badge>
                            {r.hidden && <Badge tone="red">Hidden</Badge>}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={r.hidden ? 'outline' : 'ghost'}
                          loading={busy(`${r.type}:${r.id}`)}
                          onClick={() => setHidden(r, !r.hidden)}
                          className="flex-shrink-0"
                        >
                          {!busy(`${r.type}:${r.id}`) && <EyeIcon className="w-4 h-4" />}
                          {r.hidden ? 'Show' : 'Hide'}
                        </Button>
                      </div>
                      <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words flex-1">
                        {r.text || <span className="italic text-brand-gray">No written review.</span>}
                      </p>
                      <p className="mt-3 text-xs text-brand-gray">
                        By {r.author || 'a deleted user'} · {formatDate(r.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </>
          );
        }}
      </AsyncView>
    </>
  );
};
