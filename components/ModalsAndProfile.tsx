// @/components/ModalsAndProfile.tsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../hooks/useAppStore';
// FIX: Imported ArtistHours type to resolve compilation error.
import type { Artist, Shop, Booking, Booth, Review, AuthCredentials, RegisterDetails, UserRole, ClientBookingRequest, Client, ModalState, PortfolioImage, ArtistAvailability, User, ArtistService, IntakeFormSettings, ArtistHours } from '../types';
import { LocationIcon, StarIcon, PriceIcon, XIcon, EditIcon, PaperAirplaneIcon, CalendarIcon, UploadIcon, CheckBadgeIcon, CreditCardIcon, InstagramIcon, TikTokIcon, XIconSocial, TrashIcon, ArrowRightIcon, ArrowLeftIcon, SparklesIcon } from './shared/Icons';
import { MapEmbed } from './shared/MapEmbed';
import { Loader } from './shared/Loader';
import { bodyPlacements } from '../data/bookingOptions';
import { generateArtistBio, suggestTattooService } from '../services/geminiService';

declare global {
    interface Window {
        Stripe?: any;
    }
}

// --- SHARED COMPONENTS ---

const StarRating: React.FC<{ rating: number; className?: string; onRate?: (rating: number) => void; isInteractive?: boolean }> = ({ rating, className = 'w-5 h-5', onRate, isInteractive = false }) => {
    const [hoverRating, setHoverRating] = useState(0);

    const handleRating = (rate: number) => { if (isInteractive && onRate) onRate(rate); };
    const handleMouseEnter = (rate: number) => { if (isInteractive) setHoverRating(rate); };
    const handleMouseLeave = () => { if (isInteractive) setHoverRating(0); };

    return (
        <div className="flex items-center">
            {[...Array(5)].map((_, i) => {
                const starValue = i + 1;
                const displayRating = hoverRating || rating;
                return (
                    <button type="button" key={i} onClick={() => handleRating(starValue)} onMouseEnter={() => handleMouseEnter(starValue)} onMouseLeave={handleMouseLeave} disabled={!isInteractive} className={className}>
                        <StarIcon className={`transition-colors ${starValue <= displayRating ? 'text-yellow-400' : 'text-gray-400 dark:text-gray-600'}`} />
                    </button>
                );
            })}
        </div>
    );
};

