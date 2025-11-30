// @/services/apiService.ts
import { getSupabase } from './supabaseClient';
import type { Artist, Shop, Booth, Booking, ClientBookingRequest, Notification, User, UserRole, PortfolioImage, VerificationRequest, Conversation, ConversationWithUser, Message, ArtistAvailability, Review, AdminUser, ArtistService, ArtistHours, Report } from '../types';
import { 
    adaptProfileToArtist, adaptShop, adaptBooth, adaptBooking, adaptClientBookingRequest, adaptAvailability, 
    adaptVerificationRequest, adaptReviewFromBooking, adaptNotification, adaptConversation, adaptMessage, adaptSupabaseProfileToUser, adaptReport 
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

export const fetchArtistReviews = async (artistId: string): Promise<Review[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('client_booking_requests')
        .select(`
            id,
            review_rating,
            review_text,
            review_submitted_at,
            client:profiles!client_booking_requests_client_id_fkey(id, full_name)
        `)
        .eq('artist_id', artistId)
        .not('review_rating', 'is', null)
        .order('review_submitted_at', { ascending: false });

    if (error) {
        console.error("Error fetching artist reviews:", error);
        throw error;
    }

    return data.map((item: any) => ({
        id: item.id,
        authorId: item.client?.id || 'unknown',
        authorName: item.client?.full_name || 'Anonymous',
        rating: item.review_rating,
        text: item.review_text,
        createdAt: item.review_submitted_at
    }));
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
            artist:profiles!client_booking_requests_artist_id_fkey(id, full_name, services)
        `);
        
    const { data: rawAvailability, error: availabilityError } = await supabase.from('artist_availability').select('*');
    const { data: rawVerificationRequests, error: verificationRequestsError } = await supabase.from('verification_requests').select(`*, profile:profiles(full_name), shop:shops(name)`);
    
    let reports: Report[] = [];
    const { data: rawReports, error: reportsError } = await supabase.from('reports').select('*, reporter:profiles(full_name)');
    if (!reportsError && rawReports) {
        reports = rawReports.map(adaptReport);
    }


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
        reports
    };
};

export const fetchClientBookingRequestById = async (id: string): Promise<ClientBookingRequest | null> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('client_booking_requests')
        .select(`
            *,
            client:profiles!client_booking_requests_client_id_fkey(id, full_name),
            artist:profiles!client_booking_requests_artist_id_fkey(id, full_name, services)
        `)
        .eq('id', id)
        .single();
    
    if (error || !data) return null;
    return adaptClientBookingRequest(data);
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

// Rewritten for robustness: Uses a single, powerful upsert operation.
export const updateArtistData = async (artistId: string, email: string, updatedData: Partial<Artist>): Promise<Artist> => {
    const supabase = getSupabase();
    
    // This payload contains ALL possible fields for an artist profile.
    // When upserting, it will create a new profile if one doesn't exist for the ID,
    // or update the existing one with the provided fields.
    const profilePayload: any = {
      id: artistId,
      username: email, // `username` is often used as the unique identifier with email
      updated_at: new Date().toISOString()
    };
    
    // Conditionally add fields to the payload only if they are provided.
    if (updatedData.name) profilePayload.full_name = updatedData.name;
    if (updatedData.specialty) profilePayload.specialty = updatedData.specialty;
    if (updatedData.bio) profilePayload.bio = updatedData.bio;
    if (updatedData.city) profilePayload.city = updatedData.city;
    if (updatedData.portfolio) profilePayload.portfolio = updatedData.portfolio;
    if (updatedData.socials) profilePayload.socials = updatedData.socials;
    if (updatedData.hourlyRate) profilePayload.hourly_rate = updatedData.hourlyRate;
    if (updatedData.services) profilePayload.services = updatedData.services;
    if (updatedData.aftercareMessage) profilePayload.aftercare_message = updatedData.aftercareMessage;
    if (typeof updatedData.requestHealedPhoto === 'boolean') profilePayload.request_healed_photo = updatedData.requestHealedPhoto;
    if (updatedData.hours) profilePayload.hours = updatedData.hours;
    if (updatedData.intakeSettings) profilePayload.intake_settings = updatedData.intakeSettings;
    if (updatedData.bookingMode) profilePayload.booking_mode = updatedData.bookingMode;
    if (updatedData.subscriptionTier) profilePayload.subscription_tier = updatedData.subscriptionTier;

    const { data, error } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
        console.error("Update/Upsert Artist Error:", error);
        throw new Error(`Failed to save artist details: ${error.message}`);
    }
    return adaptProfileToArtist(data);
};

// This function is now consolidated into updateArtistData for robustness.
// It is kept here to prevent breaking old calls, but it's deprecated.
export const saveArtistHours = async (userId: string, hours: ArtistHours, name: string, city: string, email: string, role: UserRole): Promise<Artist> => {
    return updateArtistData(userId, email, { hours, name, city, ...(role && { role: role } as any) });
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

export const updateBoothData = async (boothId: string, updatedData: Partial<Booth>): Promise<Booth> => {
    const supabase = getSupabase();
    const dbUpdate: any = {};
    if (updatedData.name !== undefined) dbUpdate.name = updatedData.name;
    if (updatedData.dailyRate !== undefined) dbUpdate.daily_rate = updatedData.dailyRate;
    if (updatedData.photos !== undefined) dbUpdate.photos = updatedData.photos;
    if (updatedData.amenities !== undefined) dbUpdate.amenities = updatedData.amenities;
    if (updatedData.rules !== undefined) dbUpdate.rules = updatedData.rules;

    const { data, error } = await supabase.from('booths').update(dbUpdate).eq('id', boothId).select().single();
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
    const { data: rawShop } = await supabase
        .from('shops')
        .select('location')
        .eq('id', bookingData.shopId)
        .single();
    
    const bookingWithCity = { ...data, city: rawShop?.location || 'Unknown' };
    return adaptBooking(bookingWithCity, []);
};

export const createClientBookingRequest = async (requestData: any): Promise<ClientBookingRequest> => {
    const supabase = getSupabase();
    
    // Harden the payload to ensure undefined values are sent as null.
    const rpcParams = {
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
        p_budget: requestData.budget ?? null,
        p_reference_image_urls: requestData.referenceImageUrls ?? [],
        p_preferred_time: requestData.preferredTime ?? null,
        p_client_id: requestData.clientId ?? null,
        p_guest_name: requestData.guestName ?? null,
        p_guest_email: requestData.guestEmail ?? null,
        p_guest_phone: requestData.guestPhone ?? null
    };

    const { data, error } = await supabase.rpc('create_booking_request', rpcParams);

    if (error) {
        console.error("RPC Error createClientBookingRequest:", error);
        throw error;
    }
    return adaptClientBookingRequest(data);
};

export const uploadBookingReferenceImage = async (requestId: string, file: File, index: number): Promise<string> => {
    const supabase = getSupabase();
    const fileExt = file.name.split('.').pop();
    const fileName = `${requestId}/ref_${index}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('booking-references').upload(fileName, file);
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('booking-references').getPublicUrl(fileName);
    return data.publicUrl;
};

export const updateClientBookingRequest = async (requestId: string, updates: Partial<ClientBookingRequest>) => {
    const supabase = getSupabase();
    const dbUpdates: any = {};
    if (updates.referenceImageUrls) dbUpdates.reference_image_urls = updates.referenceImageUrls;

    const { data, error } = await supabase
        .from('client_booking_requests')
        .update(dbUpdates)
        .eq('id', requestId)
        .select(`
            *,
            client:profiles!client_booking_requests_client_id_fkey(id, full_name),
            artist:profiles!client_booking_requests_artist_id_fkey(id, full_name, services)
        `)
        .single();

    if (error) throw error;
    return adaptClientBookingRequest(data);
}

export const updateClientBookingRequestStatus = async (requestId: string, status: string, paymentStatus?: string) => {
    const supabase = getSupabase();
    const updatePayload: any = { status };
    if (paymentStatus) updatePayload.payment_status = paymentStatus;

    const { error } = await supabase.from('client_booking_requests').update(updatePayload).eq('id', requestId);
    if (error) throw error;
};

export const rescheduleClientBooking = async (requestId: string, newDate: string, newTime: string) => {
    const supabase = getSupabase();
    
    const { error } = await supabase
        .from('client_booking_requests')
        .update({ 
            status: 'rescheduled',
            start_date: newDate,
            end_date: newDate,
            preferred_time: newTime,
            updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

    if (error) {
        console.error("Reschedule Error:", error);
        throw error;
    }
};

export const payClientBookingDeposit = async (requestId: string) => {
    const supabase = getSupabase();
    // In production, this would call a Stripe Edge Function.
    // For now, we simulate success by updating the DB.
    const { data, error } = await supabase
        .from('client_booking_requests')
        .update({ 
            payment_status: 'paid',
            deposit_paid_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select(`
            *,
            client:profiles!client_booking_requests_client_id_fkey(id, full_name),
            artist:profiles!client_booking_requests_artist_id_fkey(id, full_name, services)
        `)
        .single();

    if (error) throw error;
    return adaptClientBookingRequest(data);
};

export const fetchNotificationsForUser = async (userId: string): Promise<Notification[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(adaptNotification);
};

export const markUserNotificationsAsRead = async (userId: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
    if (error) throw error;
};

export const createNotification = async (userId: string, message: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('notifications').insert({ user_id: userId, message });
    if (error) console.error("Failed to create notification", error);
};

export const fetchUserConversations = async (userId: string): Promise<ConversationWithUser[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_my_conversations_v2', { p_user_id: userId });
    
    if (error) {
        console.error("RPC Error fetching conversations:", error);
        return [];
    }
    
    return (data || []).map((c: any) => ({
        id: c.id,
        participantOneId: c.participantOneId,
        participantTwoId: c.participantTwoId,
        otherUser: c.otherUser
    }));
};

export const fetchMessagesForConversation = async (conversationId: string): Promise<Message[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_messages', { p_conversation_id: conversationId });
    if (error) throw error;
    return data.map(adaptMessage);
};

export const sendMessage = async (conversationId: string, senderId: string, content: string, attachmentUrl?: string): Promise<Message> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('send_message', {
        p_conversation_id: conversationId,
        p_content: content || null,
        p_attachment_url: attachmentUrl || null
    });
    if (error) throw error;
    return adaptMessage(data);
};

export const sendSystemMessage = async (conversationId: string, senderId: string, content: string): Promise<Message> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('send_message', {
        p_conversation_id: conversationId,
        p_content: content,
        p_attachment_url: null
    });
    if (error) throw error;
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
}

export const findOrCreateConversation = async (currentUserId: string, otherUserId: string): Promise<Conversation> => {
    const supabase = getSupabase();
    
    const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .or(`and(participant_one_id.eq.${currentUserId},participant_two_id.eq.${otherUserId}),and(participant_one_id.eq.${otherUserId},participant_two_id.eq.${currentUserId})`)
        .maybeSingle();

    if (existing) return { id: existing.id, participantOneId: existing.participant_one_id, participantTwoId: existing.participant_two_id };

    const { data: newConvo, error: createError } = await supabase
        .from('conversations')
        .insert({ participant_one_id: currentUserId, participant_two_id: otherUserId })
        .select()
        .single();
    
    if (createError) throw createError;
    return { id: newConvo.id, participantOneId: newConvo.participant_one_id, participantTwoId: newConvo.participant_two_id };
};

export const setArtistAvailability = async (artistId: string, date: string, status: 'available' | 'unavailable'): Promise<ArtistAvailability> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('artist_availability')
        .upsert({ artist_id: artistId, date, status }, { onConflict: 'artist_id,date' })
        .select()
        .single();
    
    if (error) throw error;
    return adaptAvailability(data);
}

export const submitReview = async (requestId: string, rating: number, text: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('client_booking_requests')
        .update({ 
            review_rating: rating, 
            review_text: text, 
            review_submitted_at: new Date().toISOString() 
        })
        .eq('id', requestId)
        .select(`
            *,
            client:profiles!client_booking_requests_client_id_fkey(id, full_name),
            artist:profiles!client_booking_requests_artist_id_fkey(id, full_name, services)
        `)
        .single();
    if (error) throw error;
    return adaptClientBookingRequest(data);
}

export const createShop = async (shopData: any, ownerId: string): Promise<Shop> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('shops').insert({ ...shopData, owner_id: ownerId }).select().single();
    if (error) throw error;
    return adaptShop(data);
}

export const createVerificationRequest = async (type: 'artist' | 'shop', id: string, userId: string) => {
    const supabase = getSupabase();
    const payload: any = { type, status: 'pending' };
    if (type === 'artist') payload.profile_id = id; 
    else payload.shop_id = id; 

    const { error } = await supabase.from('verification_requests').insert(payload);
    if (error) throw error;
}

export const updateVerificationRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('verification_requests').update({ status }).eq('id', requestId).select().single();
    if (error) throw error;
    
    const req = adaptVerificationRequest(data);
    if (status === 'approved') {
        if (req.type === 'artist' && req.profileId) {
            await supabase.from('profiles').update({ is_verified: true }).eq('id', req.profileId);
        } else if (req.type === 'shop' && req.shopId) {
            await supabase.from('shops').update({ is_verified: true }).eq('id', req.shopId);
        }
    }
    return req;
}

