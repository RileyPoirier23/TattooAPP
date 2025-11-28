
// @/services/apiService.ts
import { getSupabase } from './supabaseClient';
import type { Artist, Shop, Booth, Booking, ClientBookingRequest, Notification, User, UserRole, PortfolioImage, VerificationRequest, Conversation, ConversationWithUser, Message, ArtistAvailability, Review, AdminUser, ArtistService, ArtistHours } from '../types';
import { 
    adaptProfileToArtist, adaptShop, adaptBooth, adaptBooking, adaptClientBookingRequest, adaptAvailability, 
    adaptVerificationRequest, adaptReviewFromBooking, adaptNotification, adaptConversation, adaptMessage, adaptSupabaseProfileToUser 
} from './dataAdapters';


export const fetchAllUsers = async(): Promise<User[]> => {
    const supabase = getSupabase();
    const { data: profiles, error } = await supabase.from('profiles').select('*');
    if (error) {
        console.error("Failed to fetch all users:", error);
        throw error;
    }
    return profiles.map(p => adaptSupabaseProfileToUser(p)).filter((u): u is User => u !== null);
};


export const fetchInitialData = async (): Promise<any> => {
    const supabase = getSupabase();
    const { data: profiles, error: artistsError } = await supabase.from('profiles').select('*').in('role', ['artist', 'dual']);
    const { data: rawShops, error: shopsError } = await supabase.from('shops').select('*');
    const { data: rawBooths, error: boothsError } = await supabase.from('booths').select('*');
    const { data: rawBookings, error: bookingsError } = await supabase.from('bookings').select('*');
    
    // CRITICAL: explicit Foreign Key hints to match the SQL script
    const { data: rawClientBookings, error: clientBookingsError } = await supabase
        .from('client_booking_requests')
        .select(`
            *,
            client:profiles!client_booking_requests_client_id_fkey(id, full_name),
            artist:profiles!client_booking_requests_artist_id_fkey(id, full_name, services)
        `);
        
    const { data: rawAvailability, error: availabilityError } = await supabase.from('artist_availability').select('*');
    const { data: rawVerificationRequests, error: verificationRequestsError } = await supabase.from('verification_requests').select(`*, profile:profiles(full_name), shop:shops(name)`);


    if (artistsError || shopsError || boothsError || bookingsError || clientBookingsError || availabilityError || verificationRequestsError) {
        const firstError = artistsError || shopsError || boothsError || bookingsError || clientBookingsError || availabilityError || verificationRequestsError;
        console.error("Supabase fetchInitialData failed.", firstError);
        let errorMessage = 'Failed to fetch initial data.';
        if (firstError?.message) errorMessage += ` DB Error: ${firstError.message}`;
        throw new Error(errorMessage);
    }
    
    const artists: Artist[] = profiles.map(adaptProfileToArtist);
    const shops: Shop[] = rawShops.map(adaptShop);
    const booths: Booth[] = rawBooths.map(adaptBooth);
    const bookings: Booking[] = rawBookings.map(b => adaptBooking(b, shops));
    const clientBookingRequests: ClientBookingRequest[] = rawClientBookings.map(adaptClientBookingRequest);
    const artistAvailability = rawAvailability.map(adaptAvailability);
    const verificationRequests = rawVerificationRequests.map(adaptVerificationRequest);

    return { 
        artists, 
        shops, 
        booths, 
        bookings,
        clientBookingRequests,
        artistAvailability,
        verificationRequests,
        notifications: [],
        conversations: [],
        messages: [],
    };
};

export const updateUserData = async (userId: string, updatedData: Partial<User['data']>) => {
    const supabase = getSupabase();
    const profileUpdate: { [key: string]: any } = {};
    if ('name' in updatedData) profileUpdate.full_name = updatedData.name;
    if ('city' in updatedData) profileUpdate.city = updatedData.city;

    const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', userId);
    if (error) throw error;
    return { success: true };
}

