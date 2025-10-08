// @/hooks/useAppStore.ts

import { useState, useEffect, useCallback } from 'react';
import { seedData } from '../data/seed';
import { authService } from '../services/authService';
import type { MockData, User, Artist, Shop, Booth, Booking, AuthCredentials, RegisterDetails } from '../types';

interface UseAppStoreReturn {
  // State
  data: MockData | null;
  loading: boolean;
  error: string | null;
  user: User | null;
  userLocation: { lat: number; lng: number } | null;
  locationError: string | null;

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
  
  // UI Actions
  getLocation: () => void;
}

export const useAppStore = (): UseAppStoreReturn => {
  const [data, setData] = useState<MockData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Initialize user from localStorage
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
        setUser(currentUser);
    }
    // Load static seed data
    setData(seedData);
    setLoading(false);
  }, []);
  
  const login = useCallback(async (credentials: AuthCredentials) => {
    const loggedInUser = await authService.login(credentials);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (details: RegisterDetails) => {
    const newUser = await authService.register(details);
    
    // If a new artist was created, add them to the main data state
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
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const updateArtist = (artistId: string, updatedData: Partial<Artist>) => {
    setData(prevData => {
      if (!prevData) return null;
      const newArtists = prevData.artists.map(artist =>
        artist.id === artistId ? { ...artist, ...updatedData } : artist
      );
      return { ...prevData, artists: newArtists };
    });

    setUser(prevUser => {
        if (prevUser && prevUser.type === 'artist' && prevUser.id === artistId) {
            const updatedUserData = { ...prevUser.data, ...updatedData } as Artist;
            const updatedUser = { ...prevUser, data: updatedUserData };
            // Also update localStorage
            localStorage.setItem('inkspace_user', JSON.stringify(updatedUser));
            return updatedUser;
        }
        return prevUser;
    });
  };

  const updateShop = (shopId: string, updatedData: Partial<Shop>) => {
    setData(prevData => {
        if (!prevData) return null;
        return {
            ...prevData,
            shops: prevData.shops.map(s => s.id === shopId ? {...s, ...updatedData} : s)
        };
    });
  };

  const addBooth = (shopId: string, boothData: Omit<Booth, 'id' | 'shopId'>) => {
    setData(prevData => {
        if (!prevData) return null;
        const newBooth: Booth = {
            id: `booth-${Date.now()}`,
            shopId,
            ...boothData
        };
        return {...prevData, booths: [...prevData.booths, newBooth]};
    });
  };

  const updateBooth = (boothId: string, updatedData: Partial<Booth>) => {
    setData(prevData => {
        if (!prevData) return null;
        return {
            ...prevData,
            booths: prevData.booths.map(b => b.id === boothId ? {...b, ...updatedData} : b)
        };
    });
  };
  
  const deleteBooth = (boothId: string) => {
    setData(prevData => {
        if (!prevData) return null;
        return {
            ...prevData,
            booths: prevData.booths.filter(b => b.id !== boothId)
        };
    });
  };

  const createBooking = (bookingData: Omit<Booking, 'id'>) => {
      setData(prevData => {
          if (!prevData) return null;
          const newBooking: Booking = {
              id: `booking-${Date.now()}`,
              ...bookingData
          };
          return {...prevData, bookings: [...prevData.bookings, newBooking]};
      });
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
      updateArtist, updateShop, addBooth, updateBooth, deleteBooth, createBooking,
      userLocation, locationError, getLocation 
  };
};