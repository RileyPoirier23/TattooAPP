// @/hooks/useAppStore.ts
// FIX: Implement the useAppStore hook with Zustand for centralized state management.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Artist, Shop, Booking, Booth, User, ViewMode, Page, AuthCredentials, RegisterDetails, MockData, ClientBookingRequest, Notification, Client, ShopOwner, Admin, ConversationWithUser, Message,
} from '../types';
import {
  fetchInitialData, updateArtistData, uploadPortfolioImage, updateShopData, addBoothToShop, deleteBoothFromShop,
  createBookingForArtist, createClientBookingRequest, updateClientBookingRequestStatus, fetchNotificationsForUser, markUserNotificationsAsRead, createNotification, fetchAllUsers, updateUserData, updateBoothData, fetchUserConversations, fetchMessagesForConversation, sendMessage, findOrCreateConversation,
} from '../services/apiService';
import { authService } from '../services/authService';

interface ModalState {
  type: 'auth' | 'artist-detail' | 'shop-detail' | 'booking' | 'client-booking-request' | 'upload-portfolio' | null;
  data?: any;
}

interface ToastState {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface AppState {
  // Data
  data: MockData;
  allUsers: User[];
  
  // App status
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  
  // User & View
  user: User | null;
  viewMode: ViewMode;
  page: Page;
  
  // UI State
  modal: ModalState;
  toast: ToastState | null;

  // Messaging State
  activeConversationId: string | null;

  // Actions
  initialize: () => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  navigateTo: (page: Page) => void;
  openModal: (type: ModalState['type'], data?: any) => void;
  closeModal: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  dismissToast: () => void;
  login: (credentials: AuthCredentials) => Promise<void>;
  register: (details: RegisterDetails) => Promise<void>;
  logout: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
  confirmArtistBooking: (bookingData: Omit<Booking, 'id' | 'artistId'>) => Promise<void>;
  sendClientBookingRequest: (requestData: Omit<ClientBookingRequest, 'id' | 'clientId' | 'status' | 'paymentStatus'>) => Promise<void>;
  respondToBookingRequest: (requestId: string, status: 'approved' | 'declined') => Promise<void>;
  updateUser: (userId: string, data: Partial<User['data']>) => Promise<void>;
  updateArtist: (artistId: string, data: Partial<Artist>) => Promise<void>;
  uploadPortfolio: (file: File) => Promise<void>;
  updateShop: (shopId: string, data: Partial<Shop>) => Promise<void>;
  addBooth: (shopId: string, boothData: Omit<Booth, 'id' | 'shopId'>) => Promise<void>;
  updateBooth: (boothId: string, data: Partial<Booth>) => Promise<void>;
  deleteBooth: (boothId: string) => Promise<void>;
  
  // Messaging Actions
  loadConversations: () => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  startConversationAndNavigate: (otherUserId: string) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      data: { artists: [], shops: [], booths: [], bookings: [], clientBookingRequests: [], notifications: [], conversations: [], messages: [] },
      allUsers: [],
      isInitialized: false,
      isLoading: true,
      error: null,
      user: null,
      viewMode: 'client',
      page: 'search',
      modal: { type: null },
      toast: null,
      activeConversationId: null,