export const updateArtistData = async (artistId: string, updatedData: Partial<Artist>): Promise<Artist> => {
    const supabase = getSupabase();
    const profileUpdate: { [key: string]: any } = {};
    if (updatedData.name) profileUpdate.full_name = updatedData.name;
    if (updatedData.specialty) profileUpdate.specialty = updatedData.specialty;
    if (updatedData.bio) profileUpdate.bio = updatedData.bio;
    if (updatedData.city) profileUpdate.city = updatedData.city;
    if (updatedData.portfolio) profileUpdate.portfolio = updatedData.portfolio;
    if (updatedData.socials) profileUpdate.socials = updatedData.socials;
    if (updatedData.hourlyRate) profileUpdate.hourly_rate = updatedData.hourlyRate;
    if (updatedData.services) profileUpdate.services = updatedData.services;
    if (updatedData.aftercareMessage) profileUpdate.aftercare_message = updatedData.aftercareMessage;
    if (typeof updatedData.requestHealedPhoto === 'boolean') profileUpdate.request_healed_photo = updatedData.requestHealedPhoto;
    
    // Explicitly handle hours to ensure they are saved as JSON
    if (updatedData.hours) profileUpdate.hours = updatedData.hours;
    
    if (updatedData.intakeSettings) profileUpdate.intake_settings = updatedData.intakeSettings;

    const { data, error } = await supabase.from('profiles').update(profileUpdate).eq('id', artistId).select().single();
    if (error) {
        console.error("Update Artist Error:", error);
        throw error;
    }
    return adaptProfileToArtist(data);
};

// V9: DIRECT UPSERT - MOST RELIABLE METHOD
// We abandon RPCs for this and simply write directly to the table.
// The SQL policies now allow "Insert/Update Own Row" which makes this work.
export const saveArtistHours = async (userId: string, hours: ArtistHours, name: string, city: string, email: string): Promise<Artist> => {
    const supabase = getSupabase();
    
    // Construct the full profile object. 
    // If the row doesn't exist, this provides all required fields (username, full_name).
    // If it does exist, it updates everything.
    const profileData = {
        id: userId,
        hours: hours,
        full_name: name || 'Artist',
        city: city || '',
        username: email, // Required for new rows
        role: 'artist', // Default role if creating
        updated_at: new Date().toISOString()
    };

    // Perform Upsert
    const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })
        .select()
        .single();
    
    if (error) {
        console.error("Direct Upsert saveArtistHours failed:", error);
        throw new Error(error.message); // Propagate actual DB error
    }

    if (!data) {
        throw new Error("Save succeeded but no data returned.");
    }

    return adaptProfileToArtist(data);
};

export const uploadPortfolioImage = async (userId: string, file: File): Promise<PortfolioImage> => {
    const supabase = getSupabase();
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('portfolios').upload(fileName, file);
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('portfolios').getPublicUrl(fileName);
    
    const newPortfolioImage: PortfolioImage = { url: data.publicUrl, isAiGenerated: false };
    const { data: profile, error: profileError } = await supabase.from('profiles').select('portfolio').eq('id', userId).single();
    if (profileError) throw profileError;
    
    const newPortfolio = [...(profile.portfolio || []), newPortfolioImage];
    const { error: updateError } = await supabase.from('profiles').update({ portfolio: newPortfolio }).eq('id', userId);
    if (updateError) throw updateError;
    return newPortfolioImage;
};

export const deletePortfolioImageFromStorage = async (imageUrl: string): Promise<{ success: boolean }> => {
    const supabase = getSupabase();
    try {
        const url = new URL(imageUrl);
        const path = url.pathname.split('/portfolios/')[1];
        if (path) {
            await supabase.storage.from('portfolios').remove([path]);
        }
    } catch (e) {
        console.error("Error parsing URL for storage deletion:", e);
    }
    return { success: true };
};

export const updateShopData = async (shopId: string, updatedData: Partial<Shop>): Promise<Shop> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('shops').update(updatedData).eq('id', shopId).select().single();
    if (error) throw error;
    return adaptShop(data);
};

export const addBoothToShop = async (shopId: string, boothData: Omit<Booth, 'id' | 'shopId'>): Promise<Booth> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('booths').insert({ ...boothData, shop_id: shopId }).select().single();
    if (error) throw error;
    return adaptBooth(data);
};

export const deleteBoothFromShop = async (boothId: string): Promise<{ success: true }> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('booths').delete().eq('id', boothId);
    if (error) throw error;
    return { success: true };
};