export const Modal: React.FC<{ children: React.ReactNode; onClose: () => void; title: string; size?: 'md' | 'lg' | 'xl'; closeDisabled?: boolean }> = ({ children, onClose, title, size = 'lg', closeDisabled = false }) => {
    const maxWidth = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
    
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !closeDisabled) {
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]" 
            aria-modal="true" 
            role="dialog"
            onClick={handleBackdropClick}
        >
            <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col transition-transform duration-200 ease-out transform scale-95 animate-[scaleUp_0.2s_ease-out_forwards]`}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-brand-dark dark:text-white">{title}</h2>
                    <button onClick={onClose} disabled={closeDisabled} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="overflow-y-auto p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const ReportModal: React.FC<{ targetId: string, type: 'user' | 'booking', onSubmit: (targetId: string, type: 'user' | 'booking', reason: string) => void, onClose: () => void }> = ({ targetId, type, onSubmit, onClose }) => {
    const [reason, setReason] = useState('');
    return (
        <Modal onClose={onClose} title={`Report ${type === 'user' ? 'User' : 'Booking'}`} size="md">
            <div className="space-y-4">
                <p className="text-sm text-brand-gray">Please describe the issue. Our team reviews all reports within 24 hours.</p>
                <textarea 
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                    rows={4} 
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 text-brand-dark dark:text-white" 
                    placeholder="Details about the incident..."
                ></textarea>
                <button onClick={() => onSubmit(targetId, type, reason)} disabled={!reason.trim()} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg disabled:bg-gray-600">Submit Report</button>
            </div>
        </Modal>
    );
};

export const RescheduleModal: React.FC<{ request: ClientBookingRequest; onConfirm: (requestId: string, status: 'rescheduled', newDate: string, newTime: string) => void; onClose: () => void }> = ({ request, onConfirm, onClose }) => {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('anytime');

    const handleConfirm = () => {
        if (!date) return;
        onConfirm(request.id, 'rescheduled', date, time);
    };

    return (
        <Modal onClose={onClose} title="Reschedule Session" size="md">
            <div className="space-y-4">
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                    <p className="text-sm text-brand-gray">Rescheduling session with</p>
                    <p className="font-bold text-brand-dark dark:text-white text-lg">{request.clientName || request.guestName}</p>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-brand-gray mb-1">New Date</label>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)} 
                        className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-brand-dark dark:text-white focus:ring-2 focus:ring-brand-secondary outline-none border border-transparent focus:border-transparent" 
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-brand-gray mb-1">New Time Preference</label>
                    <select 
                        value={time} 
                        onChange={e => setTime(e.target.value)} 
                        className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-brand-dark dark:text-white focus:ring-2 focus:ring-brand-secondary outline-none border border-transparent focus:border-transparent"
                    >
                        <option value="anytime">Anytime</option>
                        <option value="morning">Morning (9am - 12pm)</option>
                        <option value="afternoon">Afternoon (12pm - 4pm)</option>
                        <option value="evening">Evening (4pm+)</option>
                    </select>
                </div>

                <div className="flex gap-4 pt-4">
                    <button onClick={onClose} className="flex-1 bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancel</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={!date} 
                        className="flex-1 bg-purple-600 text-white font-bold py-3 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/30"
                    >
                        Confirm Change
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export const PaymentModal: React.FC<{ request: ClientBookingRequest; onProcessPayment: (requestId: string) => Promise<void>; onClose: () => void }> = ({ request, onProcessPayment, onClose }) => {
    const { data } = useAppStore();
    const [isProcessing, setIsProcessing] = useState(false);
    
    const artist = data.artists.find(a => a.id === request.artistId);
    // Fee Logic: 2.9% if free tier, 0% if pro
    const isPro = artist?.subscriptionTier === 'pro';
    const deposit = request.depositAmount || 0;
    const fee = isPro ? 0 : deposit * 0.029;
    const total = deposit + fee;

    const handlePayment = async () => {
        setIsProcessing(true);
        await onProcessPayment(request.id);
        setIsProcessing(false);
    };

    return (
        <Modal onClose={onClose} title="Confirm Deposit Payment" size="md" closeDisabled={isProcessing}>
            <div className="space-y-4">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
                    <p className="text-sm text-brand-gray">You are paying a deposit for your booking with</p>
                    <p className="font-bold text-lg text-brand-dark dark:text-white">{request.artistName}</p>
                    <p className="text-3xl font-bold text-brand-primary mt-2">${total.toFixed(2)}</p>
                    {!isPro && <p className="text-xs text-brand-gray mt-1">(Includes 2.9% platform fee)</p>}
                </div>
                
                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium text-brand-gray">Card Information</label>
                        <div className="mt-1 p-3 bg-gray-200 dark:bg-gray-800 rounded-lg text-gray-400">•••• •••• •••• 4242</div>
                    </div>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                             <label className="text-sm font-medium text-brand-gray">Expiry</label>
                             <div className="mt-1 p-3 bg-gray-200 dark:bg-gray-800 rounded-lg text-gray-400">MM / YY</div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-brand-gray">CVC</label>
                             <div className="mt-1 p-3 bg-gray-200 dark:bg-gray-800 rounded-lg text-gray-400">•••</div>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-brand-gray text-center">This is a simulated payment gateway for demonstration purposes. No real card is needed.</p>
                
                <button
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:bg-gray-600"
                >
                    {isProcessing ? <Loader size="sm" color="white" /> : <CreditCardIcon className="w-5 h-5" />}
                    <span>{isProcessing ? 'Processing...' : `Pay $${total.toFixed(2)}`}</span>
                </button>
            </div>
        </Modal>
    );
};

export const AuthModal: React.FC<{onLogin: (credentials: AuthCredentials) => void; onRegister: (details: RegisterDetails) => void; onClose: () => void;}> = ({ onLogin, onRegister, onClose }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [city, setCity] = useState('');
    const [role, setRole] = useState<UserRole>('client');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (isRegistering) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address.'); return; }
            const details: RegisterDetails = { email, password: password!, type: role, name };
            if (role === 'artist' || role === 'dual') details.city = city;
            onRegister(details);
        } else {
            onLogin({ email, password });
        }
    };
    
    const handleDevLogin = () => {
        const user = prompt("Enter dev username:");
        if (user === '__admin__') {
            const pass = prompt("Enter dev password:");
            if (pass === 'root') onLogin({ email: '__admin__', password: 'root' });
            else alert('Invalid dev credentials.');
        }
    };

    return (
        <Modal onClose={onClose} title={isRegistering ? "Create Account" : "Welcome Back"} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                {isRegistering && (
                    <>
                        <div className="mb-4">
                            <label className="text-sm font-bold text-brand-gray mb-2 block">I am a...</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['client', 'artist', 'dual', 'shop-owner'] as UserRole[]).map(r => (
                                    <button type="button" key={r} onClick={() => setRole(r)} className={`p-2 rounded-lg text-sm capitalize transition-colors ${role === r ? 'bg-brand-primary text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
                                        {r === 'dual' ? 'Artist & Client' : r.replace('-', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                           <label className="text-sm text-brand-gray" htmlFor="name">Full Name</label>
                           <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 mt-1 text-brand-dark dark:text-white"/>
                        </div>
                        {(role === 'artist' || role === 'dual') && (
                             <div>
                               <label className="text-sm text-brand-gray" htmlFor="city">Your City (e.g., Moncton, NB)</label>
                               <input id="city" type="text" value={city} onChange={e => setCity(e.target.value)} required className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 mt-1 text-brand-dark dark:text-white"/>
                            </div>
                        )}
                    </>
                )}
                <div>
                   <label className="text-sm text-brand-gray" htmlFor="email">Email</label>
                   <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 mt-1 text-brand-dark dark:text-white"/>
                </div>
                <div>
                   <label className="text-sm text-brand-gray" htmlFor="password">Password</label>
                   <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 mt-1 text-brand-dark dark:text-white"/>
                </div>

                {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                <button type="submit" className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg mt-2 hover:bg-opacity-80 transition-colors">
                    {isRegistering ? 'Sign Up' : 'Login'}
                </button>
                <div className="text-center">
                    <p className="text-sm text-brand-dark dark:text-white">
                        <span className="text-brand-gray">{isRegistering ? 'Already have an account?' : "Don't have an account?"}</span>
                        <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="font-semibold text-brand-primary ml-1 hover:underline">
                            {isRegistering ? 'Login' : 'Sign Up'}
                        </button>
                    </p>
                     <p className="text-center text-xs mt-2">
                        <button type="button" onClick={handleDevLogin} className="font-semibold text-brand-gray hover:text-brand-primary">
                            (DevLogin)
                        </button>
                    </p>
                </div>
            </form>
        </Modal>
    );
};

