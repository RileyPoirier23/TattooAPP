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

const EmptyState: React.FC<{ message: string; ctaText: string; ctaLink: string; }> = ({ message, ctaText, ctaLink }) => {
    const { navigate } = useRouter();
    return (
        <div className="text-center bg-gray-900/50 border border-dashed border-gray-700 p-8 rounded-lg">
            <p className="text-brand-gray mb-4">{message}</p>
            <button
                onClick={() => navigate(ctaLink)}
                className="inline-flex items-center gap-2 bg-brand-secondary hover:bg-opacity-80 text-white font-bold py-2 px-4 rounded-full transition-colors"
            >
                <SearchIcon className="w-5 h-5" />
                <span>{ctaText}</span>
            </button>
        </div>
    );
};

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({ user, artistBookings, allClientBookings, shops, onRespondToRequest, onCompleteRequest, onLeaveReview, onLeaveShopReview }) => {

  const canViewArtistBookings = user.type === 'artist' || user.type === 'dual';
  const canViewClientBookings = user.type === 'client' || user.type === 'dual';
  
  const mySentClientBookings = allClientBookings.filter(b => b.clientId === user.id);
  const myReceivedClientBookings = allClientBookings.filter(b => b.artistId === user.id);

  const hasCompletedBoothBookings = (booking: Booking) => {
      // An artist can review a shop after their booking period is over, regardless of payment status.
      return new Date(booking.endDate) < new Date();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-4xl font-bold text-white">My Bookings</h1>

      {canViewArtistBookings && (
        <>
            <section>
                <h2 className="text-2xl font-semibold text-brand-secondary mb-4">Client Booking Requests</h2>
                <div className="space-y-4">
                    {myReceivedClientBookings.length > 0 ? (
                        myReceivedClientBookings.map(booking => (
                            <div key={booking.id} className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-white">Request from {booking.clientName}</h3>
                                        <div className="flex items-center text-sm text-brand-gray mt-1">
                                            <CalendarIcon className="w-4 h-4 mr-2" /> Requested for: {new Date(booking.startDate).toLocaleDateString()}
                                        </div>
                                        <p className="text-sm text-brand-gray mt-2 italic">"{booking.message}"</p>
                                    </div>
                                    <div className="flex items-center gap-4 self-end md:self-center">
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusChip(booking.status)}`}>
                                            {booking.status}
                                        </span>
                                        {booking.status === 'pending' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => onRespondToRequest(booking.id, 'approved')} className="text-sm bg-green-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-green-500 transition-colors">
                                                    Approve
                                                </button>
                                                <button onClick={() => onRespondToRequest(booking.id, 'declined')} className="text-sm bg-red-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-red-500 transition-colors">
                                                    Decline
                                                </button>
                                            </div>
                                        )}
                                        {booking.status === 'approved' && (
                                            <button onClick={() => onCompleteRequest(booking.id)} className="text-sm bg-blue-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2">
                                                <CheckBadgeIcon className="w-4 h-4" />
                                                Mark as Complete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <EmptyState message="You have no incoming client booking requests." ctaText="Explore Shops" ctaLink="/shops" />
                    )}
                </div>
            </section>

            <section>
            <h2 className="text-2xl font-semibold text-brand-primary mb-4">My Booth Bookings</h2>
            <div className="space-y-4">
                {artistBookings.length > 0 ? (
                artistBookings.map(booking => {
                    const shop = shops.find(s => s.id === booking.shopId);
                    return (
                    <div key={booking.id} className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                        <h3 className="font-bold text-lg text-white">{shop?.name || 'Unknown Shop'}</h3>
                        <div className="flex items-center text-sm text-brand-gray mt-1">
                            <LocationIcon className="w-4 h-4 mr-2" /> {shop?.location}
                        </div>
                        <div className="flex items-center text-sm text-brand-gray mt-1">
                            <CalendarIcon className="w-4 h-4 mr-2" /> {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                        </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusChip(booking.paymentStatus)}`}>
                                {booking.paymentStatus}
                            </span>
                            {hasCompletedBoothBookings(booking) && (
                                <button onClick={() => onLeaveShopReview(booking)} className="text-sm bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-yellow-500 flex items-center gap-2">
                                   <StarIcon className="w-4 h-4" /> Review Shop
                                </button>
                            )}
                        </div>
                    </div>
                    );
                })
                ) : (
                    <EmptyState message="You haven't booked any booths yet." ctaText="Find a Booth" ctaLink="/shops" />
                )}
            </div>
            </section>
        </>
      )}

      {canViewClientBookings && (
        <section>
          <h2 className="text-2xl font-semibold text-brand-secondary mb-4">My Tattoo Requests</h2>
           <div className="space-y-4">
            {mySentClientBookings.length > 0 ? (
              mySentClientBookings.map(booking => (
                  <div key={booking.id} className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg text-white">Request to {booking.artistName}</h3>
                      <div className="flex items-center text-sm text-brand-gray mt-1">
                         <CalendarIcon className="w-4 h-4 mr-2" /> Requested for: {new Date(booking.startDate).toLocaleDateString()}
                      </div>
                      <p className="text-sm text-brand-gray mt-2 italic">"{booking.message}"</p>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusChip(booking.status)}`}>
                            {booking.status}
                        </span>
                        {booking.status === 'completed' && !booking.reviewRating && (
                            <button onClick={() => onLeaveReview(booking)} className="text-sm bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-yellow-500">
                                Leave a Review
                            </button>
                        )}
                        {booking.status === 'completed' && booking.reviewRating && (
                            <div className="text-sm text-yellow-400 flex items-center gap-1">
                                <CheckBadgeIcon className="w-5 h-5" />
                                <span>Reviewed</span>
                            </div>
                        )}
                    </div>
                  </div>
                ))
            ) : (
              <EmptyState message="You haven't requested any appointments yet." ctaText="Find an Artist" ctaLink="/artists" />
            )}
          </div>
        </section>
      )}
    </div>
  );
};