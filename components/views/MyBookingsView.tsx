
// @/components/views/MyBookingsView.tsx

import React, { useState } from 'react';
import type { User, Booking, ClientBookingRequest, Shop, ModalState } from '../../types';
import { CalendarIcon, LocationIcon, StarIcon, CreditCardIcon } from '../shared/Icons';

interface MyBookingsViewProps {
  user: User;
  artistBookings: Booking[];
  allClientBookings: ClientBookingRequest[];
  shops: Shop[];
  onRespondToRequest: (requestId: string, status: 'approved' | 'declined') => void;
  onCompleteRequest: (requestId: string, status: 'completed' | 'rescheduled' | 'no-show') => void;
  onLeaveReview: (request: ClientBookingRequest) => void;
  onLeaveShopReview: (booking: Booking) => void;
  openModal: (type: ModalState['type'], data?: any) => void;
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
        case 'no-show':
            return 'bg-red-500/20 text-red-400';
        case 'completed':
            return 'bg-blue-500/20 text-blue-400';
        case 'rescheduled':
            return 'bg-purple-500/20 text-purple-400';
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

const ClientRequests: React.FC<Pick<MyBookingsViewProps, 'user' | 'allClientBookings' | 'onRespondToRequest' | 'onCompleteRequest' | 'onLeaveReview' | 'openModal'> & { viewAs: 'artist' | 'client' }> = ({ user, allClientBookings, onRespondToRequest, onCompleteRequest, onLeaveReview, openModal, viewAs }) => {
    
    // CORE LOGIC FIX: Filter based on View Mode (Artist vs Client)
    const myClientRequests = allClientBookings.filter(b => 
        viewAs === 'artist' ? b.artistId === user.id : b.clientId === user.id
    );

    const pending = myClientRequests.filter(b => b.status === 'pending');
    const upcoming = myClientRequests.filter(b => b.status === 'approved' && new Date(b.endDate) >= new Date());
    const past = myClientRequests.filter(b => !pending.includes(b) && !upcoming.includes(b));

    const addToGoogleCalendar = (req: ClientBookingRequest) => {
        const start = new Date(req.startDate).toISOString().replace(/-|:|\.\d\d\d/g,"");
        const end = new Date(req.endDate).toISOString().replace(/-|:|\.\d\d\d/g,"");
        const title = encodeURIComponent(`Tattoo Session with ${req.artistName}`);
        const details = encodeURIComponent(`Service: ${req.serviceName}\nNotes: ${req.message}`);
        const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
        window.open(url, '_blank');
    };

    return (
        <div className="space-y-8">
            <BookingSection title="Pending Requests" count={pending.length}>
                {pending.length > 0 ? pending.map(req => (
                    <div key={req.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                       <p className="font-bold text-brand-dark dark:text-white">
                           {viewAs === 'artist' ? `Request from ${req.clientName}` : `Request to ${req.artistName}`}
                       </p>
                        <p className="font-semibold text-brand-primary text-sm">{req.serviceName}</p>
                       <p className="text-sm text-brand-gray mt-1 italic">"{req.message}"</p>
                       
                       {viewAs === 'artist' ? (
                           <div className="flex gap-2 mt-4">
                                <button onClick={() => onRespondToRequest(req.id, 'approved')} className="bg-green-600 text-white text-sm font-bold py-2 px-3 rounded-lg">Approve</button>
                                <button onClick={() => onRespondToRequest(req.id, 'declined')} className="bg-red-600 text-white text-sm font-bold py-2 px-3 rounded-lg">Decline</button>
                           </div>
                       ) : (
                           <div className="mt-4">
                               <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full">Awaiting Artist Approval</span>
                           </div>
                       )}
                    </div>
                )) : <p className="text-brand-gray">No pending requests.</p>}
            </BookingSection>

            <BookingSection title="Upcoming & Approved Sessions" count={upcoming.length}>
                 {upcoming.length > 0 ? upcoming.map(req => (
                    <div key={req.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-brand-dark dark:text-white">Session with {viewAs === 'artist' ? req.clientName : req.artistName}</p>
                                <p className="font-semibold text-brand-primary text-sm">{req.serviceName}</p>
                                <p className="text-sm text-brand-gray flex items-center mt-1"><CalendarIcon className="w-4 h-4 mr-1.5"/>{new Date(req.startDate).toLocaleDateString()}</p>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusChip(req.paymentStatus)}`}>{req.paymentStatus === 'unpaid' ? 'Deposit Due' : 'Deposit Paid'}</span>
                        </div>
                         {viewAs === 'artist' && req.status === 'approved' && (
                             <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
                                <button onClick={() => onCompleteRequest(req.id, 'completed')} className="bg-blue-600 text-white text-sm font-bold py-2 px-3 rounded-lg">Mark Completed</button>
                                <button onClick={() => onCompleteRequest(req.id, 'rescheduled')} className="bg-purple-600 text-white text-sm font-bold py-2 px-3 rounded-lg">Mark Rescheduled</button>
                                <button onClick={() => onCompleteRequest(req.id, 'no-show')} className="bg-red-600 text-white text-sm font-bold py-2 px-3 rounded-lg">Mark No-Show</button>
                            </div>
                        )}
                        {viewAs !== 'artist' && req.status === 'approved' && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                                {req.paymentStatus === 'unpaid' && (
                                    <button onClick={() => openModal('payment', req)} className="w-full bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                                        <CreditCardIcon className="w-5 h-5" />
                                        <span>Pay Deposit (${req.depositAmount})</span>
                                    </button>
                                )}
                                <button onClick={() => addToGoogleCalendar(req)} className="w-full bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-300 dark:hover:bg-gray-600">
                                    <CalendarIcon className="w-5 h-5" />
                                    <span>Add to Google Calendar</span>
                                </button>
                            </div>
                        )}
                    </div>
                 )) : <p className="text-brand-gray">No upcoming sessions.</p>}
            </BookingSection>
            
            <BookingSection title="Past Sessions & Requests" count={past.length}>
                 {past.length > 0 ? past.map(req => (
                     <div key={req.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                         <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-brand-dark dark:text-white">Session with {viewAs === 'artist' ? req.clientName : req.artistName}</p>
                                <p className="font-semibold text-brand-primary text-sm">{req.serviceName}</p>
                                <p className="text-sm text-brand-gray">{new Date(req.startDate).toLocaleDateString()}</p>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusChip(req.status)}`}>{req.status}</span>
                         </div>
                         {viewAs !== 'artist' && req.status === 'completed' && !req.reviewRating && (
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
    // Default dual users to their 'artist' dashboard, but clients/others to 'client'
    const [activeTab, setActiveTab] = useState<'artist' | 'client'>(
        user.type === 'artist' || user.type === 'dual' ? 'artist' : 'client'
    );

    const renderContent = () => {
        if (activeTab === 'artist') {
            return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <ArtistBookings {...props} />
                    <ClientRequests {...props} viewAs="artist" />
                </div>
            );
        }
        if (activeTab === 'client') {
            return <ClientRequests {...props} viewAs="client" />;
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
