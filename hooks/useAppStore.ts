// @/hooks/useAppStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Artist, Shop, Booking, Booth, User, ViewMode, AuthCredentials, RegisterDetails, MockData, ClientBookingRequest, Notification, Client, ShopOwner, Admin, Conversation, ConversationWithUser, Message, ArtistAvailability, Review, ModalState, PortfolioImage, VerificationRequest, ShopOwnerUser, UserRole,
} from '../types';
import {
  fetchInitialData, updateArtistData, uploadPortfolioImage, updateShopData, addBoothToShop, deleteBoothFromShop,
  createBookingForArtist, createClientBookingRequest, updateClientBookingRequestStatus, fetchNotificationsForUser, markUserNotificationsAsRead, createNotification, fetchAllUsers, updateUserData, updateBoothData, fetchUserConversations, fetchMessagesForConversation, sendMessage, findOrCreateConversation, setArtistAvailability, submitReview, deleteUserAsAdmin, deleteShopAsAdmin, uploadMessageAttachment, fetchArtistReviews, createShop as apiCreateShop, createVerificationRequest, updateVerificationRequest, addReviewToShop,
  adminUpdateUserProfile, adminUpdateShopDetails, deletePortfolioImageFromStorage, uploadBookingReferenceImage, payClientBookingDeposit,
} from '../services/apiService';
import { authService } from '../services/authService';

type NavigateFunction = (path: string) => void;

interface ToastState {
  id: number;
  message: string;
  type: 'success' | 'error';
}

// Store notification interval ID outside the component
let notificationInterval: number | null = null;

