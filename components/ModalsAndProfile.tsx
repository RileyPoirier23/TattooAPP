// @/components/ModalsAndProfile.tsx

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import type { Artist, Shop, Booking, Booth, Review, AuthCredentials, RegisterDetails, UserRole, GroundingChunk, ClientBookingRequest, Client, Socials, ModalState, PortfolioImage, ArtistAvailability, User } from '../types';
import { LocationIcon, StarIcon, PriceIcon, XIcon, EditIcon, PaperAirplaneIcon, CalendarIcon, UploadIcon, CheckBadgeIcon, CreditCardIcon } from './shared/Icons';
import { generateArtistBio, getShopInfo, editImageWithGemini } from '../services/geminiService';
import { MapEmbed } from './shared/MapEmbed';
import { Loader } from './shared/Loader';
import { tattooSizes, bodyPlacements, estimatedHours } from '../data/bookingOptions';

// FIX: Removed redundant global declaration for window.Stripe. It is now centralized in src/vite-env.d.ts.

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
                    <button key={i} onClick={() => handleRating(starValue)} onMouseEnter={() => handleMouseEnter(starValue)} onMouseLeave={handleMouseLeave} disabled={!isInteractive} className={className}>
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

const Dropdown: React.FC<{ label: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: readonly { value: string | number; label: string }[] }> = ({ label, value, onChange, options }) => (
    <div>
        <label className="text-sm font-medium text-brand-gray mb-1 block">{label}</label>
        <select value={value} onChange={onChange} className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 text-brand-dark dark:text-brand-light">
            <option value="">Select...</option>
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);

