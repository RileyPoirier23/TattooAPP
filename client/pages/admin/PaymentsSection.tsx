// Admin → Payments: every card payment taken through Square, with refunds.
import React, { useCallback, useState } from 'react';
import { api } from '../../api';
import { useStore } from '../../store';
import { Badge, Button, Card, EmptyState, Input, Notice, PageHeader, StatusBadge } from '../../components/ui';
import { CreditCardIcon, DocumentIcon, DownloadIcon } from '../../components/Icons';
import { formatDate, formatDateTime, money } from '../../lib/format';
import { PAYMENT_KIND_LABELS, type AdminPayment, type PaymentKind } from './types';
import { AsyncView, DataTable, Dialog, FilterPills, LinkButton, Muted, Pager, SearchInput, Td, useDebounced, usePaged, useRunner, type Paged } from './shared';

interface PaymentsPage extends Paged<AdminPayment> {
  totals: { grossCents: number; feesCents: number; payeeCents: number; refundedCents: number; completedCount: number; refundedCount: number };
}

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
      `Refunded ${money(p.amountCents, p.currency)}.${useStore.getState().config?.emailReady ? ' The payer has been emailed.' : p.payerName ? ' The payer has been notified on the site.' : ''}`,
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
        {p.kind === 'deposit' && <p>If the appointment hasn&apos;t happened yet, it&apos;s cancelled and the artist is told. The booking is marked as refunded.</p>}
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
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const state = usePaged<PaymentsPage>('/admin/payments', { kind: kind === 'all' ? '' : kind, status: status === 'all' ? '' : status, q: dq });
  const sandbox = useStore(s => s.config?.settings.squareEnvironment) !== 'production';
  const filtered = kind !== 'all' || status !== 'all' || !!dq;
  const [refunding, setRefunding] = useState<AdminPayment | null>(null);
  const closeRefund = useCallback(() => setRefunding(null), []);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Every card payment taken through your Square account."
        actions={
          <LinkButton
            href={`/api/admin/payments/export?${new URLSearchParams(Object.entries({ kind: kind === 'all' ? '' : kind, status: status === 'all' ? '' : status, q: dq }).filter(([, v]) => v))}`}
            download
          >
            <DownloadIcon className="w-4 h-4" /> Export CSV
          </LinkButton>
        }
      />
      {sandbox && (
        <Notice tone="warning" className="mb-6">
          Square is in <strong>Sandbox (test) mode</strong>, so this page shows test payments only. When you switch to Production in Settings, test payments are hidden and only real money is counted.
        </Notice>
      )}
      <AsyncView state={state}>
        {({ items: visible, total, pageSize, totals: t }) => {
          const totals = [
            { label: 'Collected', value: money(t.grossCents), hint: `${t.completedCount} payment${t.completedCount === 1 ? '' : 's'}` },
            { label: 'Your fees', value: money(t.feesCents), hint: 'Booking fees, booth commission & Pro plans', highlight: true },
            { label: 'Artists’ & shops’ share', value: money(t.payeeCents), hint: 'See Payouts for what is still owed' },
            { label: 'Refunded', value: money(t.refundedCents), hint: `${t.refundedCount} refund${t.refundedCount === 1 ? '' : 's'}` },
          ];

          return (
            <>
              <div className="grid min-[400px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
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
                    <p className="mt-1 text-xl sm:text-2xl font-extrabold tabular-nums text-brand-dark dark:text-white">{t.value}</p>
                    <p className="text-xs text-brand-gray mt-0.5">{t.hint}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 mb-4">
                <SearchInput value={q} onChange={setQ} placeholder="Search description, payer, payee or Square ID" loading={dq !== q.trim()} className="sm:max-w-md" />
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
                  <EmptyState icon={<CreditCardIcon className="w-12 h-12" />} title={filtered ? 'No matches' : 'No payments yet'}>
                    {filtered
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
                  <Pager page={state.page} pageSize={pageSize} total={total} onPage={state.setPage} noun={total === 1 ? 'payment' : 'payments'} />
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
