// @/services/apiService.ts
import { getSupabase } from './supabaseClient';
import type { Artist, Shop, Booth, Booking, ClientBookingRequest, Notification, User, UserRole, Review, PortfolioImage, VerificationRequest, Conversation, ConversationWithUser, Message, ArtistAvailability } from '../types';
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
    const { data: rawClientBookings, error: clientBookingsError } = await supabase
        .from('client_booking_requests')
        .select(`
            *,
            client:profiles!client_booking_requests_client_id_fkey(id, full_name),
            artist:profiles!client_booking_requests_artist_id_fkey(id, full_name)
        `);
    const { data: rawAvailability, error: availabilityError } = await supabase.from('artist_availability').select('*');
    const { data: rawVerificationRequests, error: verificationRequestsError } = await supabase.from('verification_requests').select(`*, profile:profiles(full_name), shop:shops(name)`);


    if (artistsError || shopsError || boothsError || bookingsError || clientBookingsError || availabilityError || verificationRequestsError) {
        console.error({ artistsError, shopsError, boothsError, bookingsError, clientBookingsError, availabilityError, verificationRequestsError });
        throw new Error('Failed to fetch initial data from Supabase.');
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

    const { error } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);

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

    const { data, error } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', artistId)
        .select()
        .single();

    if (error) throw error;
    
    return adaptProfileToArtist(data);
};

export const uploadPortfolioImage = async (userId: string, file: File): Promise<PortfolioImage> => {
    const supabase = getSupabase();
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('portfolios')
        .upload(fileName, file);
    
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
    
    // Fetch the specific shop associated with this booking to ensure data consistency
    const { data: rawShop, error: shopError } = await supabase.from('shops').select('*').eq('id', bookingData.shopId).single();
    
    if (shopError) {
        console.error("Failed to fetch shop details for new booking:", shopError);
        // Proceed with adaptation but the city will be 'Unknown'
        return adaptBooking(data, []);
    }
    
    return adaptBooking(data, rawShop ? [adaptShop(rawShop)] : []);
};

export const createClientBookingRequest = async (requestData: Omit<ClientBookingRequest, 'id' | 'status'|'paymentStatus'>): Promise<ClientBookingRequest> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('client_booking_requests').insert({ client_id: requestData.clientId, artist_id: requestData.artistId, start_date: requestData.startDate, end_date: requestData.endDate, message: requestData.message, tattoo_size: requestData.tattooSize, body_placement: requestData.bodyPlacement, estimated_hours: requestData.estimatedHours, deposit_amount: requestData.depositAmount, platform_fee: requestData.platformFee }).select(`*, client:profiles!client_booking_requests_client_id_fkey(full_name), artist:profiles!client_booking_requests_artist_id_fkey(full_name)`).single();
    if (error) throw error;
    
    const conversation = await findOrCreateConversation(requestData.clientId, requestData.artistId);
    await sendMessage(conversation.id, requestData.clientId, requestData.message);

    return adaptClientBookingRequest(data);
};

