// @/services/apiService.ts

import { seedData } from '../data/seed';
import type { MockData, Artist, Shop, Booth, Booking, ClientBookingRequest, Notification } from '../types';

// Simulate a database
let db: MockData = JSON.parse(JSON.stringify(seedData));

const simulateDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Fetches all initial data for the app.
 */
export const fetchInitialData = async (): Promise<MockData> => {
    await simulateDelay(500);
    return JSON.parse(JSON.stringify(db));
};

/**
 * Updates an artist's data.
 */
export const updateArtistData = async (artistId: string, updatedData: Partial<Artist>): Promise<Artist> => {
    await simulateDelay(300);
    const artistIndex = db.artists.findIndex(a => a.id === artistId);
    if (artistIndex === -1) throw new Error("Artist not found.");
    
    db.artists[artistIndex] = { ...db.artists[artistIndex], ...updatedData };
    return { ...db.artists[artistIndex] };
};

/**
 * Updates a shop's data.
 */
export const updateShopData = async (shopId: string, updatedData: Partial<Shop>): Promise<Shop> => {
    await simulateDelay(300);
    const shopIndex = db.shops.findIndex(s => s.id === shopId);
    if (shopIndex === -1) throw new Error("Shop not found.");

    db.shops[shopIndex] = { ...db.shops[shopIndex], ...updatedData };
    return { ...db.shops[shopIndex] };
};

/**
 * Adds a new booth to a shop.
 */
export const addBoothToShop = async (shopId: string, boothData: Omit<Booth, 'id' | 'shopId'>): Promise<Booth> => {
    await simulateDelay(300);
    const newBooth: Booth = {
        id: `booth-${Date.now()}`,
        shopId,
        ...boothData
    };
    db.booths.push(newBooth);
    return { ...newBooth };
};

/**
 * Updates a booth's data.
 */
export const updateBoothData = async (boothId: string, updatedData: Partial<Booth>): Promise<Booth> => {
    await simulateDelay(300);
    const boothIndex = db.booths.findIndex(b => b.id === boothId);
    if (boothIndex === -1) throw new Error("Booth not found.");

    db.booths[boothIndex] = { ...db.booths[boothIndex], ...updatedData };
    return { ...db.booths[boothIndex] };
};

/**
 * Deletes a booth.
 */
export const deleteBoothFromShop = async (boothId: string): Promise<{ success: true }> => {
    await simulateDelay(300);
    const initialLength = db.booths.length;
    db.booths = db.booths.filter(b => b.id !== boothId);
    if (db.booths.length === initialLength) throw new Error("Booth not found.");
    return { success: true };
};

/**
 * Creates a new booking.
 */
export const createBookingForArtist = async (bookingData: Omit<Booking, 'id'>): Promise<Booking> => {
    await simulateDelay(300);
    const newBooking: Booking = {
        id: `booking-${Date.now()}`,
        ...bookingData
    };
    db.bookings.push(newBooking);
    return { ...newBooking };
};

/**
 * Creates a new client booking request.
 */
export const createClientBookingRequest = async (requestData: Omit<ClientBookingRequest, 'id' | 'status'>): Promise<ClientBookingRequest> => {
    await simulateDelay(300);
    const newRequest: ClientBookingRequest = {
        id: `request-${Date.now()}`,
        status: 'pending',
        ...requestData,
    };
    db.clientBookingRequests.push(newRequest);
    return { ...newRequest };
};

/**
 * Fetches notifications for a specific user.
 */
export const fetchNotificationsForUser = async (userId: string): Promise<Notification[]> => {
    await simulateDelay(200);
    return db.notifications.filter(n => n.userId === userId);
};

/**
 * Marks all notifications for a user as read.
 */
export const markUserNotificationsAsRead = async (userId: string): Promise<{ success: true }> => {
    await simulateDelay(200);
    db.notifications.forEach(n => {
        if (n.userId === userId) {
            n.read = true;
        }
    });
    return { success: true };
};

/**
 * Creates a new notification for a user.
 */
export const createNotification = async (userId: string, message: string): Promise<Notification> => {
    await simulateDelay(50);
    const newNotification: Notification = {
        id: `notif-${Date.now()}`,
        userId,
        message,
        read: false,
        createdAt: new Date().toISOString(),
    };
    db.notifications.push(newNotification);
    return newNotification;
};
