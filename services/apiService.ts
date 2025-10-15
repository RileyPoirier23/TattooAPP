
// @/services/apiService.ts
import { supabase } from './supabaseClient';
import type { Artist, Shop, Booth, Booking, ClientBookingRequest, Notification, User, UserRole, Client, ShopOwner, Conversation, Message, ConversationWithUser, ArtistAvailability, Review } from '../types';

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
            return { ...baseUser, type: profile.role, data: { id: profile.id, name: profile.full_name, city: profile.city, specialty: profile.specialty, bio: profile.bio, portfolio: profile.portfolio || [], isVerified: profile.is_verified, socials: profile.socials } as Artist };
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
    const { data: clientBookings, error: clientBookingsError } = await supabase
        .from('client_booking_requests')
        .select(`
            *,
            client:profiles!client_booking_requests_client_id_fkey(full_name),
            artist:profiles!client_booking_requests_artist_id_fkey(full_name)
        `);
    const { data: availability, error: availabilityError } = await supabase.from('artist_availability').select('*');

    if (artistsError || shopsError || boothsError || bookingsError || clientBookingsError || availabilityError) {
        console.error({ artistsError, shopsError, boothsError, bookingsError, clientBookingsError, availabilityError });
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
        socials: profile.socials || {},
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
      clientName: (b.client as any)?.full_name || 'Unknown Client',
      artistName: (b.artist as any)?.full_name || 'Unknown Artist',
      reviewRating: b.review_rating,
      reviewText: b.review_text,
      reviewSubmittedAt: b.review_submitted_at,
    }));

    const adaptedAvailability: ArtistAvailability[] = availability.map(a => ({
        id: a.id,
        artistId: a.artist_id,
        date: a.date,
        status: a.status,
    }));

    return { 
        artists: adaptedArtists, 
        shops: adaptedShops, 
        booths, 
        bookings: adaptedBookings,
        clientBookingRequests: adaptedClientBookings,
        artistAvailability: adaptedAvailability,
        notifications: [],
        conversations: [],
        messages: [],
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
    if (updatedData.socials) profileUpdate.socials = updatedData.socials;

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
        socials: data.socials,
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
        .select(`
            *,
            client:profiles!client_booking_requests_client_id_fkey(full_name),
            artist:profiles!client_booking_requests_artist_id_fkey(full_name)
        `)
        .single();

    if (error) throw error;
    
    // Automatically create a conversation
    const conversation = await findOrCreateConversation(requestData.clientId, requestData.artistId);
    await sendMessage(conversation.id, requestData.clientId, requestData.message);


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
        clientName: (data.client as any)?.full_name,
        artistName: (data.artist as any)?.full_name,
    };
};

