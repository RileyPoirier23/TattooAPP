// Admin → Payments: every card payment taken through Square, with refunds.
import React, { useCallback, useState } from 'react';
import { api } from '../../api';
import { Badge, Button, Card, EmptyState, Input, PageHeader, StatusBadge, useApi } from '../../components/ui';
import { CreditCardIcon, DocumentIcon } from '../../components/Icons';
import { formatDate, formatDateTime, money } from '../../lib/format';
import { PAYMENT_KIND_LABELS, type AdminPayment, type PaymentKind } from './types';
import { AsyncView, DataTable, Dialog, FilterPills, Muted, SearchInput, Td, useRunner } from './shared';

const KIND_TONES: Record<PaymentKind, 'brand' | 'blue' | 'purple'> = { deposit: 'brand', booth: 'blue', subscription: 'purple' };

const KIND_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'deposit', label: 'Deposits' },
  { id: 'booth', label: 'Booth rentals' },
  { id: 'subscription', label: 'Pro plans' },
];

const RefundModal: React.FC<{ payment: AdminPayment; onClose: () => void; onRefunded: () => void }> = ({ payment: p, onClose, onRefunded }) => {
  const [reason, setReason] = useState('');
  const { run, busy } = useRunner();
  const refund = () =>
    run(
      'refund',
      async () => {
        await api.post(`/admin/payments/${p.id}/refund`, { reason: reason.trim() });
        onRefunded();
        onClose();
      },
      `Refunded ${money(p.amountCents, p.currency)}. The payer has been notified.`,
    );
  return (
    <Dialog
      title="Refund this payment?"
      onClose={onClose}
      closeDisabled={busy('refund')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy('refund')}>
            Cancel
          </Button>
          <Button variant="danger" onClick={refund} loading={busy('refund')}>
            Refund {money(p.amountCents, p.currency)}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4">
          <p className="font-semibold text-brand-dark dark:text-white">{p.description}</p>
          <p className="text-brand-gray">
            Paid by {p.payerName || p.payerEmail || 'unknown'} on {formatDateTime(p.createdAt)}
          </p>
        </div>
        <p>
          The full amount goes back to the payer&apos;s card through Square. It usually shows up on their statement within 5–10 business days. This can&apos;t be undone.
        </p>
        {p.kind === 'deposit' && <p>The booking will be marked as refunded.</p>}
        {p.kind === 'booth' && <p>The booth rental will be cancelled and the dates freed up.</p>}
        {p.kind === 'subscription' && <p>Refunding a Pro payment also ends that artist&apos;s Pro plan straight away.</p>}
        {p.payeeAmountCents > 0 && (
          <p className="text-amber-700 dark:text-amber-300">
            {p.payeeName || 'The payee'}&apos;s share ({money(p.payeeAmountCents, p.currency)}) is taken off what you owe them. If you already paid them, their balance goes
            negative and comes out of their next payout.
          </p>
        )}
        <Input
          label="Reason (optional)"
          value={reason}
          maxLength={190}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Artist cancelled the appointment"
          hint="Shown on the refund in Square."
        />
      </div>
    </Dialog>
  );
};

