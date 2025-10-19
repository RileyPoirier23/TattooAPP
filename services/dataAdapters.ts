// @/services/dataAdapters.ts

import type { Artist, Shop, Booth, Booking, ClientBookingRequest, Notification, User, UserRole, Client, ShopOwner, Admin, Conversation, Message, ConversationWithUser, ArtistAvailability, Review, VerificationRequest, AdminUser } from '../types';

/**
 * Safely extracts a property from a Supabase joined table result,
 * which can be null, a single object, or an array containing a single object.
 */
function getJoinedProperty<T extends object>(
  joinedData: unknown,
  property: keyof T
): T[keyof T] | undefined {
  if (!joinedData) return undefined;
  const data = Array.isArray(joinedData) ? joinedData[0] : joinedData;
  if (typeof data === 'object' && data !== null && property in data) {
    return (data as T)[property];
  }
  return undefined;
}


// --- Profile/User Adapters ---

export const adaptProfileToArtist = (profile: any): Artist => ({
  id: profile.id,
  name: profile.full_name,
  specialty: profile.specialty || 'Not specified',
  portfolio: profile.portfolio || [],
  city: profile.city || 'Unknown',
  bio: profile.bio || '',
  isVerified: profile.is_verified || false,
  socials: profile.socials || {},
  hourlyRate: profile.hourly_rate,
  averageRating: 0, // This is calculated dynamically in the store
});

export const adaptProfileToClient = (profile: any): Client => ({
  id: profile.id,
  name: profile.full_name,
});

export const adaptProfileToShopOwner = (profile: any, shopId: string | null = null): ShopOwner => ({
  id: profile.id,
  name: profile.full_name,
  shopId: shopId,
});

export const adaptSupabaseProfileToUser = (profile: any, shopId?: string | null): User | null => {
    if (!profile) return null;
    const baseUser = {
        id: profile.id,
        email: profile.username,
        type: profile.role as UserRole,
    };

    switch (profile.role) {
        case 'artist':
            return { ...baseUser, type: 'artist', data: adaptProfileToArtist(profile) };
        case 'dual':
            return { ...baseUser, type: 'dual', data: adaptProfileToArtist(profile) };
        case 'client':
            return { ...baseUser, type: 'client', data: adaptProfileToClient(profile) };
        case 'shop-owner':
            return { ...baseUser, type: 'shop-owner', data: adaptProfileToShopOwner(profile, shopId ?? null) };
        case 'admin':
             return { id: 'admin-dev', email: '__admin__', type: 'admin', data: { name: 'Admin' } };
        default:
            console.warn(`Unknown user role encountered during adaptation: ${profile.role}`);
            return null;
    }
}


// --- Data Model Adapters ---
export const adaptShop = (shop: any): Shop => ({
  id: shop.id,
  name: shop.name,
  location: shop.location,
  address: shop.address,
  lat: shop.lat,
  lng: shop.lng,
  amenities: shop.amenities || [],
  rating: shop.rating || 0,
  imageUrl: shop.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(shop.name)}&background=1A1A1D&color=F04E98`,
  paymentMethods: shop.payment_methods || {},
  reviews: shop.reviews || [],
  isVerified: shop.is_verified || false,
  ownerId: shop.owner_id,
  averageArtistRating: shop.average_artist_rating || 0
});

export const adaptBooth = (booth: any): Booth => ({
    id: booth.id,
    shopId: booth.shop_id,
    name: booth.name,
    dailyRate: booth.daily_rate,
    photos: booth.photos || [],
    amenities: booth.amenities || [],
    rules: booth.rules || '',
});

export const adaptBooking = (booking: any, shops: Shop[]): Booking => ({
  id: booking.id,
  artistId: booking.artist_id,
  boothId: booking.booth_id,
  shopId: booking.shop_id,
  city: shops.find(s => s.id === booking.shop_id)?.location || 'Unknown City',
  startDate: booking.start_date,
  endDate: booking.end_date,
  paymentStatus: booking.payment_status,
  totalAmount: booking.total_amount,
  platformFee: booking.platform_fee,
  paymentIntentId: booking.payment_intent_id
});

export const adaptClientBookingRequest = (b: any): ClientBookingRequest => ({
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
  clientName: getJoinedProperty<{ full_name: string }>(b.client, 'full_name') || 'Unknown Client',
  artistName: getJoinedProperty<{ full_name: string }>(b.artist, 'full_name') || 'Unknown Artist',
  reviewRating: b.review_rating,
  reviewText: b.review_text,
  reviewSubmittedAt: b.review_submitted_at,
  depositAmount: b.deposit_amount,
  platformFee: b.platform_fee,
  paymentIntentId: b.payment_intent_id
});

export const adaptNotification = (n: any): Notification => ({
    id: n.id,
    userId: n.user_id,
    message: n.message,
    read: n.read,
    createdAt: n.created_at
});

export const adaptAvailability = (a: any): ArtistAvailability => ({
    id: a.id,
    artistId: a.artist_id,
    date: a.date,
    status: a.status,
});

export const adaptVerificationRequest = (v: any): VerificationRequest => ({
  id: v.id,
  profileId: v.profile_id,
  shopId: v.shop_id,
  type: v.type,
  status: v.status,
  createdAt: v.created_at,
  // The requester is always the 'profile' associated with the request.
  requesterName: getJoinedProperty<{ full_name: string }>(v.profile, 'full_name') || 'Unknown Requester',
  // The item name depends on whether it's an artist or shop verification.
  itemName: v.type === 'artist' 
    ? getJoinedProperty<{ full_name: string }>(v.profile, 'full_name') || 'Unnamed Artist'
    : getJoinedProperty<{ name: string }>(v.shop, 'name') || 'Unnamed Shop',
});

export const adaptReviewFromBooking = (r: any): Review | null => {
    const authorName = getJoinedProperty<{ full_name: string }>(r.client, 'full_name');
    const authorId = getJoinedProperty<{ id: string }>(r.client, 'id');
    if (!authorId || !authorName || !r.review_rating) return null;
    return {
        id: r.id,
        authorId: authorId,
        authorName: authorName,
        rating: r.review_rating,
        text: r.review_text,
        createdAt: r.review_submitted_at
    };
};

export const adaptConversation = (c: any, userId: string, profilesMap: Map<string, {id: string, full_name: string}>): ConversationWithUser => {
    const otherUserId = c.participant_one_id === userId ? c.participant_two_id : c.participant_one_id;
    const otherUser = profilesMap.get(otherUserId);
    return { 
        id: c.id, 
        participantOneId: c.participant_one_id, 
        participantTwoId: c.participant_two_id, 
        otherUser: { id: otherUserId, name: otherUser?.full_name || 'Unknown User' } 
    };
};

export const adaptMessage = (m: any): Message => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    content: m.content,
    attachmentUrl: m.attachment_url,
    createdAt: m.created_at
});