export const createBookingForArtist = async (bookingData: Omit<Booking, 'id' | 'city'>): Promise<Booking> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('bookings').insert({ 
        artist_id: bookingData.artistId, 
        booth_id: bookingData.boothId, 
        shop_id: bookingData.shopId, 
        start_date: bookingData.startDate, 
        end_date: bookingData.endDate, 
        payment_status: bookingData.paymentStatus, 
        total_amount: bookingData.totalAmount, 
        platform_fee: bookingData.platformFee 
    }).select().single();

    if (error) throw error;
    const { data: rawShop } = await supabase.from('shops').select('*').eq('id', bookingData.shopId).single();
    return adaptBooking(data, rawShop ? [adaptShop(rawShop)] : []);
};

export const uploadBookingReferenceImage = async (requestId: string, file: File, index: number): Promise<string> => {
    const supabase = getSupabase();
    const fileExt = file.name.split('.').pop();
    const fileName = `${requestId}/${index}.${fileExt}`;
    const { error } = await supabase.storage.from('booking-references').upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('booking-references').getPublicUrl(fileName);
    return data.publicUrl;
};

export const createClientBookingRequest = async (requestData: Omit<ClientBookingRequest, 'id' | 'status'|'paymentStatus'>): Promise<ClientBookingRequest> => {
    const supabase = getSupabase();
    
    const payload = { 
        p_artist_id: requestData.artistId, 
        p_start_date: requestData.startDate, 
        p_end_date: requestData.endDate, 
        p_message: requestData.message, 
        p_tattoo_width: requestData.tattooWidth,
        p_tattoo_height: requestData.tattooHeight,
        p_body_placement: requestData.bodyPlacement, 
        p_deposit_amount: requestData.depositAmount, 
        p_platform_fee: requestData.platformFee,
        p_service_id: requestData.serviceId,
        p_budget: requestData.budget,
        p_reference_image_urls: requestData.referenceImageUrls,
        p_preferred_time: requestData.preferredTime,
        p_client_id: requestData.clientId || null,
        p_guest_name: requestData.guestName || null,
        p_guest_email: requestData.guestEmail || null,
        p_guest_phone: requestData.guestPhone || null
    };

    // Call the RPC function defined in SQL script
    const { data, error } = await supabase.rpc('create_booking_request', payload);
        
    if (error) {
        console.error("Error creating booking request via RPC:", error);
        throw error;
    }
    
    const adapted = adaptClientBookingRequest(data);

    // AUTO-NOTIFY ARTIST
    // This is crucial for the "Notifications pop up" requirement.
    // The SQL policies now allow public insert into notifications for this exact reason.
    try {
        const clientName = adapted.clientName || 'A client';
        const notificationMsg = `New Booking Request: ${clientName} wants a ${adapted.tattooWidth}x${adapted.tattooHeight}" tattoo.`;
        await createNotification(adapted.artistId, notificationMsg);
    } catch (e) {
        console.warn("Failed to notify artist (check RLS policies for notifications):", e);
    }

    return adapted;
};

export const updateClientBookingRequest = async (requestId: string, updates: Partial<Pick<ClientBookingRequest, 'referenceImageUrls'>>): Promise<ClientBookingRequest> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('client_booking_requests')
        .update({ reference_image_urls: updates.referenceImageUrls })
        .eq('id', requestId)
        .select('*, client:profiles!client_booking_requests_client_id_fkey(full_name), artist:profiles!client_booking_requests_artist_id_fkey(full_name, services)')
        .single();
    
    if (error) throw error;
    return adaptClientBookingRequest(data);
};

export const updateClientBookingRequestStatus = async (requestId: string, status: ClientBookingRequest['status'], paymentStatus?: 'paid' | 'unpaid'): Promise<{ success: boolean }> => {
    const supabase = getSupabase();
    const updatePayload: { [key: string]: any } = { status };
    if (paymentStatus) updatePayload.payment_status = paymentStatus;

    // Perform Update
    const { data, error } = await supabase
        .from('client_booking_requests')
        .update(updatePayload)
        .eq('id', requestId)
        .select()
        .single();

    if (error) throw error;

    // AUTO-NOTIFY CLIENT
    try {
        if (data.client_id) {
            const msg = `Booking Update: Your request has been ${status} by the artist.`;
            await createNotification(data.client_id, msg);
        }
    } catch (e) {
        console.warn("Failed to notify client", e);
    }

    return { success: true };
};