export const PaymentsSection: React.FC = () => {
  const state = useApi<AdminPayment[]>('/admin/payments');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [refunding, setRefunding] = useState<AdminPayment | null>(null);
  const closeRefund = useCallback(() => setRefunding(null), []);

  return (
    <>
      <PageHeader title="Payments" subtitle="Every card payment taken through your Square account." />
      <AsyncView state={state}>
        {payments => {
          const needle = q.trim().toLowerCase();
          const visible = payments.filter(
            p =>
              (kind === 'all' || p.kind === kind) &&
              (status === 'all' || p.status === status) &&
              (!needle || [p.description, p.payerName, p.payerEmail, p.payeeName].some(v => v?.toLowerCase().includes(needle))),
          );
          const completed = visible.filter(p => p.status === 'completed');
          const refunded = visible.filter(p => p.status === 'refunded');
          const sum = (list: AdminPayment[], f: (p: AdminPayment) => number) => list.reduce((s, p) => s + f(p), 0);
          const totals = [
            { label: 'Collected', value: money(sum(completed, p => p.amountCents)), hint: `${completed.length} payment${completed.length === 1 ? '' : 's'}` },
            { label: 'Your fees', value: money(sum(completed, p => p.feeCents)), hint: 'Booking fees, booth commission & Pro plans', highlight: true },
            { label: 'Artists’ & shops’ share', value: money(sum(completed, p => p.payeeAmountCents)), hint: 'See Payouts for what is still owed' },
            { label: 'Refunded', value: money(sum(refunded, p => p.amountCents)), hint: `${refunded.length} refund${refunded.length === 1 ? '' : 's'}` },
          ];

          return (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
                {totals.map(t => (
                  <div
                    key={t.label}
                    className={
                      t.highlight
                        ? 'rounded-2xl border border-brand-primary/40 bg-brand-primary/5 p-4'
                        : 'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-4'
                    }
                  >
                    <p className="text-xs sm:text-sm font-medium text-brand-gray">{t.label}</p>
                    <p className="mt-1 text-xl sm:text-2xl font-extrabold text-brand-dark dark:text-white">{t.value}</p>
                    <p className="text-xs text-brand-gray mt-0.5">{t.hint}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 mb-4">
                <SearchInput value={q} onChange={setQ} placeholder="Search description, payer or payee" className="sm:max-w-md" />
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                  <FilterPills value={kind} onChange={setKind} options={KIND_FILTERS} />
                  <FilterPills
                    value={status}
                    onChange={setStatus}
                    options={[
                      { id: 'all', label: 'Any status' },
                      { id: 'completed', label: 'Completed' },
                      { id: 'refunded', label: 'Refunded' },
                    ]}
                  />
                </div>
              </div>

              {visible.length === 0 ? (
                <Card>
                  <EmptyState icon={<CreditCardIcon className="w-12 h-12" />} title={payments.length ? 'No matches' : 'No payments yet'}>
                    {payments.length
                      ? 'Try a different search or filter.'
                      : 'When clients pay deposits, artists rent booths or subscribe to Pro, the payments show up here.'}
                  </EmptyState>
                </Card>
              ) : (
                <Card padded={false} className="overflow-hidden">
                  <DataTable columns={['Date', 'What', 'Paid by', 'Amount', 'Paid to', 'Status', '']}>
                    {visible.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <Td className="whitespace-nowrap text-brand-gray">
                          {formatDate(p.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                          <Muted>{new Date(p.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Muted>
                        </Td>
                        <Td className="min-w-[12rem]">
                          <Badge tone={KIND_TONES[p.kind] ?? 'gray'}>{PAYMENT_KIND_LABELS[p.kind] ?? p.kind}</Badge>
                          <span className="block mt-1">{p.description}</span>
                        </Td>
                        <Td className="min-w-[9rem]">
                          {p.payerName || <span className="text-brand-gray">Guest</span>}
                          {p.payerEmail && <Muted>{p.payerEmail}</Muted>}
                        </Td>
                        <Td className="whitespace-nowrap">
                          <span className="font-semibold">{money(p.amountCents, p.currency)}</span>
                          <Muted>Your fee {money(p.feeCents, p.currency)}</Muted>
                        </Td>
                        <Td className="min-w-[8rem]">
                          {p.payeeName ? (
                            <>
                              {p.payeeName}
                              <Muted>Gets {money(p.payeeAmountCents, p.currency)}</Muted>
                            </>
                          ) : (
                            <span className="text-brand-gray">{p.kind === 'subscription' ? 'You (all of it)' : 'Deleted account'}</span>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap">
                          <StatusBadge status={p.status === 'completed' ? 'paid' : p.status} />
                          {p.refundedAt && <Muted className="mt-1">{formatDateTime(p.refundedAt)}</Muted>}
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          <div className="flex flex-col items-end gap-1">
                            {p.receiptUrl && (
                              <a
                                href={p.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                <DocumentIcon className="w-4 h-4" /> Receipt
                              </a>
                            )}
                            {p.status === 'completed' && p.squarePaymentId && (
                              <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => setRefunding(p)}>
                                Refund
                              </Button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </DataTable>
                  {payments.length >= 1000 && <p className="px-4 py-3 text-xs text-brand-gray border-t border-gray-100 dark:border-gray-800">Showing the 1,000 most recent payments.</p>}
                </Card>
              )}
            </>
          );
        }}
      </AsyncView>
      {refunding && <RefundModal payment={refunding} onClose={closeRefund} onRefunded={() => void state.reload()} />}
    </>
  );
};
