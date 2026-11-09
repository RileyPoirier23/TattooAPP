// Log in / sign up / forgot password dialog.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { navigate } from '../router';
import { useStore } from '../store';
import { Button, Input, Modal, Notice, Toggle } from './ui';
import { CategoryPicker } from './CategoryPicker';
import { Link } from '../router';
import type { Me } from '../../shared/types';

export const AuthModal: React.FC = () => {
  const mode = useStore(s => s.authModal);
  const close = useStore(s => s.closeAuth);
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const [view, setView] = useState<'login' | 'register' | 'forgot'>(mode === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const categories = useStore(s => s.config?.settings.categories ?? []);
  const boothRental = useStore(s => !!s.config?.settings.features.boothRental);
  // Everyone can book appointments; these two switches add a pro profile and/or a shop.
  const [offersServices, setOffersServices] = useState(false);
  const [rentsSpace, setRentsSpace] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const config = useStore(s => s.config);
  const legal = (config?.pages || []).filter(p => p.slug === 'terms' || p.slug === 'privacy');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (view === 'forgot') {
        await api.post('/auth/forgot', { email });
        setSent(true);
        return;
      }
      const { user } = view === 'login'
        ? await api.post<{ user: Me }>('/auth/login', { email, password })
        : await api.post<{ user: Me }>('/auth/register', {
            email, password, name, offersServices, rentsSpace, city: city || undefined, categories: offersServices ? picked : undefined, acceptTerms,
          });
      setUser(user);
      close();
      toast(view === 'login' ? `Welcome back, ${user.name.split(' ')[0]}!` : `Welcome, ${user.name.split(' ')[0]}! Your account is ready.`);
      if (view === 'register') {
        if (user.offersServices) navigate('/dashboard?tab=profile');
        else if (user.rentsSpace) navigate('/shop');
      } else if (user.isAdmin) navigate('/admin');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const title = view === 'login' ? 'Welcome back' : view === 'register' ? 'Create your account' : 'Reset your password';

  return (
    <Modal title={title} onClose={close} size="md">
      <form onSubmit={submit} className="space-y-4">
        {view === 'register' && (
          <>
            <Input label="Full name" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
              <div className="p-3">
                <Toggle checked={offersServices} onChange={setOffersServices} label="I take bookings" description="Tattoo, barber, nails, lashes, hair, makeup… get a public profile clients can book." />
              </div>
              {boothRental && (
                <div className="p-3">
                  <Toggle checked={rentsSpace} onChange={setRentsSpace} label="I rent out chairs or rooms" description="List your shop and let visiting pros book a booth." />
                </div>
              )}
            </div>
            {offersServices && (
              <>
                <CategoryPicker options={categories} value={picked} onChange={setPicked} />
                <Input label="City you work in" placeholder="e.g. Moncton, NB" value={city} onChange={e => setCity(e.target.value)} required />
              </>
            )}
            {!offersServices && !rentsSpace && <p className="text-xs text-brand-gray">Booking appointments is open to everyone. You can switch on pro or shop features later in Settings.</p>}
          </>
        )}
        {view === 'forgot' && !config?.emailReady && (
          <Notice tone="warning">
            Password reset emails aren&apos;t set up on this site yet.{' '}
            <Link to="/contact" onClick={() => useStore.getState().closeAuth()} className="font-semibold underline">
              Contact us
            </Link>{' '}
            and we&apos;ll help you get back into your account.
          </Notice>
        )}
        {view === 'forgot' && sent ? (
          <Notice tone="success">If an account exists for {email}, we've emailed a link to reset your password. Check your inbox (and spam folder).</Notice>
        ) : (
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        )}
        {view !== 'forgot' && (
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={view === 'register' ? 8 : undefined}
            hint={view === 'register' ? 'At least 8 characters.' : undefined}
            autoComplete={view === 'login' ? 'current-password' : 'new-password'}
          />
        )}
        {view === 'register' && (
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" className="mt-1" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} required />
            <span>
              I agree to the{' '}
              {legal.length ? (
                legal.map((p, i) => (
                  <React.Fragment key={p.slug}>
                    {i > 0 && ' and '}
                    <Link to={`/p/${p.slug}`} target="_blank" className="text-brand-primary underline" onClick={e => e.stopPropagation()}>{p.title}</Link>
                  </React.Fragment>
                ))
              ) : (
                'Terms of Service and Privacy Policy'
              )}
              .
            </span>
          </label>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        {!(view === 'forgot' && sent) && (
          <Button type="submit" block size="lg" loading={busy} disabled={(view === 'register' && !acceptTerms) || (view === 'forgot' && !config?.emailReady)}>
            {view === 'login' ? 'Log in' : view === 'register' ? 'Create account' : 'Send reset link'}
          </Button>
        )}
        <div className="text-center text-sm space-y-2">
          {view === 'login' && (
            <>
              <button type="button" className="text-brand-gray hover:text-brand-primary" onClick={() => { setView('forgot'); setError(''); setSent(false); }}>
                Forgot your password?
              </button>
              <p className="text-brand-gray">
                New here?{' '}
                <button type="button" className="font-semibold text-brand-primary" onClick={() => { setView('register'); setError(''); }}>
                  Create an account
                </button>
              </p>
            </>
          )}
          {view !== 'login' && (
            <p className="text-brand-gray">
              {view === 'register' ? 'Already have an account?' : 'Remembered it?'}{' '}
              <button type="button" className="font-semibold text-brand-primary" onClick={() => { setView('login'); setError(''); }}>
                Log in
              </button>
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
};
