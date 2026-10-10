// Account settings: name, city, password, payout details and plan shortcuts.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { Link } from '../router';
import { isArtist, useStore } from '../store';
import { ROLE_LABELS } from '../lib/format';
import { PayoutMethodForm } from '../components/Earnings';
import { ProPlanCard } from '../components/ProPlan';
import { Badge, Button, Card, Input, PageHeader } from '../components/ui';
import type { Me } from '../../shared/types';

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

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { user } = await api.patch<{ user: Me }>('/me', { name, city });
      setUser(user);
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

      {(isArtist(me) || me.role === 'shop-owner') && <PayoutMethodForm me={me} />}
      {isArtist(me) && features.proPlan && <ProPlanCard me={me} />}
    </div>
  );
};
