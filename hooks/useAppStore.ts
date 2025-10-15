// @/hooks/useAppStore.ts
// FIX: Implement the useAppStore hook with Zustand for centralized state management.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Artist, Shop, Booking, Booth, User, ViewMode, Page, AuthCredentials, RegisterDetails, MockData, ClientBookingRequest, Notification, Client, ShopOwner, Admin, ConversationWithUser, Message, ArtistAvailability, Review, ModalState, PortfolioImage, VerificationRequest, ShopOwnerUser,
} from '../types';
import {
  fetchInitialData, updateArtistData, uploadPortfolioImage, updateShopData, addBoothToShop, deleteBoothFromShop,
  createBookingForArtist, createClientBookingRequest, updateClientBookingRequestStatus, fetchNotificationsForUser, markUserNotificationsAsRead, createNotification, fetchAllUsers, updateUserData, updateBoothData, fetchUserConversations, fetchMessagesForConversation, sendMessage, findOrCreateConversation, setArtistAvailability, submitReview, deleteUserAsAdmin, deleteShopAsAdmin, uploadMessageAttachment, fetchArtistReviews, replacePortfolioImage, createShop as apiCreateShop, updateProfileWithShopId, createVerificationRequest, updateVerificationRequest, addReviewToShop, updateBookingPaymentStatus,
} from '../services/apiService';
import { authService } from '../services/authService';

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
  confirmArtistBooking: (bookingData: Omit<Booking, 'id' | 'artistId' | 'city'>) => Promise<Booking | null>;
  sendClientBookingRequest: (requestData: Omit<ClientBookingRequest, 'id' | 'clientId' | 'status' | 'paymentStatus'>) => Promise<void>;
  respondToBookingRequest: (requestId: string, status: 'approved' | 'declined') => Promise<void>;
  completeBookingRequest: (requestId: string) => Promise<void>;
  submitReview: (requestId: string, rating: number, text: string) => Promise<void>;
  updateUser: (userId: string, data: Partial<User['data']>) => Promise<void>;
  updateArtist: (artistId: string, data: Partial<Artist>) => Promise<void>;
  uploadPortfolio: (file: File) => Promise<void>;
  editPortfolioImage: (artistId: string, oldImage: PortfolioImage, newImageBase64: string) => Promise<void>;
  updateShop: (shopId: string, data: Partial<Shop>) => Promise<void>;
  addBooth: (shopId: string, boothData: Omit<Booth, 'id' | 'shopId'>) => Promise<void>;
  updateBooth: (boothId: string, data: Partial<Booth>) => Promise<void>;
  deleteBooth: (boothId: string) => Promise<void>;
  setArtistAvailability: (date: string, status: 'available' | 'unavailable') => Promise<void>;
  
  // Admin Actions
  deleteUser: (userId: string) => Promise<void>;
  deleteShop: (shopId: string) => Promise<void>;
  
  // Messaging Actions
  loadConversations: () => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  sendMessage: (content: string, attachmentFile?: File) => Promise<void>;
  startConversationAndNavigate: (otherUserId: string) => Promise<void>;

  // New Roadmap Actions
  createShop: (shopData: Omit<Shop, 'id' | 'isVerified' | 'rating' | 'reviews' | 'averageArtistRating' | 'ownerId'>) => Promise<void>;
  requestVerification: (type: 'artist' | 'shop', item: Artist | Shop) => Promise<void>;
  respondToVerificationRequest: (requestId: string, status: 'approved' | 'rejected') => Promise<void>;
  submitShopReview: (shopId: string, review: Omit<Review, 'id'>) => Promise<void>;
  processPayment: (type: 'artist' | 'client', booking: Booking | ClientBookingRequest) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      data: { artists: [], shops: [], booths: [], bookings: [], clientBookingRequests: [], notifications: [], conversations: [], messages: [], artistAvailability: [], verificationRequests: [] },
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
            if (currentUser.type === 'admin') {
              set({ page: 'dashboard' });
              const users = await fetchAllUsers();
              set({ allUsers: users });
            }
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
          if (user.type === 'shop-owner' && !user.data.shopId) set({ page: 'onboarding' });
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
          } else if (user.type === 'shop-owner') {
            set({ page: 'onboarding' });
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
              return null;
          }
          try {
              const newBooking = await createBookingForArtist({ ...bookingData, artistId: user.id });
              set(state => ({ data: { ...state.data, bookings: [...state.data.bookings, newBooking] } }));
              get().showToast('Booking initiated! Please complete payment.');
              return newBooking;
          } catch(e) {
              get().showToast('Booking failed. Please try again.', 'error');
              return null;
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
            const newImage = await uploadPortfolioImage(user.id, file);
            const updatedPortfolio = [...user.data.portfolio, newImage];
            get().updateArtist(user.id, { portfolio: updatedPortfolio });
            get().closeModal();
            get().showToast('Image uploaded successfully!');
          } catch(e) {
            get().showToast('Upload failed.', 'error');
          }
      },

      editPortfolioImage: async (artistId, oldImage, newImageBase64) => {
        const user = get().user;
        if (!user || user.id !== artistId) {
            get().showToast('Unauthorized action.', 'error');
            return;
        }

        if (user.type !== 'artist' && user.type !== 'dual') {
          get().showToast('Only artists can edit their portfolio.', 'error');
          return;
        }

        try {
            const newImage = await replacePortfolioImage(user.id, oldImage, newImageBase64);
            const updatedPortfolio = user.data.portfolio.map(img => img.url === oldImage.url ? newImage : img);
            await get().updateArtist(user.id, { portfolio: updatedPortfolio });
            get().closeModal();
            get().showToast('Image updated successfully with AI!');
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to save edited image.';
            get().showToast(message, 'error');
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
          get().closeModal();
      },
      deleteBooth: async (boothId) => {
          await deleteBoothFromShop(boothId);
          set(state => ({
              data: { ...state.data, booths: state.data.booths.filter(b => b.id !== boothId) }
          }));
      },
      setArtistAvailability: async (date, status) => {
        const user = get().user;
        if (!user || (user.type !== 'artist' && user.type !== 'dual')) return;
        const newAvailability = await setArtistAvailability(user.id, date, status);
        set(state => {
            const existing = state.data.artistAvailability.find(a => a.date === date && a.artistId === user.id);
            if (existing) {
                return { data: { ...state.data, artistAvailability: state.data.artistAvailability.map(a => a.id === existing.id ? newAvailability : a)}};
            } else {
                return { data: { ...state.data, artistAvailability: [...state.data.artistAvailability, newAvailability]}};
            }
        });
      },
      completeBookingRequest: async (requestId) => {
        await updateClientBookingRequestStatus(requestId, 'completed');
        set(state => ({
            data: {
                ...state.data,
                clientBookingRequests: state.data.clientBookingRequests.map(req => req.id === requestId ? { ...req, status: 'completed' } : req),
            }
        }));
        get().showToast("Booking marked as complete.");
      },
      submitReview: async (requestId, rating, text) => {
        const updatedRequest = await submitReview(requestId, rating, text);
        set(state => ({
            data: {
                ...state.data,
                clientBookingRequests: state.data.clientBookingRequests.map(req => req.id === requestId ? updatedRequest : req),
            }
        }));
        get().closeModal();
        get().showToast("Thank you for your review!");
      },
      deleteUser: async (userId) => {
        await deleteUserAsAdmin(userId);
        set(state => ({
            allUsers: state.allUsers.filter(u => u.id !== userId),
            data: { ...state.data, artists: state.data.artists.filter(a => a.id !== userId) }
        }));
        get().showToast("User deleted.");
      },
      deleteShop: async (shopId) => {
        await deleteShopAsAdmin(shopId);
        set(state => ({
            data: { ...state.data, shops: state.data.shops.filter(s => s.id !== shopId) }
        }));
        get().showToast("Shop deleted.");
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
      sendMessage: async (content, attachmentFile) => {
        const { activeConversationId, user } = get();
        if (!activeConversationId || !user) return;
        if (!content.trim() && !attachmentFile) return;

        let attachmentUrl: string | undefined = undefined;
        if (attachmentFile) {
            attachmentUrl = await uploadMessageAttachment(attachmentFile, activeConversationId);
        }

        const newMessage = await sendMessage(activeConversationId, user.id, content.trim(), attachmentUrl);
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

      // --- NEW ROADMAP ACTIONS ---
      createShop: async (shopData) => {
        const user = get().user;
        if (!user || user.type !== 'shop-owner') return;
        try {
            const newShop = await apiCreateShop(shopData, user.id);
            await updateProfileWithShopId(user.id, newShop.id);
            // FIX: Added type guard to prevent TypeScript from being confused about the user type when updating state.
            set(state => {
                if (state.user?.type === 'shop-owner') {
                    const updatedUser: ShopOwnerUser = {
                        ...state.user,
                        data: {
                            ...state.user.data,
                            shopId: newShop.id,
                        },
                    };
                    return {
                        data: { ...state.data, shops: [...state.data.shops, newShop] },
                        user: updatedUser,
                        page: 'dashboard',
                    };
                }
                return {};
            });
            get().showToast('Your shop has been created!', 'success');
        } catch (e) {
            get().showToast('Failed to create shop.', 'error');
        }
      },
      requestVerification: async (type, item) => {
        const user = get().user;
        if (!user) return;
        try {
            // FIX: Simplified the 'id' retrieval which was causing a 'type never' error.
            const id = item.id;
            const newRequest = await createVerificationRequest(type, id, user.id);
            // No need to add to local state, admin will see it.
            get().closeModal();
            get().showToast('Verification request submitted.');
        } catch (e) {
            get().showToast('Failed to submit request.', 'error');
        }
      },
      respondToVerificationRequest: async (requestId, status) => {
        try {
            const updatedRequest = await updateVerificationRequest(requestId, status);
            // Refresh all data to reflect verification status change
            get().initialize();
            get().showToast(`Request ${status}.`);
        } catch (e) {
            get().showToast('Failed to process request.', 'error');
        }
      },
      submitShopReview: async (shopId, review) => {
        try {
            const updatedShop = await addReviewToShop(shopId, review);
            set(state => ({
                data: { ...state.data, shops: state.data.shops.map(s => s.id === shopId ? updatedShop : s) }
            }));
            get().closeModal();
            get().showToast('Thank you for reviewing the shop!');
        } catch (e) {
            get().showToast('Failed to submit review.', 'error');
        }
      },
      processPayment: async (type, booking) => {
        try {
            // Simulate API call to payment provider
            const paymentIntentId = `pi_sim_${Date.now()}`;
            await updateBookingPaymentStatus(type, booking.id, paymentIntentId);

            if (type === 'artist') {
                 set(state => ({
                    data: { ...state.data, bookings: state.data.bookings.map(b => b.id === booking.id ? { ...b, paymentStatus: 'paid' } : b) }
                }));
            } else {
                 set(state => ({
                    data: { ...state.data, clientBookingRequests: state.data.clientBookingRequests.map(b => b.id === booking.id ? { ...b, paymentStatus: 'paid' } : b) }
                }));
            }

            get().closeModal();
            get().showToast('Payment successful!');
        } catch (e) {
            get().showToast('Payment failed.', 'error');
        }
      },


    }),
    {
      name: 'inkspace-app-storage', 
      partialize: (state) => ({ viewMode: state.viewMode }),
    }
  )
);