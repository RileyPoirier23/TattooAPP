// @/hooks/useAppStore.ts

import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import * as apiService from '../services/apiService';
import type { MockData, User, Artist, Shop, Booth, Booking, AuthCredentials, RegisterDetails, ClientBookingRequest, Notification } from '../types';

interface UseAppStoreReturn {
  // State
  data: MockData | null;
  loading: boolean;
  error: string | null;
  user: User | null;
  userLocation: { lat: number; lng: number } | null;
  locationError: string | null;
  notifications: Notification[];

  // Auth Actions
  login: (credentials: AuthCredentials) => Promise<User>;
  register: (details: RegisterDetails) => Promise<User>;
  logout: () => Promise<void>;
  
  // Data Mutation Actions
  updateArtist: (artistId: string, updatedData: Partial<Artist>) => void;
  updateShop: (shopId: string, updatedData: Partial<Shop>) => void;
  addBooth: (shopId: string, boothData: Omit<Booth, 'id' | 'shopId'>) => void;
  updateBooth: (boothId: string, updatedData: Partial<Booth>) => void;
  deleteBooth: (boothId: string) => void;
  createBooking: (bookingData: Omit<Booking, 'id'>) => void;
  createClientBookingRequest: (requestData: Omit<ClientBookingRequest, 'id' | 'status'>) => void;
  
  // UI Actions
  getLocation: () => void;
  markNotificationsAsRead: () => void;
}

export const useAppStore = (): UseAppStoreReturn => {
  const [data, setData] = useState<MockData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotificationsForUser = useCallback(async (userId: string) => {
    try {
        const userNotifications = await apiService.fetchNotificationsForUser(userId);
        setNotifications(userNotifications);
    } catch(e) {
        console.error("Could not fetch notifications");
    }
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      setLoading(true);
      setError(null);
      try {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            fetchNotificationsForUser(currentUser.id);
        }
        const initialData = await apiService.fetchInitialData();
        setData(initialData);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    initializeApp();
  }, [fetchNotificationsForUser]);
  
  const login = useCallback(async (credentials: AuthCredentials) => {
    const loggedInUser = await authService.login(credentials);
    setUser(loggedInUser);
    fetchNotificationsForUser(loggedInUser.id);
    return loggedInUser;
  }, [fetchNotificationsForUser]);

  const register = useCallback(async (details: RegisterDetails) => {
    const newUser = await authService.register(details);
    
    if (newUser.type === 'artist') {
        setData(prevData => {
            if (!prevData) return null;
            return {
                ...prevData,
                artists: [...prevData.artists, newUser.data]
            }
        });
    }

    setUser(newUser);
    fetchNotificationsForUser(newUser.id);
    return newUser;
  }, [fetchNotificationsForUser]);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setNotifications([]);
  }, []);

  const updateArtist = async (artistId: string, updatedData: Partial<Artist>) => {
    try {
        const updatedArtist = await apiService.updateArtistData(artistId, updatedData);
        setData(prevData => {
            if (!prevData) return null;
            return { ...prevData, artists: prevData.artists.map(a => a.id === artistId ? updatedArtist : a) };
        });

        setUser(prevUser => {
            if (prevUser && prevUser.type === 'artist' && prevUser.id === artistId) {
                const updatedUser = { ...prevUser, data: updatedArtist };
                localStorage.setItem('inkspace_user', JSON.stringify(updatedUser));
                return updatedUser;
            }
            return prevUser;
        });
    } catch(e) {
        setError(e instanceof Error ? e.message : 'Failed to update artist.');
    }
  };

  const updateShop = async (shopId: string, updatedData: Partial<Shop>) => {
    try {
        const updatedShop = await apiService.updateShopData(shopId, updatedData);
        setData(prevData => {
            if (!prevData) return null;
            return { ...prevData, shops: prevData.shops.map(s => s.id === shopId ? updatedShop : s) };
        });
    } catch(e) {
        setError(e instanceof Error ? e.message : 'Failed to update shop.');
    }
  };

  const addBooth = async (shopId: string, boothData: Omit<Booth, 'id' | 'shopId'>) => {
    try {
        const newBooth = await apiService.addBoothToShop(shopId, boothData);
        setData(prevData => {
            if (!prevData) return null;
            return {...prevData, booths: [...prevData.booths, newBooth]};
        });
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add booth.');
    }
  };

  const updateBooth = async (boothId: string, updatedData: Partial<Booth>) => {
     try {
        const updatedBooth = await apiService.updateBoothData(boothId, updatedData);
        setData(prevData => {
            if (!prevData) return null;
            return { ...prevData, booths: prevData.booths.map(b => b.id === boothId ? updatedBooth : b) };
        });
     } catch (e) {
         setError(e instanceof Error ? e.message : 'Failed to update booth.');
     }
  };
  
  const deleteBooth = async (boothId: string) => {
    try {
        await apiService.deleteBoothFromShop(boothId);
        setData(prevData => {
            if (!prevData) return null;
            return { ...prevData, booths: prevData.booths.filter(b => b.id !== boothId) };
        });
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete booth.');
    }
  };

  const createBooking = async (bookingData: Omit<Booking, 'id'>) => {
      try {
          const newBooking = await apiService.createBookingForArtist(bookingData);
          setData(prevData => {
              if (!prevData) return null;
              return {...prevData, bookings: [...prevData.bookings, newBooking]};
          });
          // Add notification for the shop owner
          const shop = data?.shops.find(s => s.id === newBooking.shopId);
          const artist = data?.artists.find(a => a.id === newBooking.artistId);
          if (shop && artist) {
              const shopOwnerId = authService.getShopOwnerId(shop.id);
              if (shopOwnerId) {
                  const notif = await apiService.createNotification(shopOwnerId, `${artist.name} has booked a booth at your shop.`);
                  if (user?.id === shopOwnerId) setNotifications(prev => [...prev, notif]);
              }
          }

      } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to create booking.');
      }
  };
  
  const createClientBookingRequest = async (requestData: Omit<ClientBookingRequest, 'id' | 'status'>) => {
    try {
        const newRequest = await apiService.createClientBookingRequest(requestData);
        setData(prevData => {
            if (!prevData) return null;
            return {...prevData, clientBookingRequests: [...prevData.clientBookingRequests, newRequest]};
        });
        // Add notification for the artist
        const artist = data?.artists.find(a => a.id === newRequest.artistId);
        const client = authService.getUserById(newRequest.clientId);
        if (artist && client) {
            const notif = await apiService.createNotification(artist.id, `You have a new booking request from ${client.data.name}.`);
            if (user?.id === artist.id) setNotifications(prev => [...prev, notif]);
        }
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send booking request.');
    }
  };

  const markNotificationsAsRead = async () => {
    if (!user) return;
    try {
        await apiService.markUserNotificationsAsRead(user.id);
        setNotifications(prev => prev.map(n => ({...n, read: true})));
    } catch (e) {
        console.error("Failed to mark notifications as read.");
    }
  };

  const getLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setLocationError("Unable to retrieve your location.");
      }
    );
  };

  return { 
      data, loading, error, user, 
      login, register, logout, 
      updateArtist, updateShop, addBooth, updateBooth, deleteBooth, createBooking, createClientBookingRequest,
      userLocation, locationError, getLocation,
      notifications, markNotificationsAsRead
  };
};
