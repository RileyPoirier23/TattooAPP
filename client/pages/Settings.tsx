// Account settings: name, city, password, payout details and plan shortcuts.
import React, { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { Link, navigate } from '../router';
import { isArtist, useStore } from '../store';
import { ROLE_LABELS } from '../lib/format';
import { PayoutMethodForm } from '../components/Earnings';
import { ProPlanCard } from '../components/ProPlan';
import { Badge, Button, Card, Input, Modal, PageHeader } from '../components/ui';
import { DownloadIcon } from '../components/Icons';
import { useUnsavedWarning } from '../lib/unsaved';
import type { Me } from '../../shared/types';

/** Lets a client switch on artist features (their client bookings stay where they are). */
const BecomeArtistCard: React.FC<{ me: Me }> = ({ me }) => {
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const [city, setCity] = useState(me.city);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const { user } = await api.post<{ user: Me }>('/me/become-artist', { city });
      setUser(user);
      toast('Artist features are on. Set up your profile so clients can find you.');
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
        <h2 className="text-lg font-bold mb-1">Are you a tattoo artist?</h2>
        <p className="text-sm text-brand-gray mb-4">
          Switch on artist features to get a public profile, take bookings and deposits, and rent guest spots at shops. Your own bookings stay in your account.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <Input className="flex-1" label="City you work in" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Moncton, NB" />
          <Button onClick={start} loading={busy} disabled={!city.trim()}>Become an artist</Button>
        </div>
      </Card>
    </div>
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
      <PageHeader title="Account settings" subtitle={<span className="flex items-center gap-2">{me.email} <Badge tone="brand">{ROLE_LABELS[me.role]}</Badge></span>} />
      <Card>
        <h2 className="text-lg font-bold mb-4">Your details</h2>
        <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} required />
          <Input label="City" value={city} onChange={e => setCity(e.target.value)} placeholder="Optional" />
          <Input className="sm:col-span-2" label="Email" value={me.email} disabled hint="Contact the site admin to change your email." />
          <div className="sm:col-span-2 flex justify-between items-center gap-3">
            {isArtist(me) ? <Link to="/dashboard?tab=profile" className="text-sm text-brand-primary hover:underline">Edit your public artist profile →</Link> : <span />}
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

      {me.role === 'client' && <BecomeArtistCard me={me} />}

      {(isArtist(me) || me.role === 'shop-owner') && <PayoutMethodForm me={me} />}
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

      {me.role !== 'admin' && (
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