      initialize: async () => {
        try {
          set({ isLoading: true });
          const [initialData, currentUser] = await Promise.all([
            fetchInitialData(),
            authService.getCurrentUser(),
          ]);
          set({ data: initialData, user: currentUser, isInitialized: true, isLoading: false });
          if (currentUser) {
            if (currentUser.type === 'artist') set({ viewMode: 'artist' });
            if (currentUser.type === 'admin') set({ page: 'dashboard' });
            get().fetchNotifications();
            get().loadConversations();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to initialize app.";
          set({ error: message, isLoading: false, isInitialized: true });
        }
      },
      
      setViewMode: (mode) => set({ viewMode: mode }),
      navigateTo: (page) => set({ page }),
      openModal: (type, data) => set({ modal: { type, data } }),
      closeModal: () => set({ modal: { type: null, data: undefined } }),
      showToast: (message, type = 'success') => set({ toast: { id: Date.now(), message, type } }),
      dismissToast: () => set({ toast: null }),
      
      login: async (credentials) => {
        try {
          const user = await authService.login(credentials);
          set({ user, page: 'search' }); // Reset to search on login
          if (user.type === 'artist') set({ viewMode: 'artist' });
          if (user.type === 'admin') {
            set({ page: 'dashboard' });
            const users = await fetchAllUsers();
            set({ allUsers: users });
          }
          get().closeModal();
          get().fetchNotifications();
          get().loadConversations();
          get().showToast('Login successful!');
        } catch (error) {
          const message = error instanceof Error ? error.message : "Login failed.";
          get().showToast(message, 'error');
        }
      },
      
      register: async (details) => {
        try {
          const user = await authService.register(details);
          set({ user });
           if (user.type === 'artist' || user.type === 'dual') {
            set({ viewMode: 'artist', page: 'profile' }); // Go to profile to set up
          } else {
            set({ page: 'search' });
          }
          get().closeModal();
          get().showToast('Registration successful!');
        } catch (error) {
          const message = error instanceof Error ? error.message : "Registration failed.";
          get().showToast(message, 'error');
        }
      },
      
      logout: async () => {
        await authService.logout();
        set({ user: null, page: 'search', viewMode: 'client', data: {...get().data, notifications: [], conversations: [], messages: []}, activeConversationId: null });
        get().showToast('Logged out successfully.');
      },

      fetchNotifications: async () => {
        const user = get().user;
        if (!user) return;
        const notifications = await fetchNotificationsForUser(user.id);
        set(state => ({ data: { ...state.data, notifications } }));
      },

      markNotificationsAsRead: async () => {
        const user = get().user;
        if (!user) return;
        await markUserNotificationsAsRead(user.id);
        set(state => ({
          data: {
            ...state.data,
            notifications: state.data.notifications.map(n => ({ ...n, read: true })),
          }
        }));
      },

      confirmArtistBooking: async (bookingData) => {
          const user = get().user;
          if (!user || user.type !== 'artist' && user.type !== 'dual') {
              get().showToast('You must be an artist to book a booth.', 'error');
              return;
          }
          try {
              const newBooking = await createBookingForArtist({ ...bookingData, artistId: user.id });
              set(state => ({ data: { ...state.data, bookings: [...state.data.bookings, newBooking] } }));
              get().showToast('Booking initiated! Please complete payment.');
          } catch(e) {
              get().showToast('Booking failed. Please try again.', 'error');
          }
      },

      sendClientBookingRequest: async (requestData) => {
        const user = get().user;
        if (!user || user.type !== 'client' && user.type !== 'dual') {
            get().showToast('You must be logged in as a client.', 'error');
            return;
        }
        try {
            const newRequest = await createClientBookingRequest({ ...requestData, clientId: user.id });
            set(state => ({ data: { ...state.data, clientBookingRequests: [...state.data.clientBookingRequests, newRequest] } }));
            get().loadConversations();
            get().closeModal();
            get().showToast('Booking request sent!');
        } catch(e) {
            const message = e instanceof Error ? e.message : 'Failed to send request. Please try again.';
            get().showToast(message, 'error');
        }
      },

      respondToBookingRequest: async (requestId, status) => {
        try {
            await updateClientBookingRequestStatus(requestId, status);
            set(state => ({
                data: {
                    ...state.data,
                    clientBookingRequests: state.data.clientBookingRequests.map(req =>
                        req.id === requestId ? { ...req, status } : req
                    ),
                }
            }));
            get().showToast(`Request has been ${status}.`);
            get().fetchNotifications(); // Fetch latest notifications for client
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to respond to request.';
            get().showToast(message, 'error');
        }
      },
      
      updateUser: async (userId, data) => {
          if (get().user?.id !== userId) return;
          await updateUserData(userId, data);
          // FIX: The generic update was causing type errors with the discriminated union `User` type.
          // This was because `data` is a broad `Partial<User['data']>`, which makes TS think
          // required properties on specific user data types (e.g., `Artist['specialty']`) could become optional.
          // Using a type-guarded update inside `set` ensures type safety.
          set(state => {
              const user = state.user;
              if (!user) return {};

              const newUserData = { ...user.data, ...data };
              
              if (user.type === 'artist' || user.type === 'dual') {
                  return { user: { ...user, data: newUserData as Artist } };
              } else if (user.type === 'client') {
                  return { user: { ...user, data: newUserData as Client } };
              } else if (user.type === 'shop-owner') {
                  return { user: { ...user, data: newUserData as ShopOwner } };
              } else if (user.type === 'admin') {
                  return { user: { ...user, data: newUserData as Admin } };
              }
              return {};
          });
      },
      
      updateArtist: async (artistId, data) => {
        const updatedArtist = await updateArtistData(artistId, data);
        // FIX: The previous implementation didn't check the user's type, which could lead to
        // incorrectly assigning `Artist` data to a non-artist user (e.g., a ShopOwner).
        // Adding a type check for 'artist' or 'dual' ensures the user in state is updated correctly and safely.
        set(state => ({
            data: { ...state.data, artists: state.data.artists.map(a => a.id === artistId ? updatedArtist : a) },
            user: (state.user?.id === artistId && (state.user.type === 'artist' || state.user.type === 'dual')) 
                ? { ...state.user, data: updatedArtist } 
                : state.user
        }));
      },

      uploadPortfolio: async (file) => {
          const user = get().user;
          if (!user || (user.type !== 'artist' && user.type !== 'dual')) return;
          try {
            const newUrl = await uploadPortfolioImage(user.id, file);
            const updatedPortfolio = [...user.data.portfolio, newUrl];
            get().updateArtist(user.id, { portfolio: updatedPortfolio });
            get().closeModal();
            get().showToast('Image uploaded successfully!');
          } catch(e) {
            get().showToast('Upload failed.', 'error');
          }
      },

      updateShop: async (shopId, data) => {
          const updatedShop = await updateShopData(shopId, data);
          set(state => ({
              data: { ...state.data, shops: state.data.shops.map(s => s.id === shopId ? updatedShop : s) }
          }));
          get().showToast('Shop details updated.');
      },
      addBooth: async (shopId, boothData) => {
          const newBooth = await addBoothToShop(shopId, boothData);
          set(state => ({
              data: { ...state.data, booths: [...state.data.booths, newBooth] }
          }));
      },
      updateBooth: async (boothId, data) => {
          const updatedBooth = await updateBoothData(boothId, data);
          set(state => ({
              data: { ...state.data, booths: state.data.booths.map(b => b.id === boothId ? updatedBooth : b) }
          }));
      },
      deleteBooth: async (boothId) => {
          await deleteBoothFromShop(boothId);
          set(state => ({
              data: { ...state.data, booths: state.data.booths.filter(b => b.id !== boothId) }
          }));
      },

      // --- MESSAGING ACTIONS ---
      loadConversations: async () => {
        const user = get().user;
        if (!user) return;
        const conversations = await fetchUserConversations(user.id);
        set(state => ({ data: { ...state.data, conversations }}));
      },
      selectConversation: async (conversationId) => {
        set({ activeConversationId: conversationId, isLoading: true });
        const messages = await fetchMessagesForConversation(conversationId);
        set(state => ({ data: { ...state.data, messages }, isLoading: false }));
      },
      sendMessage: async (content) => {
        const { activeConversationId, user } = get();
        if (!activeConversationId || !user || !content.trim()) return;

        const newMessage = await sendMessage(activeConversationId, user.id, content.trim());
        set(state => ({
          data: { ...state.data, messages: [...state.data.messages, newMessage] }
        }));
      },
      startConversationAndNavigate: async (otherUserId) => {
        const user = get().user;
        if (!user) {
            get().showToast('You must be logged in to send a message.', 'error');
            get().openModal('auth');
            return;
        }
        try {
            set({ isLoading: true });
            const conversation = await findOrCreateConversation(user.id, otherUserId);
            await get().loadConversations();
            get().selectConversation(conversation.id);
            set({ page: 'messages', isLoading: false });
            get().closeModal();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Could not start conversation.";
            get().showToast(message, 'error');
            set({ isLoading: false });
        }
      },


    }),
    {
      name: 'inkspace-app-storage', 
      partialize: (state) => ({ viewMode: state.viewMode }),
    }
  )
);