// @/services/apiService.ts
import { supabase } from './supabaseClient';
import type { Artist, Shop, Booth, Booking, ClientBookingRequest, Notification, User, UserRole, Client, ShopOwner } from '../types';

const adaptProfileToUser = (profile: any): User | null => {
    if (!profile) return null;
    const baseUser = {
        id: profile.id,
        email: profile.username, // DB username is email
        type: profile.role as UserRole,
    };
    
    switch (profile.role) {
        case 'artist':
        case 'dual':
            return { ...baseUser, type: profile.role, data: { id: profile.id, name: profile.full_name, city: profile.city, specialty: profile.specialty, bio: profile.bio, portfolio: profile.portfolio || [], isVerified: profile.is_verified } as Artist };
        case 'client':
            return { ...baseUser, type: 'client', data: { id: profile.id, name: profile.full_name } as Client };
        case 'shop-owner':
             // This assumes shopId is managed elsewhere, e.g., on the shops table
            return { ...baseUser, type: 'shop-owner', data: { id: profile.id, name: profile.full_name, shopId: null } as ShopOwner };
        default:
            return null;
    }
}

export const fetchAllUsers = async(): Promise<User[]> => {
    const { data: profiles, error } = await supabase.from('profiles').select('*');
    if (error) {
        console.error("Failed to fetch all users:", error);
        throw error;
    }
    return profiles.map(adaptProfileToUser).filter(Boolean) as User[];
};


export const fetchInitialData = async (): Promise<any> => {
    const { data: profiles, error: artistsError } = await supabase.from('profiles').select('*').in('role', ['artist', 'dual']);
    const { data: shops, error: shopsError } = await supabase.from('shops').select('*');
    const { data: booths, error: boothsError } = await supabase.from('booths').select('*');
    const { data: bookings, error: bookingsError } = await supabase.from('bookings').select('*');
    const { data: clientBookings, error: clientBookingsError } = await supabase.from('client_booking_requests').select('*');

    if (artistsError || shopsError || boothsError || bookingsError || clientBookingsError) {
        console.error({ artistsError, shopsError, boothsError, bookingsError, clientBookingsError });
        throw new Error('Failed to fetch initial data from Supabase.');
    }
    
    const adaptedArtists: Artist[] = profiles.map(profile => ({
        id: profile.id,
        name: profile.full_name,
        specialty: profile.specialty,
        portfolio: profile.portfolio || [],
        city: profile.city,
        bio: profile.bio,
        isVerified: profile.is_verified,
    }));

    const adaptedShops: Shop[] = shops.map(shop => ({ ...shop, isVerified: shop.is_verified }));
    
    const adaptedBookings: Booking[] = bookings.map(b => ({
      id: b.id,
      artistId: b.artist_id,
      boothId: b.booth_id,
      shopId: b.shop_id,
      city: shops.find(s => s.id === b.shop_id)?.location || '',
      startDate: b.start_date,
      endDate: b.end_date,
      paymentStatus: b.payment_status,
    }));

     const adaptedClientBookings: ClientBookingRequest[] = clientBookings.map(b => ({
      id: b.id,
      clientId: b.client_id,
      artistId: b.artist_id,
      startDate: b.start_date,
      endDate: b.end_date,
      message: b.message,
      status: b.status,
      tattooSize: b.tattoo_size,
      bodyPlacement: b.body_placement,
      estimatedHours: b.estimated_hours,
      paymentStatus: b.payment_status,
    }));

    return { 
        artists: adaptedArtists, 
        shops: adaptedShops, 
        booths, 
        bookings: adaptedBookings,
        clientBookingRequests: adaptedClientBookings,
        notifications: []
    };
};

export const updateUserData = async (userId: string, updatedData: Partial<User['data']>) => {
    const profileUpdate: { [key: string]: any } = {};
    if ('name' in updatedData) profileUpdate.full_name = updatedData.name;
    if ('city' in updatedData) profileUpdate.city = updatedData.city;

    const { error } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);

    if (error) throw error;
    return { success: true };
}

export const updateArtistData = async (artistId: string, updatedData: Partial<Artist>): Promise<Artist> => {
    const profileUpdate: { [key: string]: any } = {};
    if (updatedData.name) profileUpdate.full_name = updatedData.name;
    if (updatedData.specialty) profileUpdate.specialty = updatedData.specialty;
    if (updatedData.bio) profileUpdate.bio = updatedData.bio;
    if (updatedData.city) profileUpdate.city = updatedData.city;
    if (updatedData.portfolio) profileUpdate.portfolio = updatedData.portfolio;

    const { data, error } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', artistId)
        .select()
        .single();

    if (error) throw error;
    
    return {
        id: data.id,
        name: data.full_name,
        specialty: data.specialty,
        portfolio: data.portfolio || [],
        city: data.city,
        bio: data.bio,
        isVerified: data.is_verified,
    };
};

export const uploadPortfolioImage = async (userId: string, file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('portfolios')
        .upload(fileName, file);
    
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('portfolios').getPublicUrl(fileName);
    
    // Now, update the profile with the new URL
    const { data: profile, error: profileError } = await supabase.from('profiles').select('portfolio').eq('id', userId).single();
    if (profileError) throw profileError;
    
    const newPortfolio = [...(profile.portfolio || []), data.publicUrl];
    
    const { error: updateError } = await supabase.from('profiles').update({ portfolio: newPortfolio }).eq('id', userId);
    if (updateError) throw updateError;
    
    return data.publicUrl;
};

