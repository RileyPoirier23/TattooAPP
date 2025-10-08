// @/types.ts

// --- DATA MODELS ---

export interface Artist {
  id: string;
  name: string;
  specialty: string;
  portfolio: string[];
  city: string;
  bio: string;
}

export interface Review {
  author: string;
  rating: number; // e.g., 4.5
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
}

export interface MockData {
  artists: Artist[];
  shops: Shop[];
  booths: Booth[];
  bookings: Booking[];
}


// --- APP STATE & NAVIGATION ---

export type ViewMode = 'artist' | 'client';
export type Page = 'search' | 'profile' | 'dashboard';


// --- USER & AUTHENTICATION ---

export type UserRole = 'artist' | 'client' | 'shop-owner';

interface BaseUser {
    id: string;
    username: string;
    password; // In a real app, this would not be stored on the user object client-side
    type: UserRole;
}
export interface ArtistUser extends BaseUser {
    type: 'artist';
    data: Artist;
}
export interface ClientUser extends BaseUser {
    type: 'client';
    data: { name: string };
}
export interface ShopOwnerUser extends BaseUser {
    type: 'shop-owner';
    data: { id: string; name: string; shopId: string | null };
}

export type User = ArtistUser | ClientUser | ShopOwnerUser;

export interface AuthCredentials {
    username: string;
    password;
}

export interface RegisterDetails extends AuthCredentials {
    type: UserRole;
    name: string;
    city: string; // Only for artists
}