type Theme = 'light' | 'dark';

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
  theme: Theme;
  
  // UI State
  modal: ModalState;
  toast: ToastState | null;

  // Messaging State
  activeConversationId: string | null;

  // Actions
  navigate: NavigateFunction | null;
  initialize: (navigate: NavigateFunction) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  toggleTheme: () => void;
  openModal: (type: ModalState['type'], data?: any) => void;
  closeModal: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  dismissToast: () => void;
  login: (credentials: AuthCredentials, navigate: NavigateFunction) => Promise<void>;
  register: (details: RegisterDetails, navigate: NavigateFunction) => Promise<void>;
  logout: (navigate: NavigateFunction) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
  confirmArtistBooking: (bookingData: Omit<Booking, 'id' | 'artistId' | 'city' | 'paymentStatus'>) => Promise<void>;
  sendClientBookingRequest: (requestData: Omit<ClientBookingRequest, 'id' | 'clientId' | 'status' | 'paymentStatus'>, referenceFiles: File[]) => Promise<void>;
  respondToBookingRequest: (requestId: string, status: 'approved' | 'declined') => Promise<void>;
  updateCompletionStatus: (requestId: string, status: 'completed' | 'rescheduled' | 'no-show') => Promise<void>;
  payBookingDeposit: (requestId: string) => Promise<void>;
  submitReview: (requestId: string, rating: number, text: string) => Promise<void>;
  updateUser: (userId: string, data: Partial<User['data']>) => Promise<void>;
  updateArtist: (artistId: string, data: Partial<Artist>) => Promise<void>;
  uploadPortfolio: (file: File) => Promise<void>;
  deletePortfolioImage: (imageUrl: string) => Promise<void>;
  updateShop: (shopId: string, data: Partial<Shop>) => Promise<void>;
  addBooth: (shopId: string, boothData: Omit<Booth, 'id' | 'shopId'>) => Promise<void>;
  updateBooth: (boothId: string, data: Partial<Booth>) => Promise<void>;
  deleteBooth: (boothId: string) => Promise<void>;
  setArtistAvailability: (date: string, status: 'available' | 'unavailable') => Promise<void>;
  
  // Admin Actions
  deleteUser: (userId: string) => Promise<void>;
  deleteShop: (shopId: string) => Promise<void>;
  adminUpdateUser: (userId: string, data: { name: string, role: UserRole, isVerified: boolean }) => Promise<void>;
  adminUpdateShop: (shopId: string, data: { name: string, isVerified: boolean }) => Promise<void>;
  
  // Messaging Actions
  loadConversations: () => Promise<void>;
  selectConversation: (conversationId: string | null) => Promise<void>;
  sendMessage: (content: string, attachmentFile?: File) => Promise<void>;
  startConversation: (otherUserId: string) => Promise<Conversation | null>;

  // New Roadmap Actions
  createShop: (shopData: Omit<Shop, 'id' | 'isVerified' | 'rating' | 'reviews' | 'averageArtistRating' | 'ownerId'>) => Promise<void>;
  requestVerification: (type: 'artist' | 'shop', item: Artist | Shop) => Promise<void>;
  respondToVerificationRequest: (requestId: string, status: 'approved' | 'rejected') => Promise<void>;
  submitShopReview: (shopId: string, review: Omit<Review, 'id'>) => Promise<void>;
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
      theme: 'dark',
      modal: { type: null },
      toast: null,
      activeConversationId: null,
      navigate: null,

      initialize: async (navigate) => {
        try {
          set({ isLoading: true, error: null, navigate });
          
          // First, wait for the authentication service to establish a stable session.
          // This prevents race conditions where data is fetched before RLS policies can be applied.
          const currentUser = await authService.getCurrentUser();
          
          // Once the user is known, fetch all initial application data.
          const initialData = await fetchInitialData();

          // Enrich artists with average ratings
          const artistsWithRatings = initialData.artists.map((artist: Artist) => {
              const reviews = initialData.clientBookingRequests.filter((b: ClientBookingRequest) => b.artistId === artist.id && b.reviewRating);
              const totalRating = reviews.reduce((acc: number, curr: ClientBookingRequest) => acc + (curr.reviewRating || 0), 0);
              const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
              return { ...artist, averageRating };
          });
          initialData.artists = artistsWithRatings;


          set({ data: initialData, user: currentUser, isInitialized: true, isLoading: false });
          if (currentUser) {
            if (currentUser.type === 'artist' || currentUser.type === 'dual') set({ viewMode: 'artist' });
            if (currentUser.type === 'admin') {
              navigate('/admin');
              const users = await fetchAllUsers();
              set({ allUsers: users });
            }
            get().fetchNotifications();
            get().loadConversations();
            
            if (notificationInterval) clearInterval(notificationInterval);
            notificationInterval = window.setInterval(() => get().fetchNotifications(), 30000);
          }
        } catch (error) {
          console.error("Fatal: Application initialization failed.", error);
          const message = error instanceof Error ? error.message : "Failed to initialize app.";
          set({ error: message, isLoading: false, isInitialized: true });
        }
      },
      
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleTheme: () => set(state => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      openModal: (type, data) => set({ modal: { type, data } }),
      closeModal: () => set({ modal: { type: null, data: undefined } }),
      showToast: (message, type = 'success') => set({ toast: { id: Date.now(), message, type } }),
      dismissToast: () => set({ toast: null }),
      
      login: async (credentials, navigate) => {
        try {
          const user = await authService.login(credentials);
          set({ user });
          if (user.type === 'artist' || user.type === 'dual') set({ viewMode: 'artist' });
          if (user.type === 'shop-owner' && !user.data.shopId) navigate('/onboarding');
          else if (user.type === 'admin') navigate('/admin');
          else navigate('/artists');
          
          if (user.type === 'admin') {
            const users = await fetchAllUsers();
            set({ allUsers: users });
          }

          get().closeModal();
          get().fetchNotifications();
          get().loadConversations();
          get().showToast('Login successful!');

          if (notificationInterval) clearInterval(notificationInterval);
          notificationInterval = window.setInterval(() => get().fetchNotifications(), 30000);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Login failed.";
          get().showToast(message, 'error');
        }
      },
      
      register: async (details, navigate) => {
        try {
          const user = await authService.register(details);
          set({ user });
           if (user.type === 'artist' || user.type === 'dual') {
            set({ viewMode: 'artist'});
            navigate('/profile');
          } else if (user.type === 'shop-owner') {
            navigate('/onboarding');
          } else {
            navigate('/artists');
          }
          get().closeModal();
          get().showToast('Registration successful!');
        } catch (error) {
          const message = error instanceof Error ? error.message : "Registration failed.";
          get().showToast(message, 'error');
        }
      },
      
      logout: async (navigate) => {
        await authService.logout();
        if (notificationInterval) clearInterval(notificationInterval);
        notificationInterval = null;
        set({ user: null, viewMode: 'client', data: {...get().data, notifications: [], conversations: [], messages: []}, activeConversationId: null });
        navigate('/');
        get().showToast('Logged out successfully.');
      },

      fetchNotifications: async () => {
        const user = get().user;
        if (!user) return;
        try {
            const notifications = await fetchNotificationsForUser(user.id);
            const currentNotifications = get().data.notifications;
            if(notifications.length > currentNotifications.length) {
                const newUnreadCount = notifications.filter(n => !n.read).length;
                const oldUnreadCount = currentNotifications.filter(n => !n.read).length;
                if (newUnreadCount > oldUnreadCount) {
                    get().showToast('You have a new notification!');
                }
            }
            set(state => ({ data: { ...state.data, notifications } }));
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
      },

      markNotificationsAsRead: async () => {
        const user = get().user;
        if (!user) return;
        try {
            await markUserNotificationsAsRead(user.id);
            set(state => ({
              data: {
                ...state.data,
                notifications: state.data.notifications.map(n => ({ ...n, read: true })),
              }
            }));
        } catch (error) {
             get().showToast("Could not mark notifications as read.", 'error');
        }
      },

      confirmArtistBooking: async (bookingData) => {
          const user = get().user;
          if (!user || user.type !== 'artist' && user.type !== 'dual') {
              get().showToast('You must be an artist to book a booth.', 'error');
              return;
          }
          try {
              const newBooking = await createBookingForArtist({ ...bookingData, artistId: user.id, paymentStatus: 'unpaid' });
              set(state => ({ data: { ...state.data, bookings: [...state.data.bookings, newBooking] } }));
              get().closeModal();
              get().showToast('Booking confirmed! Payment is due.');
          } catch(e) {
              get().showToast('Booking failed. Please try again.', 'error');
          }
      },

      sendClientBookingRequest: async (requestData, referenceFiles) => {
        const user = get().user;
        if (!user || user.type !== 'client' && user.type !== 'dual') {
            get().showToast('You must be logged in as a client.', 'error');
            return;
        }
        try {
            set({ isLoading: true });
            const tempRequestId = `temp_${Date.now()}`;
            const uploadPromises = referenceFiles.map((file, index) => 
                uploadBookingReferenceImage(tempRequestId, file, index)
            );
            const referenceImageUrls = await Promise.all(uploadPromises);

            const finalRequestData = { ...requestData, clientId: user.id, referenceImageUrls };

            const newRequest = await createClientBookingRequest(finalRequestData);

            set(state => ({ 
                data: { ...state.data, clientBookingRequests: [...state.data.clientBookingRequests, newRequest] },
                isLoading: false 
            }));
            await get().loadConversations();
            get().closeModal();
            get().showToast('Booking request sent!');
        } catch(e) {
            const message = e instanceof Error ? e.message : 'Failed to send request. Please try again.';
            get().showToast(message, 'error');
            set({ isLoading: false });
        }
      },

      respondToBookingRequest: async (requestId, status) => {
        try {
            const paymentStatus = 'unpaid';
            await updateClientBookingRequestStatus(requestId, status, paymentStatus);
            set(state => ({
                data: {
                    ...state.data,
                    clientBookingRequests: state.data.clientBookingRequests.map(req =>
                        req.id === requestId ? { ...req, status, paymentStatus } : req
                    ),
                }
            }));

            if (status === 'approved') {
                get().showToast(`Request has been approved. Deposit is now due.`);
            } else {
                get().showToast(`Request has been ${status}.`);
            }
            get().fetchNotifications();
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to respond to request.';
            get().showToast(message, 'error');
        }
      },
      
      updateCompletionStatus: async (requestId, status) => {
        try {
            await updateClientBookingRequestStatus(requestId, status);
            set(state => ({
                data: {
                    ...state.data,
                    clientBookingRequests: state.data.clientBookingRequests.map(req => req.id === requestId ? { ...req, status } : req),
                }
            }));
            get().showToast(`Booking marked as ${status}.`);
        } catch (e) {
            get().showToast(`Failed to mark booking as ${status}.`, 'error');
        }
      },
      
      payBookingDeposit: async (requestId: string) => {
        try {
          const updatedRequest = await payClientBookingDeposit(requestId);
          set(state => ({
            data: {
              ...state.data,
              clientBookingRequests: state.data.clientBookingRequests.map(req => 
                req.id === requestId ? updatedRequest : req
              ),
            }
          }));
          get().closeModal();
          get().showToast('Deposit paid successfully!', 'success');
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Failed to process deposit payment.';
          get().showToast(message, 'error');
        }
      },

      updateUser: async (userId, data) => {
          if (get().user?.id !== userId) return;
          try {
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
                }
                return {};
            });
          } catch(error) {
              get().showToast("Failed to update profile.", 'error');
          }
      },
      
      updateArtist: async (artistId, data) => {
        try {
            const updatedArtist = await updateArtistData(artistId, data);
            set(state => ({
                data: { ...state.data, artists: state.data.artists.map(a => a.id === artistId ? {...a, ...updatedArtist} : a) },
                user: (state.user?.id === artistId && (state.user.type === 'artist' || state.user.type === 'dual')) 
                    ? { ...state.user, data: {...state.user.data, ...updatedArtist} } 
                    : state.user
            }));
        } catch (error) {
            get().showToast("Failed to update artist details.", 'error');
        }
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

      deletePortfolioImage: async (imageUrl: string) => {
        const user = get().user;
        if (!user || (user.type !== 'artist' && user.type !== 'dual')) {
            get().showToast('Only the artist can delete their portfolio images.', 'error');
            return;
        }

        if (!window.confirm("Are you sure you want to permanently delete this image?")) {
            return;
        }

        try {
            const currentPortfolio = user.data.portfolio;
            const newPortfolio = currentPortfolio.filter(img => img.url !== imageUrl);

            await get().updateArtist(user.id, { portfolio: newPortfolio });
            await deletePortfolioImageFromStorage(imageUrl);

            get().showToast('Image deleted successfully.', 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete image.";
            get().showToast(message, 'error');
        }
      },

      updateShop: async (shopId, data) => {
        try {
          const updatedShop = await updateShopData(shopId, data);
          set(state => ({
              data: { ...state.data, shops: state.data.shops.map(s => s.id === shopId ? updatedShop : s) }
          }));
          get().showToast('Shop details updated.');
        } catch(e) {
            get().showToast("Failed to update shop.", 'error');
        }
      },
      addBooth: async (shopId, boothData) => {
        try {
          const newBooth = await addBoothToShop(shopId, boothData);
          set(state => ({
              data: { ...state.data, booths: [...state.data.booths, newBooth] }
          }));
        } catch (e) {
            get().showToast("Failed to add booth.", 'error');
        }
      },
      updateBooth: async (boothId, data) => {
        try {
          const updatedBooth = await updateBoothData(boothId, data);
          set(state => ({
              data: { ...state.data, booths: state.data.booths.map(b => b.id === boothId ? updatedBooth : b) }
          }));
          get().closeModal();
        } catch (e) {
            get().showToast("Failed to update booth.", 'error');
        }
      },
      deleteBooth: async (boothId) => {
        try {
          await deleteBoothFromShop(boothId);
          set(state => ({
              data: { ...state.data, booths: state.data.booths.filter(b => b.id !== boothId) }
          }));
        } catch (e) {
            get().showToast("Failed to delete booth.", 'error');
        }
      },
      setArtistAvailability: async (date, status) => {
        const user = get().user;
        if (!user || (user.type !== 'artist' && user.type !== 'dual')) return;
        try {
            const newAvailability = await setArtistAvailability(user.id, date, status);
            set(state => {
                const existing = state.data.artistAvailability.find(a => a.date === date && a.artistId === user.id);
                if (existing) {
                    return { data: { ...state.data, artistAvailability: state.data.artistAvailability.map(a => a.id === existing.id ? newAvailability : a)}};
                } else {
                    return { data: { ...state.data, artistAvailability: [...state.data.artistAvailability, newAvailability]}};
                }
            });
        } catch (e) {
            get().showToast("Failed to update availability.", 'error');
        }
      },
      submitReview: async (requestId, rating, text) => {
        try {
            const updatedRequest = await submitReview(requestId, rating, text);
            set(state => ({
                data: {
                    ...state.data,
                    clientBookingRequests: state.data.clientBookingRequests.map(req => req.id === requestId ? updatedRequest : req),
                }
            }));
            get().closeModal();
            get().showToast("Thank you for your review!");
            // Fix: Retrieve the navigate function from the store state to re-initialize data.
            const navigate = get().navigate;
            if (navigate) {
                get().initialize(navigate); // Re-initialize to update artist ratings
            } else {
                console.error("submitReview could not re-initialize: navigate function not found in state.");
            }
        } catch (e) {
            get().showToast("Failed to submit review.", 'error');
        }
      },
      deleteUser: async (userId) => {
        try {
            await deleteUserAsAdmin(userId);
            set(state => ({
                allUsers: state.allUsers.filter(u => u.id !== userId),
                data: { ...state.data, artists: state.data.artists.filter(a => a.id !== userId) }
            }));
            get().showToast("User deleted.");
        } catch (e) {
            get().showToast("Failed to delete user.", 'error');
        }
      },
      deleteShop: async (shopId) => {
        try {
            await deleteShopAsAdmin(shopId);
            set(state => ({
                data: { ...state.data, shops: state.data.shops.filter(s => s.id !== shopId) }
            }));
            get().showToast("Shop deleted.");
        } catch (e) {
            get().showToast("Failed to delete shop.", 'error');
        }
      },
      adminUpdateUser: async (userId, data) => {
        try {
            await adminUpdateUserProfile(userId, data);
            const users = await fetchAllUsers(); // Re-fetch all users to get consistent data
            set({ allUsers: users });
            get().closeModal();
            get().showToast('User updated successfully.');
        } catch (e) {
            get().showToast("Failed to update user.", 'error');
        }
      },
      adminUpdateShop: async (shopId, data) => {
        try {
            const updatedShop = await adminUpdateShopDetails(shopId, data);
            set(state => ({
                data: { ...state.data, shops: state.data.shops.map(s => s.id === shopId ? updatedShop : s) }
            }));
            get().closeModal();
            get().showToast('Shop updated successfully.');
        } catch(e) {
            get().showToast("Failed to update shop.", 'error');
        }
      },

      // --- MESSAGING ACTIONS ---
      loadConversations: async () => {
        const user = get().user;
        if (!user) return;
        try {
            const conversations = await fetchUserConversations(user.id);
            set(state => ({ data: { ...state.data, conversations }}));
        } catch(e) {
            console.error("Failed to load conversations:", e);
        }
      },
      selectConversation: async (conversationId) => {
        set({ activeConversationId: conversationId });
        if(conversationId) {
            set({ isLoading: true });
            try {
                const messages = await fetchMessagesForConversation(conversationId);
                set(state => ({ data: { ...state.data, messages }, isLoading: false }));
            } catch (e) {
                set({ isLoading: false });
                get().showToast("Could not load messages.", 'error');
            }
        }
      },
      sendMessage: async (content, attachmentFile) => {
        const { activeConversationId, user } = get();
        if (!activeConversationId || !user || (!content.trim() && !attachmentFile)) return;

        try {
            let attachmentUrl: string | undefined = undefined;
            if (attachmentFile) {
                attachmentUrl = await uploadMessageAttachment(attachmentFile, activeConversationId);
            }

            const newMessage = await sendMessage(activeConversationId, user.id, content.trim(), attachmentUrl);
            set(state => ({
              data: { ...state.data, messages: [...state.data.messages, newMessage] }
            }));
        } catch (e) {
            get().showToast("Failed to send message.", 'error');
        }
      },
      startConversation: async (otherUserId) => {
        const user = get().user;
        if (!user) {
            get().showToast('You must be logged in to send a message.', 'error');
            get().openModal('auth');
            return null;
        }
        try {
            set({ isLoading: true });
            const conversation = await findOrCreateConversation(user.id, otherUserId);
            await get().loadConversations();
            get().closeModal();
            set({ isLoading: false });
            return conversation;
        } catch (error) {
            get().showToast((error as Error).message, 'error');
            set({ isLoading: false });
            return null;
        }
      },

      // --- NEW ROADMAP ACTIONS ---
      createShop: async (shopData) => {
        const user = get().user;
        if (!user || user.type !== 'shop-owner') return;
        try {
            const newShop = await apiCreateShop(shopData, user.id);
            set(state => {
                if (state.user?.type === 'shop-owner') {
                    const updatedUser: ShopOwnerUser = { ...state.user, data: { ...state.user.data, shopId: newShop.id }};
                    return { data: { ...state.data, shops: [...state.data.shops, newShop] }, user: updatedUser };
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
            const id = item.id;
            await createVerificationRequest(type, id, user.id);
            get().closeModal();
            get().showToast('Verification request submitted.');
        } catch (e) {
            get().showToast('Failed to submit request.', 'error');
        }
      },
      respondToVerificationRequest: async (requestId, status) => {
        try {
            const updatedRequest = await updateVerificationRequest(requestId, status);
            set(state => {
                const newVerificationRequests = state.data.verificationRequests.map(req => req.id === requestId ? { ...req, status } : req);
                let newArtists = state.data.artists;
                let newShops = state.data.shops;
                let newAllUsers = state.allUsers;

                if (status === 'approved') {
                    if (updatedRequest.type === 'artist' && updatedRequest.profileId) {
                        newArtists = state.data.artists.map(artist => artist.id === updatedRequest.profileId ? { ...artist, isVerified: true } : artist);
                        newAllUsers = state.allUsers.map(user => {
                            if (user.id === updatedRequest.profileId && (user.type === 'artist' || user.type === 'dual')) {
                                return { ...user, data: { ...user.data, isVerified: true } };
                            }
                            return user;
                        });
                    } else if (updatedRequest.type === 'shop' && updatedRequest.shopId) {
                        newShops = state.data.shops.map(shop => shop.id === updatedRequest.shopId ? { ...shop, isVerified: true } : shop);
                    }
                }
                return { data: { ...state.data, verificationRequests: newVerificationRequests, artists: newArtists, shops: newShops }, allUsers: newAllUsers };
            });
            get().showToast(`Request ${status}.`);
        } catch (e) {
            get().showToast('Failed to process request.', 'error');
        }
      },
      submitShopReview: async (shopId, review) => {
        try {
            const updatedShop = await addReviewToShop(shopId, review);
            set(state => ({ data: { ...state.data, shops: state.data.shops.map(s => s.id === shopId ? updatedShop : s) }}));
            get().closeModal();
            get().showToast('Thank you for reviewing the shop!');
        } catch (e) {
            get().showToast('Failed to submit review.', 'error');
        }
      },
    }),
    {
      name: 'inkspace-app-storage', 
      partialize: (state) => ({ viewMode: state.viewMode, theme: state.theme }),
    }
  )
);