export const updateShopData = async (shopId: string, updatedData: Partial<Shop>): Promise<Shop> => {
    const { data, error } = await supabase
        .from('shops')
        .update(updatedData)
        .eq('id', shopId)
        .select()
        .single();
    if (error) throw error;
    return { ...data, isVerified: data.is_verified };
};

export const addBoothToShop = async (shopId: string, boothData: Omit<Booth, 'id' | 'shopId'>): Promise<Booth> => {
    const { data, error } = await supabase
        .from('booths')
        .insert({ ...boothData, shop_id: shopId })
        .select()
        .single();
    if (error) throw error;
    return { ...data, shopId: data.shop_id, dailyRate: data.daily_rate };
};

export const deleteBoothFromShop = async (boothId: string): Promise<{ success: true }> => {
    const { error } = await supabase.from('booths').delete().eq('id', boothId);
    if (error) throw error;
    return { success: true };
};

export const createBookingForArtist = async (bookingData: Omit<Booking, 'id'| 'city'>): Promise<Booking> => {
    const { data, error } = await supabase
        .from('bookings')
        .insert({
            artist_id: bookingData.artistId,
            booth_id: bookingData.boothId,
            shop_id: bookingData.shopId,
            start_date: bookingData.startDate,
            end_date: bookingData.endDate,
            payment_status: bookingData.paymentStatus
        })
        .select()
        .single();
        
    if (error) throw error;

    return {
        id: data.id,
        artistId: data.artist_id,
        boothId: data.booth_id,
        shopId: data.shop_id,
        startDate: data.start_date,
        endDate: data.end_date,
        paymentStatus: data.payment_status,
        city: '',
    };
};

export const createClientBookingRequest = async (requestData: Omit<ClientBookingRequest, 'id' | 'status'|'paymentStatus'>): Promise<ClientBookingRequest> => {
    const { data, error } = await supabase
        .from('client_booking_requests')
        .insert({
            client_id: requestData.clientId,
            artist_id: requestData.artistId,
            start_date: requestData.startDate,
            end_date: requestData.endDate,
            message: requestData.message,
            tattoo_size: requestData.tattooSize,
            body_placement: requestData.bodyPlacement,
            estimated_hours: requestData.estimatedHours,
        })
        .select()
        .single();

    if (error) throw error;
    return {
        id: data.id,
        clientId: data.client_id,
        artistId: data.artist_id,
        startDate: data.start_date,
        endDate: data.end_date,
        message: data.message,
        status: data.status,
        tattooSize: data.tattoo_size,
        bodyPlacement: data.body_placement,
        estimatedHours: data.estimated_hours,
        paymentStatus: data.payment_status,
    };
};


export const fetchNotificationsForUser = async (userId: string): Promise<Notification[]> => {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
    if (error) {
        console.error("Failed to fetch notifications:", error);
        return [];
    }
    return data.map(n => ({
        id: n.id,
        userId: n.user_id,
        message: n.message,
        read: n.read,
        createdAt: n.created_at,
    }));
};

export const markUserNotificationsAsRead = async (userId: string): Promise<{ success: true }> => {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
    
    if (error) throw error;
    return { success: true };
};

export const createNotification = async (userId: string, message: string): Promise<Notification> => {
    const { data, error } = await supabase
        .from('notifications')
        .insert({ user_id: userId, message: message })
        .select()
        .single();

    if (error) throw error;
    return {
        id: data.id,
        userId: data.user_id,
        message: data.message,
        read: data.read,
        createdAt: data.created_at,
    };
};


// --- The following are not in the placeholder but are useful ---

export const updateBoothData = async (boothId: string, updatedData: Partial<Booth>): Promise<Booth> => {
    const { data, error } = await supabase
        .from('booths')
        .update(updatedData)
        .eq('id', boothId)
        .select()
        .single();
    if (error) throw error;
    return { ...data, shopId: data.shop_id, dailyRate: data.daily_rate };
};


export const fetchUserBookings = async (userId: string, userType: 'artist' | 'client' | 'dual'): Promise<{ artistBookings: Booking[], clientBookings: ClientBookingRequest[] }> => {
    let artistBookings: Booking[] = [];
    let clientBookings: ClientBookingRequest[] = [];
    
    if (userType === 'artist' || userType === 'dual') {
        const { data, error } = await supabase.from('bookings').select('*').eq('artist_id', userId);
        if (error) throw error;
        artistBookings = data.map(b => ({...b, artistId: b.artist_id, boothId: b.booth_id, shopId: b.shop_id, startDate: b.start_date, endDate: b.end_date, paymentStatus: b.payment_status, city: ''}));
    }
    
    if (userType === 'client' || userType === 'dual') {
        const { data, error } = await supabase.from('client_booking_requests').select('*').eq('client_id', userId);
        if (error) throw error;
        clientBookings = data.map(b => ({...b, clientId: b.client_id, artistId: b.artist_id, startDate: b.start_date, endDate: b.end_date, tattooSize: b.tattoo_size, bodyPlacement: b.body_placement, estimatedHours: b.estimated_hours, paymentStatus: b.payment_status}));
    }

    return { artistBookings, clientBookings };
};