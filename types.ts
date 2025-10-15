// @/types.ts

// --- DATA MODELS ---

export interface PortfolioImage {
  url: string;
  isAiGenerated: boolean;
}

export interface Socials {
  instagram?: string;
  tiktok?: string;
  x?: string; // Formerly Twitter
}

export interface Artist {
  id: string; // This will be the user's auth id
  name: string;
  specialty: string;
  portfolio: PortfolioImage[];
  city: string;
  bio: string;
  isVerified: boolean;
  socials?: Socials;
  averageRating?: number;
}

export interface Client {
    id: string; // User's auth id
    name: string;
}

export interface ShopOwner {
    id: string; // User's auth id
    name: string;
    shopId: string | null;
}

export interface Admin {
    name: string;
}

export interface Review {
  id: string; // This will be the client booking request ID
  authorId: string;
  authorName: string;
  rating: number; 
  text: string;
  createdAt: string;
}

export interface PaymentMethods {
    email?: string;
    paypal?: string;
    btc?: string;
}

export interface Shop {
  id: string;
  name:string;
  location: string;
  address: string;
  lat: number;
  lng: number;
  amenities: string[];
  rating: number;
  imageUrl: string;
  reviews: Review[];
  paymentMethods?: PaymentMethods;
  isVerified: boolean;
}

export interface Booth {
  id: string;
  shopId: string;
  name: string;
  dailyRate: number;
  photos?: string[];
  amenities?: string[];
  rules?: string;
}

export interface Booking {
  id: string;
  artistId: string;
  boothId: string;
  shopId: string;
  city: string;
  startDate: string;
  endDate: string;
  paymentStatus: 'paid' | 'unpaid';
}

export interface ClientBookingRequest {
    id: string;
    clientId: string;
    artistId: string;
    startDate: string;
    endDate: string;
    message: string;
    status: 'pending' | 'approved' | 'declined' | 'completed';
    tattooSize: string;
    bodyPlacement: string;
    estimatedHours: number;
    paymentStatus: 'paid' | 'unpaid';
    clientName?: string;
    artistName?: string;
    reviewRating?: number;
    reviewText?: string;
    reviewSubmittedAt?: string;
}

export interface Notification {
    id: string;
    userId: string;
    message: string;
    read: boolean;
    createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface Conversation {
  id:string;
  participantOneId: string;
  participantTwoId: string;
}

// Enriched conversation type for UI
export interface ConversationWithUser extends Conversation {
  otherUser: {
    id: string;
    name: string;
  };
  lastMessage?: Message;
}

export interface ArtistAvailability {
  id: string;
  artistId: string;
  date: string;
  status: 'available' | 'unavailable';
}


export interface MockData {
  artists: Artist[];
  shops: Shop[];
  booths: Booth[];
  bookings: Booking[];
  clientBookingRequests: ClientBookingRequest[];
  notifications: Notification[];
  conversations: ConversationWithUser[];
  messages: Message[];
  artistAvailability: ArtistAvailability[];
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}


// --- APP STATE & NAVIGATION ---

export type ViewMode = 'artist' | 'client';
export type Page = 'search' | 'profile' | 'dashboard' | 'bookings' | 'settings' | 'messages' | 'admin' | 'availability';

// FIX: Export ModalState to be used across multiple files.
export interface ModalState {
  type: 'auth' | 'artist-detail' | 'shop-detail' | 'booking' | 'client-booking-request' | 'upload-portfolio' | 'edit-booth' | 'leave-review' | 'image-editor' | null;
  data?: any;
}


// --- USER & AUTHENTICATION ---

export type UserRole = 'artist' | 'client' | 'shop-owner' | 'dual' | 'admin';

interface BaseUser {
    id: string;
    email: string;
    password?: string; // Should not exist on client-side after login
    type: UserRole;
}
export interface ArtistUser extends BaseUser {
    type: 'artist';
    data: Artist;
}
export interface ClientUser extends BaseUser {
    type: 'client';
    data: Client;
}
export interface ShopOwnerUser extends BaseUser {
    type: 'shop-owner';
    data: ShopOwner;
}
export interface DualUser extends BaseUser {
    type: 'dual';
    data: Artist; // A dual user's primary data is their artist profile
}
export interface AdminUser extends BaseUser {
    type: 'admin';
    data: Admin;
}

export type User = ArtistUser | ClientUser | ShopOwnerUser | DualUser | AdminUser;

export interface AuthCredentials {
    email: string;
    password?: string;
}

export interface RegisterDetails extends AuthCredentials {
    type: UserRole;
    name: string;
    city?: string; // Only for artists/dual
}