// @/components/views/MyBookingsView.tsx

import React from 'react';
import type { User, Booking, ClientBookingRequest, Shop, Artist } from '../../types';
import { CalendarIcon, PriceIcon, LocationIcon } from '../shared/Icons';

interface MyBookingsViewProps {
  user: User;
  artistBookings: Booking[];
  clientBookings: ClientBookingRequest[];
  shops: Shop[];
  artists: Artist[];
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
        default:
            return 'bg-gray-500/20 text-gray-400';
    }
};

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({ user, artistBookings, clientBookings, shops, artists }) => {

  const canViewArtistBookings = user.type === 'artist' || user.type === 'dual';
  const canViewClientBookings = user.type === 'client' || user.type === 'dual';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-4xl font-bold text-white">My Bookings</h1>

      {canViewArtistBookings && (
        <section>
          <h2 className="text-2xl font-semibold text-brand-primary mb-4">Booth Bookings</h2>
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
                        <button className="text-sm bg-brand-secondary text-white font-semibold py-2 px-4 rounded-lg hover:bg-opacity-80">
                            Manage
                        </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-brand-gray">You have not booked any booths yet.</p>
            )}
          </div>
        </section>
      )}

      {canViewClientBookings && (
        <section>
          <h2 className="text-2xl font-semibold text-brand-secondary mb-4">Tattoo Appointments</h2>
           <div className="space-y-4">
            {clientBookings.length > 0 ? (
              clientBookings.map(booking => {
                const artist = artists.find(a => a.id === booking.artistId);
                return (
                  <div key={booking.id} className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg text-white">Appointment with {artist?.name || 'Unknown Artist'}</h3>
                      <div className="flex items-center text-sm text-brand-gray mt-1">
                         <CalendarIcon className="w-4 h-4 mr-2" /> Requested for: {new Date(booking.startDate).toLocaleDateString()}
                      </div>
                      <p className="text-sm text-brand-gray mt-2 italic">"{booking.message}"</p>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusChip(booking.status)}`}>
                            {booking.status}
                        </span>
                        <button className="text-sm bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-600">
                            View Details
                        </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-brand-gray">You have not requested any appointments yet.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
