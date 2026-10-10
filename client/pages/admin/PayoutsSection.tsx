// Admin → Payouts: what is owed to each artist/shop, recording payouts, and payout history.
import React, { useCallback, useState } from 'react';
import { api } from '../../api';
import { useStore } from '../../store';
import { Badge, Button, Card, EmptyState, Input, Notice, PageHeader, StatusBadge, cx, useApi } from '../../components/ui';
import { CashIcon, ClockIcon, PlusIcon, TrashIcon } from '../../components/Icons';
import { ROLE_LABELS, formatDate, formatDateTime, money } from '../../lib/format';
import type { Earnings, PayoutMethod } from '../../../shared/types';
import { PAYMENT_KIND_LABELS, PAYOUT_TYPE_LABELS, type PayoutRow } from './types';
import { AsyncView, Dialog, FilterPills, Muted, copyText, useRunner } from './shared';

type Payee = PayoutRow['payee'];

const PayoutDetails: React.FC<{ method: PayoutMethod; compact?: boolean }> = ({ method, compact }) => {
  const toast = useStore(s => s.toast);
  if (!method.type && !method.details) {
    return <span className="text-sm text-amber-600 dark:text-amber-400">No payout details yet. Ask them to add them in their dashboard.</span>;
  }
  return (
    <div className={cx('text-sm', !compact && 'rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3')}>
      {method.type && <p className="font-semibold text-brand-dark dark:text-white">{PAYOUT_TYPE_LABELS[method.type] ?? method.type}</p>}
      {method.details && (
        <div className="flex items-start gap-2">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all flex-1">{method.details}</p>
          <button
            type="button"
            onClick={async () => toast((await copyText(method.details ?? '')) ? 'Copied.' : 'Could not copy. Select the text instead.', 'success')}
            className="text-xs font-semibold text-brand-primary hover:underline flex-shrink-0"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
};

const RecordPayoutModal: React.FC<{ row: PayoutRow; currency: string; onClose: () => void; onRecorded: () => void }> = ({ row, currency, onClose, onRecorded }) => {
  const { payee, balanceCents } = row;
  const [amount, setAmount] = useState(balanceCents > 0 ? (balanceCents / 100).toFixed(2) : '');
  const [method, setMethod] = useState(payee.payoutMethod.type ? (PAYOUT_TYPE_LABELS[payee.payoutMethod.type] ?? '') : '');
  const [note, setNote] = useState('');
  const { run, busy } = useRunner();
  const value = Number(amount);
  const valid = amount.trim() !== '' && Number.isFinite(value) && value > 0 && value <= 1_000_000;
  const over = valid && Math.round(value * 100) > balanceCents;

  const save = () =>
    run(
      'record',
      async () => {
        await api.post('/admin/payouts', { payeeId: payee.id, amount: value, method: method.trim(), note: note.trim() });
        onRecorded();
        onClose();
      },
      `Payout of ${money(Math.round(value * 100), currency)} recorded. ${payee.name} has been notified.`,
    );

  return (
    <Dialog
      title={`Record a payout to ${payee.name}`}
      onClose={onClose}
      closeDisabled={busy('record')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy('record')}>
            Cancel
          </Button>
          <Button variant="success" onClick={save} loading={busy('record')} disabled={!valid}>
            Record payout
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          First send the money yourself (for example by e-Transfer), then record it here so your books stay straight. You currently owe {payee.name}{' '}
          <strong>{money(Math.max(balanceCents, 0), currency)}</strong>.
        </p>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-gray mb-1">Their payout details</p>
          <PayoutDetails method={payee.payoutMethod} />
        </div>
        <Input
          label="Amount sent"
          type="number"
          inputMode="decimal"
          min={0.01}
          step={0.01}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          error={amount && !valid ? 'Enter an amount greater than 0.' : undefined}
          hint={over ? `That's more than their balance. The extra will be taken off future earnings.` : `In ${currency}.`}
        />
        <Input label="How you sent it" value={method} maxLength={100} list="payout-methods" onChange={e => setMethod(e.target.value)} placeholder="e.g. e-Transfer" />
        <datalist id="payout-methods">
          {['e-Transfer', 'PayPal', 'Bank transfer', 'Cash', 'Cheque'].map(m => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <Input label="Note (optional)" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="e.g. Reference #12345, covers March bookings" />
      </div>
    </Dialog>
  );
};

const HistoryModal: React.FC<{ payee: Payee; onClose: () => void; onRecord: () => void; onChanged: () => void }> = ({ payee, onClose, onRecord, onChanged }) => {
  const state = useApi<Earnings>(`/admin/payouts/${payee.id}`);
  const [confirming, setConfirming] = useState<string | null>(null);
  const { run, busy } = useRunner();

  const remove = (id: string) =>
    run(
      `del:${id}`,
      async () => {
        await api.del(`/admin/payouts/${id}`);
        setConfirming(null);
        await state.reload();
        onChanged();
      },
      'Payout record deleted.',
    );

  return (
    <Dialog
      title={payee.name}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="success" onClick={onRecord}>
            <PlusIcon className="w-4 h-4" /> Record payout
          </Button>
        </>
      }
    >
      <p className="text-sm text-brand-gray -mt-2 mb-4">
        {payee.email} · {ROLE_LABELS[payee.role] ?? payee.role}
      </p>
      <AsyncView state={state}>
        {e => (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Earned', value: e.earnedCents },
                { label: 'Paid out', value: e.paidOutCents },
                { label: 'Still owed', value: e.balanceCents },
              ].map(t => (
                <div key={t.label} className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
                  <p className="text-xs text-brand-gray">{t.label}</p>
                  <p className={cx('text-lg font-extrabold', t.label === 'Still owed' && t.value > 0 ? 'text-brand-primary' : 'text-brand-dark dark:text-white')}>
                    {money(t.value, e.currency)}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gray mb-1">Payout details</p>
              <PayoutDetails method={payee.payoutMethod} />
            </div>

            <div>
              <h3 className="font-bold text-brand-dark dark:text-white mb-2">Payouts sent</h3>
              {e.payouts.length === 0 ? (
                <p className="text-sm text-brand-gray">No payouts recorded yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
                  {e.payouts.map(p => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                      <div className="flex-1 min-w-[10rem]">
                        <p className="font-semibold text-brand-dark dark:text-white">
                          {money(p.amountCents, e.currency)}
                          {p.method && <span className="font-normal text-brand-gray"> via {p.method}</span>}
                        </p>
                        <Muted>
                          {formatDateTime(p.createdAt)}
                          {p.note && ` · ${p.note}`}
                        </Muted>
                      </div>
                      {confirming === p.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-brand-gray">Delete this record?</span>
                          <Button size="sm" variant="danger" loading={busy(`del:${p.id}`)} onClick={() => remove(p.id)}>
                            Delete
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={busy(`del:${p.id}`)}>
                            Keep
                          </Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(p.id)} aria-label="Delete payout record">
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-brand-gray mt-2">Delete a record only if it was entered by mistake. It doesn&apos;t move any money.</p>
            </div>

            <div>
              <h3 className="font-bold text-brand-dark dark:text-white mb-2">Earnings</h3>
              {e.entries.length === 0 ? (
                <p className="text-sm text-brand-gray">No earnings yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
                  {e.entries.map(en => (
                    <li key={en.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-brand-dark dark:text-white truncate">{en.description}</p>
                        <Muted>
                          {PAYMENT_KIND_LABELS[en.kind] ?? en.kind} · {formatDate(en.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Muted>
                      </div>
                      <span className={cx('font-semibold whitespace-nowrap', en.status === 'refunded' ? 'line-through text-brand-gray' : 'text-brand-dark dark:text-white')}>
                        {money(en.amountCents, e.currency)}
                      </span>
                      {en.status === 'refunded' && <StatusBadge status="refunded" />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </AsyncView>
    </Dialog>
  );
};

export const PayoutsSection: React.FC = () => {
  const state = useApi<PayoutRow[]>('/admin/payouts');
  const currency = useStore(s => s.config?.settings.currency) || 'USD';
  const [filter, setFilter] = useState('all');
  const [viewing, setViewing] = useState<Payee | null>(null);
  const [recording, setRecording] = useState<PayoutRow | null>(null);
  const closeView = useCallback(() => setViewing(null), []);
  const closeRecord = useCallback(() => setRecording(null), []);
  const reload = useCallback(() => void state.reload(), [state]);

  return (
    <>
      <PageHeader title="Payouts" subtitle="Keep track of what you owe each artist and shop." />
      {useStore.getState().config?.settings.squareEnvironment !== 'production' && (
        <Notice tone="warning" className="mb-6">
          Square is in <strong>Sandbox (test) mode</strong>, so this page shows test payments only. When you switch to Production in Settings, test payments are hidden and only real money is counted.
        </Notice>
      )}
      <Notice className="mb-6">
        <p className="font-semibold mb-1">How payouts work</p>
        All payments go into your Square account. This page tracks what you owe each artist and shop. Send the money (e.g. e-Transfer) then record it here.
        Artists receive their clients&apos; deposits (your booking fee is kept), and shops receive booth rentals minus your commission.
      </Notice>
      <AsyncView state={state}>
        {rows => {
          const owed = rows.filter(r => r.balanceCents > 0);
          const totalOwed = owed.reduce((s, r) => s + r.balanceCents, 0);
          const totalPaid = rows.reduce((s, r) => s + r.paidOutCents, 0);
          const visible = filter === 'owed' ? owed : rows;
          return (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
                <div className="rounded-2xl border border-brand-primary/40 bg-brand-primary/5 p-4">
                  <p className="text-sm font-medium text-brand-gray">You owe in total</p>
                  <p className="mt-1 text-2xl font-extrabold text-brand-dark dark:text-white">{money(totalOwed, currency)}</p>
                  <p className="text-xs text-brand-gray">
                    to {owed.length} {owed.length === 1 ? 'person' : 'people'}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-4">
                  <p className="text-sm font-medium text-brand-gray">Paid out so far</p>
                  <p className="mt-1 text-2xl font-extrabold text-brand-dark dark:text-white">{money(totalPaid, currency)}</p>
                  <p className="text-xs text-brand-gray">all time</p>
                </div>
              </div>

              <FilterPills
                className="mb-4"
                value={filter}
                onChange={setFilter}
                options={[
                  { id: 'all', label: 'Everyone' },
                  { id: 'owed', label: 'Owed money', count: owed.length },
                ]}
              />

              {visible.length === 0 ? (
                <Card>
                  <EmptyState icon={<CashIcon className="w-12 h-12" />} title={rows.length ? 'All paid up!' : 'Nothing to pay out yet'}>
                    {rows.length ? 'You don’t owe anyone right now.' : 'Once clients pay deposits or artists rent booths, the money owed to artists and shops shows up here.'}
                  </EmptyState>
                </Card>
              ) : (
                <Card padded={false} className="divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
                  {visible.map(r => (
                    <div key={r.payee.id} className="p-4 sm:p-5 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_auto] md:items-center">
                      <button type="button" onClick={() => setViewing(r.payee)} className="text-left min-w-0 group">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-brand-dark dark:text-white group-hover:text-brand-primary">{r.payee.name}</span>
                          <Badge>{ROLE_LABELS[r.payee.role] ?? r.payee.role}</Badge>
                        </span>
                        <Muted className="truncate">{r.payee.email}</Muted>
                        <Muted>
                          Earned {money(r.earnedCents, currency)} · paid {money(r.paidOutCents, currency)}
                        </Muted>
                      </button>
                      <PayoutDetails method={r.payee.payoutMethod} compact />
                      <div className="flex flex-wrap items-center gap-3 md:justify-end">
                        <div className="md:text-right mr-auto md:mr-0">
                          <p className="text-xs text-brand-gray">Owed</p>
                          <p className={cx('text-lg font-extrabold', r.balanceCents > 0 ? 'text-brand-primary' : r.balanceCents < 0 ? 'text-red-500' : 'text-brand-gray')}>
                            {money(r.balanceCents, currency)}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setViewing(r.payee)}>
                          <ClockIcon className="w-4 h-4" /> History
                        </Button>
                        <Button size="sm" variant={r.balanceCents > 0 ? 'success' : 'outline'} onClick={() => setRecording(r)}>
                          <PlusIcon className="w-4 h-4" /> Record payout
                        </Button>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
              {rows.some(r => r.balanceCents < 0) && (
                <p className="mt-3 text-xs text-brand-gray">A negative balance means they were paid more than they earned (for example after a refund). It comes off their next earnings.</p>
              )}
            </>
          );
        }}
      </AsyncView>

      {viewing && (
        <HistoryModal
          payee={viewing}
          onClose={closeView}
          onChanged={reload}
          onRecord={() => {
            const row = state.data?.find(r => r.payee.id === viewing.id);
            setViewing(null);
            if (row) setRecording(row);
          }}
        />
      )}
      {recording && <RecordPayoutModal row={recording} currency={currency} onClose={closeRecord} onRecorded={reload} />}
    </>
  );
};