export const updateClientBookingRequestStatus = async (requestId: string, status: ClientBookingRequest['status']): Promise<{ success: boolean }> => {
    const { data: request, error: fetchError } = await supabase
        .from('client_booking_requests')
        .select('client_id, artist_id')
        .eq('id', requestId)
        .single();

    if (fetchError) throw fetchError;

    const { error: updateError } = await supabase
        .from('client_booking_requests')
        .update({ status: status })
        .eq('id', requestId);

    if (updateError) throw updateError;
    
    const { data: artistProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', request.artist_id)
        .single();

    if (profileError) throw profileError;
    
    await createNotification(
        request.client_id,
        `Your booking request with ${artistProfile.full_name} has been ${status}.`
    );

    return { success: true };
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

// --- MESSAGING ---

export const findOrCreateConversation = async (userId1: string, userId2: string): Promise<Conversation> => {
    // Check if a conversation already exists
    const { data: existing, error: existingError } = await supabase
        .from('conversations')
        .select('*')
        .or(`(participant_one_id.eq.${userId1},participant_two_id.eq.${userId2}),(participant_one_id.eq.${userId2},participant_two_id.eq.${userId1})`)
        .limit(1);

    if (existingError) throw existingError;
    if (existing && existing.length > 0) return { ...existing[0], participantOneId: existing[0].participant_one_id, participantTwoId: existing[0].participant_two_id };

    // Create a new one if not
    const { data: created, error: createError } = await supabase
        .from('conversations')
        .insert({ participant_one_id: userId1, participant_two_id: userId2 })
        .select()
        .single();
    
    if (createError) throw createError;
    return { ...created, participantOneId: created.participant_one_id, participantTwoId: created.participant_two_id };
};

export const fetchUserConversations = async (userId: string): Promise<ConversationWithUser[]> => {
    const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_one_id.eq.${userId},participant_two_id.eq.${userId}`);

    if (error) throw error;

    const participantIds = new Set<string>();
    conversations.forEach(c => {
        participantIds.add(c.participant_one_id);
        participantIds.add(c.participant_two_id);
    });

    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(participantIds));
    
    if (profileError) throw profileError;
    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    return conversations.map(c => {
        const otherUserId = c.participant_one_id === userId ? c.participant_two_id : c.participant_one_id;
        const otherUser = profilesMap.get(otherUserId);
        return {
            id: c.id,
            participantOneId: c.participant_one_id,
            participantTwoId: c.participant_two_id,
            otherUser: {
                id: otherUserId,
// FIX: Cast `otherUser` to `any` to resolve a TypeScript error where the untyped Supabase client returns a value inferred as `unknown` in strict mode, preventing property access.
                name: (otherUser as any)?.full_name || 'Unknown User'
            }
        };
    });
};

export const fetchMessagesForConversation = async (conversationId: string): Promise<Message[]> => {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data.map(m => ({
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        content: m.content,
        attachmentUrl: m.attachment_url,
        createdAt: m.created_at,
    }));
};

export const sendMessage = async (conversationId: string, senderId: string, content?: string, attachmentUrl?: string): Promise<Message> => {
    if (!content && !attachmentUrl) throw new Error("Message must have content or an attachment.");
    
    const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: senderId, content, attachment_url: attachmentUrl })
        .select()
        .single();
    
    if (error) throw error;
    return {
        id: data.id,
        conversationId: data.conversation_id,
        senderId: data.sender_id,
        content: data.content,
        attachmentUrl: data.attachment_url,
        createdAt: data.created_at,
    };
};

export const uploadMessageAttachment = async (file: File, conversationId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${conversationId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('message_attachments')
        .upload(fileName, file);
    
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('message_attachments').getPublicUrl(fileName);
    return data.publicUrl;
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

// --- ARTIST AVAILABILITY ---
export const setArtistAvailability = async (artistId: string, date: string, status: 'available' | 'unavailable'): Promise<ArtistAvailability> => {
    const { data, error } = await supabase
        .from('artist_availability')
        .upsert({ artist_id: artistId, date: date, status: status }, { onConflict: 'artist_id, date' })
        .select()
        .single();
    
    if (error) throw error;
    return { id: data.id, artistId: data.artist_id, date: data.date, status: data.status };
};

// --- REVIEWS ---
export const submitReview = async (requestId: string, rating: number, text: string): Promise<ClientBookingRequest> => {
    const { data, error } = await supabase
        .from('client_booking_requests')
        .update({ review_rating: rating, review_text: text, review_submitted_at: new Date().toISOString() })
        .eq('id', requestId)
        .select()
        .single();
    
    if (error) throw error;
    return data;
};

export const fetchArtistReviews = async (artistId: string): Promise<Review[]> => {
    const { data, error } = await supabase
        .from('client_booking_requests')
        .select('id, review_rating, review_text, review_submitted_at, client:profiles!client_booking_requests_client_id_fkey(id, full_name)')
        .eq('artist_id', artistId)
        .not('review_rating', 'is', null);

    if (error) throw error;

    return data.map(r => ({
        id: r.id,
        authorId: (r.client as any).id,
        authorName: (r.client as any).full_name,
        rating: r.review_rating,
        text: r.review_text,
        createdAt: r.review_submitted_at,
    }));
};

// --- ADMIN ACTIONS ---
export const deleteUserAsAdmin = async (userId: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    // Note: Deleting from auth.users requires service_role key, typically done in a backend function for security.
    // This will only delete the profile, not the auth user.
    return { success: true };
};

export const deleteShopAsAdmin = async (shopId: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('shops').delete().eq('id', shopId);
    if (error) throw error;
    return { success: true };
};