export const payClientBookingDeposit = async (requestId: string): Promise<ClientBookingRequest> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('client_booking_requests')
        .update({ payment_status: 'paid', deposit_paid_at: new Date().toISOString() })
        .eq('id', requestId)
        .select('*, client:profiles!client_booking_requests_client_id_fkey(full_name), artist:profiles!client_booking_requests_artist_id_fkey(full_name, services)')
        .single();
    if (error) throw error;
    
    // AUTO-NOTIFY ARTIST
    try {
        const msg = `Deposit PAID for request #${requestId.substring(0,6)}.`;
        await createNotification(data.artist_id, msg);
    } catch (e) { console.warn(e) }

    return adaptClientBookingRequest(data);
};

export const fetchNotificationsForUser = async (userId: string): Promise<Notification[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return [];
    return data.map(adaptNotification);
};

export const markUserNotificationsAsRead = async (userId: string): Promise<{ success: true }> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    if (error) throw error;
    return { success: true };
};

export const createNotification = async (userId: string, message: string): Promise<Notification> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('notifications').insert({ user_id: userId, message: message }).select().single();
    if (error) throw error;
    return adaptNotification(data);
};

export const findOrCreateConversation = async (currentUserId: string, otherUserId: string): Promise<Conversation> => {
    const supabase = getSupabase();
    
    // 1. Try to find existing
    const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .or(`and(participant_one_id.eq.${currentUserId},participant_two_id.eq.${otherUserId}),and(participant_one_id.eq.${otherUserId},participant_two_id.eq.${currentUserId})`)
        .maybeSingle();

    if (existing) {
        return { id: existing.id, participantOneId: existing.participant_one_id, participantTwoId: existing.participant_two_id };
    }

    // 2. Create new
    const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({ participant_one_id: currentUserId, participant_two_id: otherUserId })
        .select()
        .single();

    if (error) throw error;
    return { id: newConv.id, participantOneId: newConv.participant_one_id, participantTwoId: newConv.participant_two_id };
};

export const fetchUserConversations = async (userId: string): Promise<ConversationWithUser[]> => {
    const supabase = getSupabase();
    
    // Use V2 RPC which uses LEFT JOIN to prevent missing profiles from hiding chats
    const { data, error } = await supabase.rpc('get_my_conversations_v2', { p_user_id: userId });
        
    if (error) {
        console.error("Error fetching conversations via RPC:", error);
        throw error;
    }

    if (!data) return [];

    return data.map((item: any) => ({
        id: item.id,
        participantOneId: item.participantOneId,
        participantTwoId: item.participantTwoId,
        otherUser: {
            id: item.otherUser.id,
            name: item.otherUser.name || 'Unknown User'
        }
    }));
};

export const fetchMessagesForConversation = async (conversationId: string): Promise<Message[]> => {
    const supabase = getSupabase();
    
    // Use RPC to safely fetch messages for a conversation
    const { data, error } = await supabase.rpc('get_messages', { p_conversation_id: conversationId });
    
    if (error) {
        console.error("RPC get_messages failed", error);
        throw error;
    }
    
    return data.map(adaptMessage);
};

export const sendMessage = async (conversationId: string, senderId: string, content?: string, attachmentUrl?: string): Promise<Message> => {
    const supabase = getSupabase();
    if (!content && !attachmentUrl) throw new Error("Message must have content or an attachment.");
    
    // Use RPC to safely send messages server-side
    const { data, error } = await supabase.rpc('send_message', { 
        p_conversation_id: conversationId, 
        p_content: content || null, 
        p_attachment_url: attachmentUrl || null 
    });

    if (error) {
        console.error("RPC send_message failed", error);
        throw error;
    }
    
    return adaptMessage(data);
};

