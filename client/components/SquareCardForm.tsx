// Secure card entry (Square Web Payments SDK). Card details never touch our server — only a one-time token.
import React, { useEffect, useRef, useState } from 'react';
import { loadSquare, type SquareCard } from '../lib/square';
import { useStore } from '../store';
import { errorMessage } from '../api';
import { newKey } from '../lib/format';
import { Button, Notice, Spinner } from './ui';
import { LockIcon } from './Icons';

export const SquareCardForm: React.FC<{
  buttonLabel: string;
  onToken: (sourceId: string, idempotencyKey: string) => Promise<void>;
  note?: React.ReactNode;
}> = ({ buttonLabel, onToken, note }) => {
  const config = useStore(s => s.config);
  const theme = useStore(s => s.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const settings = config?.settings;

  useEffect(() => {
    if (!config?.paymentsReady || !settings) return;
    let cancelled = false;
    const dark = theme === 'dark';
    (async () => {
      try {
        await loadSquare(settings.squareEnvironment);
        if (cancelled || !window.Square || !containerRef.current) return;
        const payments = window.Square.payments(settings.squareApplicationId, settings.squareLocationId);
        const card = await payments.card({
          style: {
            input: { color: dark ? '#ffffff' : '#101014', fontSize: '16px' },
            'input::placeholder': { color: dark ? '#9ca3af' : '#6b7280' },
            '.input-container': { borderColor: dark ? '#374151' : '#d1d5db', borderRadius: '8px' },
            '.input-container.is-focus': { borderColor: settings.primaryColor },
            '.message-text': { color: dark ? '#9ca3af' : '#6b7280' },
          },
        });
        if (cancelled) {
          card.destroy();
          return;
        }
        await card.attach(containerRef.current);
        cardRef.current = card;
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setLoadError(errorMessage(err));
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      cardRef.current?.destroy();
      cardRef.current = null;
    };
  }, [config?.paymentsReady, settings?.squareApplicationId, settings?.squareLocationId, settings?.squareEnvironment, theme]);

  if (!config?.paymentsReady) {
    return <Notice tone="warning">Online payments aren't set up yet. Please check back soon or contact us.</Notice>;
  }

  const pay = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    setError('');
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== 'OK' || !result.token) {
        setError(result.errors?.[0]?.message || 'Please check your card details.');
        return;
      }
      await onToken(result.token, newKey());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="min-h-[90px] relative">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}
        {status === 'error' && <Notice tone="warning">{loadError}</Notice>}
        <div ref={containerRef} data-testid="card-container" />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
      <Button block size="lg" onClick={pay} loading={busy} disabled={status !== 'ready'}>
        <LockIcon className="w-5 h-5" />
        {buttonLabel}
      </Button>
      <p className="text-xs text-center text-brand-gray">
        {note || 'Payments are processed securely by Square. Your card details are never stored on our servers.'}
      </p>
    </div>
  );
};
