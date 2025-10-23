// @/components/views/MyBookingsView.tsx

import React from 'react';
import type { User, Booking, ClientBookingRequest, Shop } from '../../types';
import { CalendarIcon, LocationIcon, CheckBadgeIcon, CreditCardIcon, StarIcon, SearchIcon } from '../shared/Icons';
import { useRouter } from '../../hooks/useRouter';

interface MyBookingsViewProps {
  user: User;
  artistBookings: Booking[];
  allClientBookings: ClientBookingRequest[];
  shops: Shop[];
  onRespondToRequest: (requestId: string, status: 'approved' | 'declined') => void;
  onCompleteRequest: (requestId: string) => void;
  onLeaveReview: (request: ClientBookingRequest) => void;
  onLeaveShopReview: (booking: Booking) => void;
}

const getStatusChip = (status: string) => {
    switch(status) {
        case 'paid':
        case 'approved':
            return 'bg-green-500/20 text-green-400';
        case 'unpaid':
        case 'pending':
            return 'bg-yellow-500/20 text-yellow-400';
        case 'declined':
            return 'bg-red-500/20 text-red-400';
        case 'completed':
            return 'bg-blue-500/20 text-blue-400';
        default:
            return 'bg-gray-500/20 text-gray-400';
    }
};

const BookingSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
        <h2 className="text-2xl font-bold text-brand-dark dark:text-white mb-4">{title}</h2>
        <div className="space-y-4">{children}</div>
    </div>
);
