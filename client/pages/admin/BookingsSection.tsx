// Admin → Bookings: client booking requests and booth rentals.
import React, { useCallback, useState } from 'react';
import { api } from '../../api';
import { Badge, Button, Card, EmptyState, PageHeader, StarRating, StatusBadge, Tabs, cx, inputClass } from '../../components/ui';
import { CalendarIcon, EyeIcon, StoreIcon } from '../../components/Icons';
import { RescheduleModal, formatTime } from '../../components/BookingCards';
import { PREFERRED_TIMES, dollars, formatDate, formatDateTime, money, timeAgo } from '../../lib/format';
import type { BookingRequest, BookingStatus, BoothBooking } from '../../../shared/types';
import { AsyncView, ConfirmModal, DataTable, Dialog, FilterPills, Muted, Pager, SearchInput, Td, useDebounced, usePaged, useRunner, type Paged } from './shared';

type WithCounts<T> = Paged<T> & { counts: Record<string, number> };

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

const RequestDetails: React.FC<{ r: BookingRequest; onClose: () => void; onReschedule: () => void }> = ({ r, onClose, onReschedule }) => (
  <Dialog
    title="Booking request"
    size="lg"
    onClose={onClose}
    footer={
      <>
        {(r.status === 'pending' || r.status === 'approved') && (
          <Button variant="outline" onClick={onReschedule}>
            <CalendarIcon className="w-4 h-4" /> Change date or time
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </>
    }
  >
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
      <Detail label={r.appointmentTime ? 'Appointment' : 'Requested date'}>
        {formatDate(r.date)} · {r.appointmentTime ? formatTime(r.appointmentTime) : PREFERRED_TIMES[r.preferredTime] ?? r.preferredTime}
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
  const dq = useDebounced(q.trim(), 300);
  const state = usePaged<WithCounts<BookingRequest>>('/admin/booking-requests', { status, q: dq });
  const [viewing, setViewing] = useState<BookingRequest | null>(null);
  const [rescheduling, setRescheduling] = useState<BookingRequest | null>(null);
  const { run, busy } = useRunner();
  const closeView = useCallback(() => setViewing(null), []);
  const counts = state.data?.counts ?? {};

  const changeStatus = (r: BookingRequest, next: BookingStatus) =>
    run(
      `status:${r.id}`,
      async () => {
        await api.post(`/admin/booking-requests/${r.id}/status`, { status: next });
        await state.reload();
      },
      `Status changed to ${BOOKING_STATUSES.find(s => s.id === next)?.label ?? next}. The client and artist were notified.`,
    );

  return (
    <>
      <div className="space-y-3 mb-4">
        <SearchInput value={q} onChange={setQ} placeholder="Search client, artist or email" loading={dq !== q.trim()} className="sm:max-w-md" />
        <FilterPills
          value={status}
          onChange={setStatus}
          options={[{ id: '', label: 'All' }, ...BOOKING_STATUSES.map(s => ({ ...s, count: s.id === 'pending' ? counts.pending : undefined }))]}
        />
      </div>
      <AsyncView state={state}>
        {({ items: list, total, pageSize }) => {
          if (list.length === 0) {
            return (
              <Card>
                <EmptyState icon={<CalendarIcon className="w-12 h-12" />} title={dq ? 'No matches' : 'No booking requests'}>
                  {dq ? 'Try a different search.' : status ? 'Nothing with this status right now.' : 'Requests from clients to artists will appear here.'}
                </EmptyState>
              </Card>
            );
          }
          return (
            <Card padded={false} className="overflow-hidden">
              <DataTable columns={['Client', 'Artist', 'Appointment', 'Service', 'Deposit', 'Status', '']}>
                {list.map(r => (
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
                      <Muted>{r.appointmentTime ? formatTime(r.appointmentTime) : PREFERRED_TIMES[r.preferredTime] ?? r.preferredTime}</Muted>
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
              <Pager page={state.page} pageSize={pageSize} total={total} onPage={state.setPage} noun={total === 1 ? 'request' : 'requests'} />
            </Card>
          );
        }}
      </AsyncView>
      <p className="mt-3 text-xs text-brand-gray">
        Changing a status here doesn&apos;t move money. To give a deposit back, refund it from the Payments page.
      </p>
      {viewing && (
        <RequestDetails
          r={viewing}
          onClose={closeView}
          onReschedule={() => {
            setRescheduling(viewing);
            setViewing(null);
          }}
        />
      )}
      {rescheduling && (
        <RescheduleModal
          r={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null);
            void state.reload();
          }}
        />
      )}
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
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const state = usePaged<WithCounts<BoothBooking>>('/admin/booth-bookings', { status: filter === 'all' ? '' : filter, q: dq });
  const [cancelling, setCancelling] = useState<BoothBooking | null>(null);
  const { run } = useRunner();
  const closeCancel = useCallback(() => setCancelling(null), []);

  const confirmCancel = (b: BoothBooking) =>
    run(
      'cancel',
      async () => {
        await api.post(`/admin/booth-bookings/${b.id}/cancel`);
        await state.reload();
      },
      'Reservation cancelled. The booth is free again.',
    );

  return (
    <>
      <div className="space-y-3 mb-4">
        <SearchInput value={q} onChange={setQ} placeholder="Search artist, shop or city" loading={dq !== q.trim()} className="sm:max-w-md" />
        <FilterPills value={filter} onChange={setFilter} options={BOOTH_FILTERS} />
      </div>
      <AsyncView state={state}>
        {({ items: visible, total, pageSize }) => {
          if (visible.length === 0) {
            return (
              <Card>
                <EmptyState icon={<StoreIcon className="w-12 h-12" />} title={dq ? 'No matches' : 'No booth rentals'}>
                  {dq ? 'Try a different search.' : filter !== 'all' ? 'Nothing with this status.' : 'When artists book guest spots at shops, they appear here.'}
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
              <Pager page={state.page} pageSize={pageSize} total={total} onPage={state.setPage} noun={total === 1 ? 'rental' : 'rentals'} />
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
