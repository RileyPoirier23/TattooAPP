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
  allUsers: User[];
  userLocation: { lat: number; lng: number } | null;
  locationError: string | null;
  isGettingLocation: boolean;
  notifications: Notification[];

  // Auth Actions
  login: (credentials: AuthCredentials) => Promise<User>;
  register: (details: RegisterDetails) => Promise<User>;
  logout: () => Promise<void>;
  
  // Data Mutation Actions
  updateUser: (userId: string, updatedData: Partial<User['data']>) => void;
  updateArtist: (artistId: string, updatedData: Partial<Artist>) => void;
  uploadPortfolioImage: (artistId: string, file: File) => Promise<void>;
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
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotificationsForUser = useCallback(async (userId: string) => {
    try {
        const userNotifications = await apiService.fetchNotificationsForUser(userId);
        setNotifications(userNotifications);
    } catch(e) {
        console.error("Could not fetch notifications");
    }
  }, []);

  const initializeApp = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
          setUser(currentUser);
          if (currentUser.type === 'admin') {
              const allUserData = await apiService.fetchAllUsers();
              setAllUsers(allUserData);
          } else {
              await fetchNotificationsForUser(currentUser.id);
          }
      }
      const initialData = await apiService.fetchInitialData();
      setData(initialData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data. Please follow the README to connect a backend.');
    } finally {
      setLoading(false);
    }
  }, [fetchNotificationsForUser]);


  useEffect(() => {
    initializeApp();
  }, [initializeApp]);
  
  const login = useCallback(async (credentials: AuthCredentials) => {
    const loggedInUser = await authService.login(credentials);
    setUser(loggedInUser);
    if (loggedInUser.type !== 'admin') {
      fetchNotificationsForUser(loggedInUser.id);
    }
    initializeApp(); 
    return loggedInUser;
  }, [fetchNotificationsForUser, initializeApp]);

  const register = useCallback(async (details: RegisterDetails) => {
    const newUser = await authService.register(details);
    setUser(newUser);
    fetchNotificationsForUser(newUser.id);
    initializeApp(); 
    return newUser;
  }, [fetchNotificationsForUser, initializeApp]);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setNotifications([]);
    setAllUsers([]);
    initializeApp(); 
  }, [initializeApp]);

  const updateUser = async (userId: string, updatedData: Partial<User['data']>) => {
    try {
        await apiService.updateUserData(userId, updatedData);
        const currentUser = await authService.getCurrentUser();
        if (currentUser) setUser(currentUser);
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update profile.');
    }
  };


  const updateArtist = async (artistId: string, updatedData: Partial<Artist>) => {
    try {
        const updatedArtist = await apiService.updateArtistData(artistId, updatedData);
        setData(prevData => {
            if (!prevData) return null;
            return { ...prevData, artists: prevData.artists.map(a => a.id === artistId ? updatedArtist : a) };
        });
        if (user && user.id === artistId && (user.type === 'artist' || user.type === 'dual')) {
            const updatedUser = { ...user, data: { ...user.data, ...updatedArtist } };
            setUser(updatedUser);
        }
    } catch(e) {
        setError(e instanceof Error ? e.message : 'Failed to update artist.');
    }
  };
  
  const uploadPortfolioImage = async (artistId: string, file: File) => {
    const newImageUrl = await apiService.uploadPortfolioImage(artistId, file);
    if (user && user.id === artistId && (user.type === 'artist' || user.type === 'dual')) {
        const updatedPortfolio = [...user.data.portfolio, newImageUrl];
        const updatedUser = { ...user, data: { ...user.data, portfolio: updatedPortfolio } };
        setUser(updatedUser);
        setData(prevData => {
            if (!prevData) return null;
            return {
                ...prevData,
                artists: prevData.artists.map(a => a.id === artistId ? { ...a, portfolio: updatedPortfolio } : a)
            };
        });
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
    setIsGettingLocation(true);
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setIsGettingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsGettingLocation(false);
      },
      () => {
        setLocationError("Unable to retrieve your location. Please enable location services.");
        setIsGettingLocation(false);
      }
    );
  };

  return { 
      data, loading, error, user, allUsers,
      login, register, logout, 
      updateUser, updateArtist, uploadPortfolioImage,
      updateShop, addBooth, updateBooth, deleteBooth, createBooking, createClientBookingRequest,
      userLocation, locationError, getLocation, isGettingLocation,
      notifications, markNotificationsAsRead
  };
};