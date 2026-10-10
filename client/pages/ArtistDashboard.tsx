// Artist dashboard: booking requests, profile & portfolio, services, hours, booking form, earnings and plan.
import React, { useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '../api';
import { prepareImages } from '../lib/images';
import { useUnsavedWarning } from '../lib/unsaved';
import { Link, navigate, useLocation } from '../router';
import { useStore } from '../store';
import { formatDate, today } from '../lib/format';
import { ArtistRequestCard } from '../components/BookingCards';
import { Calendar } from '../components/Calendar';
import { EarningsPanel, PayoutMethodForm } from '../components/Earnings';
import { ProPlanCard } from '../components/ProPlan';
import {
  Avatar, Badge, Button, Card, EmptyState, ErrorBox, Input, Notice, PageHeader, PageLoader, Select, Tabs, Textarea, Toggle, cx, useApi,
} from '../components/ui';
import { CalendarIcon, CashIcon, CheckBadgeIcon, CogIcon, InboxStackIcon, PhotoIcon, PlusIcon, SparklesIcon, TrashIcon, UserCircleIcon, ArrowLeftIcon, ArrowRightIcon } from '../components/Icons';
import type { ArtistService, Me, MyBookings, TimeSlot, WeeklyHours } from '../../shared/types';

const TABS = [
  { id: 'requests', label: 'Requests', Icon: InboxStackIcon },
  { id: 'profile', label: 'Profile & portfolio', Icon: UserCircleIcon },
  { id: 'services', label: 'Services & prices', Icon: CashIcon },
  { id: 'hours', label: 'Hours & days off', Icon: CalendarIcon },
  { id: 'settings', label: 'Booking settings', Icon: CogIcon },
  { id: 'earnings', label: 'Earnings & payouts', Icon: CashIcon },
  { id: 'plan', label: 'Pro plan', Icon: SparklesIcon },
] as const;

function useSave() {
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const [busy, setBusy] = useState(false);
  const save = async (patch: Record<string, unknown>, message = 'Saved!') => {
    setBusy(true);
    try {
      const { user } = await api.patch<{ user: Me }>('/me', patch);
      setUser(user);
      toast(message);
      return user;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { save, busy };
}

// ---------- Requests ----------

const RequestsTab: React.FC = () => {
  const version = useStore(s => s.bookingsVersion);
  const { data, error, loading, reload } = useApi<MyBookings>('/bookings', [version]);
  const [view, setView] = useState('pending');
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  const all = data.asArtist;
  const pending = all.filter(r => r.status === 'pending');
  const upcoming = all.filter(r => r.status === 'approved' && r.date >= today());
  const toClose = all.filter(r => r.status === 'approved' && r.date < today());
  const past = all.filter(r => !['pending', 'approved'].includes(r.status) && !r.archived).sort((a, b) => (a.date < b.date ? 1 : -1));
  const archived = all.filter(r => r.archived);
  const lists: Record<string, typeof all> = { pending, upcoming: [...toClose, ...upcoming], past, archived };
  const shown = lists[view];
  return (
    <div className="space-y-4">
      <Tabs
        active={view}
        onChange={setView}
        tabs={[
          { id: 'pending', label: 'New requests', count: pending.length },
          { id: 'upcoming', label: 'Upcoming', count: toClose.length },
          { id: 'past', label: 'Past' },
          { id: 'archived', label: 'Archived' },
        ]}
      />
      {view === 'upcoming' && toClose.length > 0 && (
        <Notice tone="warning">{toClose.length} past appointment{toClose.length > 1 ? 's need' : ' needs'} to be marked completed or no-show.</Notice>
      )}
      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<InboxStackIcon />} title={view === 'pending' ? 'No new requests' : 'Nothing here yet'}>
            {view === 'pending' && 'New booking requests from clients will show up here. Make sure your profile, services and hours are filled in.'}
          </EmptyState>
        </Card>
      ) : (
        shown.map(r => <ArtistRequestCard key={r.id} request={r} onChanged={reload} />)
      )}
    </div>
  );
};

// ---------- Profile ----------

