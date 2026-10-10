// Admin → Bookings: client booking requests and booth rentals.
import React, { useCallback, useState } from 'react';
import { api } from '../../api';
import { Badge, Button, Card, EmptyState, PageHeader, StarRating, StatusBadge, Tabs, cx, inputClass, useApi } from '../../components/ui';
import { CalendarIcon, EyeIcon, StoreIcon } from '../../components/Icons';
import { PREFERRED_TIMES, dollars, formatDate, formatDateTime, money, timeAgo } from '../../lib/format';
import type { BookingRequest, BookingStatus, BoothBooking } from '../../../shared/types';
import { AsyncView, ConfirmModal, DataTable, Dialog, FilterPills, Muted, SearchInput, Td, useRunner } from './shared';

const BOOKING_STATUSES: { id: BookingStatus; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'completed', label: 'Completed' },
  { id: 'declined', label: 'Declined' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'no-show', label: 'No-show' },
];

const shortDate = (d: string) => formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' });

const Detail: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-brand-gray">{label}</dt>
    <dd className="mt-0.5 text-sm text-brand-dark dark:text-gray-200 break-words">{children}</dd>
  </div>
);

const RequestDetails: React.FC<{ r: BookingRequest; onClose: () => void }> = ({ r, onClose }) => (
  <Dialog title="Booking request" size="lg" onClose={onClose}>
    <dl className="grid gap-4 sm:grid-cols-2">
      <Detail label="Client">
        {r.clientName} {r.isGuest && <Badge>Guest</Badge>}
        {r.guestEmail && (
          <a href={`mailto:${r.guestEmail}`} className="block text-brand-primary">
            {r.guestEmail}
          </a>
        )}
        {r.guestPhone && (
          <a href={`tel:${r.guestPhone}`} className="block text-brand-primary">
            {r.guestPhone}
          </a>
        )}
      </Detail>
      <Detail label="Artist">
        <a href={`/artists/${r.artistId}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary">
          {r.artistName}
        </a>
      </Detail>
      <Detail label="Requested date">
        {formatDate(r.date)} · {PREFERRED_TIMES[r.preferredTime] ?? r.preferredTime}
      </Detail>
      <Detail label="Service">
        {r.serviceName || 'Not specified'}
        {r.servicePrice != null && ` · from ${dollars(r.servicePrice)}`}
      </Detail>
      {!!(r.tattooWidth || r.tattooHeight) && (
        <Detail label="Size">
          {r.tattooWidth ?? '?'} × {r.tattooHeight ?? '?'} in
        </Detail>
      )}
      {r.bodyPlacement && <Detail label="Placement">{r.bodyPlacement}</Detail>}
      {r.budget != null && <Detail label="Budget">{dollars(r.budget)}</Detail>}
      <Detail label="Status">
        <StatusBadge status={r.status} /> {r.archived && <Badge>Archived by artist</Badge>}
      </Detail>
      <Detail label="Deposit">
        {money(r.depositCents)}
        {r.feeCents > 0 && ` + ${money(r.feeCents)} fee`} · <StatusBadge status={r.paymentStatus} />
        {r.depositPaidAt && <Muted>Paid {formatDateTime(r.depositPaidAt)}</Muted>}
      </Detail>
      <Detail label="Submitted">{formatDateTime(r.createdAt)}</Detail>
    </dl>
    {r.message && (
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-gray mb-1">Message from client</p>
        <p className="text-sm whitespace-pre-wrap rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 text-gray-700 dark:text-gray-300">{r.message}</p>
      </div>
    )}
    {r.referenceImages.length > 0 && (
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-gray mb-2">Reference images</p>
        <div className="flex flex-wrap gap-2">
          {r.referenceImages.map(url => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt="Reference" className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
            </a>
          ))}
        </div>
      </div>
    )}
    {r.artistNote && (
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-gray mb-1">Artist&apos;s note</p>
        <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{r.artistNote}</p>
      </div>
    )}
    {r.review && (
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-gray mb-1">Review</p>
        <StarRating value={r.review.rating} size="w-4 h-4" />
        {r.review.text && <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">{r.review.text}</p>}
      </div>
    )}
  </Dialog>
);

const RequestsTab: React.FC = () => {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const state = useApi<BookingRequest[]>(`/admin/booking-requests?status=${encodeURIComponent(status)}`);
  const [viewing, setViewing] = useState<BookingRequest | null>(null);
  const { run, busy } = useRunner();
  const closeView = useCallback(() => setViewing(null), []);

  const changeStatus = (r: BookingRequest, next: BookingStatus) =>
    run(
      `status:${r.id}`,
      async () => {
        await api.post(`/admin/booking-requests/${r.id}/status`, { status: next });
        state.setData(list => {
          const updated = (list ?? []).map(x => (x.id === r.id ? { ...x, status: next } : x));
          return status ? updated.filter(x => x.status === status) : updated;
        });
      },
      `Status changed to ${BOOKING_STATUSES.find(s => s.id === next)?.label ?? next}.`,
    );

  return (
    <>
      <div className="space-y-3 mb-4">
        <SearchInput value={q} onChange={setQ} placeholder="Search client, artist or email" className="sm:max-w-md" />
        <FilterPills value={status} onChange={setStatus} options={[{ id: '', label: 'All' }, ...BOOKING_STATUSES]} />
      </div>
      <AsyncView state={state}>
        {list => {
          const needle = q.trim().toLowerCase();
          const visible = needle
            ? list.filter(r => [r.clientName, r.artistName, r.guestEmail, r.guestPhone, r.serviceName].some(v => v?.toLowerCase().includes(needle)))
            : list;
          if (visible.length === 0) {
            return (
              <Card>
                <EmptyState icon={<CalendarIcon className="w-12 h-12" />} title={list.length ? 'No matches' : 'No booking requests'}>
                  {list.length ? 'Try a different search.' : status ? 'Nothing with this status right now.' : 'Requests from clients to artists will appear here.'}
                </EmptyState>
              </Card>
            );
          }
          return (
            <Card padded={false} className="overflow-hidden">
              <DataTable columns={['Client', 'Artist', 'Appointment', 'Service', 'Deposit', 'Status', '']}>
                {visible.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <Td className="min-w-[11rem]">
                      <span className="font-semibold flex flex-wrap items-center gap-1.5">
                        {r.clientName}
                        {r.isGuest && <Badge>Guest</Badge>}
                      </span>
                      {r.guestEmail && <Muted>{r.guestEmail}</Muted>}
                      {r.guestPhone && <Muted>{r.guestPhone}</Muted>}
                      <Muted>Sent {timeAgo(r.createdAt)}</Muted>
                    </Td>
                    <Td className="min-w-[8rem]">{r.artistName}</Td>
                    <Td className="whitespace-nowrap">
                      {shortDate(r.date)}
                      <Muted>{PREFERRED_TIMES[r.preferredTime] ?? r.preferredTime}</Muted>
                    </Td>
                    <Td className="min-w-[8rem]">
                      {r.serviceName || <span className="text-brand-gray">Not specified</span>}
                      {r.servicePrice != null && <Muted>from {dollars(r.servicePrice)}</Muted>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {money(r.depositCents)}
                      <div className="mt-1">
                        <StatusBadge status={r.paymentStatus} />
                      </div>
                    </Td>
                    <Td>
                      <select
                        value={r.status}
                        aria-label="Booking status"
                        disabled={busy(`status:${r.id}`)}
                        onChange={e => changeStatus(r, e.target.value as BookingStatus)}
                        className={cx(inputClass, 'py-1.5 text-sm w-40')}
                      >
                        {BOOKING_STATUSES.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(r)}>
                        <EyeIcon className="w-4 h-4" /> Details
                      </Button>
                    </Td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          );
        }}
      </AsyncView>
      <p className="mt-3 text-xs text-brand-gray">
        Changing a status here doesn&apos;t move money. To give a deposit back, refund it from the Payments page.
      </p>
      {viewing && <RequestDetails r={viewing} onClose={closeView} />}
    </>
  );
};

const BOOTH_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Awaiting payment' },
  { id: 'paid', label: 'Paid' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'refunded', label: 'Refunded' },
];

const BoothsTab: React.FC = () => {
  const state = useApi<BoothBooking[]>('/admin/booth-bookings');
  const [filter, setFilter] = useState('all');
  const [cancelling, setCancelling] = useState<BoothBooking | null>(null);
  const { run } = useRunner();
  const closeCancel = useCallback(() => setCancelling(null), []);

  const confirmCancel = (b: BoothBooking) =>
    run(
      'cancel',
      async () => {
        await api.post(`/admin/booth-bookings/${b.id}/cancel`);
        state.setData(list => (list ?? []).map(x => (x.id === b.id ? { ...x, status: 'cancelled' } : x)));
      },
      'Reservation cancelled. The booth is free again.',
    );

  return (
    <>
      <FilterPills className="mb-4" value={filter} onChange={setFilter} options={BOOTH_FILTERS} />
      <AsyncView state={state}>
        {list => {
          const visible = filter === 'all' ? list : list.filter(b => b.status === filter);
          if (visible.length === 0) {
            return (
              <Card>
                <EmptyState icon={<StoreIcon className="w-12 h-12" />} title="No booth rentals">
                  {list.length ? 'Nothing with this status.' : 'When artists book guest spots at shops, they appear here.'}
                </EmptyState>
              </Card>
            );
          }
          return (
            <Card padded={false} className="overflow-hidden">
              <DataTable columns={['Artist', 'Shop & booth', 'Dates', 'Total', 'Status', '']}>
                {visible.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <Td className="min-w-[9rem]">
                      <span className="font-semibold">{b.artistName}</span>
                      <Muted>Booked {timeAgo(b.createdAt)}</Muted>
                    </Td>
                    <Td className="min-w-[11rem]">
                      <a href={`/shops/${b.shopId}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brand-primary">
                        {b.shopName}
                      </a>
                      <Muted>
                        {b.boothName}
                        {b.shopCity && ` · ${b.shopCity}`}
                      </Muted>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(b.startDate, { month: 'short', day: 'numeric' })} – {shortDate(b.endDate)}
                      <Muted>
                        {b.days} day{b.days === 1 ? '' : 's'}
                      </Muted>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {money(b.totalCents)}
                      <Muted>Your cut {money(b.feeCents)}</Muted>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <StatusBadge status={b.status} />
                      {b.status === 'unpaid' && b.holdExpiresAt && <Muted className="mt-1">Held until {formatDateTime(b.holdExpiresAt)}</Muted>}
                      {b.status === 'paid' && b.paidAt && <Muted className="mt-1">Paid {formatDateTime(b.paidAt)}</Muted>}
                    </Td>
                    <Td className="text-right">
                      {b.status === 'unpaid' && (
                        <Button size="sm" variant="ghost" onClick={() => setCancelling(b)}>
                          Cancel
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          );
        }}
      </AsyncView>
      <p className="mt-3 text-xs text-brand-gray">To cancel a paid rental, refund its payment on the Payments page. That cancels the rental too.</p>
      {cancelling && (
        <ConfirmModal title="Cancel this reservation?" confirmLabel="Cancel reservation" onClose={closeCancel} onConfirm={() => confirmCancel(cancelling)}>
          <p>
            {cancelling.artistName}&apos;s unpaid reservation of <strong>{cancelling.boothName}</strong> at {cancelling.shopName} (
            {formatDate(cancelling.startDate, { month: 'short', day: 'numeric' })} – {shortDate(cancelling.endDate)}) will be cancelled and the dates freed up.
          </p>
        </ConfirmModal>
      )}
    </>
  );
};

export const BookingsSection: React.FC = () => {
  const [tab, setTab] = useState<'requests' | 'booths'>('requests');
  return (
    <>
      <PageHeader title="Bookings" subtitle="Tattoo appointment requests from clients, and booth rentals by artists." />
      <Tabs
        className="mb-5"
        tabs={[
          { id: 'requests', label: 'Client bookings' },
          { id: 'booths', label: 'Booth rentals' },
        ]}
        active={tab}
        onChange={id => setTab(id === 'booths' ? 'booths' : 'requests')}
      />
      {tab === 'requests' ? <RequestsTab /> : <BoothsTab />}
    </>
  );
};
