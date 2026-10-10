// Earnings ledger and payout details for artists and shop owners.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { useStore } from '../store';
import { formatDate, money } from '../lib/format';
import { Badge, Button, Card, EmptyState, ErrorBox, Input, PageLoader, Select, StatusBadge, useApi } from './ui';
import { CashIcon } from './Icons';
import type { Earnings, Me, PayoutMethod } from '../../shared/types';

export const EarningsPanel: React.FC = () => {
  const version = useStore(s => s.bookingsVersion);
  const { data, error, loading, reload } = useApi<Earnings>('/me/earnings', [version]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  const stat = (label: string, cents: number, accent = false) => (
    <Card>
      <p className="text-sm text-brand-gray">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${accent ? 'text-brand-primary' : ''}`}>{money(cents, data.currency)}</p>
    </Card>
  );
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stat('Total earned', data.earnedCents)}
        {stat('Paid out to you', data.paidOutCents)}
        {stat('Balance owed to you', data.balanceCents, true)}
      </div>
      <p className="text-sm text-brand-gray">
        Payments are collected securely by the site and paid out to you regularly using the payout method below. Questions about a payout? Contact the site admin.
      </p>
      {data.onHoldCents > 0 && (
        <p className="text-sm rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 px-3 py-2">
          {money(data.onHoldCents, data.currency)} is on hold: it was paid for a booking that was cancelled, so the payer is due a refund. It isn&apos;t included in your balance.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-bold mb-3">Payments received</h3>
          {data.entries.length === 0 ? (
            <EmptyState icon={<CashIcon />} title="No payments yet" />
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
              {data.entries.map(e => (
                <li key={e.id} className="py-2.5 flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate">{e.description}</p>
                    <p className="text-xs text-brand-gray">{formatDate(e.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${e.status === 'refunded' || e.onHold ? 'line-through text-brand-gray' : ''}`}>{money(e.amountCents, data.currency)}</p>
                    {e.status === 'refunded' && <StatusBadge status="refunded" />}
                    {e.onHold && <Badge tone="yellow">On hold</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="font-bold mb-3">Payouts</h3>
          {data.payouts.length === 0 ? (
            <EmptyState title="No payouts yet" />
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
              {data.payouts.map(p => (
                <li key={p.id} className="py-2.5 flex justify-between gap-3">
                  <div>
                    <p>{p.method || 'Payout'}</p>
                    <p className="text-xs text-brand-gray">{formatDate(p.createdAt)}{p.note ? ` · ${p.note}` : ''}</p>
                  </div>
                  <p className="font-semibold">{money(p.amountCents, data.currency)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

const METHODS: Record<NonNullable<PayoutMethod['type']>, { label: string; placeholder: string }> = {
  etransfer: { label: 'Interac e-Transfer', placeholder: 'Email or phone number for e-Transfer' },
  paypal: { label: 'PayPal', placeholder: 'PayPal email' },
  bank: { label: 'Bank deposit', placeholder: 'Account holder, institution, transit & account number' },
  other: { label: 'Other', placeholder: 'How should we pay you?' },
};

export const PayoutMethodForm: React.FC<{ me: Me }> = ({ me }) => {
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const [type, setType] = useState<NonNullable<PayoutMethod['type']>>(me.payoutMethod.type || 'etransfer');
  const [details, setDetails] = useState(me.payoutMethod.details || '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const { user } = await api.patch<{ user: Me }>('/me', { payoutMethod: { type, details } });
      setUser(user);
      toast('Payout details saved.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <h3 className="font-bold mb-1">How you get paid</h3>
      <p className="text-sm text-brand-gray mb-4">Only the site admin can see these details.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Method" value={type} onChange={e => setType(e.target.value as typeof type)}>
          {Object.entries(METHODS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </Select>
        <Input className="sm:col-span-2" label="Details" value={details} onChange={e => setDetails(e.target.value)} placeholder={METHODS[type].placeholder} />
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={save} loading={busy}>Save payout details</Button>
      </div>
    </Card>
  );
};