const ProfileTab: React.FC<{ me: Me }> = ({ me }) => {
  const settings = useStore(s => s.config!.settings);
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const { save, busy } = useSave();
  const profileOf = (u: Me) => ({
    name: u.name,
    city: u.city,
    specialty: u.specialty,
    bio: u.bio,
    instagram: u.socials.instagram || '',
    tiktok: u.socials.tiktok || '',
    facebook: u.socials.facebook || '',
    website: u.socials.website || '',
  });
  const [form, setForm] = useState(() => profileOf(me));
  useUnsavedWarning(JSON.stringify(form) !== JSON.stringify(profileOf(me)));
  const [uploading, setUploading] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const upload = async (url: string, list: FileList | null, field: string) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      (await prepareImages(files)).forEach(f => fd.append(field, f));
      const { user } = await api.post<{ user: Me }>(url, fd);
      setUser(user);
      toast('Uploaded!');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  const updatePortfolio = async (portfolio: Me['portfolio']) => {
    try {
      const { user } = await api.put<{ user: Me }>('/me/portfolio', { portfolio });
      setUser(user);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const move = (i: number, d: number) => {
    const next = [...me.portfolio];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    updatePortfolio(next);
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

  const specialtyOptions = settings.specialties.includes(form.specialty) || !form.specialty ? settings.specialties : [form.specialty, ...settings.specialties];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <Avatar name={me.name} url={me.avatarUrl} size="xl" />
          <div className="space-y-2">
            <label className="inline-flex">
              <span className="cursor-pointer inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
                <PhotoIcon className="w-4 h-4" /> {me.avatarUrl ? 'Change photo' : 'Add profile photo'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={e => {
                  upload('/me/avatar', e.target.files, 'image');
                  e.target.value = '';
                }}
              />
            </label>
            <div className="flex items-center gap-2">
              {me.isVerified ? (
                <Badge tone="purple"><CheckBadgeIcon className="w-4 h-4" /> Verified</Badge>
              ) : me.verificationPending ? (
                <Badge tone="yellow">Verification pending</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={requestVerification} loading={verifyBusy}><CheckBadgeIcon className="w-4 h-4" /> Request verified badge</Button>
              )}
              <Link to={`/artists/${me.id}`} className="text-sm text-brand-primary hover:underline">View public profile →</Link>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={form.name} onChange={set('name')} />
          <Input label="City" value={form.city} onChange={set('city')} placeholder="e.g. Moncton, NB" />
          <Select label="Main style" value={form.specialty} onChange={set('specialty')}>
            <option value="">Choose…</option>
            {specialtyOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
          <div />
          <Textarea className="sm:col-span-2" label="Bio" rows={5} value={form.bio} onChange={set('bio')} maxLength={2000} placeholder="Tell clients about your experience, style and what you love to tattoo." />
          <Input label="Instagram URL" value={form.instagram} onChange={set('instagram')} placeholder="https://instagram.com/…" />
          <Input label="TikTok URL" value={form.tiktok} onChange={set('tiktok')} placeholder="https://tiktok.com/@…" />
          <Input label="Facebook URL" value={form.facebook} onChange={set('facebook')} placeholder="https://facebook.com/…" />
          <Input label="Website" value={form.website} onChange={set('website')} placeholder="https://…" />
        </div>
        <div className="flex justify-end mt-6">
          <Button
            loading={busy}
            onClick={async () => {
              const saved = await save({
                name: form.name,
                city: form.city,
                specialty: form.specialty,
                bio: form.bio,
                socials: { instagram: form.instagram, tiktok: form.tiktok, facebook: form.facebook, website: form.website },
              }, 'Profile saved!');
              if (saved) setForm(profileOf(saved));
            }}
          >
            Save profile
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold">Portfolio</h2>
            <p className="text-sm text-brand-gray">Your first image is used as your cover photo. {me.portfolio.length}/60 images.</p>
          </div>
          <label>
            <span className={cx('cursor-pointer inline-flex items-center gap-2 font-semibold text-sm px-4 py-2.5 rounded-lg bg-brand-solid text-on-primary hover:brightness-110', uploading && 'opacity-50 pointer-events-none')}>
              <PlusIcon className="w-5 h-5" /> {uploading ? 'Uploading…' : 'Add photos'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={e => {
                if ((e.target.files?.length || 0) > 6) toast('You can upload up to 6 photos at a time — please pick fewer.', 'error');
                else upload('/me/portfolio', e.target.files, 'images');
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {me.portfolio.length === 0 ? (
          <EmptyState icon={<PhotoIcon />} title="No photos yet">
            Upload your best work — clients book artists whose portfolios they love. Your profile appears in the artist search once it has at least one photo.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {me.portfolio.map((img, i) => (
              <div key={img.url} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800">
                <img src={img.url} alt="" className="w-full h-full object-cover" />
                {i === 0 && <Badge className="absolute top-2 left-2 bg-black/60 text-white">Cover</Badge>}
                <div className="absolute inset-x-0 bottom-0 p-2 flex justify-between bg-gradient-to-t from-black/70 opacity-100 sm:opacity-0 group-hover:opacity-100 transition">
                  <div className="flex gap-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded bg-white/20 text-white disabled:opacity-30" aria-label="Move left"><ArrowLeftIcon className="w-4 h-4" /></button>
                    <button onClick={() => move(i, 1)} disabled={i === me.portfolio.length - 1} className="p-1.5 rounded bg-white/20 text-white disabled:opacity-30" aria-label="Move right"><ArrowRightIcon className="w-4 h-4" /></button>
                  </div>
                  <button
                    onClick={() => window.confirm('Delete this photo?') && updatePortfolio(me.portfolio.filter(p => p.url !== img.url))}
                    className="p-1.5 rounded bg-red-600 text-white"
                    aria-label="Delete photo"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ---------- Services ----------

type ServiceDraft = Omit<ArtistService, 'duration' | 'price' | 'deposit' | 'minSize' | 'maxSize'> & {
  duration: string; price: string; deposit: string; minSize: string; maxSize: string;
};

const ServicesTab: React.FC<{ me: Me }> = ({ me }) => {
  const settings = useStore(s => s.config!.settings);
  const { save, busy } = useSave();
  const toDraft = (s: ArtistService): ServiceDraft => ({
    ...s,
    duration: String(s.duration), price: String(s.price), deposit: String(s.deposit),
    minSize: s.minSize != null ? String(s.minSize) : '', maxSize: s.maxSize != null ? String(s.maxSize) : '',
  });
  const [items, setItems] = useState<ServiceDraft[]>(me.services.map(toDraft));
  useUnsavedWarning(JSON.stringify(items) !== JSON.stringify(me.services.map(toDraft)));
  const update = (i: number, patch: Partial<ServiceDraft>) => setItems(list => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const add = () => setItems(list => [...list, { id: '', name: '', description: '', duration: '2', price: '150', deposit: String(settings.defaultDeposit), minSize: '', maxSize: '' }]);

  const submit = async () => {
    const saved = await save(
      {
        services: items.map(s => ({
          ...(s.id ? { id: s.id } : {}),
          name: s.name,
          description: s.description || undefined,
          duration: Number(s.duration),
          price: Number(s.price),
          deposit: Number(s.deposit),
          minSize: s.minSize === '' ? null : Number(s.minSize),
          maxSize: s.maxSize === '' ? null : Number(s.maxSize),
        })),
      },
      'Services saved!',
    );
    // Keep the IDs the server assigned, so saving again doesn't create "new" services.
    if (saved) setItems(saved.services.map(toDraft));
  };

  return (
    <Card>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
        <h2 className="text-xl font-bold">Services & prices</h2>
        <Button variant="outline" onClick={add}><PlusIcon className="w-4 h-4" /> Add service</Button>
      </div>
      <p className="text-sm text-brand-gray mb-6">
        Clients pick a service when they request a booking. The deposit is what they pay online after you approve the request.
        {!me.subscription.isPro && settings.features.proPlan && ` Clients pay an extra ${settings.depositFeePercent}% booking fee on deposits — go Pro to remove it.`}
      </p>
      {items.length === 0 && <EmptyState title="No services yet">Add at least one service (e.g. "Small tattoo", "Half-day session").</EmptyState>}
      <div className="space-y-4">
        {items.map((s, i) => (
          <div key={s.id || `new-${i}`} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="grid gap-3 sm:grid-cols-6">
              <Input className="sm:col-span-3" label="Name" value={s.name} onChange={e => update(i, { name: e.target.value })} placeholder="e.g. Small tattoo" />
              <Input label="Hours" type="number" min="0.25" step="0.25" value={s.duration} onChange={e => update(i, { duration: e.target.value })} />
              <Input label="From price" type="number" min="0" prefix="$" value={s.price} onChange={e => update(i, { price: e.target.value })} />
              <Input label="Deposit" type="number" min="0" prefix="$" value={s.deposit} onChange={e => update(i, { deposit: e.target.value })} />
              <Input className="sm:col-span-4" label="Description (optional)" value={s.description || ''} onChange={e => update(i, { description: e.target.value })} />
              <Input label="Min size (sq in)" type="number" min="0" value={s.minSize} onChange={e => update(i, { minSize: e.target.value })} />
              <Input label="Max size (sq in)" type="number" min="0" value={s.maxSize} onChange={e => update(i, { maxSize: e.target.value })} />
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="ghost" size="sm" className="text-red-600 dark:text-red-400" onClick={() => setItems(list => list.filter((_, j) => j !== i))}><TrashIcon className="w-4 h-4" /> Remove</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-6">
        <Button onClick={submit} loading={busy} disabled={items.some(s => !s.name.trim())}>Save services</Button>
      </div>
    </Card>
  );
};

// ---------- Hours & days off ----------

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Comparable form of weekly hours (ignores key order and empty days). */
const sameHours = (h: WeeklyHours) =>
  JSON.stringify(Object.keys(h).sort().filter(k => h[k]?.length).map(k => [k, h[k]]));

const HoursTab: React.FC<{ me: Me }> = ({ me }) => {
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const { save, busy } = useSave();
  const [hours, setHours] = useState<WeeklyHours>(() => JSON.parse(JSON.stringify(me.hours || {})));
  useUnsavedWarning(sameHours(hours) !== sameHours(me.hours || {}));
  const daysOff = useMemo(() => new Set(me.daysOff), [me.daysOff]);

  const setDay = (d: number, slots: TimeSlot[]) => setHours(h => ({ ...h, [String(d)]: slots }));
  const toggleDayOff = async (date: string) => {
    try {
      const { user } = daysOff.has(date) ? await api.del<{ user: Me }>(`/me/days-off/${date}`) : await api.put<{ user: Me }>(`/me/days-off/${date}`);
      setUser(user);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const copyMonday = () => setHours(h => {
    const mon = h['1'] || [];
    const next = { ...h };
    for (const d of ['2', '3', '4', '5']) next[d] = mon.map(s => ({ ...s }));
    return next;
  });

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
          <h2 className="text-xl font-bold">Weekly hours</h2>
          <Button variant="ghost" size="sm" onClick={copyMonday}>Copy Monday to weekdays</Button>
        </div>
        <p className="text-sm text-brand-gray mb-4">Clients can only request dates on days you work. If you leave every day empty, clients can request any date.</p>
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {DAY_NAMES.map((name, d) => {
            const slots = hours[String(d)] || [];
            return (
              <div key={name} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="sm:w-32 pt-2 flex items-center justify-between sm:block">
                  <span className="font-semibold">{name}</span>
                  {!slots.length && <Badge tone="gray" className="sm:mt-1">Closed</Badge>}
                </div>
                <div className="flex-1 space-y-2">
                  {slots.map((slot, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 min-w-0">
                      <Input type="time" value={slot.start} onChange={e => setDay(d, slots.map((s, j) => (j === i ? { ...s, start: e.target.value } : s)))} aria-label={`${name} start`} />
                      <span className="text-brand-gray">to</span>
                      <Input type="time" value={slot.end} onChange={e => setDay(d, slots.map((s, j) => (j === i ? { ...s, end: e.target.value } : s)))} aria-label={`${name} end`} />
                      <button onClick={() => setDay(d, slots.filter((_, j) => j !== i))} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg" aria-label="Remove hours"><TrashIcon className="w-5 h-5" /></button>
                    </div>
                  ))}
                  {slots.length < 4 && (
                    <button onClick={() => setDay(d, [...slots, { start: '11:00', end: '19:00' }])} className="text-sm font-semibold text-brand-primary hover:underline">+ Add hours</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end mt-4">
          <Button
            onClick={async () => {
              const saved = await save({ hours }, 'Hours saved!');
              if (saved) setHours(JSON.parse(JSON.stringify(saved.hours || {})));
            }}
            loading={busy}
          >
            Save hours
          </Button>
        </div>
      </Card>
      <Card className="xl:col-span-2 h-fit">
        <h2 className="text-xl font-bold mb-1">Days off</h2>
        <p className="text-sm text-brand-gray mb-4">Tap a date to block it (vacations, conventions, guest spots). Tap again to unblock.</p>
        <Calendar selected={[]} onSelect={toggleDayOff} isMarked={d => daysOff.has(d)} markedLabel="Day off" />
        {me.daysOff.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {me.daysOff.map(d => (
              <button key={d} onClick={() => toggleDayOff(d)} className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20">
                {formatDate(d, { month: 'short', day: 'numeric' })} ✕
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ---------- Booking form settings & aftercare ----------

const SettingsTab: React.FC<{ me: Me }> = ({ me }) => {
  const { save, busy } = useSave();
  const [intake, setIntake] = useState(me.intakeSettings);
  const [aftercare, setAftercare] = useState(me.aftercareMessage);
  useUnsavedWarning(JSON.stringify(intake) !== JSON.stringify(me.intakeSettings) || aftercare !== me.aftercareMessage);
  const opt = (k: keyof typeof intake, label: string, description: string) => (
    <Toggle checked={intake[k]} onChange={v => setIntake(i => ({ ...i, [k]: v }))} label={label} description={description} />
  );
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-bold mb-1">Booking request form</h2>
        <p className="text-sm text-brand-gray mb-5">Choose what clients must fill in when they request a booking with you.</p>
        <div className="space-y-5">
          {opt('requireSize', 'Tattoo size', 'Approximate width and height in inches.')}
          {opt('requirePlacement', 'Placement', 'Where on the body the tattoo will go.')}
          {opt('requireDescription', 'Description of the idea', 'At least a sentence describing the tattoo.')}
          {opt('requireBudget', 'Budget', 'How much the client expects to spend.')}
          {opt('requireReferenceImages', 'Reference photos', 'At least one image.')}
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={() => save({ intakeSettings: intake }, 'Booking form saved!')} loading={busy}>Save</Button>
        </div>
      </Card>
      <Card>
        <h2 className="text-xl font-bold mb-1">Aftercare instructions</h2>
        <p className="text-sm text-brand-gray mb-4">Sent to clients when you press "Send aftercare" on a completed booking. Leave empty to use the standard instructions.</p>
        <Textarea rows={8} value={aftercare} onChange={e => setAftercare(e.target.value)} maxLength={4000} placeholder="1. Leave the wrap on for 2–3 hours…" />
        <div className="flex justify-end mt-4">
          <Button
            onClick={async () => {
              const saved = await save({ aftercareMessage: aftercare }, 'Aftercare saved!');
              if (saved) setAftercare(saved.aftercareMessage);
            }}
            loading={busy}
          >
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
};

// ---------- Page ----------

export const ArtistDashboardPage: React.FC = () => {
  const me = useStore(s => s.user)!;
  const features = useStore(s => s.config!.settings.features);
  const { query } = useLocation();
  const tab = query.get('tab') || 'requests';
  // Subscribers can always manage (or cancel) their plan, even after the owner stops offering Pro.
  const showPlan = features.proPlan || me.subscription.isPro || me.subscription.autoRenew;
  const tabs = TABS.filter(t => t.id !== 'plan' || showPlan);
  const incomplete = !me.services.length || !me.portfolio.length || !me.bio;

  useEffect(() => {
    if (!tabs.some(t => t.id === tab)) navigate('/dashboard', { replace: true });
  }, [tab, tabs]);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Artist dashboard" subtitle={`Welcome back, ${me.name.split(' ')[0]}.`} actions={<Link to={`/artists/${me.id}`}><Button variant="outline">View my profile</Button></Link>} />
      {incomplete && tab === 'requests' && (
        <Notice tone="info" className="mb-6">
          <strong>Finish setting up your profile</strong> so clients can book you:{' '}
          {[!me.bio && 'add a bio', !me.portfolio.length && 'upload portfolio photos', !me.services.length && 'add your services'].filter(Boolean).join(', ')}.
          {!me.portfolio.length && " You won't appear in the artist search until you've added at least one photo."}{' '}
          <Link to={`/dashboard?tab=${!me.services.length && me.bio && me.portfolio.length ? 'services' : 'profile'}`} className="font-semibold underline">Do it now →</Link>
        </Notice>
      )}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 lg:sticky lg:top-24 h-fit">
          {tabs.map(({ id, label, Icon }) => (
            <Link
              key={id}
              to={`/dashboard?tab=${id}`}
              className={cx(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors',
                tab === id ? 'bg-brand-primary/10 text-brand-primary' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              <Icon className="w-5 h-5" /> {label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === 'requests' && <RequestsTab />}
          {tab === 'profile' && <ProfileTab me={me} />}
          {tab === 'services' && <ServicesTab me={me} />}
          {tab === 'hours' && <HoursTab me={me} />}
          {tab === 'settings' && <SettingsTab me={me} />}
          {tab === 'earnings' && (
            <div className="space-y-6">
              <EarningsPanel />
              <PayoutMethodForm me={me} />
            </div>
          )}
          {tab === 'plan' && <ProPlanCard me={me} />}
        </div>
      </div>
    </div>
  );
};

