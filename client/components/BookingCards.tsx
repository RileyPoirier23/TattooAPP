// Booking cards + their action dialogs, shared by My Bookings, the artist dashboard and the shop dashboard.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { navigate } from '../router';
import { useStore } from '../store';
import { currencySymbol, dollars, formatDate, formatDateTime, money, parseDate, PREFERRED_TIMES, timeAgo, today } from '../lib/format';
import { PayBoothModal, PayDepositModal } from './PaymentModals';
import { ReportModal } from './ReportModal';
import { Calendar } from './Calendar';
import { Avatar, Badge, Button, Card, Input, Modal, Select, StarRating, StatusBadge, Textarea } from './ui';
import { CalendarIcon, CameraIcon, ChatIcon, CreditCardIcon, PaperAirplaneIcon } from './Icons';
import type { BookingRequest, BoothBooking } from '../../shared/types';

// ---------- Shared helpers ----------

async function openConversation(userId: string) {
  const { id } = await api.post<{ id: string }>('/conversations', { userId });
  navigate(`/messages/${id}`);
}

const stamp = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;

function calendarLink(r: BookingRequest) {
  const text = encodeURIComponent(`Tattoo: ${r.serviceName} with ${r.artistName}`);
  let dates: string;
  if (r.appointmentTime) {
    // A timed event in the visitor's own time zone (2 hours unless we know better).
    const [h, m] = r.appointmentTime.split(':').map(Number);
    const start = parseDate(r.date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + 2 * 3_600_000);
    dates = `${stamp(start)}/${stamp(end)}`;
  } else {
    const next = parseDate(r.date);
    next.setDate(next.getDate() + 1);
    dates = `${r.date.replace(/-/g, '')}/${stamp(next).slice(0, 8)}`;
  }
  const details = encodeURIComponent(r.appointmentTime ? `Booked via ${window.location.host}` : `Time: ${PREFERRED_TIMES[r.preferredTime] || r.preferredTime} (confirm with your artist)`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
}

/** "1:00 PM" from "13:00". */
export function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export const ReviewModal: React.FC<{ title: string; onSubmit: (rating: number, text: string) => Promise<void>; onClose: () => void }> = ({ title, onSubmit, onClose }) => {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useStore(s => s.toast);
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit(rating, text);
                toast('Thanks for your review!');
                onClose();
              } catch (err) {
                toast(errorMessage(err), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Post review
          </Button>
        </>
      }
    >
      <div className="text-center space-y-4">
        <StarRating value={rating} onChange={setRating} size="w-9 h-9" />
        <Textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Share your experience…" maxLength={2000} />
      </div>
    </Modal>
  );
};

const Detail: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div>
    <dt className="text-xs text-brand-gray">{k}</dt>
    <dd className="font-medium">{v}</dd>
  </div>
);

const RequestDetails: React.FC<{ r: BookingRequest }> = ({ r }) => (
  <div className="mt-4 space-y-3 text-sm">
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Detail
        k={r.appointmentTime ? 'Appointment' : 'Date'}
        v={`${formatDate(r.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${r.appointmentTime ? formatTime(r.appointmentTime) : `${PREFERRED_TIMES[r.preferredTime] || r.preferredTime} (requested)`}`}
      />
      {(r.tattooWidth || r.tattooHeight) && <Detail k="Size" v={`${r.tattooWidth ?? '?'}" × ${r.tattooHeight ?? '?'}"`} />}
      {r.bodyPlacement && <Detail k="Placement" v={r.bodyPlacement} />}
      {r.budget != null && <Detail k="Budget" v={dollars(r.budget)} />}
    </dl>
    {r.message && <p className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 whitespace-pre-line">{r.message}</p>}
    {r.referenceImages.length > 0 && (
      <div className="flex gap-2 flex-wrap">
        {r.referenceImages.map(url => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
            <img src={url} alt="Reference" className="w-20 h-20 object-cover rounded-lg hover:opacity-80" />
          </a>
        ))}
      </div>
    )}
    {r.artistNote && <p className="text-sm"><span className="text-brand-gray">Artist note:</span> {r.artistNote}</p>}
  </div>
);

