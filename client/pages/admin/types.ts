// Response shapes of the admin API (see server/routes/admin.ts).
import type { PayoutMethod, Role, SiteSettings } from '../../../shared/types';

export interface AdminStats {
  usersByRole: Record<string, number>;
  totalUsers: number;
  newUsers30: number;
  shops: number;
  bookingRequests: Record<string, number>;
  upcomingBoothRentals: number;
  grossCents: number;
  feesCents: number;
  gross30Cents: number;
  fees30Cents: number;
  owedCents: number;
  pendingVerifications: number;
  pendingReports: number;
  newContactMessages: number;
  policiesCustomized: boolean;
  environment: 'sandbox' | 'production';
  monthly: { month: string; gross: number; fees: number }[];
  currency: string;
  paymentsReady: boolean;
  emailReady: boolean;
}

export interface MaskedSecrets {
  squareAccessTokenSet: boolean;
  squareAccessTokenFromEnv: boolean;
  squareConfigFromEnv: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassSet: boolean;
  smtpFrom: string;
  smtpFromEnv: boolean;
  resendApiKeySet: boolean;
  resendFromEnv: boolean;
}

export interface SettingsResponse {
  settings: SiteSettings;
  secrets: MaskedSecrets;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  city: string;
  status: 'active' | 'suspended';
  isVerified: boolean;
  subscriptionTier: 'free' | 'pro';
  proUntil: string | null;
  proAutoRenew: boolean;
  payoutMethod: PayoutMethod;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
}

export interface AdminShop {
  id: string;
  name: string;
  city: string;
  address: string;
  isVerified: boolean;
  averageRating: number;
  reviewCount: number;
  boothCount: number;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
}

export type PaymentKind = 'deposit' | 'booth' | 'subscription';

export interface AdminPayment {
  id: string;
  kind: PaymentKind;
  refId: string;
  description: string;
  payerName: string | null;
  payerEmail: string | null;
  payeeId: string | null;
  payeeName: string | null;
  amountCents: number;
  feeCents: number;
  payeeAmountCents: number;
  currency: string;
  squarePaymentId: string | null;
  receiptUrl: string | null;
  status: 'completed' | 'refunded';
  refundedAt: string | null;
  createdAt: string;
}

export interface PayoutRow {
  payee: { id: string; name: string; email: string; role: Role; payoutMethod: PayoutMethod };
  earnedCents: number;
  paidOutCents: number;
  balanceCents: number;
  onHoldCents: number;
}

export interface Verification {
  id: string;
  type: 'artist' | 'shop';
  userId: string;
  userName: string;
  userEmail: string;
  shopId: string | null;
  shopName: string | null;
  status: 'pending' | 'approved' | 'rejected';
  note: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface AdminReport {
  id: string;
  reporterName: string;
  reporterEmail: string | null;
  targetType: string;
  targetId: string;
  target: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  adminNote: string;
  createdAt: string;
}

export interface AdminReview {
  id: string;
  type: 'artist' | 'shop';
  rating: number;
  text: string;
  author: string | null;
  subject: string;
  hidden: boolean;
  createdAt: string;
}

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  deposit: 'Booking deposit',
  booth: 'Booth rental',
  subscription: 'Pro subscription',
};

export const PAYOUT_TYPE_LABELS: Record<string, string> = {
  etransfer: 'e-Transfer',
  paypal: 'PayPal',
  bank: 'Bank transfer',
  other: 'Other',
};
