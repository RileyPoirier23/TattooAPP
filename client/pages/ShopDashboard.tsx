// Shop owner dashboard: create the shop, manage booths, see rentals, edit details and track earnings.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { Link, useLocation } from '../router';
import { useStore } from '../store';
import { dollars, formatDate, today } from '../lib/format';
import { geocode } from '../lib/maps';
import { prepareImage } from '../lib/images';
import { useUnsavedWarning } from '../lib/unsaved';
import { BoothBookingCard } from '../components/BookingCards';
import { EarningsPanel, PayoutMethodForm } from '../components/Earnings';
import {
  Badge, Button, Card, Cover, EmptyState, ErrorBox, Input, Modal, Notice, PageHeader, PageLoader, Tabs, Textarea, Toggle, useApi,
} from '../components/ui';
import { CheckBadgeIcon, EditIcon, PhotoIcon, PlusIcon, StoreIcon, TrashIcon } from '../components/Icons';
import type { Booth, Me, MyBookings, Shop } from '../../shared/types';

interface ShopForm {
  name: string;
  city: string;
  address: string;
  description: string;
  amenities: string;
  lat: string;
  lng: string;
}

const formFrom = (s?: Shop | null): ShopForm => ({
  name: s?.name || '',
  city: s?.city || '',
  address: s?.address || '',
  description: s?.description || '',
  amenities: s?.amenities.join(', ') || '',
  lat: s?.lat != null ? String(s.lat) : '',
  lng: s?.lng != null ? String(s.lng) : '',
});

