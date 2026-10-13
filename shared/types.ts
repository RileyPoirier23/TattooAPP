// Types shared by the server (API responses) and the client.
// All money values ending in "Cents" are integer cents; service prices and booth rates are dollars.

export type Role = 'client' | 'artist' | 'dual' | 'shop-owner' | 'admin';

export interface PortfolioImage {
  url: string;
  caption?: string;
}

export interface Socials {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  website?: string;
}

export interface ArtistService {
  id: string;
  name: string;
  description?: string;
  duration: number; // hours
  price: number; // dollars (starting price)
  deposit: number; // dollars
  minSize?: number; // square inches
  maxSize?: number; // square inches
}

export interface TimeSlot {
  start: string; // "09:00"
  end: string; // "17:00"
}

/** Keys are day-of-week numbers as strings, "0" = Sunday. */
export type WeeklyHours = Record<string, TimeSlot[]>;

export interface IntakeSettings {
  requireSize: boolean;
  requirePlacement: boolean;
  requireDescription: boolean;
  requireBudget: boolean;
  requireReferenceImages: boolean;
}

export interface PayoutMethod {
  type?: 'etransfer' | 'paypal' | 'bank' | 'other';
  details?: string;
}

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
  hidden?: boolean;
}

export interface GuestSpot {
  shopId: string;
  shopName: string;
  city: string;
  startDate: string;
  endDate: string;
}

export interface PublicArtist {
  id: string;
  name: string;
  city: string;
  specialty: string;
  bio: string;
  avatarUrl: string | null;
  portfolio: PortfolioImage[];
  socials: Socials;
  services: ArtistService[];
  hours: WeeklyHours;
  intakeSettings: IntakeSettings;
  isVerified: boolean;
  isPro: boolean;
  averageRating: number;
  reviewCount: number;
  guestSpot: GuestSpot | null;
}

export interface ArtistDetail extends PublicArtist {
  reviews: Review[];
  daysOff: string[];
}

export interface Booth {
  id: string;
  shopId: string;
  name: string;
  dailyRate: number; // dollars
  description: string;
  active: boolean;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
  description: string;
  amenities: string[];
  imageUrl: string | null;
  isVerified: boolean;
  averageRating: number;
  reviewCount: number;
  booths: Booth[];
}

export interface BookedRange {
  boothId: string;
  startDate: string;
  endDate: string;
}

export interface ShopDetail extends Shop {
  reviews: Review[];
  bookedRanges: BookedRange[];
}

export interface Subscription {
  tier: 'free' | 'pro';
  isPro: boolean;
  proUntil: string | null;
  autoRenew: boolean;
  cardLabel: string | null;
}

export interface Me {
  id: string;
  email: string;
  role: Role;
  name: string;
  city: string;
  specialty: string;
  bio: string;
  avatarUrl: string | null;
  portfolio: PortfolioImage[];
  socials: Socials;
  services: ArtistService[];
  hours: WeeklyHours;
  intakeSettings: IntakeSettings;
  aftercareMessage: string;
  payoutMethod: PayoutMethod;
  isVerified: boolean;
  verificationPending: boolean;
  subscription: Subscription;
  shopId: string | null;
  daysOff: string[];
}

export type BookingStatus = 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed' | 'no-show';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type PreferredTime = 'anytime' | 'morning' | 'afternoon' | 'evening';

export interface BookingRequest {
  id: string;
  artistId: string;
  artistName: string;
  clientId: string | null;
  clientName: string;
  isGuest: boolean;
  guestEmail: string | null;
  guestPhone: string | null;
  serviceId: string | null;
  serviceName: string;
  servicePrice: number | null;
  date: string; // YYYY-MM-DD
  preferredTime: PreferredTime;
  /** Exact start time set by the artist when approving, "13:00". */
  appointmentTime: string | null;
  message: string;
  tattooWidth: number | null;
  tattooHeight: number | null;
  bodyPlacement: string;
  budget: number | null;
  referenceImages: string[];
  status: BookingStatus;
  depositCents: number;
  feeCents: number;
  paymentStatus: PaymentStatus;
  depositPaidAt: string | null;
  artistNote: string;
  archived: boolean;
  review: Review | null;
  accessToken?: string; // only sent to the client who made the request
  createdAt: string;
  updatedAt: string;
}

export type BoothBookingStatus = 'unpaid' | 'paid' | 'cancelled' | 'refunded';

export interface BoothBooking {
  id: string;
  artistId: string;
  artistName: string;
  boothId: string;
  boothName: string;
  shopId: string;
  shopName: string;
  shopCity: string;
  startDate: string;
  endDate: string;
  days: number;
  totalCents: number;
  feeCents: number;
  status: BoothBookingStatus;
  paidAt: string | null;
  holdExpiresAt: string | null;
  reviewed: boolean;
  createdAt: string;
}

export interface MyBookings {
  asClient: BookingRequest[];
  asArtist: BookingRequest[];
  boothBookings: BoothBooking[]; // booths this artist rented
  shopBookings: BoothBooking[]; // rentals at this owner's shop
}

export interface AppNotification {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface ConversationUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
}

export interface Conversation {
  id: string;
  otherUser: ConversationUser;
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  kind: 'deposit' | 'booth' | 'subscription';
  description: string;
  amountCents: number;
  status: string;
  /** Cancelled by the artist/shop/admin and waiting for a refund: not counted as earned. */
  onHold: boolean;
  createdAt: string;
}

export interface PayoutRecord {
  id: string;
  amountCents: number;
  method: string;
  note: string;
  createdAt: string;
}

export interface Earnings {
  currency: string;
  earnedCents: number;
  paidOutCents: number;
  balanceCents: number;
  onHoldCents: number;
  entries: LedgerEntry[];
  payouts: PayoutRecord[];
}

export interface SiteFeatures {
  clientBooking: boolean;
  guestBooking: boolean;
  boothRental: boolean;
  messaging: boolean;
  proPlan: boolean;
  reviews: boolean;
  unclaimedShops: boolean;
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  defaultTheme: 'dark' | 'light';
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  heroImageUrl: string;
  aboutTitle: string;
  aboutText: string;
  announcementEnabled: boolean;
  announcementText: string;
  contactEmail: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  footerText: string;
  features: SiteFeatures;
  depositFeePercent: number;
  boothFeePercent: number;
  proMonthlyPrice: number;
  defaultDeposit: number;
  currency: string;
  boothHoldHours: number;
  bodyPlacements: string[];
  specialties: string[];
  squareApplicationId: string;
  squareLocationId: string;
  squareEnvironment: 'sandbox' | 'production';
  googleMapsApiKey: string;
}

export interface SecretSettings {
  squareAccessToken: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  /** Resend (resend.com) API key — sends email over HTTPS, which works on hosts that block SMTP. */
  resendApiKey: string;
}

export interface PageSummary {
  slug: string;
  title: string;
  showInFooter: boolean;
}

export interface Page extends PageSummary {
  id: string;
  body: string;
  published: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface PublicConfig {
  settings: SiteSettings;
  pages: PageSummary[];
  paymentsReady: boolean;
  emailReady: boolean;
}

export interface GuestBookingView {
  request: BookingRequest;
  artist: { id: string; name: string; city: string; avatarUrl: string | null };
}
