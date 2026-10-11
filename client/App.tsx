// App shell and route table.
import React, { Suspense, lazy, useEffect } from 'react';
import { Link, matchPath, useLocation } from './router';
import { ROLE_LABELS } from './lib/format';
import { useStore } from './store';
import { applyBranding, applyTheme } from './lib/theme';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { Button, Card, EmptyState, PageLoader, cx } from './components/ui';
import { LockIcon, XIcon } from './components/Icons';
import { HomePage } from './pages/Home';
import { ArtistsPage } from './pages/Artists';
import { ArtistProfilePage } from './pages/ArtistProfile';
import { ShopsPage } from './pages/Shops';
import { ShopProfilePage } from './pages/ShopProfile';
import { BookingStatusPage } from './pages/BookingStatus';
import { ContentPage } from './pages/ContentPage';
import { ContactPage } from './pages/Contact';
import { ResetPasswordPage } from './pages/ResetPassword';
import type { Role } from '../shared/types';

// Pages only members use are downloaded when first opened, so visitors browsing artists load less.
const AdminPage = lazy(() => import('./pages/admin/AdminPage').then(m => ({ default: m.AdminPage })));
const MyBookingsPage = lazy(() => import('./pages/MyBookings').then(m => ({ default: m.MyBookingsPage })));
const ArtistDashboardPage = lazy(() => import('./pages/ArtistDashboard').then(m => ({ default: m.ArtistDashboardPage })));
const ShopDashboardPage = lazy(() => import('./pages/ShopDashboard').then(m => ({ default: m.ShopDashboardPage })));
const MessagesPage = lazy(() => import('./pages/Messages').then(m => ({ default: m.MessagesPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then(m => ({ default: m.SettingsPage })));

/** If part of the site fails to load (usually an old tab after the site was updated), offer a reload instead of a blank page. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  componentDidCatch(err: unknown) {
    console.error(err);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Card className="max-w-md mx-auto mt-10 text-center">
        <h2 className="text-xl font-bold mb-2">Something went wrong loading this page</h2>
        <p className="text-brand-gray mb-4">The site may have just been updated. Reloading usually fixes it.</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </Card>
    );
  }
}

type RouteDef = { path: string; render: (p: Record<string, string>) => React.ReactNode; auth?: Role[] | true; wide?: boolean };

const ROUTES: RouteDef[] = [
  { path: '/', render: () => <HomePage />, wide: true },
  { path: '/artists', render: () => <ArtistsPage /> },
  { path: '/artists/:id', render: p => <ArtistProfilePage id={p.id} /> },
  { path: '/shops', render: () => <ShopsPage /> },
  { path: '/shops/:id', render: p => <ShopProfilePage id={p.id} /> },
  { path: '/booking/:id', render: p => <BookingStatusPage id={p.id} /> },
  { path: '/bookings', render: () => <MyBookingsPage />, auth: true },
  { path: '/dashboard', render: () => <ArtistDashboardPage />, auth: ['artist', 'dual'] },
  { path: '/shop', render: () => <ShopDashboardPage />, auth: ['shop-owner'] },
  { path: '/messages', render: () => <MessagesPage />, auth: true },
  { path: '/messages/:id', render: p => <MessagesPage conversationId={p.id} />, auth: true },
  { path: '/settings', render: () => <SettingsPage />, auth: true },
  { path: '/p/:slug', render: p => <ContentPage slug={p.slug} /> },
  { path: '/contact', render: () => <ContactPage /> },
  { path: '/reset-password', render: () => <ResetPasswordPage /> },
  { path: '/admin', render: () => <AdminPage section="overview" />, auth: ['admin'] },
  { path: '/admin/:section', render: p => <AdminPage section={p.section} />, auth: ['admin'] },
];

const Toasts: React.FC = () => {
  const toasts = useStore(s => s.toasts);
  const dismiss = useStore(s => s.dismissToast);
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[70] flex flex-col gap-2 items-stretch sm:items-end pointer-events-none" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex items-start gap-3 sm:max-w-sm rounded-xl px-4 py-3 shadow-lg text-white text-sm font-medium animate-slide-up',
            t.type === 'error' ? 'bg-red-600' : 'bg-gray-900 dark:bg-gray-800 border border-gray-700',
          )}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

const LoginRequired: React.FC<{ roles?: Role[] }> = ({ roles }) => {
  const user = useStore(s => s.user);
  const openAuth = useStore(s => s.openAuth);
  return (
    <Card className="max-w-md mx-auto mt-10">
      <EmptyState icon={<LockIcon />} title={user ? "You don't have access to this page" : 'Please log in'}>
        {user ? (
          <>
            <p>This page is for {roles?.filter(r => r !== 'dual').map(r => ROLE_LABELS[r]?.toLowerCase() ?? r).join(' or ')} accounts.</p>
            {user.role === 'client' && roles?.includes('artist') && (
              <Link to="/settings#artist" className="inline-block mt-4">
                <Button>Become an artist</Button>
              </Link>
            )}
          </>
        ) : (
          <>
            <p>Log in or create a free account to continue.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" onClick={() => openAuth('login')}>Log in</Button>
              <Button onClick={() => openAuth('register')}>Sign up</Button>
            </div>
          </>
        )}
      </EmptyState>
    </Card>
  );
};

export const App: React.FC = () => {
  const { ready, config, bootError, user, theme, authModal, boot } = useStore();
  const { path } = useLocation();

  useEffect(() => {
    boot();
  }, [boot]);
  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => {
    if (config) applyBranding(config.settings);
  }, [config]);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center"><PageLoader /></div>;
  }
  if (bootError || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">We can't load the site right now</h1>
          <p className="text-brand-gray mb-4">{bootError}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </Card>
      </div>
    );
  }

  let route: RouteDef | undefined;
  let params: Record<string, string> = {};
  for (const r of ROUTES) {
    const m = matchPath(r.path, path);
    if (m) {
      route = r;
      params = m;
      break;
    }
  }

  let content: React.ReactNode;
  if (!route) {
    content = (
      <Card className="max-w-md mx-auto mt-10">
        <EmptyState title="Page not found">The page you're looking for doesn't exist or has moved.</EmptyState>
      </Card>
    );
  } else if (route.auth && (!user || (Array.isArray(route.auth) && !route.auth.includes(user.role)))) {
    content = <LoginRequired roles={Array.isArray(route.auth) ? route.auth : undefined} />;
  } else {
    content = route.render(params);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className={cx('flex-1 w-full', route?.wide ? '' : 'container mx-auto px-4 py-8')}>
        <ErrorBoundary resetKey={path}>
          <Suspense fallback={<PageLoader />}>
            <div key={path} className="animate-fade-in">{content}</div>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      {authModal && <AuthModal key={authModal} />}
      <Toasts />
    </div>
  );
};