export const updateClientBookingRequestStatus = async (requestId: string, status: ClientBookingRequest['status'], paymentStatus?: 'paid' | 'unpaid'): Promise<{ success: boolean }> => {
    const supabase = getSupabase();
    const { data: request, error: fetchError } = await supabase.from('client_booking_requests').select('client_id, artist_id').eq('id', requestId).single();
    if (fetchError) throw fetchError;

    const updatePayload: { status: ClientBookingRequest['status'], payment_status?: 'paid' | 'unpaid' } = { status };
    if (paymentStatus) {
        updatePayload.payment_status = paymentStatus;
    }

    const { error: updateError } = await supabase.from('client_booking_requests').update(updatePayload).eq('id', requestId);
    if (updateError) throw updateError;
    
    const { data: artistProfile, error: profileError } = await supabase.from('profiles').select('full_name').eq('id', request.artist_id).single();
    if (profileError) throw profileError;
    await createNotification(request.client_id, `Your booking request with ${artistProfile.full_name} has been ${status}.`);
    return { success: true };
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

export const findOrCreateConversation = async (userId1: string, userId2: string): Promise<Conversation> => {
    const supabase = getSupabase();
    const { data: existing, error: existingError } = await supabase.from('conversations').select('*').or(`(participant_one_id.eq.${userId1},participant_two_id.eq.${userId2}),(participant_one_id.eq.${userId2},participant_two_id.eq.${userId1})`).limit(1);
    if (existingError) throw existingError;
    if (existing && existing.length > 0) return { ...existing[0], participantOneId: existing[0].participant_one_id, participantTwoId: existing[0].participant_two_id };

    const { data: created, error: createError } = await supabase.from('conversations').insert({ participant_one_id: userId1, participant_two_id: userId2 }).select().single();
    if (createError) throw createError;
    return { ...created, participantOneId: created.participant_one_id, participantTwoId: created.participant_two_id };
};

export const fetchUserConversations = async (userId: string): Promise<ConversationWithUser[]> => {
    const supabase = getSupabase();
    const { data: conversations, error } = await supabase.from('conversations').select('*').or(`participant_one_id.eq.${userId},participant_two_id.eq.${userId}`);
    if (error) throw error;

    const participantIds = new Set<string>();
    conversations.forEach(c => { participantIds.add(c.participant_one_id); participantIds.add(c.participant_two_id); });
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, full_name').in('id', Array.from(participantIds));
    if (profileError) throw profileError;
    const profilesMap = new Map<string, { id: string; full_name: string }>(profiles.map(p => [p.id, p]));

    return conversations.map(c => adaptConversation(c, userId, profilesMap));
};

export const fetchMessagesForConversation = async (conversationId: string): Promise<Message[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(adaptMessage);
};

export const sendMessage = async (conversationId: string, senderId: string, content?: string, attachmentUrl?: string): Promise<Message> => {
    const supabase = getSupabase();
    if (!content && !attachmentUrl) throw new Error("Message must have content or an attachment.");
    const { data, error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, content, attachment_url: attachmentUrl }).select().single();
    if (error) throw error;
    return adaptMessage(data);
};

export const uploadMessageAttachment = async (file: File, conversationId: string): Promise<string> => {
    const supabase = getSupabase();
    const fileExt = file.name.split('.').pop();
    const fileName = `${conversationId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('message_attachments').upload(fileName, file);
    if (uploadError) throw uploadError;
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
    const { data, error } = await supabase.from('client_booking_requests').update({ review_rating: rating, review_text: text, review_submitted_at: new Date().toISOString() }).select(`*, client:profiles!client_booking_requests_client_id_fkey(full_name), artist:profiles!client_booking_requests_artist_id_fkey(full_name)`).single();
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
    // Note: You might want to delete the auth user as well, which requires admin privileges.
    // const { error: authError } = await supabase.auth.admin.deleteUser(userId);
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
        const { error: verifyError } = await supabase.from(table).update({ is_verified: true }).eq('id', id);
        if (verifyError) throw verifyError;
    }
    
    return adaptVerificationRequest(updatedData);
};

export const addReviewToShop = async (shopId: string, review: Omit<Review, 'id'>): Promise<Shop> => {
    const supabase = getSupabase();
    const { data: shop, error: fetchError } = await supabase.from('shops').select('reviews').eq('id', shopId).single();
    if (fetchError) throw fetchError;
    
    const newReview = { ...review, id: `review_${Date.now()}` };
    const updatedReviews = [...(shop.reviews || []), newReview];
    const newAverageRating = updatedReviews.reduce((acc, r) => acc + r.rating, 0) / updatedReviews.length;

    const { data, error } = await supabase.from('shops').update({ reviews: updatedReviews, average_artist_rating: newAverageRating }).eq('id', shopId).select().single();
    if (error) throw error;
    return adaptShop(data);
};

// --- NEW ADMIN FUNCTIONS ---
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