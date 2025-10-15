// @/components/ModalsAndProfile.tsx

import React, { useState, useMemo, useRef, useCallback } from 'react';
import type { Artist, Shop, Booking, Booth, Review, AuthCredentials, RegisterDetails, UserRole, GroundingChunk, ClientBookingRequest, Client, Socials, ModalState, PortfolioImage } from '../types';
import { LocationIcon, StarIcon, PriceIcon, XIcon, EditIcon, PaperAirplaneIcon, CalendarIcon, UploadIcon, CheckBadgeIcon } from './shared/Icons';
import { generateArtistBio, getShopInfo, editImageWithGemini } from '../services/geminiService';
import { MapEmbed } from './shared/MapEmbed';
import { Loader } from './shared/Loader';
import { tattooSizes, bodyPlacements, estimatedHours } from '../data/bookingOptions';

// --- SHARED COMPONENTS ---

const StarRating: React.FC<{ rating: number; className?: string; onRate?: (rating: number) => void; isInteractive?: boolean }> = ({ rating, className = 'w-5 h-5', onRate, isInteractive = false }) => {
    const [hoverRating, setHoverRating] = useState(0);

    const handleRating = (rate: number) => {
        if (isInteractive && onRate) {
            onRate(rate);
        }
    };

    const handleMouseEnter = (rate: number) => {
        if (isInteractive) {
            setHoverRating(rate);
        }
    };

    const handleMouseLeave = () => {
        if (isInteractive) {
            setHoverRating(0);
        }
    };

    return (
        <div className="flex items-center">
            {[...Array(5)].map((_, i) => {
                const starValue = i + 1;
                const displayRating = hoverRating || rating;
                const isFull = starValue <= displayRating;
                const isHalf = !isFull && starValue - 0.5 <= displayRating;

                return (
                    <button
                        key={i}
                        onClick={() => handleRating(starValue)}
                        onMouseEnter={() => handleMouseEnter(starValue)}
                        onMouseLeave={handleMouseLeave}
                        disabled={!isInteractive}
                        className={`${className} ${isInteractive ? 'cursor-pointer' : ''}`}
                    >
                        <StarIcon
                            className={`transition-colors ${
                                isFull ? 'text-yellow-400' : isHalf ? 'text-yellow-400' : 'text-gray-600'
                            }`}
                            style={isHalf ? { clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' } : {}}
                        />
                    </button>
                );
            })}
        </div>
    );
};

const Modal: React.FC<{ children: React.ReactNode; onClose: () => void; title: string; size?: 'md' | 'lg' | 'xl' }> = ({ children, onClose, title, size = 'lg' }) => {
    const maxWidth = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
            <div className={`bg-gray-900 border border-gray-700 rounded-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}>
                <header className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close modal">
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
        <select value={value} onChange={onChange} className="w-full bg-gray-800 border-gray-700 rounded p-2">
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
    const [role, setRole] = useState<UserRole>('artist');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (isRegistering) {
            const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            if (!isEmailValid) {
                setError('Please enter a valid email address.');
                return;
            }
            const details: RegisterDetails = { email, password: password!, type: role, name };
            if (role === 'artist' || role === 'dual') {
                details.city = city;
            }
            onRegister(details);
        } else {
            onLogin({ email, password });
        }
    };
    
    const handleDevLogin = () => {
        // DEV ADMIN LOGIN: Use a non-email username to prevent collision with actual Supabase users.
        const user = prompt("Enter dev username (hint: __admin__):");
        if (user === null) return; // User cancelled prompt

        const pass = prompt("Enter dev password (hint: root):");
        if (pass === null) return; // User cancelled prompt

        if (user === '__admin__' && pass === 'root') {
            onLogin({ email: '__admin__', password: 'root' });
        } else {
            alert('Invalid dev credentials.');
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
                                {(['artist', 'client', 'dual', 'shop-owner'] as UserRole[]).map(r => (
                                    <button type="button" key={r} onClick={() => setRole(r)} className={`p-2 rounded-lg text-sm capitalize ${role === r ? 'bg-brand-primary text-white' : 'bg-gray-800 text-gray-300'}`}>
                                        {r === 'dual' ? 'Artist & Client' : r.replace('-', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                           <label className="text-sm text-brand-gray" htmlFor="name">Full Name</label>
                           <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded p-2 mt-1"/>
                        </div>
                        {(role === 'artist' || role === 'dual') && (
                             <div>
                               <label className="text-sm text-brand-gray" htmlFor="city">Your City (e.g., Moncton, NB)</label>
                               <input id="city" type="text" value={city} onChange={e => setCity(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded p-2 mt-1"/>
                            </div>
                        )}
                    </>
                )}
                <div>
                   <label className="text-sm text-brand-gray" htmlFor="email">Email</label>
                   <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded p-2 mt-1"/>
                </div>
                <div>
                   <label className="text-sm text-brand-gray" htmlFor="password">Password</label>
                   <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded p-2 mt-1"/>
                </div>

                {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                <button type="submit" className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg mt-2">
                    {isRegistering ? 'Sign Up' : 'Login'}
                </button>
                <div className="text-center">
                    <p className="text-sm">
                        <span className="text-brand-gray">{isRegistering ? 'Already have an account?' : "Don't have an account?"}</span>
                        <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="font-semibold text-brand-primary ml-1">
                            {isRegistering ? 'Login' : 'Sign Up'}
                        </button>
                    </p>
                     <p className="text-center text-xs mt-2">
                        <button
                            type="button"
                            onClick={handleDevLogin}
                            className="font-semibold text-brand-gray hover:text-brand-primary"
                        >
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
    const futureBookings = bookings.filter(b => 
        b.artistId === artist.id && new Date(b.endDate) >= new Date()
    );

    const averageRating = useMemo(() => {
        if (!reviews || reviews.length === 0) return 0;
        const total = reviews.reduce((acc, review) => acc + review.rating, 0);
        return total / reviews.length;
    }, [reviews]);

    return (
        <Modal onClose={onClose} title={artist.name}>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {artist.portfolio.slice(0, 3).map((image, index) => (
                        <img key={index} src={`${image.url}?random=${artist.id}-${index}`} alt={`${artist.name}'s portfolio ${index+1}`} className="w-full h-48 object-cover rounded-lg bg-gray-800" />
                    ))}
                </div>
                 <div>
                    <div className="flex justify-between items-start">
                        <h3 className="text-lg font-bold text-brand-primary">{artist.specialty}</h3>
                        {averageRating > 0 && (
                            <div className="flex items-center gap-2">
                                <StarRating rating={averageRating} />
                                <span className="font-bold text-white">{averageRating.toFixed(1)}</span>
                                <span className="text-sm text-brand-gray">({reviews.length})</span>
                            </div>
                        )}
                    </div>
                    <p className="text-brand-light mt-2">{artist.bio}</p>
                    {artist.socials && (
                        <div className="flex items-center gap-4 mt-4">
                            {artist.socials.instagram && <a href={artist.socials.instagram} target="_blank" rel="noopener noreferrer" className="text-brand-gray hover:text-white">Instagram</a>}
                            {artist.socials.tiktok && <a href={artist.socials.tiktok} target="_blank" rel="noopener noreferrer" className="text-brand-gray hover:text-white">TikTok</a>}
                            {artist.socials.x && <a href={artist.socials.x} target="_blank" rel="noopener noreferrer" className="text-brand-gray hover:text-white">X</a>}
                        </div>
                    )}
                </div>

                {reviews && reviews.length > 0 && (
                <div>
                    <h4 className="font-bold text-white mb-3">Client Reviews</h4>
                    <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                        {reviews.map((review) => (
                            <div key={review.id} className="bg-gray-800/50 p-3 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="font-semibold text-gray-300">{review.authorName}</p>
                                    <StarRating rating={review.rating} className="w-4 h-4" />
                                </div>
                                <p className="text-brand-gray text-sm italic">"{review.text}"</p>
                            </div>
                        ))}
                    </div>
                </div>
                )}

                <div>
                    <h4 className="font-bold text-white mb-2">Upcoming Availability</h4>
                    <ul className="space-y-2">
                        {futureBookings.length > 0 ? futureBookings.map(booking => {
                            const shop = shops.find(s => s.id === booking.shopId);
                            return (
                                <li key={booking.id} className="bg-gray-800 p-3 rounded-lg text-sm">
                                    <p className="font-semibold text-gray-300">{shop?.name || 'Private Studio'}</p>
                                    <p className="text-brand-gray">{shop?.location || 'Unknown City'}</p>
                                    <p className="text-brand-gray">{new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}</p>
                                </li>
                            )
                        }) : <p className="text-brand-gray text-sm">No upcoming guest spots scheduled.</p>}
                    </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <button 
                        onClick={() => onMessageClick(artist.id)}
                        className="w-full bg-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2">
                        <PaperAirplaneIcon className="w-5 h-5" />
                        <span>Message Artist</span>
                    </button>
                    <button 
                        onClick={onBookRequest}
                        className="w-full bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-80 transition-colors flex items-center justify-center space-x-2">
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
            const message = error instanceof Error ? error.message : "An unexpected error occurred.";
            setInsightsError(message);
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
                    <div>
                        <p className="flex items-center text-brand-gray"><LocationIcon className="w-4 h-4 mr-2" />{shop.address}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                        <StarIcon className="w-5 h-5 text-yellow-400" />
                        <span className="text-white font-bold">{shop.rating.toFixed(1)}</span>
                    </div>
                </div>
                <div className="mt-4">
                    <h4 className="font-bold text-white mb-2">Amenities</h4>
                    <div className="flex flex-wrap gap-2">
                        {shop.amenities.map(amenity => (
                            <span key={amenity} className="bg-brand-primary/20 text-brand-primary text-xs font-semibold px-3 py-1 rounded-full">{amenity}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div>
                <h4 className="font-bold text-white mb-3">AI-Powered Insights</h4>
                <div className="bg-gray-800/50 p-4 rounded-lg">
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
                                    <h5 className="text-xs font-bold text-gray-400 mb-1">Sources:</h5>
                                    <ul className="flex flex-wrap gap-2">
                                        {insights.chunks.map((chunk, i) => (
                                            <li key={i}>
                                                <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded-md truncate">
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
                    <h4 className="font-bold text-white mb-3">Customer Reviews</h4>
                    <div className="space-y-4">
                        {shop.reviews.map((review, index) => (
                            <div key={index} className="bg-gray-800/50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="font-semibold text-gray-300">{review.authorName}</p>
                                    <StarRating rating={review.rating} className="w-4 h-4" />
                                </div>
                                <p className="text-brand-gray text-sm">{review.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h4 className="font-bold text-white mb-2">Available Booths</h4>
                 <div className="space-y-3">
                    {booths.length > 0 ? booths.map(booth => (
                        <div key={booth.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-white">{booth.name}</p>
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
        if (isSelectedStart || isSelectedEnd) {
            buttonClass += 'bg-brand-primary text-white';
        } else if (isInRange) {
            buttonClass += 'bg-brand-primary/50 text-white';
        } else if (isDisabled) {
            buttonClass += 'text-gray-600 cursor-not-allowed line-through';
        } else {
            buttonClass += 'hover:bg-gray-700 text-white';
        }

        days.push(
          <div key={day} className="p-1">
            <button
              onClick={() => !isDisabled && onDateSelect(date)}
              disabled={isDisabled}
              className={buttonClass}
            >
              {day}
            </button>
          </div>
        );
      }
      return days;
    };
  
    return (
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>&lt;</button>
          <h4 className="font-bold text-white">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-brand-gray">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => <div key={day}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 mt-2">{renderDays()}</div>
      </div>
    );
};

export const BookingModal: React.FC<{shop: Shop, booths: Booth[], bookings: Booking[], onClose: () => void, onConfirmBooking: (bookingData: Omit<Booking, 'id' | 'artistId'>) => void}> = ({ shop, booths, bookings, onClose, onConfirmBooking }) => {
    const [step, setStep] = useState(1);
    const [selectedBoothId, setSelectedBoothId] = useState<string | null>(booths.length > 0 ? booths[0].id : null);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    const bookedDatesForSelectedBooth = useMemo(() => {
        if (!selectedBoothId) return [];
        const relevantBookings = bookings.filter(b => b.boothId === selectedBoothId);
        const dates: Date[] = [];
        relevantBookings.forEach(booking => {
            let currentDate = new Date(booking.startDate);
            const stopDate = new Date(booking.endDate);
            // Adjust for timezone differences by using UTC dates
            currentDate = new Date(currentDate.valueOf() + currentDate.getTimezoneOffset() * 60 * 1000);
            stopDate.setUTCHours(23, 59, 59, 999);

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
            onConfirmBooking({
                shopId: shop.id,
                boothId: selectedBoothId,
                city: shop.location,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                paymentStatus: 'unpaid',
            });
            setStep(2);
        }
    };

    return (
        <Modal onClose={onClose} title={step === 1 ? `Book a Booth at ${shop.name}` : 'Booking Initiated'} size="xl">
            {step === 1 ? (
                 <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-brand-gray mb-1 block">Select Booth</label>
                        <select value={selectedBoothId || ''} onChange={e => { setSelectedBoothId(e.target.value); setStartDate(null); setEndDate(null); }} className="w-full bg-gray-800 border-gray-700 rounded p-2">
                           {booths.map(b => <option key={b.id} value={b.id}>{b.name} - ${b.dailyRate}/day</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Calendar bookedDates={bookedDatesForSelectedBooth} onDateSelect={handleDateSelect} selectedStartDate={startDate} selectedEndDate={endDate} />
                        <div>
                             <h4 className="font-bold text-white mb-2">Booking Summary</h4>
                             <div className="bg-gray-800 p-4 rounded-lg space-y-2 text-sm">
                                <p><strong>Start Date:</strong> {startDate ? startDate.toLocaleDateString() : 'Not Selected'}</p>
                                <p><strong>End Date:</strong> {endDate ? endDate.toLocaleDateString() : 'Not Selected'}</p>
                             </div>
                        </div>
                    </div>

                    <button onClick={handleConfirm} disabled={!selectedBoothId || !startDate || !endDate} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed">
                        Confirm Booking
                    </button>
                </div>
            ) : (
                <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">Complete Your Booking</h3>
                    <p className="text-brand-gray mb-4">Your spot is reserved pending payment. Please use one of the methods below to pay the shop directly.</p>
                    <div className="bg-gray-800 p-4 rounded-lg text-left text-sm space-y-2">
                        {shop.paymentMethods?.email && <p><strong>Interac e-Transfer:</strong> {shop.paymentMethods.email}</p>}
                        {shop.paymentMethods?.paypal && <p><strong>PayPal:</strong> {shop.paymentMethods.paypal}</p>}
                        {shop.paymentMethods?.btc && <p><strong>Bitcoin:</strong> {shop.paymentMethods.btc}</p>}
                        {!shop.paymentMethods?.email && !shop.paymentMethods?.paypal && !shop.paymentMethods?.btc && <p>Contact the shop directly for payment.</p>}
                    </div>
                     <button onClick={onClose} className="w-full bg-gray-700 text-white font-bold py-3 rounded-lg mt-6">
                        Close
                    </button>
                </div>
            )}
        </Modal>
    );
};

export const ClientBookingRequestModal: React.FC<{ artist: Artist; onClose: () => void; onSendRequest: (request: Omit<ClientBookingRequest, 'id' | 'clientId' | 'status' | 'paymentStatus'>) => void; }> = ({ artist, onClose, onSendRequest }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [message, setMessage] = useState('');
    const [tattooSize, setTattooSize] = useState('');
    const [bodyPlacement, setBodyPlacement] = useState('');
    const [hours, setHours] = useState(0);

    const handleSubmit = () => {
        if (startDate && endDate && message && tattooSize && bodyPlacement && hours > 0) {
            onSendRequest({
                artistId: artist.id,
                startDate,
                endDate,
                message,
                tattooSize,
                bodyPlacement,
                estimatedHours: hours,
            });
        }
    };

    return (
        <Modal onClose={onClose} title={`Request Booking with ${artist.name}`} size="lg">
            <div className="space-y-4">
                <p className="text-sm text-brand-gray">Select your desired dates and provide details about your tattoo idea. {artist.name} will review your request and get back to you.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="text-sm font-medium text-brand-gray mb-1 block">Availability Start</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded p-2" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-brand-gray mb-1 block">Availability End</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded p-2" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Dropdown label="Tattoo Size" value={tattooSize} onChange={e => setTattooSize(e.target.value)} options={tattooSizes} />
                    <Dropdown label="Body Placement" value={bodyPlacement} onChange={e => setBodyPlacement(e.target.value)} options={bodyPlacements} />
                    <Dropdown label="Estimated Hours" value={hours} onChange={e => setHours(Number(e.target.value))} options={estimatedHours} />
                </div>
                
                <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Tattoo Idea / Message</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full bg-gray-800 border-gray-700 rounded p-2" placeholder={`Hi ${artist.name}, I'm interested in getting a...`}></textarea>
                </div>
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

export const UploadPortfolioModal: React.FC<{ onClose: () => void, onUpload: (file: File) => void }> = ({ onClose, onUpload }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const dropzoneRef = useRef<HTMLDivElement>(null);

    const handleFileChange = (selectedFile: File | null) => {
        if (selectedFile && selectedFile.type.startsWith('image/')) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        } else {
            setFile(null);
            setPreview(null);
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropzoneRef.current) {
            dropzoneRef.current.style.borderColor = '#F04E98';
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropzoneRef.current) {
            dropzoneRef.current.style.borderColor = '#4a5568';
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropzoneRef.current) {
            dropzoneRef.current.style.borderColor = '#4a5568';
        }
        const droppedFile = e.dataTransfer.files && e.dataTransfer.files[0];
        handleFileChange(droppedFile);
    }, []);

    const handleSubmit = async () => {
        if (!file) return;
        setIsUploading(true);
        await onUpload(file);
        setIsUploading(false);
    };

    return (
        <Modal onClose={onClose} title="Upload New Portfolio Image" size="md">
            <div className="space-y-4">
                <div
                    ref={dropzoneRef}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className="w-full h-64 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-center p-4 transition-colors"
                >
                    {preview ? (
                        <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg" />
                    ) : (
                        <>
                            <UploadIcon className="w-12 h-12 text-brand-gray mb-2" />
                            <p className="font-semibold text-white">Drag & drop an image here</p>
                            <p className="text-sm text-brand-gray">or click to select a file</p>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </>
                    )}
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={!file || isUploading}
                    className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600 flex items-center justify-center space-x-2"
                >
                    {isUploading ? <><Loader /> <span>Uploading...</span></> : <> <UploadIcon className="w-5 h-5" /> <span>Upload Image</span> </> }
                </button>
            </div>
        </Modal>
    );
};

export const EditBoothModal: React.FC<{ booth: Booth, onSave: (boothId: string, data: Partial<Booth>) => void, onClose: () => void }> = ({ booth, onSave, onClose }) => {
    const [name, setName] = useState(booth.name);
    const [dailyRate, setDailyRate] = useState(booth.dailyRate);
    const [amenities, setAmenities] = useState((booth.amenities || []).join(', '));
    const [rules, setRules] = useState(booth.rules || '');

    const handleSave = () => {
        const updatedData: Partial<Booth> = {
            name,
            dailyRate,
            rules,
            amenities: amenities.split(',').map(a => a.trim()).filter(Boolean),
        };
        onSave(booth.id, updatedData);
    };

    return (
        <Modal onClose={onClose} title={`Edit ${booth.name}`} size="lg">
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Booth Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded p-2" />
                </div>
                <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Daily Rate ($)</label>
                    <input type="number" value={dailyRate} onChange={e => setDailyRate(Number(e.target.value))} className="w-full bg-gray-800 border-gray-700 rounded p-2" />
                </div>
                <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Amenities (comma-separated)</label>
                    <input type="text" value={amenities} onChange={e => setAmenities(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded p-2" placeholder="e.g., WiFi, Privacy Screen, Storage" />
                </div>
                 <div>
                    <label className="text-sm font-medium text-brand-gray mb-1 block">Booth Rules</label>
                    <textarea value={rules} onChange={e => setRules(e.target.value)} rows={3} className="w-full bg-gray-800 border-gray-700 rounded p-2"></textarea>
                </div>
                <button onClick={handleSave} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">
                    Save Changes
                </button>
            </div>
        </Modal>
    );
};

export const LeaveReviewModal: React.FC<{ request: ClientBookingRequest, onSubmit: (requestId: string, rating: number, text: string) => void, onClose: () => void }> = ({ request, onSubmit, onClose }) => {
    const [rating, setRating] = useState(0);
    const [text, setText] = useState('');

    const handleSubmit = () => {
        if (rating > 0) {
            onSubmit(request.id, rating, text);
        }
    };

    return (
        <Modal onClose={onClose} title={`Review your session with ${request.artistName}`} size="md">
            <div className="space-y-4 text-center">
                <p className="text-brand-gray">How was your experience?</p>
                <div className="flex justify-center">
                    <StarRating rating={rating} onRate={setRating} isInteractive={true} className="w-8 h-8" />
                </div>
                <div>
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Share more about your experience..." className="w-full bg-gray-800 border-gray-700 rounded p-2" />
                </div>
                <button onClick={handleSubmit} disabled={rating === 0} className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg disabled:bg-gray-600">
                    Submit Review
                </button>
            </div>
        </Modal>
    );
};

export const ImageEditorModal: React.FC<{ 
    artistId: string;
    image: PortfolioImage; 
    onClose: () => void; 
    onSave: (artistId: string, oldImage: PortfolioImage, newImageBase64: string) => Promise<void>; 
}> = ({ artistId, image, onClose, onSave }) => {
    const [prompt, setPrompt] = useState('');
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setError(null);
        setEditedImage(null);
        try {
            const resultBase64 = await editImageWithGemini(image.url, prompt);
            setEditedImage(resultBase64);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!editedImage) return;
        setIsSaving(true);
        setError(null);
        try {
            await onSave(artistId, image, editedImage);
            // The store will close the modal on success.
        } catch (err) {
            // Error is handled and displayed by the store's toast.
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal onClose={onClose} title="Edit Image with AI" size="xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column */}
                <div>
                    <h3 className="font-bold text-white mb-2">Original Image</h3>
                    <img src={image.url} alt="Original portfolio piece" className="w-full rounded-lg bg-gray-800" />
                </div>
                {/* Right column */}
                <div className="flex flex-col space-y-4">
                    <div>
                        <h3 className="font-bold text-white mb-2">Edited Image</h3>
                        <div className="w-full aspect-square bg-gray-800 rounded-lg flex items-center justify-center">
                            {isGenerating && <Loader />}
                            {!isGenerating && editedImage && (
                                <img src={`data:image/png;base64,${editedImage}`} alt="AI-edited image" className="w-full h-full object-contain rounded-lg" />
                            )}
                            {!isGenerating && !editedImage && (
                                <p className="text-brand-gray text-sm p-4 text-center">Your generated image will appear here.</p>
                            )}
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                    <div>
                        <label htmlFor="edit-prompt" className="text-sm font-medium text-brand-gray mb-1 block">Describe your edits</label>
                        <textarea
                            id="edit-prompt"
                            rows={3}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., Add a dragon flying in the sky, watercolor style"
                            className="w-full bg-gray-800 border-gray-700 rounded-lg p-2"
                            disabled={isGenerating || isSaving}
                        />
                    </div>
                    <div className="flex-grow"></div>
                    <div className="space-y-2">
                         <button
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || isGenerating || isSaving}
                            className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg flex items-center justify-center space-x-2 disabled:bg-gray-600"
                        >
                            {isGenerating ? <><Loader /> <span>Generating...</span></> : '✨ Generate'}
                        </button>
                         <button
                            onClick={handleSave}
                            disabled={!editedImage || isGenerating || isSaving}
                            className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg flex items-center justify-center space-x-2 disabled:bg-gray-600"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// --- PROFILE & DASHBOARD VIEWS ---

export const ArtistProfileView: React.FC<{ artist: Artist; updateArtist: (artistId: string, data: Partial<Artist>) => void; showToast: (message: string, type?: 'success' | 'error') => void; openModal: (type: ModalState['type'], data?: any) => void; }> = ({ artist, updateArtist, showToast, openModal }) => {
    const [bio, setBio] = useState(artist.bio);
    const [specialty, setSpecialty] = useState(artist.specialty);
    const [socials, setSocials] = useState<Socials>(artist.socials || {});
    const [isGenerating, setIsGenerating] = useState(false);

    const handleSave = () => {
        updateArtist(artist.id, { bio, specialty, socials });
        showToast("Profile saved!");
    };

    const handleGenerateBio = async () => {
        setIsGenerating(true);
        try {
            const generatedBio = await generateArtistBio(artist.name, specialty);
            setBio(generatedBio);
            showToast("AI-generated bio has been populated!");
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred.';
            showToast(message, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
         <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-800 backdrop-blur-sm max-w-4xl mx-auto">
            <div className="flex items-center space-x-4 mb-8">
                <img src={artist.portfolio.length > 0 ? artist.portfolio[0].url : `https://ui-avatars.com/api/?name=${artist.name.replace(' ', '+')}&background=101014&color=F04E98`} alt={artist.name} className="w-24 h-24 object-cover rounded-full border-4 border-gray-700 bg-gray-800" />
                <div>
                    <h2 className="text-4xl font-bold text-white">{artist.name}</h2>
                    <p className="text-brand-primary text-lg">{artist.city}</p>
                </div>
            </div>
            
            <div className="space-y-6">
                <div>
                    <label htmlFor="specialty" className="block text-sm font-medium text-brand-gray mb-1">Specialty</label>
                    <input 
                        type="text"
                        id="specialty"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    />
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label htmlFor="bio" className="block text-sm font-medium text-brand-gray">Biography</label>
                        <button 
                            onClick={handleGenerateBio}
                            disabled={isGenerating}
                            className="text-xs font-semibold bg-brand-secondary/80 text-white px-3 py-1 rounded-full hover:bg-brand-secondary transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center"
                        >
                            {isGenerating ? 'Generating...' : '✨ Generate with AI'}
                        </button>
                    </div>
                    <textarea 
                        id="bio"
                        rows={4}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    />
                </div>
                 <div>
                    <h3 className="text-sm font-medium text-brand-gray mb-2">Social Links</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input type="url" placeholder="Instagram URL" value={socials.instagram || ''} onChange={e => setSocials(s => ({...s, instagram: e.target.value}))} className="bg-gray-800 border-gray-700 rounded-lg py-2 px-3" />
                        <input type="url" placeholder="TikTok URL" value={socials.tiktok || ''} onChange={e => setSocials(s => ({...s, tiktok: e.target.value}))} className="bg-gray-800 border-gray-700 rounded-lg py-2 px-3" />
                        <input type="url" placeholder="X / Twitter URL" value={socials.x || ''} onChange={e => setSocials(s => ({...s, x: e.target.value}))} className="bg-gray-800 border-gray-700 rounded-lg py-2 px-3" />
                    </div>
                </div>
                <div>
                     <h3 className="text-sm font-medium text-brand-gray mb-2">Portfolio</h3>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {artist.portfolio.map((image, i) => (
                             <div key={i} className="relative group">
                                <img src={`${image.url}?random=${artist.id}-${i}`} alt={`Portfolio piece ${i}`} className="w-full h-32 object-cover rounded-lg bg-gray-800" />
                                {image.isAiGenerated && (
                                    <div className="absolute top-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                                        AI
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <button 
                                        onClick={() => openModal('image-editor', { image: image, artistId: artist.id })} 
                                        className="text-white p-2 bg-black/50 rounded-full" 
                                        title="Edit image with AI"
                                    >
                                        <EditIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => openModal('upload-portfolio')} className="w-full h-32 rounded-lg border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-brand-gray hover:bg-gray-800 hover:border-gray-600 transition-colors">
                            <UploadIcon className="w-8 h-8 mb-2" />
                            <span className="text-sm font-semibold">Add Image</span>
                        </button>
                     </div>
                </div>
                <div className="flex justify-end">
                    <button onClick={handleSave} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-opacity-80 transition-colors">
                        Save Changes
                    </button>
                </div>
            </div>
         </div>
    );
};

export const ClientProfileView: React.FC<{ client: Client; bookings: ClientBookingRequest[] }> = ({ client, bookings }) => {
    const upcomingBookings = bookings.filter(b => new Date(b.startDate) >= new Date() && b.status === 'approved');
    const pendingBookings = bookings.filter(b => b.status === 'pending');

    return (
        <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-800 backdrop-blur-sm max-w-4xl mx-auto">
            <div className="flex items-center space-x-4 mb-8">
                 <img src={`https://ui-avatars.com/api/?name=${client.name.replace(' ', '+')}&background=101014&color=8A4EFC`} alt={client.name} className="w-24 h-24 object-cover rounded-full border-4 border-gray-700 bg-gray-800" />
                <div>
                    <h2 className="text-4xl font-bold text-white">{client.name}</h2>
                    <p className="text-brand-secondary text-lg">InkSpace Client</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-xl font-bold text-white mb-4">Upcoming Appointments</h3>
                    <div className="space-y-3">
                        {upcomingBookings.length > 0 ? upcomingBookings.map(booking => (
                            <div key={booking.id} className="bg-gray-800 p-4 rounded-lg">
                                <p className="font-semibold text-gray-300">With {booking.artistName}</p>
                                <p className="text-sm text-brand-gray">{new Date(booking.startDate).toLocaleDateString()}</p>
                                <span className="text-xs font-bold bg-green-500/20 text-green-400 px-2 py-1 rounded-full capitalize">{booking.status}</span>
                            </div>
                        )) : <p className="text-brand-gray text-sm">No upcoming appointments.</p>}
                    </div>
                </div>
                 <div>
                    <h3 className="text-xl font-bold text-white mb-4">Pending Requests</h3>
                    <div className="space-y-3">
                        {pendingBookings.length > 0 ? pendingBookings.map(booking => (
                            <div key={booking.id} className="bg-gray-800 p-4 rounded-lg">
                                <p className="font-semibold text-gray-300">With {booking.artistName}</p>
                                <p className="text-sm text-brand-gray">{new Date(booking.startDate).toLocaleDateString()}</p>
                                <span className="text-xs font-bold bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full capitalize">{booking.status}</span>
                            </div>
                        )) : <p className="text-brand-gray text-sm">No pending requests.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};