export const uploadMessageAttachment = async (file: File, conversationId: string): Promise<string> => {
    const supabase = getSupabase();
    const fileExt = file.name.split('.').pop();
    const fileName = `${conversationId}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('message_attachments').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('message_attachments').getPublicUrl(fileName);
    return data.publicUrl;
};

export const updateBoothData = async (boothId: string, updatedData: Partial<Booth>): Promise<Booth> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('booths').update(updatedData).eq('id', boothId).select().single();
    if (error) throw error;
    return adaptBooth(data);
};

export const setArtistAvailability = async (artistId: string, date: string, status: 'available' | 'unavailable'): Promise<ArtistAvailability> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('artist_availability').upsert({ artist_id: artistId, date: date, status: status }, { onConflict: 'artist_id, date' }).select().single();
    if (error) throw error;
    return adaptAvailability(data);
};

export const submitReview = async (requestId: string, rating: number, text: string): Promise<ClientBookingRequest> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('client_booking_requests').update({ review_rating: rating, review_text: text, review_submitted_at: new Date().toISOString() }).select(`*, client:profiles!client_booking_requests_client_id_fkey(full_name), artist:profiles!client_booking_requests_artist_id_fkey(full_name, services)`).single();
    if (error) throw error;
    return adaptClientBookingRequest(data);
};

export const fetchArtistReviews = async (artistId: string): Promise<Review[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('client_booking_requests').select('id, review_rating, review_text, review_submitted_at, client:profiles!client_booking_requests_client_id_fkey(id, full_name)').eq('artist_id', artistId).not('review_rating', 'is', null);
    if (error) throw error;
    if (!data) return [];
    return data.map(adaptReviewFromBooking).filter((r): r is Review => r !== null);
};

export const deleteUserAsAdmin = async (userId: string): Promise<{ success: boolean }> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    return { success: true };
};

export const deleteShopAsAdmin = async (shopId: string): Promise<{ success: boolean }> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('shops').delete().eq('id', shopId);
    if (error) throw error;
    return { success: true };
};

export const createShop = async (shopData: Omit<Shop, 'id' | 'isVerified' | 'rating' | 'reviews' | 'averageArtistRating' | 'ownerId'>, ownerId: string): Promise<Shop> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('shops').insert({ 
        name: shopData.name,
        location: shopData.location,
        address: shopData.address,
        lat: shopData.lat,
        lng: shopData.lng,
        amenities: shopData.amenities,
        image_url: shopData.imageUrl,
        payment_methods: shopData.paymentMethods,
        owner_id: ownerId, 
        is_verified: false, 
        rating: 0, 
        reviews: [], 
        average_artist_rating: 0 
    }).select().single();
    if (error) throw error;
    return adaptShop(data);
};

export const createVerificationRequest = async (type: 'artist' | 'shop', id: string, profileId: string): Promise<VerificationRequest> => {
    const supabase = getSupabase();
    const insertData = type === 'artist' ? { profile_id: id, type } : { shop_id: id, profile_id: profileId, type };
    const { data, error } = await supabase.from('verification_requests').insert(insertData).select().single();
    if (error) throw error;
    return adaptVerificationRequest(data);
};

export const updateVerificationRequest = async (requestId: string, status: 'approved' | 'rejected'): Promise<VerificationRequest> => {
    const supabase = getSupabase();
    const { data: request, error: fetchError } = await supabase.from('verification_requests').select('*').eq('id', requestId).single();
    if (fetchError) throw fetchError;

    const { data: updatedData, error: updateError } = await supabase.from('verification_requests').update({ status }).eq('id', requestId).select().single();
    if (updateError) throw updateError;

    if (status === 'approved') {
        const table = request.type === 'artist' ? 'profiles' : 'shops';
        const id = request.type === 'artist' ? request.profile_id : request.shop_id;
        await supabase.from(table).update({ is_verified: true }).eq('id', id);
    }
    
    return adaptVerificationRequest(updatedData);
};

export const addReviewToShop = async (shopId: string, review: Omit<Review, 'id'>): Promise<Shop> => {
    const supabase = getSupabase();
    const { data: shop } = await supabase.from('shops').select('reviews').eq('id', shopId).single();
    
    const newReview = { ...review, id: `review_${Date.now()}` };
    const updatedReviews = [...(shop?.reviews || []), newReview];
    const newAverageRating = updatedReviews.reduce((acc, r) => acc + r.rating, 0) / updatedReviews.length;

    const { data, error } = await supabase.from('shops').update({ reviews: updatedReviews, average_artist_rating: newAverageRating }).eq('id', shopId).select().single();
    if (error) throw error;
    return adaptShop(data);
};

export const adminUpdateUserProfile = async (userId: string, updates: { name: string, role: UserRole, isVerified: boolean }): Promise<{success: boolean}> => {
    const supabase = getSupabase();
    const { error } = await supabase
        .from('profiles')
        .update({ full_name: updates.name, role: updates.role, is_verified: updates.isVerified })
        .eq('id', userId);
    if (error) throw error;
    return { success: true };
};

export const adminUpdateShopDetails = async (shopId: string, updates: { name: string, isVerified: boolean }): Promise<Shop> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('shops')
        .update({ name: updates.name, is_verified: updates.isVerified })
        .eq('id', shopId)
        .select()
        .single();
    if (error) throw error;
    return adaptShop(data);
};
