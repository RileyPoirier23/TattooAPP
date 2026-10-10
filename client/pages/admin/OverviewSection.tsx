// Admin → Overview: key numbers, revenue chart, things needing attention and a setup checklist.
import React from 'react';
import { Link } from '../../router';
import { useStore } from '../../store';
import { Badge, Card, PageHeader, SectionTitle, cx, useApi } from '../../components/ui';
import {
  ArrowRightIcon, CalendarIcon, CashIcon, ChartIcon, CheckBadgeIcon, CheckIcon, FlagIcon, PriceIcon, StoreIcon, UsersIcon,
} from '../../components/Icons';
import { money } from '../../lib/format';
import type { AdminStats } from './types';
import { AsyncView } from './shared';

type IconType = React.FC<{ className?: string }>;

const StatCard: React.FC<{ label: string; value: string; hint?: React.ReactNode; icon: IconType; to?: string; highlight?: boolean }> = ({
  label, value, hint, icon: Icon, to, highlight,
}) => {
  const body = (
    <div
      className={cx(
        'h-full rounded-2xl border p-5 transition-colors',
        highlight
          ? 'border-brand-primary/40 bg-brand-primary/5'
          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60',
        to && 'hover:border-brand-primary/60',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-brand-gray">{label}</p>
        <Icon className="w-5 h-5 text-brand-primary" />
      </div>
      <p className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-dark dark:text-white">{value}</p>
      {hint && <div className="mt-1 text-xs text-brand-gray">{hint}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
};

/** Last 12 calendar months as "YYYY-MM", oldest first. */
function last12Months(): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

const monthLabel = (ym: string, long = false) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, long ? { month: 'long', year: 'numeric' } : { month: 'short' });
};

const RevenueChart: React.FC<{ monthly: AdminStats['monthly']; currency: string }> = ({ monthly, currency }) => {
  const byMonth = new Map(monthly.map(m => [m.month, m]));
  const rows = last12Months().map(month => ({ month, gross: byMonth.get(month)?.gross ?? 0, fees: byMonth.get(month)?.fees ?? 0 }));
  const max = Math.max(...rows.map(r => r.gross), 1);
  const empty = rows.every(r => r.gross === 0);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-brand-dark dark:text-white">Revenue by month</h2>
          <p className="text-sm text-brand-gray">Completed payments over the last 12 months</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-brand-primary/30" /> Collected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-brand-primary" /> Your fees
          </span>
        </div>
      </div>
      {empty ? (
        <p className="text-sm text-brand-gray py-10 text-center">No payments yet. Your revenue will show up here once clients start paying deposits.</p>
      ) : (
        <>
          <div className="relative h-48" aria-hidden="true">
            {/* Recessive grid lines at 0, 50% and 100% of the tallest month */}
            {[0, 50, 100].map(p => (
              <div key={p} className="absolute inset-x-0 border-t border-gray-100 dark:border-gray-800" style={{ bottom: `${p}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-1 sm:gap-2">
              {rows.map(r => (
                <div key={r.month} className="group relative flex-1 h-full flex items-end justify-center">
                  <div
                    className="w-full max-w-[28px] flex flex-col justify-end rounded-t overflow-hidden bg-brand-primary/30"
                    style={{ height: `${(r.gross / max) * 100}%`, minHeight: r.gross > 0 ? 3 : 0 }}
                  >
                    <div className="bg-brand-primary" style={{ height: r.gross ? `${(r.fees / r.gross) * 100}%` : 0 }} />
                  </div>
                  <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap rounded-lg bg-brand-dark text-white text-xs px-3 py-2 shadow-lg">
                    <p className="font-semibold">{monthLabel(r.month, true)}</p>
                    <p>Collected: {money(r.gross, currency)}</p>
                    <p>Your fees: {money(r.fees, currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2 mt-2" aria-hidden="true">
            {rows.map(r => (
              <span key={r.month} className="flex-1 text-center text-[10px] sm:text-xs text-brand-gray">
                {monthLabel(r.month)}
              </span>
            ))}
          </div>
          <table className="sr-only">
            <caption>Revenue by month</caption>
            <thead>
              <tr>
                <th>Month</th>
                <th>Collected</th>
                <th>Your fees</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.month}>
                  <td>{monthLabel(r.month, true)}</td>
                  <td>{money(r.gross, currency)}</td>
                  <td>{money(r.fees, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
};

const ChecklistItem: React.FC<{ done: boolean; title: string; to: string; optional?: boolean; children: React.ReactNode }> = ({ done, title, to, optional, children }) => (
  <li>
    <Link to={to} className="flex items-start gap-3 rounded-xl p-3 -mx-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <span
        className={cx(
          'mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
          done ? 'bg-emerald-500 text-white' : 'border-2 border-gray-300 dark:border-gray-600',
        )}
      >
        {done && <CheckIcon className="w-4 h-4" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex flex-wrap items-center gap-2 font-semibold text-brand-dark dark:text-white">
          {title}
          {done ? <Badge tone="green">Done</Badge> : optional ? <Badge>Optional</Badge> : <Badge tone="yellow">To do</Badge>}
        </span>
        <span className="block text-sm text-brand-gray">{children}</span>
      </span>
      <ArrowRightIcon className="w-4 h-4 mt-1 text-brand-gray flex-shrink-0" />
    </Link>
  </li>
);

const ROLE_PLURALS: Record<string, string> = {
  client: 'Clients',
  artist: 'Artists',
  dual: 'Artist + client',
  'shop-owner': 'Shop owners',
  admin: 'Admins',
};

const BOOKING_STATUS_ORDER = ['pending', 'approved', 'completed', 'declined', 'cancelled', 'no-show'];

export const OverviewSection: React.FC = () => {
  const state = useApi<AdminStats>('/admin/stats');
  const settings = useStore(s => s.config?.settings);

  return (
    <>
      <PageHeader title="Overview" subtitle="How your marketplace is doing at a glance." />
      <AsyncView state={state}>
        {s => {
          const pendingBookings = s.bookingRequests.pending ?? 0;
          const totalBookings = Object.values(s.bookingRequests).reduce((a, b) => a + b, 0);
          const attention = [
            { n: s.pendingVerifications, label: 'verification request', plural: 'verification requests', to: '/admin/verifications', icon: CheckBadgeIcon },
            { n: s.pendingReports, label: 'report to review', plural: 'reports to review', to: '/admin/reports', icon: FlagIcon },
            { n: s.owedCents > 0 ? 1 : 0, label: `${money(s.owedCents, s.currency)} owed to artists & shops`, plural: '', to: '/admin/payouts', icon: CashIcon },
          ].filter(a => a.n > 0);
          const branded = !!settings && (settings.siteName !== 'InkSpace' || !!settings.logoUrl);
          const maxRole = Math.max(...Object.values(s.usersByRole), 1);

          return (
            <div className="space-y-6">
              {attention.length > 0 && (
                <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                  {attention.map(a => (
                    <Link
                      key={a.to}
                      to={a.to}
                      className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-500/15"
                    >
                      <a.icon className="w-5 h-5" />
                      {a.plural ? `${a.n} ${a.n === 1 ? a.label : a.plural}` : a.label}
                      <ArrowRightIcon className="w-4 h-4 ml-auto sm:ml-2" />
                    </Link>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Total collected" value={money(s.grossCents, s.currency)} icon={PriceIcon} hint="All completed payments, all time" to="/admin/payments" />
                <StatCard label="Your platform fees" value={money(s.feesCents, s.currency)} icon={ChartIcon} hint="What the site has earned, all time" highlight />
                <StatCard
                  label="Last 30 days"
                  value={money(s.gross30Cents, s.currency)}
                  icon={CalendarIcon}
                  hint={<>Collected · {money(s.fees30Cents, s.currency)} in fees</>}
                />
                <StatCard label="Owed to artists & shops" value={money(s.owedCents, s.currency)} icon={CashIcon} hint="Send these payouts from the Payouts page" to="/admin/payouts" />
              </div>

              <RevenueChart monthly={s.monthly} currency={s.currency} />

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <SectionTitle
                    actions={
                      <Link to="/admin/users" className="text-sm font-semibold text-brand-primary">
                        Manage
                      </Link>
                    }
                  >
                    <UsersIcon className="w-5 h-5 text-brand-primary" /> People
                  </SectionTitle>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-3xl font-extrabold text-brand-dark dark:text-white">{s.totalUsers}</span>
                    <span className="text-sm text-brand-gray">accounts · {s.newUsers30} new in the last 30 days</span>
                  </div>
                  <ul className="space-y-2.5">
                    {Object.keys(ROLE_PLURALS).map(role => {
                      const n = s.usersByRole[role] ?? 0;
                      return (
                        <li key={role} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{ROLE_PLURALS[role]}</span>
                          <span className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <span className="block h-full rounded-full bg-brand-primary" style={{ width: `${(n / maxRole) * 100}%` }} />
                          </span>
                          <span className="text-right font-semibold text-brand-dark dark:text-white">{n}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>

                <Card>
                  <SectionTitle
                    actions={
                      <Link to="/admin/bookings" className="text-sm font-semibold text-brand-primary">
                        View all
                      </Link>
                    }
                  >
                    <CalendarIcon className="w-5 h-5 text-brand-primary" /> Bookings & shops
                  </SectionTitle>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div>
                      <p className="text-2xl font-extrabold text-brand-dark dark:text-white">{totalBookings}</p>
                      <p className="text-xs text-brand-gray">booking requests</p>
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold text-brand-dark dark:text-white">{s.shops}</p>
                      <p className="text-xs text-brand-gray">
                        <Link to="/admin/shops" className="hover:text-brand-primary">
                          shops
                        </Link>
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold text-brand-dark dark:text-white">{s.upcomingBoothRentals}</p>
                      <p className="text-xs text-brand-gray">upcoming booth rentals</p>
                    </div>
                  </div>
                  {totalBookings === 0 ? (
                    <p className="text-sm text-brand-gray">No booking requests yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {BOOKING_STATUS_ORDER.filter(st => s.bookingRequests[st]).map(st => (
                        <span key={st} className="inline-flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm">
                          <span className="font-bold text-brand-dark dark:text-white">{s.bookingRequests[st]}</span>
                          <span className="text-gray-600 dark:text-gray-300 capitalize">{st.replace('-', ' ')}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {pendingBookings > 0 && (
                    <p className="mt-4 text-xs text-brand-gray">
                      {pendingBookings} request{pendingBookings === 1 ? ' is' : 's are'} waiting for an artist to respond.
                    </p>
                  )}
                </Card>
              </div>

              <Card>
                <SectionTitle>
                  <StoreIcon className="w-5 h-5 text-brand-primary" /> Setup checklist
                </SectionTitle>
                <ul className="space-y-1">
                  <ChecklistItem done={s.paymentsReady} title="Connect Square payments" to="/admin/settings">
                    {s.paymentsReady
                      ? 'Square is connected. Clients can pay deposits and artists can pay for booths.'
                      : 'Add your Square keys so clients can pay deposits online. Until then, nobody can pay through the site.'}
                  </ChecklistItem>
                  <ChecklistItem done={s.emailReady} title="Set up email" to="/admin/settings">
                    {s.emailReady
                      ? 'Email is set up. Booking updates and password resets will be delivered.'
                      : 'Add SMTP details so people get booking confirmations and password reset emails.'}
                  </ChecklistItem>
                  <ChecklistItem done={branded} title="Make it yours" to="/admin/customize">
                    Set your site name, logo, colors and home page text.
                  </ChecklistItem>
                  <ChecklistItem done={!!settings?.googleMapsApiKey} optional title="Add a Google Maps key" to="/admin/settings">
                    Enables address lookup, &ldquo;near me&rdquo; search and listings for shops that haven&apos;t joined yet.
                  </ChecklistItem>
                  <ChecklistItem done={false} optional title="Review your Terms & Privacy pages" to="/admin/pages">
                    The starter pages are placeholders. Add your own policies before launch.
                  </ChecklistItem>
                </ul>
              </Card>
            </div>
          );
        }}
      </AsyncView>
    </>
  );
};
