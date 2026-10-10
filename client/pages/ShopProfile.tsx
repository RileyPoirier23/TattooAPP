// Public shop page: details, map, booths with availability, reviews, and booth rental.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { Link, navigate } from '../router';
import { isArtist, useStore } from '../store';
import { daysInclusive, dollars, formatDate, money, timeAgo, today } from '../lib/format';
import { MapEmbed } from '../components/MapEmbed';
import { PayBoothModal } from '../components/PaymentModals';
import { ReportModal } from '../components/ReportModal';
import { Badge, Button, Card, Cover, EmptyState, ErrorBox, Input, Modal, Notice, PageLoader, Select, StarRating, useApi } from '../components/ui';
import { ArrowLeftIcon, ChatIcon, CheckBadgeIcon, FlagIcon, LocationIcon } from '../components/Icons';
import type { BoothBooking, ShopDetail } from '../../shared/types';

const BookBoothModal: React.FC<{ shop: ShopDetail; boothId: string; onClose: () => void; onBooked: () => void }> = ({ shop, boothId, onClose, onBooked }) => {
  const toast = useStore(s => s.toast);
  const settings = useStore(s => s.config!.settings);
  const [selected, setSelected] = useState(boothId);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<BoothBooking | null>(null);
  const booth = shop.booths.find(b => b.id === selected)!;
  const days = start && end && end >= start ? daysInclusive(start, end) : 0;
  const taken = shop.bookedRanges.filter(r => r.boothId === selected);
  const clash = days > 0 && taken.some(r => r.startDate <= end && r.endDate >= start);

  if (created) {
    return <PayBoothModal booking={created} onClose={() => { onBooked(); onClose(); }} onPaid={() => { onBooked(); onClose(); navigate('/bookings'); }} />;
  }

  const reserve = async () => {
    setBusy(true);
    setError('');
    try {
      const booking = await api.post<BoothBooking>('/booth-bookings', { boothId: selected, startDate: start, endDate: end });
      toast(`Reserved! Pay within ${settings.boothHoldHours} hours to confirm.`);
      setCreated(booking);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Rent a booth at ${shop.name}`}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={reserve} loading={busy} disabled={!days || clash}>Reserve & pay</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Booth" value={selected} onChange={e => setSelected(e.target.value)}>
          {shop.booths.map(b => <option key={b.id} value={b.id}>{b.name} — {dollars(b.dailyRate)}/day</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="First day" type="date" min={today()} value={start} onChange={e => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value); }} />
          <Input label="Last day" type="date" min={start || today()} value={end} onChange={e => setEnd(e.target.value)} />
        </div>
        {taken.length > 0 && (
          <div className="text-sm">
            <p className="font-medium mb-1">Already booked:</p>
            <ul className="text-brand-gray space-y-0.5">
              {taken.map(r => <li key={r.startDate}>{formatDate(r.startDate, { month: 'short', day: 'numeric' })} – {formatDate(r.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}</li>)}
            </ul>
          </div>
        )}
        {clash && <Notice tone="warning">Those dates overlap an existing booking. Please choose other dates.</Notice>}
        {days > 0 && !clash && (
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 flex justify-between items-center">
            <span>{days} day{days > 1 ? 's' : ''} × {dollars(booth.dailyRate)}</span>
            <span className="text-xl font-bold">{money(Math.round(booth.dailyRate * 100) * days)}</span>
          </div>
        )}
        {booth.description && <p className="text-sm text-brand-gray">{booth.description}</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </Modal>
  );
};

export const ShopProfilePage: React.FC<{ id: string }> = ({ id }) => {
  const { data: shop, error, loading, reload } = useApi<ShopDetail>(`/shops/${id}`);
  const user = useStore(s => s.user);
  const features = useStore(s => s.config!.settings.features);
  const openAuth = useStore(s => s.openAuth);
  const toast = useStore(s => s.toast);
  const [bookBooth, setBookBooth] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !shop) return <PageLoader />;

  const isOwner = user?.id === shop.ownerId;
  const startBooking = (boothId: string) => {
    if (!user) {
      toast('Log in with an artist account to rent a booth.');
      return openAuth('login');
    }
    if (!isArtist(user)) return toast('Only artist accounts can rent booths.', 'error');
    setBookBooth(boothId);
  };
  const messageShop = async () => {
    if (!user) return openAuth('login');
    try {
      const { id: convoId } = await api.post<{ id: string }>('/conversations', { userId: shop.ownerId });
      navigate(`/messages/${convoId}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Link to="/shops" className="inline-flex items-center gap-1 text-sm text-brand-gray hover:text-brand-primary mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> All shops
      </Link>
      <div className="rounded-3xl overflow-hidden relative mb-8">
        <Cover url={shop.imageUrl} alt={shop.name} className="w-full h-56 md:h-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-0 p-6 text-white">
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-2">
            {shop.name}
            {shop.isVerified && <CheckBadgeIcon className="w-7 h-7 text-brand-secondary" title="Verified shop" />}
          </h1>
          <p className="flex items-center gap-1 text-white/80"><LocationIcon className="w-4 h-4" />{shop.address}, {shop.city}</p>
          {shop.reviewCount > 0 && <div className="mt-2"><StarRating value={shop.averageRating} showValue count={shop.reviewCount} /></div>}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {shop.description && (
            <Card>
              <h2 className="font-bold text-lg mb-2">About the shop</h2>
              <p className="whitespace-pre-line text-gray-700 dark:text-gray-300">{shop.description}</p>
            </Card>
          )}
          <section>
            <h2 className="font-bold text-xl mb-4">Booths</h2>
            {shop.booths.length === 0 ? (
              <Card><EmptyState title="No booths listed right now" /></Card>
            ) : (
              <div className="space-y-3">
                {shop.booths.map(b => (
                  <Card key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-bold">{b.name}</p>
                      {b.description && <p className="text-sm text-brand-gray">{b.description}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold whitespace-nowrap">{dollars(b.dailyRate)}<span className="text-sm font-normal text-brand-gray">/day</span></p>
                      {features.boothRental && !isOwner && <Button onClick={() => startBooking(b.id)}>Book</Button>}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
          {features.reviews && (
            <section>
              <h2 className="font-bold text-xl mb-4">Reviews from guest artists</h2>
              {shop.reviews.length === 0 ? (
                <Card><EmptyState title="No reviews yet" /></Card>
              ) : (
                <div className="space-y-3">
                  {shop.reviews.map(r => (
                    <Card key={r.id}>
                      <div className="flex justify-between items-center"><span className="font-semibold">{r.authorName}</span><StarRating value={r.rating} size="w-4 h-4" /></div>
                      {r.text && <p className="mt-2 text-gray-700 dark:text-gray-300">{r.text}</p>}
                      <p className="text-xs text-brand-gray mt-2">{timeAgo(r.createdAt)}</p>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <h2 className="font-bold text-lg mb-3">Location</h2>
            <p className="text-sm text-brand-gray mb-3">{shop.address}, {shop.city}</p>
            <MapEmbed lat={shop.lat} lng={shop.lng} address={`${shop.address}, ${shop.city}`} />
          </Card>
          {shop.amenities.length > 0 && (
            <Card>
              <h2 className="font-bold text-lg mb-3">Amenities</h2>
              <div className="flex flex-wrap gap-2">{shop.amenities.map(a => <Badge key={a} tone="brand">{a}</Badge>)}</div>
            </Card>
          )}
          {!isOwner && features.messaging && (
            <Button variant="outline" block onClick={messageShop}><ChatIcon className="w-5 h-5" /> Message the shop</Button>
          )}
          {isOwner && <Button variant="outline" block onClick={() => navigate('/shop')}>Manage my shop</Button>}
          {user && !isOwner && (
            <button onClick={() => setReporting(true)} className="text-xs text-brand-gray hover:text-red-500 flex items-center gap-1">
              <FlagIcon className="w-4 h-4" /> Report this shop
            </button>
          )}
        </div>
      </div>
      {bookBooth && <BookBoothModal shop={shop} boothId={bookBooth} onClose={() => setBookBooth(null)} onBooked={reload} />}
      {reporting && <ReportModal targetType="shop" targetId={shop.id} label={shop.name} onClose={() => setReporting(false)} />}
    </div>
  );
};
