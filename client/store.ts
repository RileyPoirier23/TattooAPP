// Global app state: site config, current user, theme, toasts, notifications and live updates.
import { create } from 'zustand';
import { api, errorMessage } from './api';
import type { AppNotification, Me, PublicConfig } from '../shared/types';

type Theme = 'light' | 'dark';
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
  /** Set while the toast plays its exit animation, just before it's removed. */
  leaving?: boolean;
}

interface State {
  config: PublicConfig | null;
  user: Me | null;
  ready: boolean;
  bootError: string | null;
  theme: Theme;
  toasts: Toast[];
  authModal: 'login' | 'register' | null;
  notifications: AppNotification[];
  unreadMessages: number;
  /** Bumped whenever bookings change server-side so pages can refetch. */
  bookingsVersion: number;
  /** Bumped when a new message arrives. */
  messagesVersion: number;

  boot: () => Promise<void>;
  setUser: (user: Me | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  toggleTheme: () => void;
  toast: (message: string, type?: 'success' | 'error') => void;
  dismissToast: (id: number) => void;
  openAuth: (mode?: 'login' | 'register') => void;
  closeAuth: () => void;
  loadNotifications: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  loadUnreadMessages: () => Promise<void>;
}

function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

let events: EventSource | null = null;

export const useStore = create<State>()((set, get) => ({
  config: null,
  user: null,
  ready: false,
  bootError: null,
  theme: storedTheme() || (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
  toasts: [],
  authModal: null,
  notifications: [],
  unreadMessages: 0,
  bookingsVersion: 0,
  messagesVersion: 0,

  boot: async () => {
    try {
      const [config, me] = await Promise.all([api.get<PublicConfig>('/config'), api.get<{ user: Me | null }>('/auth/me')]);
      set({ config, ready: true });
      if (!storedTheme()) set({ theme: config.settings.defaultTheme });
      get().setUser(me.user);
    } catch (err) {
      set({ bootError: errorMessage(err), ready: true });
    }
  },

  setUser: user => {
    const prev = get().user;
    set({ user });
    if (user && user.id !== prev?.id) {
      get().loadNotifications();
      get().loadUnreadMessages();
      connectEvents();
    }
    if (!user) {
      events?.close();
      events = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      set({ notifications: [], unreadMessages: 0 });
    }
  },

  refreshUser: async () => {
    try {
      const { user } = await api.get<{ user: Me | null }>('/auth/me');
      get().setUser(user);
    } catch {
      /* ignore */
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      get().setUser(null);
    }
  },

  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* ignore */
    }
    set({ theme });
  },

  toast: (message, type = 'success') => {
    const id = Date.now() + Math.random();
    set(s => ({ toasts: [...s.toasts.slice(-3), { id, message, type }] }));
    setTimeout(() => get().dismissToast(id), type === 'error' ? 6000 : 4000);
  },
  dismissToast: id => {
    if (!get().toasts.some(t => t.id === id && !t.leaving)) return;
    set(s => ({ toasts: s.toasts.map(t => (t.id === id ? { ...t, leaving: true } : t)) }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 150);
  },

  openAuth: (mode = 'login') => set({ authModal: mode }),
  closeAuth: () => set({ authModal: null }),

  loadNotifications: async () => {
    try {
      set({ notifications: await api.get<AppNotification[]>('/notifications') });
    } catch {
      /* ignore */
    }
  },
  markNotificationsRead: async () => {
    if (!get().notifications.some(n => !n.read)) return;
    set(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })) }));
    await api.post('/notifications/read').catch(() => {});
  },
  loadUnreadMessages: async () => {
    try {
      const convos = await api.get<{ unreadCount: number }[]>('/conversations');
      set({ unreadMessages: convos.reduce((s, c) => s + c.unreadCount, 0) });
    } catch {
      /* ignore */
    }
  },
}));

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connectEvents() {
  events?.close();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  events = new EventSource('/api/events');
  const { getState, setState } = useStore;
  // The browser gives up for good after a non-200 reply (e.g. a 502 while the site redeploys) — retry ourselves,
  // then catch up on anything missed while disconnected.
  events.onerror = () => {
    if (events?.readyState !== EventSource.CLOSED) return;
    reconnectTimer = setTimeout(async () => {
      if (!getState().user) return;
      // The session may have ended meanwhile (logged out elsewhere, suspended); don't keep retrying with it.
      await getState().refreshUser();
      if (!getState().user) return;
      connectEvents();
      getState().loadNotifications();
      getState().loadUnreadMessages();
      setState(s => ({ bookingsVersion: s.bookingsVersion + 1, messagesVersion: s.messagesVersion + 1 }));
    }, 5000);
  };
  events.addEventListener('notification', e => {
    const n = JSON.parse((e as MessageEvent).data) as AppNotification;
    setState(s => ({ notifications: [n, ...s.notifications].slice(0, 50) }));
    getState().toast(n.message);
  });
  events.addEventListener('message', () => {
    setState(s => ({ messagesVersion: s.messagesVersion + 1 }));
    getState().loadUnreadMessages();
  });
  events.addEventListener('bookings', () => setState(s => ({ bookingsVersion: s.bookingsVersion + 1 })));
  events.addEventListener('me', () => getState().refreshUser());
}

// Convenience selectors
export const isArtist = (u: Me | null) => u?.role === 'artist' || u?.role === 'dual';
export const isClient = (u: Me | null) => u?.role === 'client' || u?.role === 'dual';
