// @/types.ts

// --- DATA MODELS ---

export interface Artist {
  id: string; // This will be the user's auth id
  name: string;
  specialty: string;
  portfolio: string[];
  city: string;
  bio: string;
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

export interface Review {
  author: string;
  rating: number; 
  text: string;
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
}

export interface Booth {
  id: string;
  shopId: string;
  name: string;
  dailyRate: number;
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
    status: 'pending' | 'approved' | 'declined';
    // New detailed fields
    tattooSize: string;
    bodyPlacement: string;
    estimatedHours: number;
    paymentStatus: 'paid' | 'unpaid';
}

export interface Notification {
    id: string;
    userId: string;
    message: string;
    read: boolean;
    createdAt: string;
}

export interface MockData {
  artists: Artist[];
  shops: Shop[];
  booths: Booth[];
  bookings: Booking[];
  clientBookingRequests: ClientBookingRequest[];
  notifications: Notification[];
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}


// --- APP STATE & NAVIGATION ---

export type ViewMode = 'artist' | 'client';
export type Page = 'search' | 'profile' | 'dashboard' | 'bookings' | 'settings' | 'messages';


// --- USER & AUTHENTICATION ---

export type UserRole = 'artist' | 'client' | 'shop-owner' | 'dual'; // Added 'dual' role

interface BaseUser {
    id: string;
    username: string;
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

export type User = ArtistUser | ClientUser | ShopOwnerUser | DualUser;

export interface AuthCredentials {
    username: string;
    password?: string; // Password is optional here
}

export interface RegisterDetails extends AuthCredentials {
    type: UserRole;
    name: string;
    city?: string; // Only for artists/dual
}
