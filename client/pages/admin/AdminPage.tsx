// Admin panel: layout with section navigation (sidebar on desktop, scrollable tabs on mobile).
import React, { useEffect, useRef } from 'react';
import { Link } from '../../router';
import { useStore } from '../../store';
import { Button, Card, EmptyState, cx, useApi } from '../../components/ui';
import {
  CalendarIcon, CashIcon, ChartIcon, CheckBadgeIcon, CogIcon, CreditCardIcon, DocumentIcon, DownloadIcon, EyeIcon,
  FlagIcon, InboxStackIcon, LockIcon, PaletteIcon, StarIcon, StoreIcon, UsersIcon,
} from '../../components/Icons';
import type { AdminStats } from './types';
import { useAdminCountsListener } from './shared';
import { OverviewSection } from './OverviewSection';
import { CustomizeSection } from './CustomizeSection';
import { PagesSection } from './PagesSection';
import { SettingsSection } from './SettingsSection';
import { UsersSection } from './UsersSection';
import { ShopsSection } from './ShopsSection';
import { BookingsSection } from './BookingsSection';
import { PaymentsSection } from './PaymentsSection';
import { PayoutsSection } from './PayoutsSection';
import { VerificationsSection } from './VerificationsSection';
import { ReportsSection } from './ReportsSection';
import { ReviewsSection } from './ReviewsSection';
import { BackupSection } from './BackupSection';
import { InboxSection } from './InboxSection';

type IconType = React.FC<{ className?: string }>;

interface SectionDef {
  id: string;
  label: string;
  icon: IconType;
  group: string;
  component: React.FC;
  badge?: (s: AdminStats) => number;
}

const SECTIONS: SectionDef[] = [
  { id: 'overview', label: 'Overview', icon: ChartIcon, group: 'Dashboard', component: OverviewSection },
  { id: 'customize', label: 'Customize', icon: PaletteIcon, group: 'Your site', component: CustomizeSection },
  { id: 'pages', label: 'Pages', icon: DocumentIcon, group: 'Your site', component: PagesSection },
  { id: 'settings', label: 'Settings', icon: CogIcon, group: 'Your site', component: SettingsSection },
  { id: 'inbox', label: 'Inbox', icon: InboxStackIcon, group: 'Manage', component: InboxSection, badge: s => s.newContactMessages },
  { id: 'users', label: 'Users', icon: UsersIcon, group: 'Manage', component: UsersSection },
  { id: 'shops', label: 'Shops', icon: StoreIcon, group: 'Manage', component: ShopsSection },
  { id: 'bookings', label: 'Bookings', icon: CalendarIcon, group: 'Manage', component: BookingsSection },
  { id: 'verifications', label: 'Verifications', icon: CheckBadgeIcon, group: 'Manage', component: VerificationsSection, badge: s => s.pendingVerifications },
  { id: 'reports', label: 'Reports', icon: FlagIcon, group: 'Manage', component: ReportsSection, badge: s => s.pendingReports },
  { id: 'reviews', label: 'Reviews', icon: StarIcon, group: 'Manage', component: ReviewsSection },
  { id: 'payments', label: 'Payments', icon: CreditCardIcon, group: 'Money', component: PaymentsSection },
  { id: 'payouts', label: 'Payouts', icon: CashIcon, group: 'Money', component: PayoutsSection },
  { id: 'backup', label: 'Backup', icon: DownloadIcon, group: 'System', component: BackupSection },
];

const GROUPS = Array.from(new Set(SECTIONS.map(s => s.group)));

export const AdminPage: React.FC<{ section: string }> = ({ section }) => {
  const user = useStore(s => s.user);
  const siteName = useStore(s => s.config?.settings.siteName) || 'your site';
  const openAuth = useStore(s => s.openAuth);
  const isAdmin = user?.role === 'admin';
  // Refreshed whenever the admin switches sections so the badge counts stay current.
  const stats = useApi<AdminStats>(isAdmin ? '/admin/stats' : null, [section]);
  useAdminCountsListener(() => void stats.reload());
  const current = SECTIONS.find(s => s.id === section);
  const mobileTabs = useRef<HTMLDivElement>(null);

  // Keep the active tab visible in the horizontally scrolling mobile nav.
  useEffect(() => {
    mobileTabs.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [section]);

  useEffect(() => {
    if (current) document.title = `${current.label} · Admin · ${siteName}`;
  }, [current, siteName]);

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <Card>
          <EmptyState icon={<LockIcon className="w-12 h-12" />} title="Admins only">
            {user ? (
              <p>Your account doesn&apos;t have access to the admin panel.</p>
            ) : (
              <>
                <p>Log in with an admin account to manage {siteName}.</p>
                <Button className="mt-4" onClick={() => openAuth('login')}>
                  Log in
                </Button>
              </>
            )}
          </EmptyState>
        </Card>
      </div>
    );
  }

  const badge = (s: SectionDef) => (s.badge && stats.data ? s.badge(stats.data) : 0);
  const Content = current?.component;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-6" aria-label="Admin sections">
            <div className="px-3">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">Admin panel</p>
              <p className="text-sm text-brand-gray truncate">{siteName}</p>
            </div>
            {GROUPS.map(group => (
              <div key={group}>
                <p className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-brand-gray">{group}</p>
                <ul className="space-y-0.5">
                  {SECTIONS.filter(s => s.group === group).map(s => {
                    const active = s.id === section;
                    const n = badge(s);
                    return (
                      <li key={s.id}>
                        <Link
                          to={s.id === 'overview' ? '/admin' : `/admin/${s.id}`}
                          aria-current={active ? 'page' : undefined}
                          className={cx(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            active
                              ? 'bg-brand-primary/10 text-brand-primary'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-dark dark:hover:text-white',
                          )}
                        >
                          <s.icon className="w-5 h-5 flex-shrink-0" />
                          <span className="flex-1">{s.label}</span>
                          {n > 0 && <span className="text-xs font-bold bg-brand-solid text-on-primary rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">{n}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-brand-gray hover:text-brand-dark dark:hover:text-white">
              <EyeIcon className="w-5 h-5" />
              View site
            </Link>
          </nav>
        </aside>

        {/* Mobile tabs */}
        <nav className="lg:hidden -mx-4 px-4 mb-6 overflow-x-auto scrollbar-hide" aria-label="Admin sections">
          <div ref={mobileTabs} className="flex gap-2 w-max pb-1">
            {SECTIONS.map(s => {
              const active = s.id === section;
              const n = badge(s);
              return (
                <Link
                  key={s.id}
                  to={s.id === 'overview' ? '/admin' : `/admin/${s.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-colors',
                    active
                      ? 'bg-brand-solid text-on-primary border-brand-primary'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300',
                  )}
                >
                  <s.icon className="w-4 h-4" />
                  {s.label}
                  {n > 0 && <span className={cx('text-xs rounded-full px-1.5', active ? 'bg-white/25' : 'bg-brand-solid text-on-primary')}>{n}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="min-w-0">
          {Content ? (
            <Content key={section} />
          ) : (
            <Card>
              <EmptyState title="Section not found">
                <p>That part of the admin panel doesn&apos;t exist.</p>
                <Link to="/admin" className="inline-block mt-3 text-brand-primary font-semibold">
                  Back to the overview
                </Link>
              </EmptyState>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
