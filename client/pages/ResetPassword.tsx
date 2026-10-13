// Set a new password from an emailed reset link.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { navigate, useLocation } from '../router';
import { useStore } from '../store';
import { Button, Card, Input } from '../components/ui';
import type { Me } from '../../shared/types';

export const ResetPasswordPage: React.FC = () => {
  const { query } = useLocation();
  const token = query.get('token') || '';
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const openAuth = useStore(s => s.openAuth);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    setError('');
    try {
      const { user } = await api.post<{ user: Me }>('/auth/reset', { token, password });
      setUser(user);
      toast('Password updated — you are now logged in.');
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-6">
      <h1 className="text-2xl font-extrabold mb-1">Choose a new password</h1>
      <p className="text-sm text-brand-gray mb-6">Pick something at least 8 characters long.</p>
      {!token ? (
        <p className="text-sm">This link is missing its code. <button className="text-brand-primary" onClick={() => openAuth('login')}>Request a new reset email</button>.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="New password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
          <Input label="Confirm password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={8} required autoComplete="new-password" />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" block loading={busy}>Save password</Button>
        </form>
      )}
    </Card>
  );
};