export const ArtistDetailModal: React.FC<{ artist: Artist; reviews: Review[]; bookings: Booking[]; shops: Shop[]; onClose: () => void; onBookRequest: () => void; showToast: (message: string, type?: 'success' | 'error') => void; onMessageClick: (artistId: string) => void; }> = ({ artist, reviews, bookings, shops, onClose, onBookRequest, onMessageClick }) => {
    const ImageCarousel: React.FC<{ images: PortfolioImage[] }> = ({ images }) => {
        const [currentIndex, setCurrentIndex] = useState(0);
        if (images.length === 0) return <div className="w-full h-96 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center text-brand-gray">No portfolio images yet.</div>
        const nextSlide = () => setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
        const prevSlide = () => setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
        return (
            <div className="relative w-full">
                <div className="w-full h-96 rounded-lg overflow-hidden relative bg-gray-200 dark:bg-gray-800">
                    <img src={`${images[currentIndex].url}?random=${currentIndex}`} alt={`Portfolio piece ${currentIndex + 1}`} className="w-full h-full object-cover transition-transform duration-500" />
                    <button onClick={prevSlide} className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/80 transition-colors"><ArrowLeftIcon className="w-6 h-6"/></button>
                    <button onClick={nextSlide} className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/80 transition-colors"><ArrowRightIcon className="w-6 h-6"/></button>
                </div>
            </div>
        );
    };

    return (
        <Modal onClose={onClose} title={artist.name} size="xl">
            <div className="space-y-6">
                <ImageCarousel images={artist.portfolio} />
                 <div>
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold text-brand-primary">{artist.specialty}</h3>
                        </div>
                        {artist.averageRating && artist.averageRating > 0 ? (
                            <div className="flex items-center gap-2">
                                <StarRating rating={artist.averageRating} />
                                <span className="font-bold text-brand-dark dark:text-white">{artist.averageRating.toFixed(1)}</span>
                                <span className="text-sm text-brand-gray">({reviews.length})</span>
                            </div>
                        ) : null}
                    </div>
                    <p className="text-gray-800 dark:text-brand-light mt-2">{artist.bio}</p>
                    {artist.socials && (
                        <div className="flex items-center gap-4 mt-4">
                            {artist.socials.instagram && <a href={artist.socials.instagram} target="_blank" rel="noopener noreferrer" className="text-brand-gray hover:text-brand-primary dark:hover:text-white" title="Instagram"><InstagramIcon className="w-6 h-6"/></a>}
                            {artist.socials.tiktok && <a href={artist.socials.tiktok} target="_blank" rel="noopener noreferrer" className="text-brand-gray hover:text-brand-primary dark:hover:text-white" title="TikTok"><TikTokIcon className="w-6 h-6"/></a>}
                            {artist.socials.x && <a href={artist.socials.x} target="_blank" rel="noopener noreferrer" className="text-brand-gray hover:text-brand-primary dark:hover:text-white" title="X (Twitter)"><XIconSocial className="w-5 h-5"/></a>}
                        </div>
                    )}
                </div>

                {artist.services && artist.services.length > 0 && (
                <div>
                    <h4 className="font-bold text-brand-dark dark:text-white mb-3">Services</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {artist.services.map((service) => (
                            <div key={service.id} className="bg-gray-100 dark:bg-gray-800/50 p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-gray-700 dark:text-gray-300">{service.name}</p>
                                    <p className="text-sm text-brand-gray">{service.duration} hours</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-brand-primary">${service.price}</p>
                                    <p className="text-xs text-brand-gray">Deposit: ${service.depositAmount}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                )}


                {reviews && reviews.length > 0 && (
                <div>
                    <h4 className="font-bold text-brand-dark dark:text-white mb-3">Client Reviews</h4>
                    <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                        {reviews.map((review) => (
                            <div key={review.id} className="bg-gray-100 dark:bg-gray-800/50 p-3 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="font-semibold text-gray-700 dark:text-gray-300">{review.authorName}</p>
                                    <StarRating rating={review.rating} className="w-4 h-4" />
                                </div>
                                <p className="text-brand-gray text-sm italic">"{review.text}"</p>
                            </div>
                        ))}
                    </div>
                </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                     <button onClick={() => onMessageClick(artist.id)} className="w-full bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2">
                        <PaperAirplaneIcon className="w-5 h-5" />
                        <span>Message Artist</span>
                    </button>
                    <button onClick={onBookRequest} className="w-full bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-80 transition-colors flex items-center justify-center space-x-2">
                        <CalendarIcon className="w-5 h-5" />
                        <span>Request Booking</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export const ShopDetailModal: React.FC<{ shop: Shop; booths: Booth[]; onClose: () => void; onBookClick: (shop: Shop) => void; }> = ({ shop, booths, onClose, onBookClick }) => {
    return (
    <Modal onClose={onClose} title={shop.name}>
        <div className="space-y-6">
            <MapEmbed lat={shop.lat} lng={shop.lng} />
            <div>
                 <div className="flex justify-between items-start">
                    <p className="flex items-center text-brand-gray"><LocationIcon className="w-4 h-4 mr-2" />{shop.address}</p>
                    <div className="flex items-center space-x-1">
                        <StarIcon className="w-5 h-5 text-yellow-400" />
                        <span className="text-brand-dark dark:text-white font-bold">{shop.averageArtistRating.toFixed(1)}</span>
                        <span className="text-sm text-brand-gray">({shop.reviews?.length || 0} reviews)</span>
                    </div>
                </div>
                <div className="mt-4">
                    <h4 className="font-bold text-brand-dark dark:text-white mb-2">Amenities</h4>
                    <div className="flex flex-wrap gap-2">
                        {shop.amenities.map(amenity => (
                            <span key={amenity} className="bg-brand-primary/20 text-brand-primary text-xs font-semibold px-3 py-1 rounded-full">{amenity}</span>
                        ))}
                    </div>
                </div>
            </div>

            {shop.reviews && shop.reviews.length > 0 && (
                <div>
                    <h4 className="font-bold text-brand-dark dark:text-white mb-3">Artist Reviews</h4>
                    <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                        {shop.reviews.map((review, index) => (
                            <div key={index} className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="font-semibold text-gray-700 dark:text-gray-300">{review.authorName}</p>
                                    <StarRating rating={review.rating} className="w-4 h-4" />
                                </div>
                                <p className="text-brand-gray text-sm italic">"{review.text}"</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h4 className="font-bold text-brand-dark dark:text-white mb-2">Available Booths</h4>
                 <div className="space-y-3">
                    {booths.length > 0 ? booths.map(booth => (
                        <div key={booth.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-brand-dark dark:text-white">{booth.name}</p>
                                <p className="text-lg font-bold text-brand-primary">${booth.dailyRate}<span className="text-sm font-normal text-brand-gray">/day</span></p>
                            </div>
                            <button onClick={() => onBookClick(shop)} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-80 transition-colors text-sm">Book Booth</button>
                        </div>
                    )) : (
                        <p className="text-brand-gray text-sm">No booths currently listed for this shop.</p>
                    )}
                </div>
            </div>
        </div>
    </Modal>
)};

export const BookingModal: React.FC<{ shop: Shop; booths: Booth[]; bookings: Booking[]; onClose: () => void; onConfirmBooking: (booking: any) => void; }> = ({ shop, booths, bookings, onClose, onConfirmBooking }) => {
    const [selectedBoothId, setSelectedBoothId] = useState(booths[0]?.id || '');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleConfirm = () => {
        if(!startDate || !endDate || !selectedBoothId) return;
        const booth = booths.find(b => b.id === selectedBoothId);
        if(!booth) return;
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
        const totalAmount = diffDays * booth.dailyRate;

        onConfirmBooking({
            boothId: selectedBoothId,
            shopId: shop.id,
            startDate,
            endDate,
            totalAmount,
            platformFee: totalAmount * 0.1
        });
    };

    return (
        <Modal onClose={onClose} title={`Book a Spot at ${shop.name}`}>
             <div className="space-y-4">
                 <div>
                     <label className="block text-sm font-medium text-brand-gray mb-1">Select Booth</label>
                     <select value={selectedBoothId} onChange={e => setSelectedBoothId(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 text-brand-dark dark:text-white">
                         {booths.map(b => <option key={b.id} value={b.id}>{b.name} - ${b.dailyRate}/day</option>)}
                     </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                         <label className="block text-sm font-medium text-brand-gray mb-1">Start Date</label>
                         <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 text-brand-dark dark:text-white" />
                     </div>
                     <div>
                         <label className="block text-sm font-medium text-brand-gray mb-1">End Date</label>
                         <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 text-brand-dark dark:text-white" />
                     </div>
                 </div>
                 <button onClick={handleConfirm} disabled={!startDate || !endDate} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg mt-4 disabled:bg-gray-600">
                     Confirm Booking
                 </button>
             </div>
        </Modal>
    );
};

const BookingCalendar: React.FC<{
  artistHours: ArtistHours;
  selectedDate: string;
  onDateChange: (date: string) => void;
}> = ({ artistHours, selectedDate, onDateChange }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const isDateAvailable = (date: Date) => {
        const dayOfWeek = date.getDay(); // 0 = Sunday
        const hours = artistHours[dayOfWeek];
        return hours && hours.length > 0;
    };
    
    const renderCalendar = () => {
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        let days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(currentYear, currentMonth, i);
            const dateString = date.toISOString().split('T')[0];
            const isToday = new Date().toISOString().split('T')[0] === dateString;
            const isSelected = selectedDate === dateString;
            const isAvailable = isDateAvailable(date);

            let classes = "w-10 h-10 flex items-center justify-center rounded-full transition-colors ";
            if (isAvailable) {
                if (isSelected) {
                    classes += "bg-brand-primary text-white font-bold";
                } else if (isToday) {
                    classes += "bg-brand-secondary/20 text-brand-secondary";
                } else {
                    classes += "hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer";
                }
            } else {
                classes += "text-gray-400 dark:text-gray-600 cursor-not-allowed line-through";
            }
            
            days.push(
                <button key={i} onClick={() => isAvailable && onDateChange(dateString)} disabled={!isAvailable} className={classes}>
                    {i}
                </button>
            );
        }
        return days;
    };

    const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' });
    const nextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };
    const prevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ArrowLeftIcon className="w-5 h-5"/></button>
                <h4 className="font-bold text-lg">{monthName} {currentYear}</h4>
                <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ArrowRightIcon className="w-5 h-5"/></button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-brand-gray">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2 mt-2 text-center">
                {renderCalendar()}
            </div>
             <div className="flex items-center gap-4 text-xs mt-4">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-brand-primary"></div> Selected</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400 dark:bg-gray-600"></div> Unavailable/Closed</div>
            </div>
        </div>
    );
};

export const ClientBookingRequestModal: React.FC<{ artist: Artist; availability: ArtistAvailability[]; onClose: () => void; onSendRequest: (data: any, files: File[]) => void; }> = ({ artist, availability, onClose, onSendRequest }) => {
    const { user } = useAppStore();
    const [step, setStep] = useState(1);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestionError, setSuggestionError] = useState('');
    
    // Step 1
    const [width, setWidth] = useState<number | ''>('');
    const [height, setHeight] = useState<number | ''>('');
    const [placement, setPlacement] = useState('');
    const [budget, setBudget] = useState<number | ''>('');
    const [description, setDescription] = useState(`Hi ${artist.name}, I'm interested in getting a...`);
    const [files, setFiles] = useState<File[]>([]);
    
    // Step 2
    const [serviceId, setServiceId] = useState('');
    const [selectedDate, setSelectedDate] = useState('');

    // Step 3
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files).slice(0, 5));
        }
    };
    
    const handleSuggest = async () => {
        if (typeof width !== 'number' || typeof height !== 'number' || !artist.services) return;
        setIsSuggesting(true);
        setSuggestionError('');
        try {
            const suggestedId = await suggestTattooService(width, height, artist.services);
            setServiceId(suggestedId);
        } catch (e) {
            setSuggestionError(e instanceof Error ? e.message : "Could not suggest a service.");
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleSubmit = () => {
        const deposit = artist.services?.find(s => s.id === serviceId)?.depositAmount || 50;
        
        const payload: any = {
            artistId: artist.id,
            serviceId: serviceId || 'custom',
            startDate: selectedDate,
            endDate: selectedDate,
            message: description,
            tattooWidth: Number(width),
            tattooHeight: Number(height),
            bodyPlacement: placement,
            depositAmount: deposit,
            platformFee: deposit * 0.029,
            budget: budget ? Number(budget) : null,
            status: 'pending',
            preferredTime: 'anytime'
        };

        if (!user) {
            payload.guestName = guestName;
            payload.guestEmail = guestEmail;
            payload.guestPhone = guestPhone;
        }

        onSendRequest(payload, files);
    };

    const inputClasses = "w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-brand-dark dark:text-white border border-transparent focus:border-brand-primary focus:ring-0 transition-colors";

    return (
        <Modal onClose={onClose} title={`Request Booking: Step ${step} of 3`} size="xl">
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-6">
                <div className="bg-brand-primary h-1.5 rounded-full" style={{ width: `${(step / 3) * 100}%` }}></div>
            </div>

            {/* Step 1: Tattoo Details */}
            {step === 1 && (
                <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                    <h3 className="font-bold text-lg text-brand-dark dark:text-white">Tattoo Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-1 grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium text-brand-gray">Width (in)</label><input type="number" value={width} onChange={e => setWidth(e.target.value === '' ? '' : Number(e.target.value))} className={inputClasses} /></div>
                            <div><label className="text-sm font-medium text-brand-gray">Height (in)</label><input type="number" value={height} onChange={e => setHeight(e.target.value === '' ? '' : Number(e.target.value))} className={inputClasses} /></div>
                            <div className="col-span-2"><label className="text-sm font-medium text-brand-gray">Body Placement</label><select value={placement} onChange={e => setPlacement(e.target.value)} className={inputClasses}><option value="">Select placement...</option>{bodyPlacements.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
                            <div className="col-span-2"><label className="text-sm font-medium text-brand-gray">Budget (Optional)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray">$</span><input type="number" value={budget} onChange={e => setBudget(e.target.value === '' ? '' : Number(e.target.value))} className={`${inputClasses} pl-6`} /></div></div>
                        </div>
                        <div className="md:col-span-1 flex flex-col">
                            <label className="text-sm font-medium text-brand-gray">Tattoo Idea / Message</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} className={`${inputClasses} flex-grow`} />
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-brand-gray">Reference Photos (Up to 5)</label>
                        <div className="mt-1"><input type="file" multiple onChange={handleFileChange} className="w-full text-sm text-brand-gray file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-secondary/10 file:text-brand-secondary hover:file:bg-brand-secondary/20" /></div>
                    </div>
                    <div className="flex justify-end pt-4"><button onClick={() => setStep(2)} disabled={!width || !height || !placement} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600">Next</button></div>
                </div>
            )}

            {/* Step 2: Service & Dates */}
            {step === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-[fadeIn_0.3s_ease-out]">
                    <div className="space-y-4">
                         <h3 className="font-bold text-lg text-brand-dark dark:text-white">Service</h3>
                         <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={inputClasses}>
                            <option value="">Select A Service...</option>
                            {artist.services?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} hrs)</option>)}
                         </select>
                         <button onClick={handleSuggest} disabled={isSuggesting || !width || !height || !artist.services || artist.services.length === 0} className="w-full flex items-center justify-center gap-2 bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">
                           {isSuggesting ? <Loader size="sm" color="white" /> : <SparklesIcon className="w-5 h-5"/>} Suggest
                         </button>
                         {suggestionError && <p className="text-red-500 text-xs text-center">{suggestionError}</p>}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-brand-dark dark:text-white mb-4">Select Your Availability</h3>
                        <BookingCalendar artistHours={artist.hours || {}} selectedDate={selectedDate} onDateChange={setSelectedDate} />
                    </div>
                    <div className="md:col-span-2 flex justify-between pt-4"><button onClick={() => setStep(1)} className="bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-2 px-6 rounded-lg">Back</button><button onClick={() => setStep(3)} disabled={!selectedDate} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600">Next</button></div>
                </div>
            )}
            
            {/* Step 3: Contact & Confirm */}
            {step === 3 && (
                 <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                     {!user ? (
                         <>
                            <h3 className="font-bold text-lg text-brand-dark dark:text-white">Your Contact Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-sm font-medium text-brand-gray">Full Name</label><input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} className={inputClasses} required/></div>
                                <div><label className="text-sm font-medium text-brand-gray">Email</label><input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className={inputClasses} required/></div>
                                <div className="col-span-full"><label className="text-sm font-medium text-brand-gray">Phone Number</label><input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className={inputClasses} /></div>
                            </div>
                         </>
                     ) : (
                         <div className="text-center p-8">
                            <h3 className="font-bold text-xl text-brand-dark dark:text-white">Ready to Send?</h3>
                            <p className="text-brand-gray">Your request will be sent to {artist.name} for review.</p>
                         </div>
                     )}
                     <div className="flex justify-between pt-4"><button onClick={() => setStep(2)} className="bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-2 px-6 rounded-lg">Back</button><button onClick={handleSubmit} disabled={!user && (!guestName || !guestEmail)} className="bg-brand-secondary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600">Send Request</button></div>
                 </div>
            )}
        </Modal>
    );
};

export const UploadPortfolioModal: React.FC<{ onClose: () => void; onUpload: (file: File) => void }> = ({ onClose, onUpload }) => {
    const [file, setFile] = useState<File | null>(null);

    const handleUpload = () => {
        if (file) onUpload(file);
    };

    return (
        <Modal onClose={onClose} title="Upload to Portfolio" size="md">
            <div className="space-y-4 text-center">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8">
                    <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" id="pf-upload" accept="image/*" />
                    <label htmlFor="pf-upload" className="cursor-pointer flex flex-col items-center">
                        <UploadIcon className="w-12 h-12 text-brand-gray mb-2" />
                        <span className="text-brand-primary font-bold">Click to select image</span>
                    </label>
                    {file && <p className="mt-2 text-sm text-brand-dark dark:text-white">{file.name}</p>}
                </div>
                <button onClick={handleUpload} disabled={!file} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600">Upload</button>
            </div>
        </Modal>
    );
};

export const EditBoothModal: React.FC<{ booth: Booth; onSave: (id: string, data: Partial<Booth>) => void; onClose: () => void }> = ({ booth, onSave, onClose }) => {
    const [name, setName] = useState(booth.name);
    const [rate, setRate] = useState(booth.dailyRate);

    return (
        <Modal onClose={onClose} title="Edit Booth">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-brand-gray">Booth Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 text-brand-dark dark:text-white" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-brand-gray">Daily Rate ($)</label>
                    <input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 text-brand-dark dark:text-white" />
                </div>
                <button onClick={() => onSave(booth.id, { name, dailyRate: rate })} className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg">Save Changes</button>
            </div>
        </Modal>
    );
};

export const LeaveReviewModal: React.FC<{ request: ClientBookingRequest; onSubmit: (id: string, rating: number, text: string) => void; onClose: () => void }> = ({ request, onSubmit, onClose }) => {
    const [rating, setRating] = useState(5);
    const [text, setText] = useState('');

    return (
        <Modal onClose={onClose} title="Leave a Review" size="md">
            <div className="space-y-4 text-center">
                <p className="text-brand-gray">How was your session with <strong>{request.artistName}</strong>?</p>
                <div className="flex justify-center">
                    <StarRating rating={rating} onRate={setRating} isInteractive className="w-8 h-8 cursor-pointer" />
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={4} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-3 text-brand-dark dark:text-white" placeholder="Share your experience..." />
                <button onClick={() => onSubmit(request.id, rating, text)} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Submit Review</button>
            </div>
        </Modal>
    );
};

export const ShopReviewModal: React.FC<{ booking: Booking; shop: Shop; onClose: () => void; onSubmit: (shopId: string, review: Omit<Review, 'id'>) => void }> = ({ booking, shop, onClose, onSubmit }) => {
    const [rating, setRating] = useState(5);
    const [text, setText] = useState('');
    const { user } = useAppStore();

    const handleSubmit = () => {
        if (!user) return;
        onSubmit(shop.id, {
            authorId: user.id,
            authorName: user.data.name,
            rating,
            text,
            createdAt: new Date().toISOString()
        });
    };

    return (
        <Modal onClose={onClose} title={`Review ${shop.name}`} size="md">
            <div className="space-y-4 text-center">
                <div className="flex justify-center">
                    <StarRating rating={rating} onRate={setRating} isInteractive className="w-8 h-8 cursor-pointer" />
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={4} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-3 text-brand-dark dark:text-white" placeholder="How was the shop environment?" />
                <button onClick={handleSubmit} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Submit Review</button>
            </div>
        </Modal>
    );
};

export const VerificationRequestModal: React.FC<{ item: Artist | Shop; type: 'artist' | 'shop'; onClose: () => void; onSubmit: (type: 'artist' | 'shop', item: Artist | Shop) => void }> = ({ item, type, onClose, onSubmit }) => (
    <Modal onClose={onClose} title="Request Verification" size="md">
        <div className="space-y-4">
            <p className="text-brand-gray">Submit a request to verify <strong>{type === 'artist' ? item.name : (item as Shop).name}</strong>. Our team will review your profile.</p>
            <button onClick={() => onSubmit(type, item)} className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg">Send Request</button>
        </div>
    </Modal>
);

export const AdminEditUserModal: React.FC<{ user: User; onSave: (id: string, data: any) => void; onClose: () => void }> = ({ user, onSave, onClose }) => {
    const [name, setName] = useState(user.data.name);
    const [isVerified, setIsVerified] = useState((user.data as any).isVerified || false);

    return (
        <Modal onClose={onClose} title="Edit User">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-brand-gray">Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 text-brand-dark dark:text-white" />
                </div>
                <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} className="rounded text-brand-primary focus:ring-brand-primary" />
                    <span className="text-brand-dark dark:text-white">Verified Account</span>
                </label>
                <button onClick={() => onSave(user.id, { name, role: user.type, isVerified })} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Save</button>
            </div>
        </Modal>
    );
};

export const AdminEditShopModal: React.FC<{ shop: Shop; onSave: (id: string, data: any) => void; onClose: () => void }> = ({ shop, onSave, onClose }) => {
    const [name, setName] = useState(shop.name);
    const [isVerified, setIsVerified] = useState(shop.isVerified);

    return (
        <Modal onClose={onClose} title="Edit Shop">
            <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-brand-gray">Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 text-brand-dark dark:text-white" />
                </div>
                <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} className="rounded text-brand-primary focus:ring-brand-primary" />
                    <span className="text-brand-dark dark:text-white">Verified Shop</span>
                </label>
                <button onClick={() => onSave(shop.id, { name, isVerified })} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Save</button>
            </div>
        </Modal>
    );
};

export const BookingRequestDetailModal: React.FC<{ request: ClientBookingRequest; onClose: () => void; onRespond: (id: string, status: 'approved' | 'declined') => void }> = ({ request, onClose, onRespond }) => (
    <Modal onClose={onClose} title="Booking Request">
        <div className="space-y-4">
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-brand-gray text-sm">Client</p>
                <p className="font-bold text-lg text-brand-dark dark:text-white">{request.clientName || request.guestName}</p>
                {request.guestEmail && <p className="text-sm text-brand-gray">{request.guestEmail}</p>}
                {request.guestPhone && <p className="text-sm text-brand-gray">{request.guestPhone}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-brand-gray text-sm">Size</p>
                    <p className="font-semibold text-brand-dark dark:text-white">{request.tattooWidth}" x {request.tattooHeight}"</p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-brand-gray text-sm">Placement</p>
                    <p className="font-semibold text-brand-dark dark:text-white capitalize">{request.bodyPlacement.replace('_', ' ')}</p>
                </div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-brand-gray text-sm">Description</p>
                <p className="text-brand-dark dark:text-white italic">"{request.message}"</p>
            </div>
            {request.referenceImageUrls && request.referenceImageUrls.length > 0 && (
                <div>
                    <p className="font-semibold mb-2 text-brand-dark dark:text-white">Reference Images</p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {request.referenceImageUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt="Reference" className="w-24 h-24 object-cover rounded-lg hover:opacity-80" />
                            </a>
                        ))}
                    </div>
                </div>
            )}
            {request.status === 'pending' && (
                <div className="flex gap-4 pt-4">
                    <button onClick={() => onRespond(request.id, 'approved')} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg">Approve</button>
                    <button onClick={() => onRespond(request.id, 'declined')} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-lg">Decline</button>
                </div>
            )}
        </div>
    </Modal>
);

export const SubscriptionModal: React.FC<{ onConfirm: () => void; onClose: () => void; }> = ({ onConfirm, onClose }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    
    const handleConfirm = async () => {
        setIsProcessing(true);
        await onConfirm();
        // The modal will be closed by the store action after success/failure.
        setIsProcessing(false);
    };

    return (
        <Modal onClose={onClose} title="Upgrade to InkSpace Pro" size="md">
            <div className="space-y-4 text-center">
                <SparklesIcon className="w-16 h-16 text-brand-secondary mx-auto" />
                <h3 className="text-2xl font-bold text-brand-dark dark:text-white">Unlock Your Potential</h3>
                <p className="text-brand-gray">Go Pro to remove all platform fees on deposits, get a verified badge, and access automated marketing tools.</p>
                
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-4xl font-extrabold text-brand-dark dark:text-white">$19<span className="text-lg font-medium text-brand-gray">/month</span></p>
                </div>

                <button
                    onClick={handleConfirm}
                    disabled={isProcessing}
                    className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:bg-gray-600"
                >
                    {isProcessing ? <Loader size="sm" color="white" /> : <CheckBadgeIcon className="w-5 h-5" />}
                    <span>{isProcessing ? 'Processing...' : 'Confirm Upgrade'}</span>
                </button>
            </div>
        </Modal>
    );
};

export const ClientProfileView: React.FC<{ client: Client; bookings: ClientBookingRequest[] }> = ({ client, bookings }) => {
    const active = bookings.filter(b => b.status === 'approved' || b.status === 'pending');
    
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800">
                <h1 className="text-3xl font-bold text-brand-dark dark:text-white">{client.name}</h1>
                <p className="text-brand-gray mt-1">Client Account</p>
            </div>
            
            <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-bold text-brand-dark dark:text-white mb-4">Active Requests & Bookings</h2>
                <div className="space-y-4">
                    {active.length > 0 ? active.map(b => (
                        <div key={b.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-bold text-brand-dark dark:text-white">{b.serviceName} with {b.artistName}</p>
                                <p className="text-sm text-brand-gray">{new Date(b.startDate).toLocaleDateString()}</p>
                            </div>
                            <span className="bg-brand-primary/20 text-brand-primary text-xs font-bold px-3 py-1 rounded-full capitalize">{b.status}</span>
                        </div>
                    )) : <p className="text-brand-gray italic">No active bookings.</p>}
                </div>
            </div>
        </div>
    );
};

export const ArtistProfileView: React.FC<{ artist: Artist; updateArtist: (id: string, data: Partial<Artist>) => Promise<void>; deletePortfolioImage: (url: string) => Promise<void>; showToast: (msg: string, type?: 'success' | 'error') => void; openModal: (type: ModalState['type'], data?: any) => void; }> = ({ artist, updateArtist, deletePortfolioImage, showToast, openModal }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [bio, setBio] = useState(artist.bio);
    const [specialty, setSpecialty] = useState(artist.specialty);
    const [instagram, setInstagram] = useState(artist.socials?.instagram || '');
    const [isGeneratingBio, setIsGeneratingBio] = useState(false);

    const handleSaveProfile = async () => {
        await updateArtist(artist.id, { 
            bio, 
            specialty, 
            socials: { ...artist.socials, instagram } 
        });
        setIsEditing(false);
        showToast('Profile updated!', 'success');
    };

    const handleGenerateBio = async () => {
        setIsGeneratingBio(true);
        try {
            const generated = await generateArtistBio(artist.name, specialty, artist.city);
            setBio(generated);
        } catch (error) {
            showToast('Failed to generate bio.', 'error');
        } finally {
            setIsGeneratingBio(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 relative">
                <button onClick={() => setIsEditing(!isEditing)} className="absolute top-4 right-4 text-brand-gray hover:text-brand-dark dark:hover:text-white p-2">
                    {isEditing ? <XIcon className="w-6 h-6" /> : <EditIcon className="w-6 h-6" />}
                </button>
                
                {isEditing ? (
                    <div className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
                        <div>
                            <label className="block text-sm font-medium text-brand-gray mb-1">Specialty</label>
                            <input type="text" value={specialty} onChange={e => setSpecialty(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 text-brand-dark dark:text-white" />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-brand-gray">Bio</label>
                                <button onClick={handleGenerateBio} disabled={isGeneratingBio} className="text-xs flex items-center gap-1 text-brand-secondary hover:underline">
                                    {isGeneratingBio ? <Loader size="sm" /> : <><SparklesIcon className="w-3 h-3"/> AI Generate</>}
                                </button>
                            </div>
                            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 text-brand-dark dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-gray mb-1">Instagram URL</label>
                            <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 text-brand-dark dark:text-white" />
                        </div>
                        <button onClick={handleSaveProfile} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg">Save Profile</button>
                    </div>
                ) : (
                    <>
                        <h1 className="text-3xl font-bold text-brand-dark dark:text-white mb-2">{artist.name}</h1>
                        <p className="text-brand-primary font-semibold mb-4">{artist.specialty} • {artist.city}</p>
                        <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-2xl">{artist.bio || "No bio yet."}</p>
                        {artist.socials?.instagram && (
                            <a href={artist.socials.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-brand-dark dark:text-white hover:text-brand-primary transition-colors">
                                <InstagramIcon className="w-5 h-5" />
                                <span className="font-medium">Instagram</span>
                            </a>
                        )}
                    </>
                )}
            </div>

            <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-brand-dark dark:text-white">Portfolio</h2>
                    <button onClick={() => openModal('upload-portfolio')} className="bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                        <UploadIcon className="w-5 h-5" /> Upload
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {artist.portfolio.map((img, i) => (
                        <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <img src={img.url} alt="Portfolio" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button onClick={() => deletePortfolioImage(img.url)} className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {artist.portfolio.length === 0 && <p className="text-brand-gray col-span-full py-8 text-center">Your portfolio is empty. Upload some work!</p>}
                </div>
            </div>
        </div>
    );
};