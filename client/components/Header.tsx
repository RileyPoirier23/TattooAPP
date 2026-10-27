// Top navigation: logo, main links, notifications, account menu and mobile menu.
import React, { useEffect, useRef, useState } from 'react';
import { Link, navigate, useLocation } from '../router';
import { isArtist, useStore } from '../store';
import { timeAgo } from '../lib/format';
import { Avatar, Button, cx } from './ui';
import { BellIcon, ChatIcon, ChevronDownIcon, MenuIcon, MoonIcon, NeedleIcon, SunIcon, XIcon } from './Icons';
import type { Me } from '../../shared/types';

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOutside();
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}

function accountLinks(user: Me): { to: string; label: string }[] {
  const links: { to: string; label: string }[] = [];
  if (user.role === 'admin') links.push({ to: '/admin', label: 'Admin panel' });
  if (isArtist(user)) links.push({ to: '/dashboard', label: 'Artist dashboard' });
  if (user.role === 'shop-owner') links.push({ to: '/shop', label: 'My shop' });
  if (user.role !== 'admin') links.push({ to: '/bookings', label: 'My bookings' });
  if (user.role !== 'admin') links.push({ to: '/messages', label: 'Messages' });
  links.push({ to: '/settings', label: 'Account settings' });
  return links;
}

const Notifications: React.FC = () => {
  const notifications = useStore(s => s.notifications);
  const markRead = useStore(s => s.markNotificationsRead);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(o => !o);
          if (!open && unread) setTimeout(markRead, 800);
        }}
        className="relative p-2 rounded-lg text-gray-500 hover:text-brand-dark dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-expanded={open}
      >
        <BellIcon className="w-6 h-6" />
        <span className="sr-only">Notifications</span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-solid text-on-primary text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </button>
      {open && (
        <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 animate-pop-in origin-top sm:origin-top-right overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 font-semibold">Notifications</div>
          <ul className="max-h-96 overflow-y-auto overscroll-contain">
            {notifications.length === 0 && <li className="p-6 text-center text-sm text-brand-gray">You're all caught up.</li>}
            {notifications.map(n => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    setOpen(false);
                    if (n.link) navigate(n.link);
                  }}
                  className={cx('w-full text-left px-4 py-3 text-sm border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60', !n.read && 'bg-brand-primary/5')}
                >
                  <p className="text-gray-800 dark:text-gray-200">{n.message}</p>
                  <p className="text-xs text-brand-gray mt-1">{timeAgo(n.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const UserMenu: React.FC<{ user: Me }> = ({ user }) => {
  const logout = useStore(s => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div className="relative hidden md:block" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
        <Avatar name={user.name} url={user.avatarUrl} size="sm" />
        <span className="text-sm font-semibold max-w-[10rem] truncate">{user.name}</span>
        <ChevronDownIcon className="w-4 h-4 text-brand-gray" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1 animate-pop-in origin-top-right">
          <div className="px-4 py-2 text-xs text-brand-gray truncate">{user.email}</div>
          {accountLinks(user).map(l => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">
              {l.label}
            </Link>
          ))}
          <div className="border-t border-gray-200 dark:border-gray-800 my-1" />
          <button
            onClick={async () => {
              // Leave the page first, so unsaved changes get the usual "leave without saving?" question.
              if (!navigate('/')) return;
              setOpen(false);
              await logout();
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
};

export const Header: React.FC = () => {
  const config = useStore(s => s.config)!;
  const user = useStore(s => s.user);
  const theme = useStore(s => s.theme);
  const toggleTheme = useStore(s => s.toggleTheme);
  const openAuth = useStore(s => s.openAuth);
  const logout = useStore(s => s.logout);
  const unreadMessages = useStore(s => s.unreadMessages);
  const { path } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const s = config.settings;

  useEffect(() => setMobileOpen(false), [path]);

  const nav = [
    s.features.clientBooking && { to: '/artists', label: 'Find an artist' },
    s.features.boothRental && { to: '/shops', label: 'Guest spots' },
  ].filter(Boolean) as { to: string; label: string }[];

  return (
    <header className="sticky top-0 z-50 pt-[env(safe-area-inset-top)] bg-brand-light/85 dark:bg-brand-dark/85 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      {s.announcementEnabled && s.announcementText && (
        <div className="bg-gradient-to-r from-brand-solid to-brand-secondary-solid text-on-gradient text-center text-sm font-medium px-4 py-2">{s.announcementText}</div>
      )}
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 min-w-0" aria-label={`${s.siteName} home`}>
          {s.logoUrl ? (
            <img src={s.logoUrl} alt={s.siteName} className="h-9 w-auto max-w-[160px] object-contain" />
          ) : (
            <>
              <NeedleIcon className="w-8 h-8 text-brand-primary flex-shrink-0" />
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">{s.siteName}</span>
            </>
          )}
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {nav.map(n => (
            <Link
              key={n.to}
              to={n.to}
              className={cx(
                'px-3 py-2 rounded-lg text-sm font-semibold transition-colors',
                path.startsWith(n.to) ? 'text-brand-primary bg-brand-primary/10' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-lg text-gray-500 hover:text-brand-dark dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Toggle dark mode">
            {theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
          </button>
          {user ? (
            <>
              {user.role !== 'admin' && s.features.messaging && (
                <Link to="/messages" className="relative p-2 rounded-lg text-gray-500 hover:text-brand-dark dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Messages">
                  <ChatIcon className="w-6 h-6" />
                  {unreadMessages > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-brand-primary" />}
                </Link>
              )}
              <Notifications />
              <UserMenu user={user} />
            </>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" onClick={() => openAuth('login')}>Log in</Button>
              <Button onClick={() => openAuth('register')}>Sign up</Button>
            </div>
          )}
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
            {mobileOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-brand-light dark:bg-brand-dark animate-fade-in">
          <div className="container mx-auto px-4 py-3 space-y-1">
            {nav.map(n => (
              <Link key={n.to} to={n.to} className="block px-3 py-2.5 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-800">
                {n.label}
              </Link>
            ))}
            <div className="border-t border-gray-200 dark:border-gray-800 my-2" />
            {user ? (
              <>
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={user.name} url={user.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{user.name}</p>
                    <p className="text-xs text-brand-gray truncate">{user.email}</p>
                  </div>
                </div>
                {accountLinks(user).map(l => (
                  <Link key={l.to} to={l.to} className="block px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                    {l.label}
                  </Link>
                ))}
                <button
                  onClick={async () => {
                    if (!navigate('/')) return;
                    await logout();
                  }}
                  className="block w-full text-left px-3 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Log out
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 py-1">
                <Button variant="outline" onClick={() => openAuth('login')}>Log in</Button>
                <Button onClick={() => openAuth('register')}>Sign up</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
