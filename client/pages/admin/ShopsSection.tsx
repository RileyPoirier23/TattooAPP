// Admin → Shops: verify, edit or delete tattoo shops.
import React, { useCallback, useState } from 'react';
import { Link } from '../../router';
import { api, errorMessage } from '../../api';
import { useStore } from '../../store';
import { Button, Card, EmptyState, PageHeader, StarRating, Toggle, cx, useApi } from '../../components/ui';
import { EditIcon, PhotoIcon, StoreIcon, TrashIcon, UploadIcon } from '../../components/Icons';
import { formatDate } from '../../lib/format';
import { prepareImage } from '../../lib/images';
import { ShopDetailsForm } from '../ShopDashboard';
import type { Shop } from '../../../shared/types';
import type { AdminShop } from './types';
import { AsyncView, ConfirmModal, DataTable, Dialog, FilterPills, Muted, SearchInput, Td, Toolbar, useRunner } from './shared';

const EditShopModal: React.FC<{ shopId: string; onClose: () => void; onSaved: (s: Shop) => void }> = ({ shopId, onClose, onSaved }) => {
  const shop = useApi<Shop>(`/shops/${shopId}`);
  const toast = useStore(s => s.toast);
  const [uploading, setUploading] = useState(false);
  const uploadCover = async (picked: File | undefined) => {
    if (!picked) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', await prepareImage(picked));
      const saved = await api.post<Shop>(`/shops/${shopId}/image`, fd);
      shop.setData(saved);
      onSaved(saved);
      toast('Cover photo updated.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  };
  return (
    <Dialog title="Edit shop" size="lg" onClose={onClose}>
      <AsyncView state={shop}>
        {s => (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-full sm:w-48 h-28 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {s.imageUrl ? <img src={s.imageUrl} alt="" className="w-full h-full object-cover" /> : <PhotoIcon className="w-8 h-8 text-brand-gray" />}
              </div>
              <label className="inline-flex">
                <span className={cx('cursor-pointer inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800', uploading && 'opacity-50 pointer-events-none')}>
                  <UploadIcon className="w-4 h-4" /> {uploading ? 'Uploading…' : s.imageUrl ? 'Replace cover photo' : 'Add cover photo'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={e => {
                    uploadCover(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <ShopDetailsForm
              shop={s}
              submitLabel="Save changes"
              onSaved={saved => {
                onSaved(saved);
                onClose();
              }}
            />
            <p className="text-xs text-brand-gray">The owner is not notified about changes you make here. Booths and blocked dates are managed by the owner from their shop dashboard.</p>
          </div>
        )}
      </AsyncView>
    </Dialog>
  );
};

export const ShopsSection: React.FC = () => {
  const state = useApi<AdminShop[]>('/admin/shops');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<AdminShop | null>(null);
  const [deleting, setDeleting] = useState<AdminShop | null>(null);
  const { run, busy } = useRunner();

  const closeEdit = useCallback(() => setEditing(null), []);
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
                          <Toggle checked={s.isVerified} disabled={busy(`verify:${s.id}`)} onChange={v => setVerified(s, v)} ariaLabel={`${s.name} verified`} />
                        </Td>
                        <Td className="whitespace-nowrap text-brand-gray">{formatDate(s.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</Td>
                        <Td className="text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                            <EditIcon className="w-4 h-4" /> Edit
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

      {editing && (
        <EditShopModal
          shopId={editing.id}
          onClose={closeEdit}
          onSaved={saved => patchLocal(saved.id, { name: saved.name, city: saved.city, address: saved.address })}
        />
      )}
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