export const addReviewToShop = async (shopId: string, review: Omit<Review, 'id'>) => {
    const supabase = getSupabase();
    const { data: shop, error: fetchError } = await supabase.from('shops').select('reviews').eq('id', shopId).single();
    if (fetchError) throw fetchError;
    
    const currentReviews = shop.reviews || [];
    const newReviews = [...currentReviews, review];
    
    const totalRating = newReviews.reduce((acc: number, r: any) => acc + r.rating, 0);
    const avgRating = totalRating / newReviews.length;

    const { data: updatedShop, error: updateError } = await supabase
        .from('shops')
        .update({ reviews: newReviews, average_artist_rating: avgRating })
        .eq('id', shopId)
        .select()
        .single();
        
    if (updateError) throw updateError;
    return adaptShop(updatedShop);
}

export const deleteUserAsAdmin = async (userId: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
}

export const deleteShopAsAdmin = async (shopId: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('shops').delete().eq('id', shopId);
    if (error) throw error;
}

export const adminUpdateUserProfile = async (userId: string, data: { name: string, role: UserRole, isVerified: boolean }) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('profiles').update({ 
        full_name: data.name, 
        role: data.role, 
        is_verified: data.isVerified 
    }).eq('id', userId);
    if (error) throw error;
}

export const adminUpdateShopDetails = async (shopId: string, data: { name: string, isVerified: boolean }) => {
    const supabase = getSupabase();
    const { data: updatedShop, error } = await supabase.from('shops').update({
        name: data.name,
        is_verified: data.isVerified
    }).eq('id', shopId).select().single();
    if (error) throw error;
    return adaptShop(updatedShop);
}

export const createReport = async (reportData: { reporterId: string, targetId: string, type: 'user' | 'booking', reason: string }) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('reports').insert({
        reporter_id: reportData.reporterId,
        target_id: reportData.targetId,
        type: reportData.type,
        reason: reportData.reason,
        status: 'pending'
    });
    if (error) throw error;
}

export const resolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    const supabase = getSupabase();
    const { error } = await supabase.from('reports').update({ status }).eq('id', reportId);
    if (error) throw error;
}