// Admin → Shops: verify, rename or delete tattoo shops.
import React, { useCallback, useState } from 'react';
import { api } from '../../api';
import { Link } from '../../router';
import { Button, Card, EmptyState, Input, PageHeader, StarRating, Toggle, useApi } from '../../components/ui';
import { EditIcon, StoreIcon, TrashIcon } from '../../components/Icons';
import { formatDate } from '../../lib/format';
import type { AdminShop } from './types';
import { AsyncView, ConfirmModal, DataTable, Dialog, FilterPills, Muted, SearchInput, Td, Toolbar, useRunner } from './shared';

const RenameModal: React.FC<{ shop: AdminShop; onClose: () => void; onSaved: (name: string) => void }> = ({ shop, onClose, onSaved }) => {
  const [name, setName] = useState(shop.name);
  const { run, busy } = useRunner();
  const save = () =>
    run(
      'rename',
      async () => {
        await api.patch(`/admin/shops/${shop.id}`, { name: name.trim() });
        onSaved(name.trim());
        onClose();
      },
      'Shop renamed.',
    );
  return (
    <Dialog
      title="Rename shop"
      size="sm"
      onClose={onClose}
      closeDisabled={busy('rename')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy('rename')}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy('rename')} disabled={!name.trim() || name.trim() === shop.name}>
            Save
          </Button>
        </>
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          if (name.trim() && name.trim() !== shop.name) save();
        }}
      >
        <Input label="Shop name" value={name} maxLength={120} autoFocus onChange={e => setName(e.target.value)} hint="The owner can also change this from their shop dashboard." />
      </form>
    </Dialog>
  );
};

export const ShopsSection: React.FC = () => {
  const state = useApi<AdminShop[]>('/admin/shops');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [renaming, setRenaming] = useState<AdminShop | null>(null);
  const [deleting, setDeleting] = useState<AdminShop | null>(null);
  const { run, busy } = useRunner();

  const closeRename = useCallback(() => setRenaming(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);
  const patchLocal = (id: string, patch: Partial<AdminShop>) => state.setData(list => (list ?? []).map(s => (s.id === id ? { ...s, ...patch } : s)));

  const setVerified = (s: AdminShop, isVerified: boolean) =>
    run(
      `verify:${s.id}`,
      async () => {
        await api.patch(`/admin/shops/${s.id}`, { isVerified });
        patchLocal(s.id, { isVerified });
      },
      isVerified ? `${s.name} is now verified. The owner has been notified.` : `${s.name} is no longer verified.`,
    );

  const confirmDelete = (s: AdminShop) =>
    run(
      'delete',
      async () => {
        await api.del(`/admin/shops/${s.id}`);
        state.setData(list => (list ?? []).filter(x => x.id !== s.id));
      },
      `${s.name} was deleted.`,
    );

  return (
    <>
      <PageHeader title="Shops" subtitle="Tattoo shops on your site. Verified shops get a badge that helps artists trust them." />
      <AsyncView state={state}>
        {shops => {
          const needle = q.trim().toLowerCase();
          const visible = shops.filter(
            s =>
              (filter === 'all' || (filter === 'verified') === s.isVerified) &&
              (!needle || [s.name, s.city, s.address, s.ownerName, s.ownerEmail].some(v => v?.toLowerCase().includes(needle))),
          );
          const unverified = shops.filter(s => !s.isVerified).length;
          return (
            <>
              <Toolbar>
                <SearchInput value={q} onChange={setQ} placeholder="Search shops, cities or owners" className="flex-1" />
                <FilterPills
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { id: 'all', label: `All (${shops.length})` },
                    { id: 'verified', label: 'Verified' },
                    { id: 'unverified', label: 'Not verified', count: unverified },
                  ]}
                />
              </Toolbar>
              {visible.length === 0 ? (
                <Card>
                  <EmptyState icon={<StoreIcon className="w-12 h-12" />} title={shops.length ? 'No matches' : 'No shops yet'}>
                    {shops.length ? 'Try a different search or filter.' : 'Shops appear here when a shop owner creates one.'}
                  </EmptyState>
                </Card>
              ) : (
                <Card padded={false} className="overflow-hidden">
                  <DataTable columns={['Shop', 'Owner', 'Booths', 'Rating', 'Verified', 'Added', '']}>
                    {visible.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <Td className="min-w-[12rem]">
                          <a href={`/shops/${s.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-brand-primary">
                            {s.name}
                          </a>
                          <Muted>{[s.address, s.city].filter(Boolean).join(', ') || 'No address yet'}</Muted>
                        </Td>
                        <Td className="min-w-[12rem]">
                          <Link to={`/admin/users?q=${encodeURIComponent(s.ownerEmail)}`} className="font-medium hover:text-brand-primary">
                            {s.ownerName}
                          </Link>
                          <Muted>{s.ownerEmail}</Muted>
                        </Td>
                        <Td>{s.boothCount}</Td>
                        <Td className="whitespace-nowrap">
                          {s.reviewCount > 0 ? <StarRating value={s.averageRating} size="w-4 h-4" count={s.reviewCount} /> : <span className="text-brand-gray">No reviews</span>}
                        </Td>
                        <Td>
                          <Toggle checked={s.isVerified} disabled={busy(`verify:${s.id}`)} onChange={v => setVerified(s, v)} />
                        </Td>
                        <Td className="whitespace-nowrap text-brand-gray">{formatDate(s.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</Td>
                        <Td className="text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => setRenaming(s)}>
                            <EditIcon className="w-4 h-4" /> Rename
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleting(s)} aria-label={`Delete ${s.name}`}>
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </DataTable>
                </Card>
              )}
            </>
          );
        }}
      </AsyncView>

      {renaming && <RenameModal shop={renaming} onClose={closeRename} onSaved={name => patchLocal(renaming.id, { name })} />}
      {deleting && (
        <ConfirmModal title="Delete this shop?" confirmLabel="Delete shop" onClose={closeDelete} onConfirm={() => confirmDelete(deleting)}>
          <p>
            <strong>{deleting.name}</strong> will be permanently removed, including its booths, reviews and past rentals. The owner&apos;s account stays.
          </p>
          <p>Shops with upcoming paid booth rentals can&apos;t be deleted. Refund those first in Payments.</p>
        </ConfirmModal>
      )}
    </>
  );
};