function paymentBadge(r: BookingRequest) {
  if (r.status !== 'approved' && r.paymentStatus === 'unpaid') return null;
  if (r.depositCents === 0 && r.paymentStatus !== 'refunded') return <Badge tone="gray">No deposit</Badge>;
  if (r.paymentStatus === 'paid') return <Badge tone="green">Deposit paid</Badge>;
  if (r.paymentStatus === 'refunded') return <Badge tone="purple">Refunded</Badge>;
  return <Badge tone="yellow">Deposit due</Badge>;
}

// ---------- Client's view of a booking request ----------

export const ClientRequestCard: React.FC<{ request: BookingRequest; token?: string; onChanged: () => void }> = ({ request: r, token, onChanged }) => {
  const toast = useStore(s => s.toast);
  const user = useStore(s => s.user);
  const features = useStore(s => s.config!.settings.features);
  const [paying, setPaying] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    const paidWarning = r.paymentStatus === 'paid' ? '\n\nYour deposit has been paid — the site admin will review it for a refund according to the booking policy.' : '';
    if (!window.confirm(`Cancel your booking with ${r.artistName}?${paidWarning}`)) return;
    setBusy(true);
    try {
      await api.post(`/booking-requests/${r.id}/action`, { action: 'cancel', token });
      toast('Booking cancelled.');
      onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const total = r.depositCents + r.feeCents;
  const needsPayment = r.status === 'approved' && r.paymentStatus === 'unpaid' && r.depositCents > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-lg">{r.serviceName} with {r.artistName}</p>
          <p className="text-sm text-brand-gray">Requested {timeAgo(r.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={r.status} />
          {paymentBadge(r)}
        </div>
      </div>
      <RequestDetails r={r} />
      {needsPayment && (
        <div className="mt-4 rounded-xl border border-brand-primary/40 bg-brand-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{r.artistName} approved your request! 🎉</p>
            <p className="text-sm text-brand-gray">
              Pay your {money(r.depositCents)} deposit{r.feeCents > 0 && <> plus a {money(r.feeCents)} booking fee</>} to lock in your date.
            </p>
          </div>
          <Button onClick={() => setPaying(true)}><CreditCardIcon className="w-5 h-5" /> Pay {money(total)}</Button>
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-2">
        {r.status === 'approved' && (
          <a href={calendarLink(r)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><CalendarIcon className="w-4 h-4" /> Add to calendar</Button>
          </a>
        )}
        {user && features.messaging && (
          <Button variant="outline" size="sm" onClick={() => openConversation(r.artistId).catch(err => toast(errorMessage(err), 'error'))}>
            <ChatIcon className="w-4 h-4" /> Message artist
          </Button>
        )}
        {!user && features.messaging && (
          <Button variant="outline" size="sm" onClick={() => useStore.getState().openAuth('register')}>
            <ChatIcon className="w-4 h-4" /> Create an account to message {r.artistName}
          </Button>
        )}
        {r.status === 'completed' && !r.review && features.reviews && (!r.isGuest || (r.paymentStatus === 'paid' && r.depositCents > 0)) && (
          <Button size="sm" onClick={() => setReviewing(true)}>Leave a review</Button>
        )}
        {r.status === 'completed' && !r.review && features.reviews && r.isGuest && !(r.paymentStatus === 'paid' && r.depositCents > 0) && !user && (
          <Button variant="outline" size="sm" onClick={() => useStore.getState().openAuth('register')}>
            Create an account to leave a review
          </Button>
        )}
        {r.review && <span className="text-sm text-brand-gray self-center">You rated this {r.review.rating}★</span>}
        {(r.status === 'pending' || (r.status === 'approved' && r.date >= today())) && (
          <Button variant="ghost" size="sm" onClick={cancel} loading={busy} className="text-red-600 dark:text-red-400">Cancel booking</Button>
        )}
        {user && (
          <button onClick={() => setReporting(true)} className="ml-auto text-xs text-brand-gray hover:text-red-500">Report a problem</button>
        )}
      </div>
      {paying && <PayDepositModal request={r} token={token} onClose={() => setPaying(false)} onPaid={() => { setPaying(false); onChanged(); }} />}
      {reviewing && (
        <ReviewModal
          title={`Review ${r.artistName}`}
          onClose={() => setReviewing(false)}
          onSubmit={async (rating, text) => {
            await api.post(`/booking-requests/${r.id}/review`, { rating, text, token });
            onChanged();
          }}
        />
      )}
      {reporting && <ReportModal targetType="booking" targetId={r.id} label="booking" onClose={() => setReporting(false)} />}
    </Card>
  );
};

// ---------- Artist's view of a booking request ----------

const SUGGESTED_START: Record<string, string> = { morning: '10:00', afternoon: '13:00', evening: '17:00', anytime: '' };

const ApproveModal: React.FC<{ r: BookingRequest; onClose: () => void; onDone: () => void }> = ({ r, onClose, onDone }) => {
  const toast = useStore(s => s.toast);
  const [deposit, setDeposit] = useState(String(r.depositCents / 100));
  const [startTime, setStartTime] = useState(r.appointmentTime || SUGGESTED_START[r.preferredTime] || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const emailReady = useStore(s => s.config!.emailReady);
  const feePercent = useStore(s => s.config!.settings.depositFeePercent);
  const isProArtist = useStore(s => !!s.user?.subscription.isPro);
  return (
    <Modal
      title={`Approve ${r.clientName}'s request`}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="success"
            loading={busy}
            disabled={!startTime}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post(`/booking-requests/${r.id}/action`, { action: 'approve', depositAmount: Number(deposit) || 0, time: startTime, note: note || undefined });
                const told = !r.isGuest || emailReady;
                toast(
                  (Number(deposit) > 0 ? 'Approved — the client has been asked to pay the deposit.' : 'Approved — no deposit needed.') +
                    (told ? '' : " Email isn't set up yet, so the client won't be emailed — they'll see it on their booking link."),
                );
                onDone();
              } catch (err) {
                toast(errorMessage(err), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Approve
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm">
          {formatDate(r.date)} · {PREFERRED_TIMES[r.preferredTime]} · {r.serviceName}
        </p>
        <Input label="Start time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required hint={`The client asked for: ${PREFERRED_TIMES[r.preferredTime]}.`} />
        <Input
          label="Deposit to collect"
          type="number"
          min="0"
          step="1"
          prefix={currencySymbol()}
          value={deposit}
          onChange={e => setDeposit(e.target.value)}
          hint={`Set to 0 if you don't need a deposit.${feePercent > 0 && !isProArtist ? ` The client also pays a ${feePercent}% booking fee on top.` : ''}`}
        />
        <Textarea label="Note to the client (optional)" value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="e.g. Let's start at 1pm. Please eat beforehand!" />
      </div>
    </Modal>
  );
};

export const RescheduleModal: React.FC<{ r: BookingRequest; onClose: () => void; onDone: () => void }> = ({ r, onClose, onDone }) => {
  const toast = useStore(s => s.toast);
  const [date, setDate] = useState('');
  const [time, setTime] = useState(r.appointmentTime || SUGGESTED_START[r.preferredTime] || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Reschedule appointment"
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!date}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post(`/booking-requests/${r.id}/action`, { action: 'reschedule', date, time, note: note || undefined });
                const emailReady = useStore.getState().config?.emailReady;
                toast(`Moved to ${formatDate(date)}.${!r.isGuest || emailReady ? ' The client has been notified.' : " Email isn't set up yet, so let the client know."}`);
                onDone();
              } catch (err) {
                toast(errorMessage(err), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Save new date
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-brand-gray">Currently {formatDate(r.date)}.</p>
        <Calendar selected={date ? [date] : []} onSelect={setDate} initialMonth={r.date >= today() ? r.date : undefined} />
        <Input label="Start time" type="time" value={time} onChange={e => setTime(e.target.value)} />
        <Textarea label="Note to the client (optional)" value={note} onChange={e => setNote(e.target.value)} rows={2} />
      </div>
    </Modal>
  );
};

export const ArtistRequestCard: React.FC<{ request: BookingRequest; onChanged: () => void; compact?: boolean }> = ({ request: r, onChanged }) => {
  const toast = useStore(s => s.toast);
  const features = useStore(s => s.config!.settings.features);
  const [modal, setModal] = useState<'approve' | 'reschedule' | 'report' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (action: string, confirmText?: string, extra: Record<string, unknown> = {}) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    try {
      await api.post(`/booking-requests/${r.id}/action`, { action, ...extra });
      const done: Record<string, string> = {
        decline: 'Request declined.',
        cancel: 'Appointment cancelled.',
        complete: 'Marked as completed — it’s now under Past.',
        'no-show': 'Marked as a no-show — it’s now under Past.',
        archive: 'Archived.',
        unarchive: 'Moved back from the archive.',
      };
      if (done[action]) toast(done[action]);
      onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };
  const followUp = async (kind: 'aftercare' | 'healed-photo') => {
    setBusy(kind);
    try {
      await api.post(`/booking-requests/${r.id}/aftercare`, { kind });
      toast(kind === 'aftercare' ? 'Aftercare instructions sent.' : 'Healed photo request sent.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };
  const isPast = r.date <= today();

  return (
    <Card className={r.archived ? 'opacity-70' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={r.clientName} size="md" />
          <div>
            <p className="font-bold text-lg flex items-center gap-2">{r.clientName}{r.isGuest && <Badge tone="gray">Guest</Badge>}</p>
            <p className="text-sm text-brand-primary font-semibold">{r.serviceName}{r.servicePrice != null && ` · from ${dollars(r.servicePrice)}`}</p>
            {(r.guestEmail || r.guestPhone) && (
              <p className="text-xs text-brand-gray">
                {r.guestEmail && <a href={`mailto:${r.guestEmail}`} className="hover:underline">{r.guestEmail}</a>}
                {r.guestEmail && r.guestPhone && ' · '}
                {r.guestPhone && <a href={`tel:${r.guestPhone}`} className="hover:underline">{r.guestPhone}</a>}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <StatusBadge status={r.status} />
          {paymentBadge(r)}
        </div>
      </div>
      <RequestDetails r={r} />
      {r.review && (
        <div className="mt-3 text-sm bg-amber-500/10 rounded-lg p-3">
          <StarRating value={r.review.rating} size="w-4 h-4" /> {r.review.text && <span className="ml-1">“{r.review.text}”</span>}
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-2">
        {r.status === 'pending' && (
          <>
            <Button variant="success" size="sm" onClick={() => setModal('approve')}>Approve</Button>
            <Button variant="danger" size="sm" loading={busy === 'decline'} onClick={() => act('decline', `Decline ${r.clientName}'s request?`)}>Decline</Button>
          </>
        )}
        {(r.status === 'pending' || r.status === 'approved') && (
          <Button variant="outline" size="sm" onClick={() => setModal('reschedule')}>Reschedule</Button>
        )}
        {r.status === 'approved' && isPast && (
          <>
            <Button size="sm" loading={busy === 'complete'} onClick={() => act('complete')}>Mark completed</Button>
            <Button variant="outline" size="sm" loading={busy === 'no-show'} onClick={() => act('no-show', 'Mark this client as a no-show?')}>No-show</Button>
          </>
        )}
        {r.status === 'approved' && !isPast && (
          <Button variant="ghost" size="sm" className="text-red-600 dark:text-red-400" loading={busy === 'cancel'} onClick={() => act('cancel', `Cancel this appointment? ${r.paymentStatus === 'paid' ? 'The deposit was paid — the admin will be notified to arrange a refund.' : ''}`)}>
            Cancel appointment
          </Button>
        )}
        {r.status === 'completed' && (
          <>
            <Button variant="outline" size="sm" loading={busy === 'aftercare'} onClick={() => followUp('aftercare')}><PaperAirplaneIcon className="w-4 h-4" /> Send aftercare</Button>
            <Button variant="outline" size="sm" loading={busy === 'healed-photo'} onClick={() => followUp('healed-photo')}><CameraIcon className="w-4 h-4" /> Ask for healed photo</Button>
          </>
        )}
        {r.clientId && features.messaging && (
          <Button variant="ghost" size="sm" onClick={() => openConversation(r.clientId!).catch(err => toast(errorMessage(err), 'error'))}><ChatIcon className="w-4 h-4" /> Message</Button>
        )}
        <div className="ml-auto flex gap-3 items-center">
          {['declined', 'cancelled', 'completed', 'no-show'].includes(r.status) && (
            <button className="text-xs text-brand-gray hover:text-brand-primary" onClick={() => act(r.archived ? 'unarchive' : 'archive')}>{r.archived ? 'Unarchive' : 'Archive'}</button>
          )}
          <button className="text-xs text-brand-gray hover:text-red-500" onClick={() => setModal('report')}>Report</button>
        </div>
      </div>
      {modal === 'approve' && <ApproveModal r={r} onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />}
      {modal === 'reschedule' && <RescheduleModal r={r} onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />}
      {modal === 'report' && <ReportModal targetType="booking" targetId={r.id} label="booking" onClose={() => setModal(null)} />}
    </Card>
  );
};

// ---------- Booth rentals ----------

export const BoothBookingCard: React.FC<{ booking: BoothBooking; as: 'artist' | 'owner'; onChanged: () => void }> = ({ booking: b, as, onChanged }) => {
  const toast = useStore(s => s.toast);
  const features = useStore(s => s.config!.settings.features);
  const [paying, setPaying] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    const paid = b.status === 'paid';
    if (!window.confirm(paid ? `Cancel ${b.artistName}'s paid rental? The site admin will be asked to refund them.` : 'Cancel this reservation?')) return;
    setBusy(true);
    try {
      await api.post(`/booth-bookings/${b.id}/cancel`);
      toast('Reservation cancelled.');
      onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-lg">{as === 'artist' ? `${b.boothName} at ${b.shopName}` : `${b.artistName} · ${b.boothName}`}</p>
          <p className="text-sm text-brand-gray">
            {formatDate(b.startDate, { month: 'short', day: 'numeric' })} → {formatDate(b.endDate, { month: 'short', day: 'numeric', year: 'numeric' })} · {b.days} day{b.days > 1 ? 's' : ''}
            {as === 'artist' && ` · ${b.shopCity}`}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={b.status} />
          <p className="font-bold mt-1">{money(b.totalCents)}</p>
          {as === 'owner' && b.status === 'paid' && <p className="text-xs text-brand-gray">You earn {money(b.totalCents - b.feeCents)}</p>}
        </div>
      </div>
      {b.status === 'unpaid' && b.holdExpiresAt && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Held until {formatDateTime(b.holdExpiresAt)} — unpaid reservations are released automatically.</p>
      )}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-2">
        {as === 'artist' && b.status === 'unpaid' && <Button size="sm" onClick={() => setPaying(true)}><CreditCardIcon className="w-4 h-4" /> Pay {money(b.totalCents)}</Button>}
        {(b.status === 'unpaid' || (as === 'owner' && b.status === 'paid' && b.endDate >= today())) && (
          <Button variant="ghost" size="sm" className="text-red-600 dark:text-red-400" onClick={cancel} loading={busy}>{b.status === 'paid' ? 'Cancel rental' : 'Cancel reservation'}</Button>
        )}
        {as === 'artist' && b.status === 'paid' && b.startDate <= today() && !b.reviewed && features.reviews && (
          <Button variant="outline" size="sm" onClick={() => setReviewing(true)}>Review this shop</Button>
        )}
        {features.messaging && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                if (as === 'owner') await openConversation(b.artistId);
                else {
                  const shop = await api.get<{ ownerId: string }>(`/shops/${b.shopId}`);
                  await openConversation(shop.ownerId);
                }
              } catch (err) {
                toast(errorMessage(err), 'error');
              }
            }}
          >
            <ChatIcon className="w-4 h-4" /> Message {as === 'owner' ? 'artist' : 'shop'}
          </Button>
        )}
        {as === 'artist' && <Button variant="ghost" size="sm" onClick={() => navigate(`/shops/${b.shopId}`)}>View shop</Button>}
      </div>
      {paying && <PayBoothModal booking={b} onClose={() => setPaying(false)} onPaid={() => { setPaying(false); onChanged(); }} />}
      {reviewing && (
        <ReviewModal
          title={`Review ${b.shopName}`}
          onClose={() => setReviewing(false)}
          onSubmit={async (rating, text) => {
            await api.post(`/booth-bookings/${b.id}/review`, { rating, text });
            onChanged();
          }}
        />
      )}
    </Card>
  );
};