// --- AUTHENTICATION MODAL ---

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
                           <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 mt-1"/>
                        </div>
                        {(role === 'artist' || role === 'dual') && (
                             <div>
                               <label className="text-sm text-brand-gray" htmlFor="city">Your City (e.g., Moncton, NB)</label>
                               <input id="city" type="text" value={city} onChange={e => setCity(e.target.value)} required className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 mt-1"/>
                            </div>
                        )}
                    </>
                )}
                <div>
                   <label className="text-sm text-brand-gray" htmlFor="email">Email</label>
                   <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 mt-1"/>
                </div>
                <div>
                   <label className="text-sm text-brand-gray" htmlFor="password">Password</label>
                   <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 mt-1"/>
                </div>

                {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                <button type="submit" className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg mt-2 hover:bg-opacity-80 transition-colors">
                    {isRegistering ? 'Sign Up' : 'Login'}
                </button>
                <div className="text-center">
                    <p className="text-sm">
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


// --- DETAIL & ACTION MODALS ---

export const ArtistDetailModal: React.FC<{ artist: Artist; reviews: Review[]; bookings: Booking[]; shops: Shop[]; onClose: () => void; onBookRequest: () => void; showToast: (message: string, type?: 'success' | 'error') => void; onMessageClick: (artistId: string) => void; }> = ({ artist, reviews, bookings, shops, onClose, onBookRequest, onMessageClick }) => {
    const futureBookings = bookings.filter(b => b.artistId === artist.id && new Date(b.endDate) >= new Date());
    
    return (
        <Modal onClose={onClose} title={artist.name}>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {artist.portfolio.slice(0, 3).map((image, index) => (
                        <img key={index} src={`${image.url}?random=${artist.id}-${index}`} alt={`${artist.name}'s portfolio ${index+1}`} className="w-full h-48 object-cover rounded-lg bg-gray-200 dark:bg-gray-800" />
                    ))}
                </div>
                 <div>
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold text-brand-primary">{artist.specialty}</h3>
                             {artist.hourlyRate && <p className="text-brand-dark dark:text-white font-semibold">${artist.hourlyRate}/hr</p>}
                        </div>
                        {artist.averageRating && artist.averageRating > 0 && (
                            <div className="flex items-center gap-2">
                                <StarRating rating={artist.averageRating} />
                                <span className="font-bold text-brand-dark dark:text-white">{artist.averageRating.toFixed(1)}</span>
                                <span className="text-sm text-brand-gray">({reviews.length})</span>
                            </div>
                        )}
                    </div>
                    <p className="text-gray-800 dark:text-brand-light mt-2">{artist.bio}</p>
                    {artist.socials && (
                        <div className="flex items-center gap-4 mt-4">
                            {artist.socials.instagram && <a href={artist.socials.instagram} target="_blank" rel="noopener noreferrer" className="text-brand-gray hover:text-brand-dark dark:hover:text-white">Instagram</a>}
                            {artist.socials.tiktok && <a href={artist.socials.tiktok} target="_blank" rel="noopener noreferrer" className="text-brand-gray hover:text-brand-dark dark:hover:text-white">TikTok</a>}
                            {artist.socials.x && <a href={artist.socials.x} target="_blank" rel="noopener noreferrer" className="text-brand-gray hover:text-brand-dark dark:hover:text-white">X</a>}
                        </div>
                    )}
                </div>

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

                <div>
                    <h4 className="font-bold text-brand-dark dark:text-white mb-2">Upcoming Availability</h4>
                    <ul className="space-y-2">
                        {futureBookings.length > 0 ? futureBookings.map(booking => {
                            const shop = shops.find(s => s.id === booking.shopId);
                            return (
                                <li key={booking.id} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-sm">
                                    <p className="font-semibold text-gray-700 dark:text-gray-300">{shop?.name || 'Private Studio'}</p>
                                    <p className="text-brand-gray">{shop?.location || 'Unknown City'}</p>
                                    <p className="text-brand-gray">{new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}</p>
                                </li>
                            )
                        }) : <p className="text-brand-gray text-sm">No upcoming guest spots scheduled.</p>}
                    </ul>
                </div>

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
    const [insights, setInsights] = useState<{ text: string; chunks: GroundingChunk[] } | null>(null);
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);
    const [insightsError, setInsightsError] = useState<string | null>(null);

    const handleGetInsights = async () => {
        setIsLoadingInsights(true);
        setInsightsError(null);
        try {
            const result = await getShopInfo(shop.name, shop.location);
            setInsights(result);
        } catch (error) {
            setInsightsError((error as Error).message);
        } finally {
            setIsLoadingInsights(false);
        }
    };
    
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

            <div>
                <h4 className="font-bold text-brand-dark dark:text-white mb-3">AI-Powered Insights</h4>
                <div className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-lg">
                    {!insights && !isLoadingInsights && !insightsError && (
                         <button onClick={handleGetInsights} className="text-sm font-semibold bg-brand-secondary/80 text-white px-4 py-2 rounded-lg hover:bg-brand-secondary transition-colors">
                            ✨ Learn more about this shop
                        </button>
                    )}
                    {isLoadingInsights && <div className="flex justify-center items-center h-10"><Loader /></div>}
                    {insightsError && <p className="text-sm text-red-400">{insightsError}</p>}
                    {insights && (
                        <div className="space-y-3">
                            <p className="text-brand-gray text-sm italic">"{insights.text}"</p>
                            {insights.chunks.length > 0 && (
                                <div>
                                    <h5 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Sources:</h5>
                                    <ul className="flex flex-wrap gap-2">
                                        {insights.chunks.map((chunk, i) => (
                                            <li key={i}>
                                                <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md truncate">
                                                    {chunk.web.title || new URL(chunk.web.uri).hostname}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
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

const Calendar: React.FC<{ bookedDates: Date[], onDateSelect: (date: Date) => void, selectedStartDate: Date | null, selectedEndDate: Date | null }> = ({ bookedDates, onDateSelect, selectedStartDate, selectedEndDate }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
  
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();
  
    const bookedDateStrings = useMemo(() => bookedDates.map(d => d.toDateString()), [bookedDates]);
  
    const renderDays = () => {
      const days = [];
      for (let i = 0; i < startDay; i++) {
        days.push(<div key={`empty-${i}`} className="w-full h-10"></div>);
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dateString = date.toDateString();
        const isBooked = bookedDateStrings.includes(dateString);
        const isPast = date < new Date(new Date().toDateString());
        
        const isSelectedStart = selectedStartDate?.toDateString() === dateString;
        const isSelectedEnd = selectedEndDate?.toDateString() === dateString;
        const isInRange = selectedStartDate && selectedEndDate && date > selectedStartDate && date < selectedEndDate;
        const isDisabled = isBooked || isPast;

        let buttonClass = 'w-full h-10 rounded-full text-sm font-semibold transition-colors ';
        if (isSelectedStart || isSelectedEnd) buttonClass += 'bg-brand-primary text-white';
        else if (isInRange) buttonClass += 'bg-brand-primary/50 text-white';
        else if (isDisabled) buttonClass += 'text-gray-500 dark:text-gray-600 cursor-not-allowed line-through';
        else buttonClass += 'hover:bg-gray-200 dark:hover:bg-gray-700 text-brand-dark dark:text-white';

        days.push(
          <div key={day} className="p-1">
            <button onClick={() => !isDisabled && onDateSelect(date)} disabled={isDisabled} className={buttonClass}>
              {day}
            </button>
          </div>
        );
      }
      return days;
    };
  
    return (
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>&lt;</button>
          <h4 className="font-bold text-brand-dark dark:text-white">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-brand-gray">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => <div key={day}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 mt-2">{renderDays()}</div>
      </div>
    );
};

export const BookingModal: React.FC<{shop: Shop, booths: Booth[], bookings: Booking[], onClose: () => void, onConfirmBooking: (bookingData: Omit<Booking, 'id' | 'artistId' | 'city'>) => void}> = ({ shop, booths, bookings, onClose, onConfirmBooking }) => {
    const [selectedBoothId, setSelectedBoothId] = useState<string | null>(booths.length > 0 ? booths[0].id : null);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    const PLATFORM_FEE_PERCENT = 0.05;

    const { totalAmount, platformFee, numberOfDays } = useMemo(() => {
        if (!startDate || !endDate || !selectedBoothId) return { totalAmount: 0, platformFee: 0, numberOfDays: 0 };
        const selectedBooth = booths.find(b => b.id === selectedBoothId);
        if (!selectedBooth) return { totalAmount: 0, platformFee: 0, numberOfDays: 0 };
        
        const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const subtotal = days * selectedBooth.dailyRate;
        const fee = subtotal * PLATFORM_FEE_PERCENT;
        return { totalAmount: subtotal + fee, platformFee: fee, numberOfDays: days };
    }, [startDate, endDate, selectedBoothId, booths]);

    const bookedDatesForSelectedBooth = useMemo(() => {
        if (!selectedBoothId) return [];
        const dates: Date[] = [];
        bookings.filter(b => b.boothId === selectedBoothId).forEach(booking => {
            let currentDate = new Date(new Date(booking.startDate).setUTCHours(0,0,0,0));
            const stopDate = new Date(new Date(booking.endDate).setUTCHours(0,0,0,0));
            while (currentDate <= stopDate) {
                dates.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }
        });
        return dates;
    }, [bookings, selectedBoothId]);

    const handleDateSelect = (date: Date) => {
        if (!startDate || (startDate && endDate)) {
            setStartDate(date);
            setEndDate(null);
        } else if (date > startDate) {
            setEndDate(date);
        } else {
            setStartDate(date);
        }
    };
    
    const handleConfirm = () => {
        if (selectedBoothId && startDate && endDate) {
            onConfirmBooking({ shopId: shop.id, boothId: selectedBoothId, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], paymentStatus: 'unpaid', totalAmount, platformFee });
        }
    };

    return (
        <Modal onClose={onClose} title={`Book a Booth at ${shop.name}`} size="xl">
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Select Booth</label>
                    <select value={selectedBoothId || ''} onChange={e => { setSelectedBoothId(e.target.value); setStartDate(null); setEndDate(null); }} className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2">
                        {booths.map(b => <option key={b.id} value={b.id}>{b.name} - ${b.dailyRate}/day</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Calendar bookedDates={bookedDatesForSelectedBooth} onDateSelect={handleDateSelect} selectedStartDate={startDate} selectedEndDate={endDate} />
                    <div>
                        <h4 className="font-bold text-brand-dark dark:text-white mb-2">Booking Summary</h4>
                        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg space-y-2 text-sm">
                            <p><strong>Start Date:</strong> {startDate ? startDate.toLocaleDateString() : 'Not Selected'}</p>
                            <p><strong>End Date:</strong> {endDate ? endDate.toLocaleDateString() : 'Not Selected'}</p>
                            {numberOfDays > 0 && (
                                <>
                                    <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                                    <p><strong>Number of Days:</strong> {numberOfDays}</p>
                                    <p><strong>Platform Fee (5%):</strong> ${platformFee.toFixed(2)}</p>
                                    <p className="text-lg font-bold"><strong>Total:</strong> ${totalAmount.toFixed(2)}</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <button onClick={handleConfirm} disabled={!selectedBoothId || !startDate || !endDate} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed">
                    Proceed to Payment
                </button>
            </div>
        </Modal>
    );
};

export const ClientBookingRequestModal: React.FC<{ artist: Artist; availability: ArtistAvailability[]; onClose: () => void; onSendRequest: (request: Omit<ClientBookingRequest, 'id' | 'clientId' | 'status' | 'paymentStatus'>) => void; }> = ({ artist, availability, onClose, onSendRequest }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [message, setMessage] = useState('');
    const [tattooSize, setTattooSize] = useState('');
    const [bodyPlacement, setBodyPlacement] = useState('');
    const [hours, setHours] = useState(0);

    const PLATFORM_FEE_PERCENT = 0.05;
    const DEPOSIT_PERCENT = 0.25;

    const { depositAmount, platformFee } = useMemo(() => {
        if (!hours || !artist.hourlyRate) return { depositAmount: 0, platformFee: 0 };
        const estimatedTotal = hours * artist.hourlyRate;
        const deposit = estimatedTotal * DEPOSIT_PERCENT;
        const fee = deposit * PLATFORM_FEE_PERCENT;
        return { depositAmount: deposit, platformFee: fee };
    }, [hours, artist.hourlyRate]);

    const unavailableDates = useMemo(() => new Set(availability.filter(a => a.status === 'unavailable').map(a => a.date)), [availability]);
    const isDateUnavailable = (dateStr: string) => unavailableDates.has(dateStr);

    const handleSubmit = () => {
        if (startDate && endDate && message && tattooSize && bodyPlacement && hours > 0) {
            onSendRequest({ artistId: artist.id, startDate, endDate, message, tattooSize, bodyPlacement, estimatedHours: hours, depositAmount, platformFee });
        }
    };

    return (
        <Modal onClose={onClose} title={`Request Booking with ${artist.name}`} size="lg">
            <div className="space-y-4">
                <p className="text-sm text-brand-gray">Select your desired dates and provide details about your tattoo idea. {artist.name} will review your request and get back to you.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="text-sm font-medium text-brand-gray mb-1 block">Availability Start</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2" />
                        {startDate && isDateUnavailable(startDate) && <p className="text-xs text-yellow-400 mt-1">Artist is marked as unavailable on this date.</p>}
                    </div>
                    <div>
                        <label className="text-sm font-medium text-brand-gray mb-1 block">Availability End</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2" />
                        {endDate && isDateUnavailable(endDate) && <p className="text-xs text-yellow-400 mt-1">Artist is marked as unavailable on this date.</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Dropdown label="Tattoo Size" value={tattooSize} onChange={e => setTattooSize(e.target.value)} options={tattooSizes} />
                    <Dropdown label="Body Placement" value={bodyPlacement} onChange={e => setBodyPlacement(e.target.value)} options={bodyPlacements} />
                    <Dropdown label="Estimated Hours" value={hours} onChange={e => setHours(Number(e.target.value))} options={estimatedHours} />
                </div>
                
                <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Tattoo Idea / Message</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2" placeholder={`Hi ${artist.name}, I'm interested in getting a...`}></textarea>
                </div>

                {artist.hourlyRate && hours > 0 && (
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-sm">
                        <p className="font-semibold text-brand-dark dark:text-brand-light">Estimated Deposit: <span className="text-brand-dark dark:text-white">${depositAmount.toFixed(2)}</span> (25% of estimated cost)</p>
                        <p className="text-xs text-brand-gray">This will be required if the artist approves your request.</p>
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={!startDate || !endDate || !message || !tattooSize || !bodyPlacement || !hours}
                    className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                    <PaperAirplaneIcon className="w-5 h-5" />
                    <span>Send Request</span>
                </button>
            </div>
        </Modal>
    );
};

export const UploadPortfolioModal: React.FC<{ onClose: () => void; onUpload: (file: File) => void }> = ({ onClose, onUpload }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(selectedFile);
        }
    };

    return (
        <Modal onClose={onClose} title="Upload New Portfolio Piece" size="md">
            <div className="space-y-4">
                <div className="w-full h-64 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center">
                    {preview ? (
                        <img src={preview} alt="Preview" className="max-w-full max-h-full rounded-lg" />
                    ) : (
                        <div className="text-center text-brand-gray">
                            <UploadIcon className="w-12 h-12 mx-auto" />
                            <p>Click to browse or drag file here</p>
                        </div>
                    )}
                </div>
                <input type="file" onChange={handleFileChange} accept="image/*" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-secondary file:text-white hover:file:bg-opacity-80" />
                <button onClick={() => file && onUpload(file)} disabled={!file} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600">Upload Image</button>
            </div>
        </Modal>
    );
};

export const EditBoothModal: React.FC<{ booth: Booth; onSave: (boothId: string, data: Partial<Booth>) => void; onClose: () => void; }> = ({ booth, onSave, onClose }) => {
    const [name, setName] = useState(booth.name);
    const [dailyRate, setDailyRate] = useState(booth.dailyRate);

    const handleSave = () => {
        onSave(booth.id, { name, dailyRate });
    };

    return (
        <Modal onClose={onClose} title="Edit Booth" size="md">
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Booth Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" />
                </div>
                <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Daily Rate ($)</label>
                    <input type="number" value={dailyRate} onChange={e => setDailyRate(Number(e.target.value))} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" />
                </div>
                <button onClick={handleSave} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Save Changes</button>
            </div>
        </Modal>
    );
};

export const LeaveReviewModal: React.FC<{ request: ClientBookingRequest; onSubmit: (requestId: string, rating: number, text: string) => void; onClose: () => void }> = ({ request, onSubmit, onClose }) => {
    const [rating, setRating] = useState(0);
    const [text, setText] = useState('');
    return (
        <Modal onClose={onClose} title={`Review Your Session with ${request.artistName}`} size="md">
            <div className="space-y-4">
                <div className="flex justify-center">
                    <StarRating rating={rating} onRate={setRating} isInteractive={true} className="w-8 h-8" />
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={4} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" placeholder="Share your experience..."></textarea>
                <button onClick={() => onSubmit(request.id, rating, text)} disabled={!rating || !text} className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg disabled:bg-gray-600">Submit Review</button>
            </div>
        </Modal>
    );
};

export const ImageEditorModal: React.FC<{ artistId: string; image: PortfolioImage; onSave: (artistId: string, oldImage: PortfolioImage, newBase64: string) => void; onClose: () => void; }> = ({ artistId, image, onSave, onClose }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [editedImage, setEditedImage] = useState<string | null>(null);

    const handleEdit = async () => {
        setIsLoading(true);
        try {
            const result = await editImageWithGemini(image.url, prompt);
            setEditedImage(result);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal onClose={onClose} title="Edit Image with AI" size="xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="font-semibold text-brand-dark dark:text-white">Original Image</h3>
                    <img src={image.url} alt="Original" className="w-full rounded-lg" />
                    <h3 className="font-semibold text-brand-dark dark:text-white">Describe your edits</h3>
                    <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g., 'make the background a vibrant cyberpunk city'" className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" />
                    <button onClick={handleEdit} disabled={isLoading || !prompt} className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg disabled:bg-gray-600 flex items-center justify-center">
                        {isLoading ? <Loader size="sm" color="white" /> : "✨ Generate Edit"}
                    </button>
                </div>
                 <div className="space-y-4">
                    <h3 className="font-semibold text-brand-dark dark:text-white">AI Generated Result</h3>
                    <div className="w-full h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                        {editedImage ? <img src={`data:image/png;base64,${editedImage}`} alt="Edited" className="w-full rounded-lg" /> : <p className="text-brand-gray">Result will appear here</p>}
                    </div>
                    <button onClick={() => editedImage && onSave(artistId, image, editedImage)} disabled={!editedImage} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600">Save to Portfolio</button>
                 </div>
            </div>
        </Modal>
    );
};

export const ShopReviewModal: React.FC<{ booking: Booking; shop: Shop; onSubmit: (shopId: string, review: Omit<Review, 'id'>) => void; onClose: () => void; }> = ({ booking, shop, onSubmit, onClose }) => {
    const { user } = useAppStore();
    const [rating, setRating] = useState(0);
    const [text, setText] = useState('');

    const handleSubmit = () => {
        if (!user || !rating || !text) return;
        onSubmit(shop.id, {
            authorId: user.id,
            authorName: user.data.name,
            rating,
            text,
            createdAt: new Date().toISOString()
        });
    };

    return (
        <Modal onClose={onClose} title={`Review Your Stay at ${shop.name}`} size="md">
            <div className="space-y-4">
                <p className="text-sm text-brand-gray text-center">Your feedback helps other artists find great places to work.</p>
                <div className="flex justify-center">
                    <StarRating rating={rating} onRate={setRating} isInteractive={true} className="w-8 h-8" />
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={4} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" placeholder="How was the shop environment, cleanliness, and staff?"></textarea>
                <button onClick={handleSubmit} disabled={!rating || !text} className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg disabled:bg-gray-600">Submit Review</button>
            </div>
        </Modal>
    );
};

// --- STRIPE PAYMENT MODAL ---
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

const cardStyle = (isDarkMode: boolean) => ({
  style: {
    base: {
      color: isDarkMode ? '#F5F5F7' : '#101014',
      fontFamily: 'sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': { color: '#A0A0A0' }
    },
    invalid: {
      color: '#F04E98',
      iconColor: '#F04E98'
    }
  }
});

type PaymentContext = 
    { type: 'artist', data: Booking } | 
    { type: 'client', data: ClientBookingRequest };

export const PaymentModal: React.FC<{ context: PaymentContext, onClose: () => void, onProcessPayment: (type: 'artist' | 'client', booking: Booking | ClientBookingRequest, paymentMethodId: string) => void }> = ({ context, onClose, onProcessPayment }) => {
    const { theme } = useAppStore();
    const [stripe, setStripe] = useState<any>(null);
    const [cardElement, setCardElement] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const cardElementRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (stripe || !STRIPE_PUBLISHABLE_KEY) {
            return;
        }

        let attempts = 0;
        const intervalId = setInterval(() => {
            attempts++;
            if (window.Stripe) {
                clearInterval(intervalId);
                setStripe(window.Stripe(STRIPE_PUBLISHABLE_KEY));
            } else if (attempts > 20) { // Stop after 2 seconds
                clearInterval(intervalId);
                setError("Payment services could not be loaded. Please check your network connection and refresh.");
                console.error("Stripe.js did not load in time.");
            }
        }, 100);

        return () => clearInterval(intervalId);
    }, [stripe]);

    useEffect(() => {
        if (stripe && !cardElement && cardElementRef.current) {
            const elements = stripe.elements();
            const card = elements.create('card', cardStyle(theme === 'dark'));
            card.mount(cardElementRef.current);
            setCardElement(card);
        }
    }, [stripe, cardElement, theme]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !cardElement) return;

        setIsLoading(true);
        setError(null);

        const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
            type: 'card',
            card: cardElement,
        });

        if (pmError) {
            setError(pmError.message);
            setIsLoading(false);
            return;
        }

        onProcessPayment(context.type, context.data, paymentMethod.id);
    };

    const amount = context.type === 'artist' ? context.data.totalAmount : context.data.depositAmount;
    const title = context.type === 'artist' ? 'Pay for Booth Rental' : 'Pay Booking Deposit';

    if (!STRIPE_PUBLISHABLE_KEY) {
        return (
            <Modal onClose={onClose} title="Configuration Error" size="md">
                <p className="text-center text-red-400">The Stripe service is not configured. Please provide a publishable key.</p>
            </Modal>
        )
    }

    return (
        <Modal onClose={onClose} title={title} size="md" closeDisabled={isLoading}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-brand-gray mb-2">Card Details</label>
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg border border-gray-300 dark:border-gray-700">
                        <div ref={cardElementRef} />
                    </div>
                </div>

                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                
                <button
                    type="submit"
                    disabled={!stripe || isLoading}
                    className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg flex items-center justify-center disabled:bg-gray-600"
                >
                    {isLoading ? <Loader size="sm" color="white" /> : `Pay $${amount?.toFixed(2) || '0.00'}`}
                </button>
            </form>
        </Modal>
    );
};


export const VerificationRequestModal: React.FC<{ item: Artist | Shop, type: 'artist' | 'shop', onSubmit: (type: 'artist' | 'shop', item: Artist | Shop) => void, onClose: () => void }> = ({ item, type, onSubmit, onClose }) => {
    return (
        <Modal onClose={onClose} title={`Request ${type === 'artist' ? 'Artist' : 'Shop'} Verification`} size="md">
            <div className="text-center space-y-4">
                <CheckBadgeIcon className="w-16 h-16 text-brand-secondary mx-auto" />
                <p className="text-brand-gray">Submitting a verification request for <span className="font-bold text-brand-dark dark:text-white">{item.name}</span> will place it in a queue for an admin to review.</p>
                <p className="text-xs text-gray-500">Admins will review your profile or shop details to ensure authenticity. This process may take several business days.</p>
                <div className="pt-4 flex gap-4">
                    <button onClick={onClose} className="w-full bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-3 rounded-lg">Cancel</button>
                    <button onClick={() => onSubmit(type, item)} className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg">Submit Request</button>
                </div>
            </div>
        </Modal>
    );
};

// --- PROFILE & DASHBOARD VIEWS ---

export const ArtistProfileView: React.FC<{ artist: Artist, updateArtist: (id: string, data: Partial<Artist>) => void, showToast: (msg: string) => void, openModal: (type: ModalState['type'], data?: any) => void }> = ({ artist, updateArtist, showToast, openModal }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isGeneratingBio, setIsGeneratingBio] = useState(false);
    const [formData, setFormData] = useState<Partial<Artist>>({ ...artist });

    const handleGenerateBio = async () => {
        setIsGeneratingBio(true);
        try {
            const bio = await generateArtistBio(formData.name!, formData.specialty!);
            setFormData(prev => ({ ...prev, bio }));
        } catch (error) {
            showToast('Failed to generate bio.');
        } finally {
            setIsGeneratingBio(false);
        }
    };

    const handleSave = () => {
        updateArtist(artist.id, formData);
        setIsEditing(false);
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-4xl font-bold text-brand-dark dark:text-white">{artist.name}</h1>
                    {artist.isVerified && <CheckBadgeIcon className="w-8 h-8 text-brand-secondary" title="Verified Artist" />}
                </div>
                {isEditing ? (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditing(false)} className="bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                        <button onClick={handleSave} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg">Save</button>
                    </div>
                ) : (
                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-brand-dark dark:text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"><EditIcon className="w-5 h-5"/> Edit Profile</button>
                )}
            </div>

            <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 space-y-6">
                {isEditing ? (
                    <div className="space-y-4">
                        <div><label className="text-sm text-brand-gray">Name</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded"/></div>
                        <div><label className="text-sm text-brand-gray">Specialty</label><input type="text" value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded"/></div>
                        <div><label className="text-sm text-brand-gray">Hourly Rate ($)</label><input type="number" value={formData.hourlyRate || ''} onChange={e => setFormData({...formData, hourlyRate: Number(e.target.value)})} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded"/></div>
                        <div className="relative">
                           <label className="text-sm text-brand-gray">Bio</label>
                           <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} rows={3} className={`w-full bg-gray-100 dark:bg-gray-800 p-2 rounded transition-all ${isGeneratingBio ? 'opacity-50' : ''}`}/>
                           <button onClick={handleGenerateBio} disabled={isGeneratingBio} className="absolute bottom-2 right-2 text-xs bg-brand-secondary text-white px-2 py-1 rounded-lg disabled:bg-gray-600 flex items-center justify-center" style={{minWidth: '90px'}}>
                            {isGeneratingBio ? <Loader size="sm" color="white" /> : '✨ AI Generate'}
                           </button>
                        </div>
                        <div>
                            <h4 className="text-sm text-brand-gray mb-1">Socials</h4>
                            <input type="text" placeholder="Instagram URL" value={formData.socials?.instagram || ''} onChange={e => setFormData({...formData, socials: {...formData.socials, instagram: e.target.value}})} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2"/>
                            <input type="text" placeholder="TikTok URL" value={formData.socials?.tiktok || ''} onChange={e => setFormData({...formData, socials: {...formData.socials, tiktok: e.target.value}})} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2"/>
                            <input type="text" placeholder="X (Twitter) URL" value={formData.socials?.x || ''} onChange={e => setFormData({...formData, socials: {...formData.socials, x: e.target.value}})} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded"/>
                        </div>
                    </div>
                ) : (
                    <div>
                        <p className="text-lg font-semibold text-brand-primary">{artist.specialty}</p>
                        {artist.hourlyRate && <p className="text-brand-dark dark:text-white font-semibold">${artist.hourlyRate}/hr</p>}
                        <p className="text-gray-800 dark:text-brand-light mt-2">{artist.bio}</p>
                    </div>
                )}
            </div>
            
            {!artist.isVerified && (
                <div className="mt-6 bg-yellow-400/20 dark:bg-yellow-900/30 border border-yellow-500/50 p-4 rounded-lg flex items-center justify-between">
                    <p className="text-yellow-800 dark:text-yellow-300 text-sm">Your profile is unverified. Verified artists get priority in search results.</p>
                    <button onClick={() => openModal('request-verification', { item: artist, type: 'artist' })} className="bg-yellow-500 text-black font-bold py-2 px-4 rounded-lg text-sm">Request Verification</button>
                </div>
            )}

             <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-brand-dark dark:text-white">Portfolio</h2>
                    <button onClick={() => openModal('upload-portfolio')} className="flex items-center gap-2 bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg"><UploadIcon className="w-5 h-5"/> Add Image</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {artist.portfolio.map((image, index) => (
                        <div key={index} className="relative group">
                            <img src={`${image.url}?random=${artist.id}-${index}`} alt={`Portfolio piece ${index+1}`} className="w-full h-48 object-cover rounded-lg bg-gray-200 dark:bg-gray-800" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button onClick={() => openModal('image-editor', { artistId: artist.id, image })} className="text-white flex items-center gap-2 bg-black/50 p-2 rounded-lg">
                                    <EditIcon className="w-5 h-5"/> AI Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
        </div>
    );
};

export const ClientProfileView: React.FC<{ client: Client, bookings: ClientBookingRequest[] }> = ({ client, bookings }) => {
    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-brand-dark dark:text-white mb-6">Welcome, {client.name}</h1>
            <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800">
                <h2 className="text-2xl font-bold text-brand-dark dark:text-white mb-4">Your Past Sessions</h2>
                <div className="space-y-4">
                {bookings.filter(b => b.status === 'completed').length > 0 ? bookings.filter(b => b.status === 'completed').map(b => (
                    <div key={b.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                        <p>Session with <span className="font-bold">{b.artistName}</span> on {new Date(b.startDate).toLocaleDateString()}</p>
                        {b.reviewRating && <StarRating rating={b.reviewRating} />}
                    </div>
                )) : <p className="text-brand-gray">No completed sessions yet.</p>}
                </div>
            </div>
        </div>
    );
};

// --- ADMIN MODALS ---
export const AdminEditUserModal: React.FC<{ user: User; onSave: (userId: string, data: { name: string, role: UserRole, isVerified: boolean }) => void; onClose: () => void; }> = ({ user, onSave, onClose }) => {
    const [name, setName] = useState(user.data.name);
    const [role, setRole] = useState<UserRole>(user.type);
    const [isVerified, setIsVerified] = useState('isVerified' in user.data ? user.data.isVerified : false);

    const handleSave = () => {
        onSave(user.id, { name, role, isVerified });
    };

    return (
        <Modal onClose={onClose} title={`Edit User: ${user.data.name}`} size="md">
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Full Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" />
                </div>
                <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Role</label>
                    <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 capitalize">
                        {['client', 'artist', 'dual', 'shop-owner', 'admin'].map(r => <option key={r} value={r}>{r.replace('-', ' ')}</option>)}
                    </select>
                </div>
                {role !== 'admin' && (
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 text-brand-secondary focus:ring-brand-secondary" />
                        <span className="text-brand-gray">Is Verified</span>
                    </label>
                )}
                <button onClick={handleSave} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Save Changes</button>
            </div>
        </Modal>
    );
};

export const AdminEditShopModal: React.FC<{ shop: Shop; onSave: (shopId: string, data: { name: string, isVerified: boolean }) => void; onClose: () => void; }> = ({ shop, onSave, onClose }) => {
    const [name, setName] = useState(shop.name);
    const [isVerified, setIsVerified] = useState(shop.isVerified);
    
    const handleSave = () => {
        onSave(shop.id, { name, isVerified });
    };

    return (
        <Modal onClose={onClose} title={`Edit Shop: ${shop.name}`} size="md">
             <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Shop Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" />
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 text-brand-secondary focus:ring-brand-secondary" />
                    <span className="text-brand-gray">Is Verified</span>
                </label>
                <button onClick={handleSave} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Save Changes</button>
            </div>
        </Modal>
    );
};