export const ShopDetailsForm: React.FC<{ shop?: Shop | null; onSaved: (s: Shop) => void; submitLabel: string }> = ({ shop, onSaved, submitLabel }) => {
  const settings = useStore(s => s.config!.settings);
  const toast = useStore(s => s.toast);
  const [form, setForm] = useState<ShopForm>(formFrom(shop));
  const [savedForm, setSavedForm] = useState<ShopForm>(formFrom(shop));
  useUnsavedWarning(JSON.stringify(form) !== JSON.stringify(savedForm));
  const [busy, setBusy] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const set = (k: keyof ShopForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let lat = form.lat ? Number(form.lat) : null;
      let lng = form.lng ? Number(form.lng) : null;
      const addressChanged = !shop || shop.address !== form.address || shop.city !== form.city;
      if (settings.googleMapsApiKey && (addressChanged || lat == null)) {
        const found = await geocode(settings.googleMapsApiKey, `${form.address}, ${form.city}`).catch(() => null);
        if (found) ({ lat, lng } = found);
      }
      const body = {
        name: form.name,
        city: form.city,
        address: form.address,
        description: form.description,
        amenities: form.amenities.split(',').map(a => a.trim()).filter(Boolean),
        lat,
        lng,
      };
      const saved = shop ? await api.patch<Shop>(`/shops/${shop.id}`, body) : await api.post<Shop>('/shops', body);
      setSavedForm(form);
      toast(shop ? 'Shop details saved.' : 'Your shop is live! Now add your booths.');
      onSaved(saved);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Input className="sm:col-span-2" label="Shop name" value={form.name} onChange={set('name')} required />
      <Input label="Street address" value={form.address} onChange={set('address')} required placeholder="123 Main St" />
      <Input label="City" value={form.city} onChange={set('city')} required placeholder="e.g. Moncton, NB" />
      <Textarea className="sm:col-span-2" label="About the shop" rows={4} value={form.description} onChange={set('description')} placeholder="Vibe, equipment provided, parking, house rules for guest artists…" />
      <Input className="sm:col-span-2" label="Amenities" value={form.amenities} onChange={set('amenities')} placeholder="WiFi, Private rooms, Parking, Autoclave, Ink provided" hint="Separate with commas." />
      {settings.googleMapsApiKey ? (
        <p className="sm:col-span-2 text-xs text-brand-gray">
          We'll place your shop on the map automatically from the address.{' '}
          <button type="button" className="underline" onClick={() => setShowCoords(v => !v)}>Set coordinates manually</button>
        </p>
      ) : (
        <p className="sm:col-span-2 text-xs text-brand-gray">
          Optional: add map coordinates so artists can see your exact location.{' '}
          <button type="button" className="underline" onClick={() => setShowCoords(v => !v)}>{showCoords ? 'Hide' : 'Add coordinates'}</button>
        </p>
      )}
      {showCoords && (
        <>
          <Input label="Latitude" type="number" step="any" value={form.lat} onChange={set('lat')} hint="Right-click your shop in Google Maps to copy coordinates." />
          <Input label="Longitude" type="number" step="any" value={form.lng} onChange={set('lng')} />
        </>
      )}
      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
};

interface BoothBlock { id: string; boothId: string; boothName: string; startDate: string; endDate: string; note: string }

/** Dates a booth can't be rented (shop closed, private booking, renovations…). */
const BlockedDates: React.FC<{ shop: Shop }> = ({ shop }) => {
  const toast = useStore(s => s.toast);
  const blocks = useApi<BoothBlock[]>(`/shops/${shop.id}/blocks`);
  const [boothId, setBoothId] = useState(shop.booths[0]?.id || '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (shop.booths.length === 0) return null;
  const add = async () => {
    setBusy(true);
    try {
      await api.post(`/booths/${boothId}/blocks`, { startDate: start, endDate: end || start, note });
      toast('Dates blocked.');
      setStart('');
      setEnd('');
      setNote('');
      blocks.reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    try {
      await api.del(`/booth-blocks/${id}`);
      blocks.reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  return (
    <Card>
      <h2 className="text-xl font-bold mb-1">Blocked dates</h2>
      <p className="text-sm text-brand-gray mb-4">Block days when a booth can't be rented — holidays, private bookings or renovations.</p>
      <div className="grid gap-3 sm:grid-cols-5 items-end">
        <label className="sm:col-span-2 text-sm">
          <span className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Booth</span>
          <select className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5" value={boothId} onChange={e => setBoothId(e.target.value)}>
            {shop.booths.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <Input label="First day" type="date" min={today()} value={start} onChange={e => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value); }} />
        <Input label="Last day" type="date" min={start || today()} value={end} onChange={e => setEnd(e.target.value)} />
        <Button onClick={add} loading={busy} disabled={!boothId || !start}>Block</Button>
        <Input className="sm:col-span-5" label="Reason (optional, only you see this)" value={note} onChange={e => setNote(e.target.value)} />
      </div>
      {blocks.data && blocks.data.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-200 dark:divide-gray-800 text-sm">
          {blocks.data.map(b => (
            <li key={b.id} className="py-2 flex items-center justify-between gap-3">
              <span>
                <strong>{b.boothName}</strong>: {formatDate(b.startDate, { month: 'short', day: 'numeric' })}
                {b.endDate !== b.startDate && ` – ${formatDate(b.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                {b.note && <span className="text-brand-gray"> · {b.note}</span>}
              </span>
              <button onClick={() => remove(b.id)} className="text-red-500 hover:underline">Unblock</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

const BoothModal: React.FC<{ shopId: string; booth?: Booth; onClose: () => void; onSaved: (s: Shop) => void }> = ({ shopId, booth, onClose, onSaved }) => {
  const toast = useStore(s => s.toast);
  const [name, setName] = useState(booth?.name || '');
  const [rate, setRate] = useState(booth ? String(booth.dailyRate) : '100');
  const [description, setDescription] = useState(booth?.description || '');
  const [active, setActive] = useState(booth?.active ?? true);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const body = { name, dailyRate: Number(rate), description, active };
      onSaved(booth ? await api.patch<Shop>(`/booths/${booth.id}`, body) : await api.post<Shop>(`/shops/${shopId}/booths`, body));
      toast(booth ? 'Booth updated.' : 'Booth added.');
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={booth ? 'Edit booth' : 'Add a booth'}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy} disabled={!name.trim() || !(Number(rate) >= 0)}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Booth name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Front window station" />
        <Input label="Daily rate" type="number" min="0" prefix="$" value={rate} onChange={e => setRate(e.target.value)} />
        <Textarea label="Description (optional)" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What's included: chair, light, power supply, ink…" />
        <Toggle checked={active} onChange={setActive} label="Available to book" description="Turn off to hide this booth temporarily." />
      </div>
    </Modal>
  );
};

export const ShopDashboardPage: React.FC = () => {
  const me = useStore(s => s.user)!;
  const setUser = useStore(s => s.setUser);
  const refreshUser = useStore(s => s.refreshUser);
  const toast = useStore(s => s.toast);
  const settings = useStore(s => s.config!.settings);
  const version = useStore(s => s.bookingsVersion);
  const { query } = useLocation();
  const shopReq = useApi<Shop | null>('/my-shop');
  const bookings = useApi<MyBookings>('/bookings', [version]);
  const [tab, setTab] = useState(query.get('tab') || 'rentals');
  const [boothModal, setBoothModal] = useState<Booth | 'new' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);

  if (shopReq.error) return <ErrorBox message={shopReq.error} onRetry={shopReq.reload} />;
  if (shopReq.loading) return <PageLoader />;
  const shop = shopReq.data;

  if (!shop) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader title="List your shop" subtitle="Tell guest artists about your shop. You can add booths right after." />
        <Card>
          <ShopDetailsForm
            submitLabel="Create my shop"
            onSaved={s => {
              shopReq.setData(s);
              refreshUser();
              setTab('booths');
            }}
          />
        </Card>
      </div>
    );
  }

  const uploadImage = async (files: FileList | null) => {
    const picked = files?.[0];
    if (!picked) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', await prepareImage(picked));
      shopReq.setData(await api.post<Shop>(`/shops/${shop.id}/image`, fd));
      toast('Cover photo updated.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  };
  const deleteBooth = async (b: Booth) => {
    if (!window.confirm(`Remove "${b.name}"? Booths with past bookings are hidden instead of deleted.`)) return;
    try {
      shopReq.setData(await api.del<Shop>(`/booths/${b.id}`));
      toast('Booth removed.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const requestVerification = async () => {
    setVerifyBusy(true);
    try {
      const { user } = await api.post<{ user: Me }>('/me/verification');
      setUser(user);
      toast("Verification requested — we'll let you know once it's reviewed.");
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setVerifyBusy(false);
    }
  };

  const rentals = bookings.data?.shopBookings || [];
  const upcoming = rentals.filter(b => b.endDate >= today() && ['paid', 'unpaid'].includes(b.status));
  const past = rentals.filter(b => !upcoming.includes(b));

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={shop.name}
        subtitle={`${shop.address}, ${shop.city}`}
        actions={<Link to={`/shops/${shop.id}`}><Button variant="outline">View public page</Button></Link>}
      />
      {!settings.features.boothRental && <Notice tone="warning" className="mb-6">Booth rentals are currently turned off site-wide by the admin.</Notice>}
      {shop.booths.length === 0 && <Notice className="mb-6">Add at least one booth so artists can book a guest spot at your shop.</Notice>}
      <Tabs
        className="mb-6"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'rentals', label: 'Rentals', count: upcoming.filter(b => b.startDate <= today()).length },
          { id: 'booths', label: `Booths (${shop.booths.length})` },
          { id: 'details', label: 'Shop details' },
          { id: 'earnings', label: 'Earnings & payouts' },
        ]}
      />

      {tab === 'rentals' && (
        <div className="space-y-8">
          {bookings.error && <ErrorBox message={bookings.error} onRetry={bookings.reload} />}
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Upcoming</h2>
            {upcoming.length === 0 ? <Card><EmptyState icon={<StoreIcon />} title="No upcoming rentals" /></Card> : upcoming.map(b => <BoothBookingCard key={b.id} booking={b} as="owner" onChanged={bookings.reload} />)}
          </section>
          {past.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">Past & cancelled</h2>
              {past.map(b => <BoothBookingCard key={b.id} booking={b} as="owner" onChanged={bookings.reload} />)}
            </section>
          )}
        </div>
      )}

      {tab === 'booths' && (
        <div className="space-y-6">
        <Card>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold">Booths</h2>
              <p className="text-sm text-brand-gray">The platform keeps {settings.boothFeePercent}% of each rental; you receive the rest.</p>
            </div>
            <Button onClick={() => setBoothModal('new')}><PlusIcon className="w-4 h-4" /> Add booth</Button>
          </div>
          {shop.booths.length === 0 ? (
            <EmptyState title="No booths yet" />
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {shop.booths.map(b => (
                <li key={b.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold flex items-center gap-2">{b.name}{!b.active && <Badge tone="gray">Hidden</Badge>}</p>
                    {b.description && <p className="text-sm text-brand-gray truncate">{b.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold whitespace-nowrap">{dollars(b.dailyRate)}<span className="text-sm font-normal text-brand-gray">/day</span></span>
                    <button onClick={() => setBoothModal(b)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Edit booth"><EditIcon className="w-5 h-5" /></button>
                    <button onClick={() => deleteBooth(b)} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10" aria-label="Delete booth"><TrashIcon className="w-5 h-5" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <BlockedDates shop={shop} />
        </div>
      )}

      {tab === 'details' && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <Cover url={shop.imageUrl} alt={shop.name} className="w-full sm:w-64 h-40 rounded-xl" />
              <div className="space-y-3">
                <label>
                  <span className={`cursor-pointer inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 ${uploading ? 'opacity-50' : ''}`}>
                    <PhotoIcon className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Change cover photo'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={e => {
                      uploadImage(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
                <div>
                  {shop.isVerified ? (
                    <Badge tone="purple"><CheckBadgeIcon className="w-4 h-4" /> Verified shop</Badge>
                  ) : me.verificationPending ? (
                    <Badge tone="yellow">Verification pending</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={requestVerification} loading={verifyBusy}><CheckBadgeIcon className="w-4 h-4" /> Request verified badge</Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <ShopDetailsForm shop={shop} submitLabel="Save details" onSaved={s => shopReq.setData(s)} />
          </Card>
        </div>
      )}

      {tab === 'earnings' && (
        <div className="space-y-6">
          <EarningsPanel />
          <PayoutMethodForm me={me} />
        </div>
      )}

      {boothModal && <BoothModal shopId={shop.id} booth={boothModal === 'new' ? undefined : boothModal} onClose={() => setBoothModal(null)} onSaved={s => shopReq.setData(s)} />}
    </div>
  );
};
