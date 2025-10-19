// @/services/apiService.ts
import { supabase } from './supabaseClient';
import type { Artist, Shop, Booth, Booking, ClientBookingRequest, Notification, User, UserRole, Client, ShopOwner, Conversation, Message, ConversationWithUser, ArtistAvailability, Review, PortfolioImage, VerificationRequest } from '../types';

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
            return { ...baseUser, type: profile.role, data: { id: profile.id, name: profile.full_name, city: profile.city, specialty: profile.specialty, bio: profile.bio, portfolio: profile.portfolio || [], isVerified: profile.is_verified, socials: profile.socials, hourlyRate: profile.hourly_rate } as Artist };
        case 'client':
            return { ...baseUser, type: 'client', data: { id: profile.id, name: profile.full_name } as Client };
        case 'shop-owner':
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
    const { data: verificationRequests, error: verificationRequestsError } = await supabase.from('verification_requests').select(`*, profile:profiles(full_name), shop:shops(name)`);


    if (artistsError || shopsError || boothsError || bookingsError || clientBookingsError || availabilityError || verificationRequestsError) {
        console.error({ artistsError, shopsError, boothsError, bookingsError, clientBookingsError, availabilityError, verificationRequestsError });
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
        hourlyRate: profile.hourly_rate,
    }));

    const adaptedShops: Shop[] = shops.map(shop => ({ ...shop, id: shop.id, name: shop.name, location: shop.location, address: shop.address, lat: shop.lat, lng: shop.lng, amenities: shop.amenities, rating: shop.rating, imageUrl: shop.image_url, paymentMethods: shop.payment_methods, reviews: shop.reviews, isVerified: shop.is_verified, ownerId: shop.owner_id, averageArtistRating: shop.average_artist_rating }));
    
    const adaptedBookings: Booking[] = bookings.map(b => ({
      id: b.id,
      artistId: b.artist_id,
      boothId: b.booth_id,
      shopId: b.shop_id,
      city: shops.find(s => s.id === b.shop_id)?.location || '',
      startDate: b.start_date,
      endDate: b.end_date,
      paymentStatus: b.payment_status,
      totalAmount: b.total_amount,
      platformFee: b.platform_fee,
      paymentIntentId: b.payment_intent_id
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
      clientName: (b.client as { full_name: string } | null)?.full_name || 'Unknown Client',
      artistName: (b.artist as { full_name: string } | null)?.full_name || 'Unknown Artist',
      reviewRating: b.review_rating,
      reviewText: b.review_text,
      reviewSubmittedAt: b.review_submitted_at,
      depositAmount: b.deposit_amount,
      platformFee: b.platform_fee,
      paymentIntentId: b.payment_intent_id
    }));

    const adaptedAvailability: ArtistAvailability[] = availability.map(a => ({
        id: a.id,
        artistId: a.artist_id,
        date: a.date,
        status: a.status,
    }));
    
    const adaptedVerificationRequests: VerificationRequest[] = verificationRequests.map(v => ({
      id: v.id,
      profileId: v.profile_id,
      shopId: v.shop_id,
      type: v.type,
      status: v.status,
      createdAt: v.created_at,
      requesterName: v.type === 'artist' ? v.profile?.full_name : v.shop?.name,
      itemName: v.type === 'artist' ? v.profile?.full_name : v.shop?.name,
    }));

    return { 
        artists: adaptedArtists, 
        shops: adaptedShops, 
        booths, 
        bookings: adaptedBookings,
        clientBookingRequests: adaptedClientBookings,
        artistAvailability: adaptedAvailability,
        verificationRequests: adaptedVerificationRequests,
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
    if (updatedData.hourlyRate) profileUpdate.hourly_rate = updatedData.hourlyRate;

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
        hourlyRate: data.hourly_rate,
        averageRating: 0,
    };
};

