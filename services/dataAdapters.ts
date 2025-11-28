
// @/services/dataAdapters.ts

import type { Artist, Shop, Booth, Booking, ClientBookingRequest, Notification, User, UserRole, Client, ShopOwner, Admin, Conversation, Message, ConversationWithUser, ArtistAvailability, Review, VerificationRequest, AdminUser, ArtistService } from '../types';

/**
 * Safely extracts a property from a Supabase joined table result.
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

export const adaptProfileToArtist = (profile: any): Artist => {
  let hours = {};
  if (profile.hours) {
      if (typeof profile.hours === 'string') {
          try {
              hours = JSON.parse(profile.hours);
          } catch (e) {
              console.error("Failed to parse hours JSON:", e);
          }
      } else {
          hours = profile.hours;
      }
  }

  return {
    id: profile.id,
    name: profile.full_name,
    specialty: profile.specialty || 'Not specified',
    portfolio: profile.portfolio || [],
    city: profile.city || 'Unknown',
    bio: profile.bio || '',
    isVerified: profile.is_verified || false,
    socials: profile.socials || {},
    hourlyRate: profile.hourly_rate,
    services: profile.services || [],
    aftercareMessage: profile.aftercare_message || '',
    requestHealedPhoto: profile.request_healed_photo || false,
    averageRating: 0, // Calculated in store
    hours: hours,
    intakeSettings: profile.intake_settings,
    bookingMode: profile.booking_mode || 'time_range'
  };
};

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
            const adminUser: AdminUser = {
                id: 'admin-dev',
                email: '__admin__',
                type: 'admin',
                data: { name: 'Admin' }
            };
            return adminUser;
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
});

export const adaptClientBookingRequest = (b: any): ClientBookingRequest => {
  // Use optional chaining and nullish coalescing to safely extract nested properties
  // even if the joined data is null or structured unexpectedly.
  const artistData = b.artist || {};
  const clientData = b.client || {};

  // Handle artist services - fallback to empty array if missing
  const artistServices = artistData.services || 
                         getJoinedProperty<{ services: ArtistService[] }>(b.artist, 'services') || [];
  
  const service = artistServices.find((s: any) => s.id === b.service_id);

  // Display Name Priority:
  // 1. Joined Profile Name (from client table)
  // 2. Guest Name (from booking table)
  // 3. Fallback
  const clientProfileName = clientData.full_name || 
                            getJoinedProperty<{ full_name: string }>(b.client, 'full_name');
  
  const displayName = clientProfileName || (b.guest_name ? `${b.guest_name} (Guest)` : 'Unknown Client');

  const artistName = artistData.full_name ||
                     getJoinedProperty<{ full_name: string }>(b.artist, 'full_name') || 'Unknown Artist';

  // Robustly resolve Client ID
  // In some RPC returns, client_id might be top-level, or nested inside 'client'
  const clientId = b.client_id || clientData.id || null;

  return {
    id: b.id,
    clientId: clientId, 
    artistId: b.artist_id,
    startDate: b.start_date,
    endDate: b.end_date,
    message: b.message,
    status: b.status,
    tattooWidth: b.tattoo_width,
    tattooHeight: b.tattoo_height,
    bodyPlacement: b.body_placement,
    paymentStatus: b.payment_status,
    clientName: displayName,
    artistName: artistName,
    reviewRating: b.review_rating,
    reviewText: b.review_text,
    reviewSubmittedAt: b.review_submitted_at,
    depositAmount: b.deposit_amount,
    depositPaidAt: b.deposit_paid_at,
    platformFee: b.platform_fee,
    serviceId: b.service_id,
    serviceName: service?.name || 'Custom Session',
    budget: b.budget,
    referenceImageUrls: b.reference_image_urls || [],
    guestName: b.guest_name,
    guestEmail: b.guest_email,
    guestPhone: b.guest_phone,
    preferredTime: b.preferred_time
  };
};

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
  requesterName: v.profile?.full_name,
  itemName: v.type === 'artist' ? v.profile?.full_name : v.shop?.name,
});

export const adaptReviewFromBooking = (b: any): Review | null => {
    if (!b.review_rating || !b.client) return null;
    return {
        id: b.id,
        authorId: getJoinedProperty<{id: string}>(b.client, 'id') || 'unknown',
        authorName: getJoinedProperty<{full_name: string}>(b.client, 'full_name') || 'Anonymous',
        rating: b.review_rating,
        text: b.review_text,
        createdAt: b.review_submitted_at
    };
};

export const adaptConversation = (c: any, currentUserId: string, profilesMap: Map<string, { id: string; full_name: string }>): ConversationWithUser => {
    const otherParticipantId = c.participant_one_id === currentUserId ? c.participant_two_id : c.participant_one_id;
    const otherUser = profilesMap.get(otherParticipantId) || { id: otherParticipantId, full_name: 'Unknown User' };

    return {
        id: c.id,
        participantOneId: c.participant_one_id,
        participantTwoId: c.participant_two_id,
        otherUser: {
            id: otherUser.id,
            name: otherUser.full_name
        }
    };
};

export const adaptMessage = (m: any): Message => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    content: m.content,
    attachmentUrl: m.attachment_url,
    createdAt: m.created_at,
});
