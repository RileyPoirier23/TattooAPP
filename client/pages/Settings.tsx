// Account settings: name, city, password, payout details and plan shortcuts.
import React, { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { Link, navigate } from '../router';
import { accountKind, isArtist, useStore } from '../store';
import { PayoutMethodForm } from '../components/Earnings';
import { ProPlanCard } from '../components/ProPlan';
import { Badge, Button, Card, Input, Modal, PageHeader } from '../components/ui';
import { CalendarIcon, DownloadIcon } from '../components/Icons';
import { CategoryPicker } from '../components/CategoryPicker';
import { useUnsavedWarning } from '../lib/unsaved';
import type { Me } from '../../shared/types';

/** Lets a client switch on artist features (their client bookings stay where they are). */
const BecomeArtistCard: React.FC<{ me: Me }> = ({ me }) => {
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const [city, setCity] = useState(me.city);
  const [picked, setPicked] = useState<string[]>([]);
  const categories = useStore(s => s.config?.settings.categories ?? []);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const { user } = await api.post<{ user: Me }>('/me/become-artist', { city, categories: picked });
      setUser(user);
      toast('Pro features are on. Set up your profile so clients can find you.');
      navigate('/dashboard?tab=profile');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (window.location.hash === '#artist') document.getElementById('artist')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  return (
    <div id="artist">
      <Card>
        <h2 className="text-lg font-bold mb-1">Do you take bookings?</h2>
        <p className="text-sm text-brand-gray mb-4">
          Switch on pro features to get a public profile, take bookings and deposits, and rent booths at shops. Your own bookings stay in your account.
        </p>
        <div className="space-y-4">
          <CategoryPicker options={categories} value={picked} onChange={setPicked} />
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <Input className="flex-1" label="City you work in" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Moncton, NB" />
            <Button onClick={start} loading={busy} disabled={!city.trim() || picked.length === 0}>Become a pro</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

/** Lets any member switch on shop features and list a shop with booths or rooms for rent. */
const ListShopCard: React.FC = () => {
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const { user } = await api.post<{ user: Me }>('/me/become-host');
      setUser(user);
      toast('Shop features are on. Add your shop and its booths.');
      navigate('/shop');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (window.location.hash === '#shop') document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  return (
    <div id="shop">
      <Card>
        <h2 className="text-lg font-bold mb-1">Do you have chairs or rooms to rent out?</h2>
        <p className="text-sm text-brand-gray mb-4">
          List your shop, set daily rates for each booth, and visiting pros book and pay online. You keep everything else on this account.
        </p>
        <Button onClick={start} loading={busy}>List a shop</Button>
      </Card>
    </div>
  );
};

/** A private link that puts the member's bookings in Google Calendar, Apple Calendar or Outlook. */
const CalendarFeedCard: React.FC<{ me: Me }> = ({ me }) => {
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const [busy, setBusy] = useState(false);
  const url = me.calendarToken ? `${window.location.origin}/api/calendar/${me.calendarToken}.ics` : '';
  const change = async (method: 'post' | 'del', done: string) => {
    setBusy(true);
    try {
      const { user } = method === 'post' ? await api.post<{ user: Me }>('/me/calendar-token') : await api.del<{ user: Me }>('/me/calendar-token');
      setUser(user);
      toast(done);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied.');
    } catch {
      toast('Select the link and copy it.', 'error');
    }
  };
  return (
    <Card>
      <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-brand-primary" /> Your calendar feed</h2>
      <p className="text-sm text-brand-gray mb-4">
        Subscribe to this private link in your calendar app and your appointments{isArtist(me) ? ', client bookings' : ''}{me.rentsSpace || isArtist(me) ? ' and booth rentals' : ''} show up there and stay up to date.
      </p>
      {url ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={url} readOnly onFocus={e => e.target.select()} className="flex-1 [&_input]:font-mono [&_input]:text-xs" aria-label="Calendar feed link" />
            <Button variant="outline" onClick={copy}>Copy</Button>
          </div>
          <ul className="text-xs text-brand-gray space-y-1">
            <li><strong>Google Calendar:</strong> Other calendars → + → From URL, paste the link.</li>
            <li><strong>Apple Calendar:</strong> File → New Calendar Subscription, paste the link.</li>
            <li><strong>Outlook:</strong> Add calendar → Subscribe from web, paste the link.</li>
          </ul>
          <p className="text-xs text-brand-gray">Anyone with the link can see your bookings. If it gets shared by mistake, reset it.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" loading={busy} onClick={() => change('post', 'New link created. Update it in your calendar app.')}>Reset link</Button>
            <Button variant="ghost" size="sm" loading={busy} onClick={() => change('del', 'Calendar feed turned off.')}>Turn off</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" loading={busy} onClick={() => change('post', 'Calendar link created.')}>Create calendar link</Button>
      )}
    </Card>
  );
};

export const SettingsPage: React.FC = () => {
  const me = useStore(s => s.user)!;
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const features = useStore(s => s.config!.settings.features);
  const [name, setName] = useState(me.name);
  const [city, setCity] = useState(me.city);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  useUnsavedWarning(name !== me.name || city !== me.city || !!(current || next || confirm));

  const deleteAccount = async () => {
    setDeleteBusy(true);
    try {
      await api.post('/me/delete', { password: deletePassword });
      setUser(null);
      toast('Your account has been deleted.');
      navigate('/');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { user } = await api.patch<{ user: Me }>('/me', { name, city });
      setUser(user);
      setName(user.name);
      setCity(user.city);
      toast('Settings saved.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return toast("The new passwords don't match.", 'error');
    setChanging(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('Password changed. Other devices have been signed out.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Account settings" subtitle={<span className="flex items-center gap-2">{me.email} <Badge tone="brand">{accountKind(me)}</Badge></span>} />
      <Card>
        <h2 className="text-lg font-bold mb-4">Your details</h2>
        <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} required />
          <Input label="City" value={city} onChange={e => setCity(e.target.value)} placeholder="Optional" />
          <Input className="sm:col-span-2" label="Email" value={me.email} disabled hint="Contact the site admin to change your email." />
          <div className="sm:col-span-2 flex justify-between items-center gap-3">
            {isArtist(me) ? <Link to="/dashboard?tab=profile" className="text-sm text-brand-primary hover:underline">Edit your public pro profile →</Link> : <span />}
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-bold mb-4">Change password</h2>
        <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-3">
          <Input label="Current password" type="password" value={current} onChange={e => setCurrent(e.target.value)} required autoComplete="current-password" />
          <Input label="New password" type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
          <Input label="Confirm new password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
          <div className="sm:col-span-3 flex justify-end">
            <Button type="submit" loading={changing}>Change password</Button>
          </div>
        </form>
      </Card>

      <CalendarFeedCard me={me} />

      {!me.isAdmin && !me.offersServices && <BecomeArtistCard me={me} />}
      {!me.isAdmin && !me.rentsSpace && features.boothRental && <ListShopCard />}

      {(isArtist(me) || me.rentsSpace) && <PayoutMethodForm me={me} />}
      {isArtist(me) && (features.proPlan || me.subscription.isPro || me.subscription.autoRenew) && <ProPlanCard me={me} />}

      <Card>
        <h2 className="text-lg font-bold mb-1">Your data</h2>
        <p className="text-sm text-brand-gray mb-4">
          Download a copy of everything we hold about you: your account, bookings, payments, messages and more (a JSON file).
        </p>
        <a
          href="/api/me/export"
          download
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <DownloadIcon className="w-4 h-4" /> Download my data
        </a>
      </Card>

      {!me.isAdmin && (
        <Card className="border-red-500/30">
          <h2 className="text-lg font-bold mb-1">Delete account</h2>
          <p className="text-sm text-brand-gray mb-4">
            Permanently deletes your account, profile, photos, messages and reviews.
            You can't delete your account while you have upcoming paid bookings or money still owed to you.
          </p>
          <Button variant="danger" onClick={() => setDeleting(true)}>Delete my account</Button>
        </Card>
      )}
      {deleting && (
        <Modal
          title="Delete your account?"
          onClose={() => setDeleting(false)}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleting(false)}>Keep my account</Button>
              <Button variant="danger" onClick={deleteAccount} loading={deleteBusy} disabled={!deletePassword}>Delete forever</Button>
            </>
          }
        >
          <p className="text-sm mb-4">This can't be undone. Enter your password to confirm.</p>
          <Input label="Password" type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} autoComplete="current-password" />
        </Modal>
      )}
    </div>
  );
};
