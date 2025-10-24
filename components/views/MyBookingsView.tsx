// @/components/views/MyBookingsView.tsx

import React, { useState } from 'react';
import type { User, Booking, ClientBookingRequest, Shop } from '../../types';
import { CalendarIcon, LocationIcon, StarIcon } from '../shared/Icons';

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

const BookingSection: React.FC<{ title: string; children: React.ReactNode; count: number; }> = ({ title, children, count }) => (
    <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
        <h2 className="text-2xl font-bold text-brand-dark dark:text-white mb-4 flex items-center gap-2">
            {title}
            {count > 0 && <span className="bg-brand-primary/20 text-brand-primary text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full">{count}</span>}
        </h2>
        <div className="space-y-4">{children}</div>
    </div>
);


const ArtistBookings: React.FC<Pick<MyBookingsViewProps, 'artistBookings' | 'shops' | 'onLeaveShopReview'>> = ({ artistBookings, shops, onLeaveShopReview }) => {
    const upcomingBookings = artistBookings.filter(b => new Date(b.endDate) >= new Date());
    const pastBookings = artistBookings.filter(b => new Date(b.endDate) < new Date());

    return (
        <div className="space-y-8">
            <BookingSection title="Upcoming Guest Spots" count={upcomingBookings.length}>
                {upcomingBookings.length > 0 ? upcomingBookings.map(booking => {
                    const shop = shops.find(s => s.id === booking.shopId);
                    return (
                        <div key={booking.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-brand-dark dark:text-white">{shop?.name}</p>
                                    <p className="text-sm text-brand-gray flex items-center mt-1"><LocationIcon className="w-4 h-4 mr-1.5"/>{shop?.location}</p>
                                    <p className="text-sm text-brand-gray flex items-center mt-1"><CalendarIcon className="w-4 h-4 mr-1.5"/>{new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}</p>
                                </div>
                                <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusChip(booking.paymentStatus)}`}>{booking.paymentStatus}</span>
                            </div>
                        </div>
                    );
                }) : <p className="text-brand-gray">No upcoming guest spots scheduled.</p>}
            </BookingSection>
            <BookingSection title="Past Guest Spots" count={pastBookings.length}>
                {pastBookings.length > 0 ? pastBookings.map(booking => {
                    const shop = shops.find(s => s.id === booking.shopId);
                    const hasReviewed = shop?.reviews.some(r => r.authorId === booking.artistId);
                    return (
                        <div key={booking.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-bold text-brand-dark dark:text-white">{shop?.name}</p>
                                <p className="text-sm text-brand-gray">{new Date(booking.startDate).toLocaleDateString()}</p>
                            </div>
                            {!hasReviewed && (
                                <button onClick={() => onLeaveShopReview(booking)} className="flex items-center gap-2 bg-brand-secondary text-white text-sm font-bold py-2 px-3 rounded-lg"><StarIcon className="w-4 h-4"/> Leave Shop Review</button>
                            )}
                        </div>
                    );
                }) : <p className="text-brand-gray">No past guest spots.</p>}
            </BookingSection>
        </div>
    );
};

const ClientRequests: React.FC<Pick<MyBookingsViewProps, 'user' | 'allClientBookings' | 'onRespondToRequest' | 'onCompleteRequest' | 'onLeaveReview'>> = ({ user, allClientBookings, onRespondToRequest, onCompleteRequest, onLeaveReview }) => {
    const myClientRequests = allClientBookings.filter(b => (user.type === 'artist' || user.type === 'dual') ? b.artistId === user.id : b.clientId === user.id);
    const pending = myClientRequests.filter(b => b.status === 'pending');
    const upcoming = myClientRequests.filter(b => b.status === 'approved' && new Date(b.endDate) >= new Date());
    const past = myClientRequests.filter(b => b.status === 'completed' || b.status === 'declined' || (b.status === 'approved' && new Date(b.endDate) < new Date()));

    const isArtistView = user.type === 'artist' || user.type === 'dual';

    return (
        <div className="space-y-8">
            {isArtistView && (
                <BookingSection title="Pending Requests" count={pending.length}>
                    {pending.length > 0 ? pending.map(req => (
                        <div key={req.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                           <p className="font-bold text-brand-dark dark:text-white">Request from {req.clientName}</p>
                           <p className="text-sm text-brand-gray mt-1 italic">"{req.message}"</p>
                           <div className="flex gap-2 mt-4">
                                <button onClick={() => onRespondToRequest(req.id, 'approved')} className="bg-green-600 text-white text-sm font-bold py-2 px-3 rounded-lg">Approve</button>
                                <button onClick={() => onRespondToRequest(req.id, 'declined')} className="bg-red-600 text-white text-sm font-bold py-2 px-3 rounded-lg">Decline</button>
                           </div>
                        </div>
                    )) : <p className="text-brand-gray">No pending client requests.</p>}
                </BookingSection>
            )}

            <BookingSection title="Upcoming & Approved Sessions" count={upcoming.length}>
                 {upcoming.length > 0 ? upcoming.map(req => (
                    <div key={req.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-brand-dark dark:text-white">Session with {isArtistView ? req.clientName : req.artistName}</p>
                                <p className="text-sm text-brand-gray flex items-center mt-1"><CalendarIcon className="w-4 h-4 mr-1.5"/>{new Date(req.startDate).toLocaleDateString()}</p>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusChip(req.paymentStatus)}`}>{req.paymentStatus === 'unpaid' ? 'Deposit Due' : 'Deposit Paid'}</span>
                        </div>
                         {isArtistView && req.status === 'approved' && (
                            <button onClick={() => onCompleteRequest(req.id)} className="mt-4 bg-brand-secondary text-white text-sm font-bold py-2 px-3 rounded-lg">Mark as Completed</button>
                        )}
                    </div>
                 )) : <p className="text-brand-gray">No upcoming sessions.</p>}
            </BookingSection>
            
            <BookingSection title="Past Sessions & Requests" count={past.length}>
                 {past.length > 0 ? past.map(req => (
                     <div key={req.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                         <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-brand-dark dark:text-white">Session with {isArtistView ? req.clientName : req.artistName}</p>
                                <p className="text-sm text-brand-gray">{new Date(req.startDate).toLocaleDateString()}</p>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusChip(req.status)}`}>{req.status}</span>
                         </div>
                         {!isArtistView && req.status === 'completed' && !req.reviewRating && (
                             <button onClick={() => onLeaveReview(req)} className="mt-4 flex items-center gap-2 bg-brand-secondary text-white text-sm font-bold py-2 px-3 rounded-lg"><StarIcon className="w-4 h-4"/> Leave a Review</button>
                         )}
                     </div>
                 )) : <p className="text-brand-gray">No past sessions.</p>}
            </BookingSection>
        </div>
    );
}

export const MyBookingsView: React.FC<MyBookingsViewProps> = (props) => {
    const { user } = props;
    const [activeTab, setActiveTab] = useState(user.type === 'dual' ? 'artist' : (user.type === 'artist' ? 'artist' : 'client'));

    const renderContent = () => {
        if (activeTab === 'artist') {
            return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <ArtistBookings {...props} />
                    <ClientRequests {...props} user={{...user, type: 'artist'}} />
                </div>
            );
        }
        if (activeTab === 'client') {
            return <ClientRequests {...props} />;
        }
        return null;
    };
    
    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold text-brand-dark dark:text-white mb-8">My Bookings</h1>
            
            {user.type === 'dual' && (
                <div className="mb-8 flex items-center border-b border-gray-200 dark:border-gray-800">
                    <button onClick={() => setActiveTab('artist')} className={`px-4 py-2 font-semibold ${activeTab === 'artist' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-brand-gray'}`}>As Artist</button>
                    <button onClick={() => setActiveTab('client')} className={`px-4 py-2 font-semibold ${activeTab === 'client' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-brand-gray'}`}>As Client</button>
                </div>
            )}

            {renderContent()}
        </div>
    );
};