export const uploadPortfolioImage = async (userId: string, file: File): Promise<PortfolioImage> => {
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

export const replacePortfolioImage = async (userId: string, oldImage: PortfolioImage, newImageBase64: string): Promise<PortfolioImage> => {
    const mimeType = 'image/png';
    const fileExt = 'png';
    const newFileName = `${userId}/${Date.now()}.${fileExt}`;

    const byteCharacters = atob(newImageBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const newFile = new File([blob], newFileName, { type: mimeType });

    const { error: uploadError } = await supabase.storage.from('portfolios').upload(newFileName, newFile);
    if (uploadError) throw uploadError;

    const { data: { publicUrl: newUrl } } = supabase.storage.from('portfolios').getPublicUrl(newFileName);
    const newPortfolioImage: PortfolioImage = { url: newUrl, isAiGenerated: true };

    const { data: profile, error: profileError } = await supabase.from('profiles').select('portfolio').eq('id', userId).single();
    if (profileError) throw profileError;
    
    const currentPortfolio: PortfolioImage[] = profile.portfolio || [];
    const updatedPortfolio = currentPortfolio.map(img => img.url === oldImage.url ? newPortfolioImage : img);
    
    const { error: updateError } = await supabase.from('profiles').update({ portfolio: updatedPortfolio }).eq('id', userId);
    if (updateError) throw updateError;
    
    try {
        const oldFilePath = new URL(oldImage.url).pathname.split('/portfolios/')[1];
        if (oldFilePath) {
            const { error: deleteError } = await supabase.storage.from('portfolios').remove([oldFilePath]);
            if (deleteError) console.warn("Could not delete old image:", deleteError.message);
        }
    } catch(e) { console.warn("Could not parse old image URL for deletion:", oldImage.url); }
    
    return newPortfolioImage;
};

export const updateShopData = async (shopId: string, updatedData: Partial<Shop>): Promise<Shop> => {
    const { data, error } = await supabase.from('shops').update(updatedData).eq('id', shopId).select().single();
    if (error) throw error;
    return { ...data, id: data.id, name: data.name, location: data.location, address: data.address, lat: data.lat, lng: data.lng, amenities: data.amenities, rating: data.rating, imageUrl: data.image_url, paymentMethods: data.payment_methods, reviews: data.reviews, isVerified: data.is_verified, ownerId: data.owner_id, averageArtistRating: data.average_artist_rating };
};

export const addBoothToShop = async (shopId: string, boothData: Omit<Booth, 'id' | 'shopId'>): Promise<Booth> => {
    const { data, error } = await supabase.from('booths').insert({ ...boothData, shop_id: shopId }).select().single();
    if (error) throw error;
    return { ...data, shopId: data.shop_id, dailyRate: data.daily_rate };
};

export const deleteBoothFromShop = async (boothId: string): Promise<{ success: true }> => {
    const { error } = await supabase.from('booths').delete().eq('id', boothId);
    if (error) throw error;
    return { success: true };
};

export const createBookingForArtist = async (bookingData: Omit<Booking, 'id'| 'city'>): Promise<Booking> => {
    const { data, error } = await supabase.from('bookings').insert({ artist_id: bookingData.artistId, booth_id: bookingData.boothId, shop_id: bookingData.shopId, start_date: bookingData.startDate, end_date: bookingData.endDate, payment_status: bookingData.paymentStatus, total_amount: bookingData.totalAmount, platform_fee: bookingData.platformFee }).select().single();
    if (error) throw error;
    return { id: data.id, artistId: data.artist_id, boothId: data.booth_id, shopId: data.shop_id, startDate: data.start_date, endDate: data.end_date, paymentStatus: data.payment_status, totalAmount: data.total_amount, platformFee: data.platform_fee, city: '' };
};

export const createClientBookingRequest = async (requestData: Omit<ClientBookingRequest, 'id' | 'status'|'paymentStatus'>): Promise<ClientBookingRequest> => {
    const { data, error } = await supabase.from('client_booking_requests').insert({ client_id: requestData.clientId, artist_id: requestData.artistId, start_date: requestData.startDate, end_date: requestData.endDate, message: requestData.message, tattoo_size: requestData.tattooSize, body_placement: requestData.bodyPlacement, estimated_hours: requestData.estimatedHours, deposit_amount: requestData.depositAmount, platform_fee: requestData.platformFee }).select(`*, client:profiles!client_booking_requests_client_id_fkey(full_name), artist:profiles!client_booking_requests_artist_id_fkey(full_name)`).single();
    if (error) throw error;
    
    const conversation = await findOrCreateConversation(requestData.clientId, requestData.artistId);
    await sendMessage(conversation.id, requestData.clientId, requestData.message);

    return { id: data.id, clientId: data.client_id, artistId: data.artist_id, startDate: data.start_date, endDate: data.end_date, message: data.message, status: data.status, tattooSize: data.tattoo_size, bodyPlacement: data.body_placement, estimatedHours: data.estimated_hours, paymentStatus: data.payment_status, clientName: (data.client as { full_name: string } | null)?.full_name, artistName: (data.artist as { full_name: string } | null)?.full_name, depositAmount: data.deposit_amount, platformFee: data.platform_fee };
};

export const updateClientBookingRequestStatus = async (requestId: string, status: ClientBookingRequest['status']): Promise<{ success: boolean }> => {
    const { data: request, error: fetchError } = await supabase.from('client_booking_requests').select('client_id, artist_id').eq('id', requestId).single();
    if (fetchError) throw fetchError;
    const { error: updateError } = await supabase.from('client_booking_requests').update({ status: status }).eq('id', requestId);
    if (updateError) throw updateError;
    
    const { data: artistProfile, error: profileError } = await supabase.from('profiles').select('full_name').eq('id', request.artist_id).single();
    if (profileError) throw profileError;
    await createNotification(request.client_id, `Your booking request with ${artistProfile.full_name} has been ${status}.`);
    return { success: true };
};

export const fetchNotificationsForUser = async (userId: string): Promise<Notification[]> => {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return [];
    return data.map(n => ({ id: n.id, userId: n.user_id, message: n.message, read: n.read, createdAt: n.created_at }));
};

export const markUserNotificationsAsRead = async (userId: string): Promise<{ success: true }> => {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    if (error) throw error;
    return { success: true };
};

export const createNotification = async (userId: string, message: string): Promise<Notification> => {
    const { data, error } = await supabase.from('notifications').insert({ user_id: userId, message: message }).select().single();
    if (error) throw error;
    return { id: data.id, userId: data.user_id, message: data.message, read: data.read, createdAt: data.created_at };
};

export const findOrCreateConversation = async (userId1: string, userId2: string): Promise<Conversation> => {
    const { data: existing, error: existingError } = await supabase.from('conversations').select('*').or(`(participant_one_id.eq.${userId1},participant_two_id.eq.${userId2}),(participant_one_id.eq.${userId2},participant_two_id.eq.${userId1})`).limit(1);
    if (existingError) throw existingError;
    if (existing && existing.length > 0) return { ...existing[0], participantOneId: existing[0].participant_one_id, participantTwoId: existing[0].participant_two_id };

    const { data: created, error: createError } = await supabase.from('conversations').insert({ participant_one_id: userId1, participant_two_id: userId2 }).select().single();
    if (createError) throw createError;
    return { ...created, participantOneId: created.participant_one_id, participantTwoId: created.participant_two_id };
};

export const fetchUserConversations = async (userId: string): Promise<ConversationWithUser[]> => {
    const { data: conversations, error } = await supabase.from('conversations').select('*').or(`participant_one_id.eq.${userId},participant_two_id.eq.${userId}`);
    if (error) throw error;

    const participantIds = new Set<string>();
    conversations.forEach(c => { participantIds.add(c.participant_one_id); participantIds.add(c.participant_two_id); });
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, full_name').in('id', Array.from(participantIds));
    if (profileError) throw profileError;
    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    return conversations.map(c => {
        const otherUserId = c.participant_one_id === userId ? c.participant_two_id : c.participant_one_id;
        const otherUser = profilesMap.get(otherUserId);
        return { id: c.id, participantOneId: c.participant_one_id, participantTwoId: c.participant_two_id, otherUser: { id: otherUserId, name: otherUser?.full_name || 'Unknown User' } };
    });
};

export const fetchMessagesForConversation = async (conversationId: string): Promise<Message[]> => {
    const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(m => ({ id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, content: m.content, attachmentUrl: m.attachment_url, createdAt: m.created_at }));
};

export const sendMessage = async (conversationId: string, senderId: string, content?: string, attachmentUrl?: string): Promise<Message> => {
    if (!content && !attachmentUrl) throw new Error("Message must have content or an attachment.");
    const { data, error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, content, attachment_url: attachmentUrl }).select().single();
    if (error) throw error;
    return { id: data.id, conversationId: data.conversation_id, senderId: data.sender_id, content: data.content, attachmentUrl: data.attachment_url, createdAt: data.created_at };
};

export const uploadMessageAttachment = async (file: File, conversationId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${conversationId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('message_attachments').upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('message_attachments').getPublicUrl(fileName);
    return data.publicUrl;
};

export const updateBoothData = async (boothId: string, updatedData: Partial<Booth>): Promise<Booth> => {
    const { data, error } = await supabase.from('booths').update(updatedData).eq('id', boothId).select().single();
    if (error) throw error;
    return { ...data, shopId: data.shop_id, dailyRate: data.daily_rate };
};

export const setArtistAvailability = async (artistId: string, date: string, status: 'available' | 'unavailable'): Promise<ArtistAvailability> => {
    const { data, error } = await supabase.from('artist_availability').upsert({ artist_id: artistId, date: date, status: status }, { onConflict: 'artist_id, date' }).select().single();
    if (error) throw error;
    return { id: data.id, artistId: data.artist_id, date: data.date, status: data.status };
};

export const submitReview = async (requestId: string, rating: number, text: string): Promise<ClientBookingRequest> => {
    const { data, error } = await supabase.from('client_booking_requests').update({ review_rating: rating, review_text: text, review_submitted_at: new Date().toISOString() }).eq('id', requestId).select().single();
    if (error) throw error;
    return data;
};

export const fetchArtistReviews = async (artistId: string): Promise<Review[]> => {
    const { data, error } = await supabase.from('client_booking_requests').select('id, review_rating, review_text, review_submitted_at, client:profiles!client_booking_requests_client_id_fkey(id, full_name)').eq('artist_id', artistId).not('review_rating', 'is', null);
    if (error) throw error;
    if (!data) return [];
    return data
        .map(r => {
            // FIX: The type of `r.client` from the Supabase join is inferred as `unknown`. Cast it to a specific, known shape to ensure type-safe access.
            const client = r.client as { id: string; full_name: string } | null;
            return {
                id: r.id,
                authorId: client?.id,
                authorName: client?.full_name,
                rating: r.review_rating,
                text: r.review_text,
                createdAt: r.review_submitted_at
            };
        })
        .filter((r): r is Review => !!(r.authorId && r.authorName));
};

export const deleteUserAsAdmin = async (userId: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    return { success: true };
};

export const deleteShopAsAdmin = async (shopId: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('shops').delete().eq('id', shopId);
    if (error) throw error;
    return { success: true };
};

export const createShop = async (shopData: Omit<Shop, 'id' | 'isVerified' | 'rating' | 'reviews' | 'averageArtistRating' | 'ownerId'>, ownerId: string): Promise<Shop> => {
    const { data, error } = await supabase.from('shops').insert({ ...shopData, owner_id: ownerId, is_verified: false, rating: 0, reviews: [], average_artist_rating: 0 }).select().single();
    if (error) throw error;
    return { ...data, id: data.id, name: data.name, location: data.location, address: data.address, lat: data.lat, lng: data.lng, amenities: data.amenities, rating: data.rating, imageUrl: data.image_url, paymentMethods: data.payment_methods, reviews: data.reviews, isVerified: data.is_verified, ownerId: data.owner_id, averageArtistRating: data.average_artist_rating };
};

export const createVerificationRequest = async (type: 'artist' | 'shop', id: string, profileId: string): Promise<VerificationRequest> => {
    const insertData = type === 'artist' ? { profile_id: id, type } : { shop_id: id, profile_id: profileId, type };
    const { data, error } = await supabase.from('verification_requests').insert(insertData).select().single();
    if (error) throw error;
    return data;
};

export const updateVerificationRequest = async (requestId: string, status: 'approved' | 'rejected'): Promise<VerificationRequest> => {
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
    
    return { id: updatedData.id, profileId: updatedData.profile_id, shopId: updatedData.shop_id, type: updatedData.type, status: updatedData.status, createdAt: updatedData.created_at };
};

export const addReviewToShop = async (shopId: string, review: Omit<Review, 'id'>): Promise<Shop> => {
    const { data: shop, error: fetchError } = await supabase.from('shops').select('reviews').eq('id', shopId).single();
    if (fetchError) throw fetchError;
    
    const newReview = { ...review, id: `review_${Date.now()}` };
    const updatedReviews = [...(shop.reviews || []), newReview];
    const newAverageRating = updatedReviews.reduce((acc, r) => acc + r.rating, 0) / updatedReviews.length;

    const { data, error } = await supabase.from('shops').update({ reviews: updatedReviews, average_artist_rating: newAverageRating }).eq('id', shopId).select().single();
    if (error) throw error;
    return { ...data, id: data.id, name: data.name, location: data.location, address: data.address, lat: data.lat, lng: data.lng, amenities: data.amenities, rating: data.rating, imageUrl: data.image_url, paymentMethods: data.payment_methods, reviews: data.reviews, isVerified: data.is_verified, ownerId: data.owner_id, averageArtistRating: data.average_artist_rating };
};

export const updateBookingPaymentStatus = async (type: 'artist' | 'client', id: string, paymentIntentId: string): Promise<any> => {
    const table = type === 'artist' ? 'bookings' : 'client_booking_requests';
    const { data, error } = await supabase.from(table).update({ payment_status: 'paid', payment_intent_id: paymentIntentId }).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

// --- NEW ADMIN FUNCTIONS ---
export const adminUpdateUserProfile = async (userId: string, updates: { name: string, role: UserRole, isVerified: boolean }): Promise<{success: boolean}> => {
    const { error } = await supabase
        .from('profiles')
        .update({ full_name: updates.name, role: updates.role, is_verified: updates.isVerified })
        .eq('id', userId);
    if (error) throw error;
    return { success: true };
};

export const adminUpdateShopDetails = async (shopId: string, updates: { name: string, isVerified: boolean }): Promise<Shop> => {
    const { data, error } = await supabase
        .from('shops')
        .update({ name: updates.name, is_verified: updates.isVerified })
        .eq('id', shopId)
        .select()
        .single();
    if (error) throw error;
    return { ...data, id: data.id, name: data.name, location: data.location, address: data.address, lat: data.lat, lng: data.lng, amenities: data.amenities, rating: data.rating, imageUrl: data.image_url, paymentMethods: data.payment_methods, reviews: data.reviews, isVerified: data.is_verified, ownerId: data.owner_id, averageArtistRating: data.average_artist_rating };
};