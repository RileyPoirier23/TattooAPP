
// @/components/ModalsAndProfile.tsx

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import type { Artist, Shop, Booking, Booth, Review, AuthCredentials, RegisterDetails, UserRole, ClientBookingRequest, Client, Socials, ModalState, PortfolioImage, ArtistAvailability, User, ArtistService, IntakeFormSettings } from '../types';
import { LocationIcon, StarIcon, PriceIcon, XIcon, EditIcon, PaperAirplaneIcon, CalendarIcon, UploadIcon, CheckBadgeIcon, CreditCardIcon, SparklesIcon, InstagramIcon, TikTokIcon, XIconSocial, TrashIcon, ArrowRightIcon, ArrowLeftIcon } from './shared/Icons';
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
const ImageCarousel: React.FC<{ images: PortfolioImage[] }> = ({ images }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    if (images.length === 0) {
        return <div className="w-full h-96 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center text-brand-gray">No portfolio images yet.</div>
    }

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


export const ArtistDetailModal: React.FC<{ artist: Artist; reviews: Review[]; bookings: Booking[]; shops: Shop[]; onClose: () => void; onBookRequest: () => void; showToast: (message: string, type?: 'success' | 'error') => void; onMessageClick: (artistId: string) => void; }> = ({ artist, reviews, bookings, shops, onClose, onBookRequest, onMessageClick }) => {
    
    return (
        <Modal onClose={onClose} title={artist.name} size="xl">
            <div className="space-y-6">
                <ImageCarousel images={artist.portfolio} />
                 <div>
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold text-brand-primary">{artist.specialty}</h3>
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

export const BookingModal: React.FC<{shop: Shop, booths: Booth[], bookings: Booking[], onClose: () => void, onConfirmBooking: (bookingData: Omit<Booking, 'id' | 'artistId' | 'city' | 'paymentStatus'>) => void}> = ({ shop, booths, bookings, onClose, onConfirmBooking }) => {
    const [selectedBoothId, setSelectedBoothId] = useState<string | null>(booths.length > 0 ? booths[0].id : null);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    const PLATFORM_FEE_PERCENT = 0.029;

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
            onConfirmBooking({ shopId: shop.id, boothId: selectedBoothId, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], totalAmount, platformFee });
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
                                    <p><strong>Platform Fee (2.9%):</strong> ${platformFee.toFixed(2)}</p>
                                    <p className="text-lg font-bold"><strong>Total:</strong> ${totalAmount.toFixed(2)}</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <button onClick={handleConfirm} disabled={!selectedBoothId || !startDate || !endDate} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed">
                    Confirm Booking
                </button>
            </div>
        </Modal>
    );
};

const ClientBookingCalendar: React.FC<{
  artistHours?: any;
  availability: Map<string, 'available' | 'unavailable'>;
  onDateSelect: (date: Date) => void;
  selectedStartDate: Date | null;
  selectedEndDate: Date | null;
}> = ({ artistHours, availability, onDateSelect, selectedStartDate, selectedEndDate }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
  
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();
  
    const renderDays = () => {
      const days = [];
      for (let i = 0; i < startDay; i++) {
        days.push(<div key={`empty-${i}`} className="w-full h-10"></div>);
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dateString = date.toISOString().split('T')[0];
        const status = availability.get(dateString);
        const isPast = date < new Date(new Date().toDateString());
        
        // Artist Working Hours Check
        let isWorkingDay = true;
        if (artistHours) {
            const dayIndex = date.getDay(); // 0 = Sunday
            isWorkingDay = artistHours[dayIndex] && artistHours[dayIndex].length > 0;
        }

        const isSelectedStart = selectedStartDate?.toDateString() === date.toDateString();
        const isSelectedEnd = selectedEndDate?.toDateString() === date.toDateString();
        const isInRange = selectedStartDate && selectedEndDate && date > selectedStartDate && date < selectedEndDate;
        
        const isDisabled = isPast || status === 'unavailable' || !isWorkingDay;

        let buttonClass = 'w-full h-10 rounded-full text-sm font-semibold transition-colors ';
        if (isSelectedStart || isSelectedEnd) {
            buttonClass += 'bg-brand-primary text-white';
        } else if (isInRange) {
            buttonClass += 'bg-brand-primary/50 text-white';
        } else if (isDisabled) {
            buttonClass += 'text-gray-400 dark:text-gray-600 cursor-not-allowed line-through opacity-50';
        } else if (status === 'available') {
            buttonClass += 'bg-green-500/20 hover:bg-green-500/40 text-green-800 dark:text-green-300';
        } else {
            buttonClass += 'hover:bg-gray-200 dark:hover:bg-gray-700 text-brand-dark dark:text-white';
        }

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
          <button type="button" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ArrowLeftIcon className="w-5 h-5"/></button>
          <h4 className="font-bold text-brand-dark dark:text-white">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
          <button type="button" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ArrowRightIcon className="w-5 h-5"/></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-brand-gray">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => <div key={day}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 mt-2">{renderDays()}</div>
        <div className="flex items-center space-x-4 mt-4 text-xs">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 border border-brand-primary rounded-full"></div><span>Available</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-400/30 rounded-full line-through"></div><span>Unavailable/Closed</span></div>
        </div>
      </div>
    );
};

const StepContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="animate-[fadeIn_0.3s_ease-in-out]">
        {children}
    </div>
);

export const ClientBookingRequestModal: React.FC<{ artist: Artist; availability: ArtistAvailability[]; onClose: () => void; onSendRequest: (request: Omit<ClientBookingRequest, 'id' | 'clientId' | 'status' | 'paymentStatus'>, files: File[]) => void; }> = ({ artist, availability, onClose, onSendRequest }) => {
    const { user, showToast } = useAppStore();
    const [step, setStep] = useState(1);
    // If user is not logged in, we need an extra step for contact info
    const totalSteps = user ? 3 : 4;

    // Form State
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [message, setMessage] = useState('');
    const [tattooWidth, setTattooWidth] = useState<number>(0);
    const [tattooHeight, setTattooHeight] = useState<number>(0);
    const [bodyPlacement, setBodyPlacement] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [budget, setBudget] = useState<number | undefined>();
    const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [preferredTime, setPreferredTime] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('anytime');

    // Guest Contact Fields
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');

    // Derived State
    const selectedService = useMemo(() => artist.services?.find(s => s.id === serviceId), [serviceId, artist.services]);
    const availabilityMap = useMemo(() => new Map(availability.map(a => [a.date, a.status])), [availability]);
    
    // Artist Hours for selected day
    const getHoursForDay = (date: Date) => {
        if (!artist.hours) return null;
        const dayIndex = date.getDay();
        return artist.hours[dayIndex] || [];
    };

    const selectedDayHours = startDate ? getHoursForDay(startDate) : null;
    const isArtistOpenOnSelectedDay = selectedDayHours && selectedDayHours.length > 0;

    // Navigation & Handlers
    const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

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

    const handleSuggestDuration = async () => {
        if (!artist.services || artist.services.length === 0) {
            showToast('This artist hasn\'t listed specific services for auto-suggestion yet. Please select one manually.', 'error');
            return;
        }
        if (tattooWidth <= 0 || tattooHeight <= 0) {
            showToast('Please enter valid width and height.', 'error');
            return;
        }
        setIsSuggesting(true);
        try {
            const suggestedId = await suggestTattooService(tattooWidth, tattooHeight, artist.services || []);
            setServiceId(suggestedId);
            const suggestedService = artist.services?.find(s => s.id === suggestedId);
            showToast(`Suggested service: ${suggestedService?.name || 'session'}`, 'success');
        } catch (e) {
            const message = e instanceof Error ? e.message : "Could not suggest a service.";
            showToast(message, 'error');
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setReferenceFiles(prev => [...prev, ...files].slice(0, 5)); // Limit to 5 images
            const newPreviews = files.map((file: File) => URL.createObjectURL(file));
            setPreviews(prev => [...prev, ...newPreviews].slice(0, 5));
        }
    };

    // Validation
    const isStep1Valid = tattooWidth > 0 && tattooHeight > 0 && bodyPlacement && message.trim() !== '';
    const isStep2Valid = serviceId && startDate && isArtistOpenOnSelectedDay;
    const isGuestStepValid = guestName.trim() !== '' && guestEmail.includes('@') && guestPhone.trim() !== '';

    const handleSubmit = () => {
        if (isStep1Valid && isStep2Valid && (user || isGuestStepValid)) {
            const platformFee = (selectedService?.depositAmount || 0) * 0.029;
            onSendRequest({ 
                artistId: artist.id, 
                startDate: startDate!.toISOString().split('T')[0], 
                endDate: (endDate || startDate)!.toISOString().split('T')[0], 
                message, 
                tattooWidth, 
                tattooHeight, 
                bodyPlacement, 
                depositAmount: selectedService?.depositAmount, 
                platformFee,
                serviceId,
                budget,
                preferredTime: artist.bookingMode === 'time_range' ? preferredTime : undefined,
                // Guest Fields
                guestName: !user ? guestName : undefined,
                guestEmail: !user ? guestEmail : undefined,
                guestPhone: !user ? guestPhone : undefined,
            }, referenceFiles);
        } else {
            showToast('Please fill out all required fields.', 'error');
        }
    };
    
    // UI
    const inputClasses = "w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg p-2 text-brand-dark dark:text-white";
    
    // Determine Step Titles dynamically based on if user is logged in
    const stepTitles = user 
        ? [ "Tattoo Details", "Service & Dates", "Review & Confirm" ] 
        : [ "Tattoo Details", "Service & Dates", "Contact Info", "Review & Confirm" ];
    
    const currentTitle = `Request Booking: Step ${step} of ${totalSteps} - ${stepTitles[step - 1]}`;

    return (
        <Modal onClose={onClose} title={currentTitle} size="xl">
             <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
                <div 
                    className="bg-brand-secondary h-2 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${(step / totalSteps) * 100}%` }}
                ></div>
            </div>

            {step === 1 && (
                <StepContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-brand-gray mb-1 block">Width (in)</label>
                                    <input type="number" value={tattooWidth || ''} onChange={e => setTattooWidth(parseFloat(e.target.value))} className={inputClasses} required />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-gray mb-1 block">Height (in)</label>
                                    <input type="number" value={tattooHeight || ''} onChange={e => setTattooHeight(parseFloat(e.target.value))} className={inputClasses} required />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-brand-gray mb-1 block">Body Placement</label>
                                <select value={bodyPlacement} onChange={e => setBodyPlacement(e.target.value)} className={inputClasses} required>
                                    <option value="">Select placement...</option>
                                    {bodyPlacements.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-brand-gray mb-1 block">Budget (Optional)</label>
                                <input type="number" value={budget || ''} placeholder="$" onChange={e => setBudget(parseFloat(e.target.value))} className={inputClasses} />
                            </div>
                        </div>
                        <div className="space-y-4">
                           <div>
                                <label className="text-sm font-medium text-brand-gray mb-1 block">Tattoo Idea / Message</label>
                                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} className={inputClasses} placeholder={`Hi ${artist.name}, I'm interested in getting a...`} required></textarea>
                            </div>
                           <div>
                                <label className="text-sm font-medium text-brand-gray mb-1 block">Reference Photos (Up to 5)</label>
                                <input type="file" multiple onChange={handleFileChange} accept="image/*" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-secondary/80 file:text-white hover:file:bg-brand-secondary" />
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {previews.map((p, i) => <img key={i} src={p} className="w-16 h-16 object-cover rounded-lg" alt={`Reference preview ${i + 1}`} />)}
                                </div>
                            </div>
                        </div>
                    </div>
                     <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <button onClick={nextStep} disabled={!isStep1Valid} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600">Next</button>
                    </div>
                </StepContent>
            )}

            {step === 2 && (
                <StepContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-brand-gray mb-1 block">Service</label>
                                <div className="flex gap-2 items-start">
                                    <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={`${inputClasses} capitalize flex-grow`} required>
                                        <option value="">Select a service...</option>
                                        {(artist.services || []).map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration}hr) - ${s.price}</option>)}
                                    </select>
                                    <button 
                                        type="button" 
                                        onClick={handleSuggestDuration} 
                                        className="bg-brand-secondary text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 text-sm disabled:bg-gray-600 h-10 flex-shrink-0"
                                        title={(!artist.services || artist.services.length === 0) ? "No services available to suggest from" : "Suggest a service based on size"}
                                    >
                                        {isSuggesting ? <Loader size="sm" color="white" /> : <SparklesIcon className="w-4 h-4" />}
                                        <span>Suggest</span>
                                    </button>
                                </div>
                                {(!artist.services || artist.services.length === 0) && (
                                    <p className="text-xs text-red-400 mt-1">Artist has not set up services for auto-suggestions.</p>
                                )}
                            </div>
                             {artist.bookingMode === 'time_range' && (
                                <div>
                                    <label className="text-sm font-medium text-brand-gray mb-1 block">Preferred Time of Day</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['morning', 'afternoon', 'evening', 'anytime'] as const).map(time => (
                                             <button type="button" key={time} onClick={() => setPreferredTime(time)} className={`p-2 rounded-lg text-sm capitalize transition-colors ${preferredTime === time ? 'bg-brand-primary text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>{time}</button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-brand-gray mt-2">The artist will confirm the exact time based on your preference.</p>
                                </div>
                            )}
                            
                            {startDate && (
                                <div className={`p-3 rounded-lg border ${isArtistOpenOnSelectedDay ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                    <h4 className={`font-bold text-sm ${isArtistOpenOnSelectedDay ? 'text-green-600' : 'text-red-500'}`}>
                                        {isArtistOpenOnSelectedDay ? 'Artist Availability' : 'Artist Closed'}
                                    </h4>
                                    {isArtistOpenOnSelectedDay ? (
                                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                            {selectedDayHours?.map((slot, i) => (
                                                <div key={i}>{slot.start} - {slot.end}</div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-1 text-xs text-brand-gray">The artist is not working on {startDate.toLocaleDateString('en-US', { weekday: 'long' })}s. Please choose another date.</p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                             <label className="text-sm font-medium text-brand-gray mb-1 block">Select Your Availability (select start and end date, or single day)</label>
                             <ClientBookingCalendar artistHours={artist.hours} availability={availabilityMap} onDateSelect={handleDateSelect} selectedStartDate={startDate} selectedEndDate={endDate} />
                        </div>
                    </div>
                    <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <button onClick={prevStep} className="bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-2 px-6 rounded-lg">Back</button>
                        <button onClick={nextStep} disabled={!isStep2Valid} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600">Next</button>
                    </div>
                </StepContent>
            )}

            {/* Step 3 (Only for Guests): Contact Information */}
            {!user && step === 3 && (
                <StepContent>
                    <div className="space-y-4">
                        <div className="bg-brand-secondary/10 p-4 rounded-lg border border-brand-secondary/20 mb-4">
                            <p className="text-sm text-brand-dark dark:text-white">You are booking as a guest. Please provide your contact details so the artist can reach you.</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-brand-gray mb-1 block">Full Name</label>
                            <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} className={inputClasses} placeholder="John Doe" required />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-brand-gray mb-1 block">Email Address</label>
                            <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className={inputClasses} placeholder="john@example.com" required />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-brand-gray mb-1 block">Phone Number</label>
                            <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className={inputClasses} placeholder="(555) 123-4567" required />
                        </div>
                    </div>
                    <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <button onClick={prevStep} className="bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-2 px-6 rounded-lg">Back</button>
                        <button onClick={nextStep} disabled={!isGuestStepValid} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600">Next</button>
                    </div>
                </StepContent>
            )}

            {/* Final Step: Review */}
            {step === totalSteps && (
                <StepContent>
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-brand-dark dark:text-white">Review Your Request</h3>
                        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div><strong className="text-brand-gray block">Service:</strong> {selectedService?.name}</div>
                                <div><strong className="text-brand-gray block">Dates:</strong> {startDate?.toLocaleDateString()}{endDate ? ` - ${endDate.toLocaleDateString()}`: ''}</div>
                                {artist.bookingMode === 'time_range' && <div><strong className="text-brand-gray block">Preferred Time:</strong> <span className="capitalize">{preferredTime}</span></div>}
                                <div><strong className="text-brand-gray block">Size:</strong> {tattooWidth}" x {tattooHeight}"</div>
                                <div><strong className="text-brand-gray block">Placement:</strong> {bodyPlacements.find(p => p.value === bodyPlacement)?.label}</div>
                                {budget && <div><strong className="text-brand-gray block">Budget:</strong> ${budget}</div>}
                                {!user && (
                                    <>
                                        <div className="col-span-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                            <strong className="text-brand-gray block">Contact Info:</strong>
                                            <p>{guestName} • {guestEmail} • {guestPhone}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div>
                                <strong className="text-brand-gray block">Description:</strong>
                                <p className="mt-1 whitespace-pre-wrap">{message}</p>
                            </div>
                            {previews.length > 0 && (
                                <div>
                                    <strong className="text-brand-gray block">References:</strong>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {previews.map((p, i) => <img key={i} src={p} className="w-16 h-16 object-cover rounded-lg" alt={`Reference preview ${i + 1}`} />)}
                                    </div>
                                </div>
                            )}
                             <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
                                <p className="font-semibold text-brand-dark dark:text-brand-light">Estimated Deposit: <span className="text-lg font-bold text-brand-primary">${selectedService?.depositAmount?.toFixed(2)}</span></p>
                                <p className="text-xs text-brand-gray">This deposit will be required if the artist approves your request.</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <button onClick={prevStep} className="bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-2 px-6 rounded-lg">Back</button>
                        <button onClick={handleSubmit} className="bg-brand-secondary text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center space-x-2">
                            <PaperAirplaneIcon className="w-5 h-5" />
                            <span>Send Request</span>
                        </button>
                    </div>
                </StepContent>
            )}
        </Modal>
    );
};

// ... UploadPortfolioModal, EditBoothModal, LeaveReviewModal, ShopReviewModal, VerificationRequestModal, AdminEditUserModal, AdminEditShopModal remain same ...

export const UploadPortfolioModal: React.FC<{ onClose: () => void; onUpload: (file: File) => Promise<void> }> = ({ onClose, onUpload }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (file) {
      setIsUploading(true);
      await onUpload(file);
      setIsUploading(false);
      onClose();
    }
  };

  return (
    <Modal onClose={onClose} title="Upload to Portfolio" size="md">
      <div className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
            <UploadIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-secondary/10 file:text-brand-secondary hover:file:bg-brand-secondary/20" />
        </div>
        <button onClick={handleUpload} disabled={!file || isUploading} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600">
          {isUploading ? <Loader size="sm" color="white" /> : 'Upload'}
        </button>
      </div>
    </Modal>
  );
};

export const EditBoothModal: React.FC<{ booth: Booth; onSave: (id: string, data: Partial<Booth>) => Promise<void>; onClose: () => void }> = ({ booth, onSave, onClose }) => {
    const [name, setName] = useState(booth.name);
    const [rate, setRate] = useState(booth.dailyRate);
    
    const handleSave = async () => {
        await onSave(booth.id, { name, dailyRate: rate });
        onClose();
    }
    
    return (
        <Modal onClose={onClose} title="Edit Booth" size="md">
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-brand-gray">Booth Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2"/>
                </div>
                 <div>
                    <label className="text-sm font-medium text-brand-gray">Daily Rate ($)</label>
                    <input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2"/>
                </div>
                <button onClick={handleSave} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Save Changes</button>
            </div>
        </Modal>
    )
}

export const LeaveReviewModal: React.FC<{ request: ClientBookingRequest; onSubmit: (id: string, rating: number, text: string) => Promise<void>; onClose: () => void }> = ({ request, onSubmit, onClose }) => {
    const [rating, setRating] = useState(5);
    const [text, setText] = useState('');
    
    return (
        <Modal onClose={onClose} title="Leave a Review" size="md">
            <div className="space-y-4">
                <div className="flex justify-center">
                    <StarRating rating={rating} isInteractive onRate={setRating} className="w-8 h-8" />
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={4} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" placeholder="How was your experience?"></textarea>
                <button onClick={() => onSubmit(request.id, rating, text)} className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg">Submit Review</button>
            </div>
        </Modal>
    )
}

export const ShopReviewModal: React.FC<{ booking: Booking; shop: Shop; onClose: () => void; onSubmit: (shopId: string, review: any) => Promise<void> }> = ({ booking, shop, onClose, onSubmit }) => {
    const [rating, setRating] = useState(5);
    const [text, setText] = useState('');
    
    const handleSubmit = async () => {
        // Need author info from booking context or user store, assumed handled by parent or gathered here
        // The service uses passed review object.
        // Assuming current user is artist.
        const review = {
            authorId: booking.artistId,
            authorName: 'Visiting Artist', // Backend/Service usually fetches real name or we pass it
            rating,
            text,
            createdAt: new Date().toISOString()
        }
        await onSubmit(shop.id, review);
    }

    return (
        <Modal onClose={onClose} title={`Review ${shop.name}`} size="md">
            <div className="space-y-4">
                <div className="flex justify-center">
                    <StarRating rating={rating} isInteractive onRate={setRating} className="w-8 h-8" />
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={4} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" placeholder="How was the shop environment?"></textarea>
                <button onClick={handleSubmit} className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg">Submit Review</button>
            </div>
        </Modal>
    )
}

export const VerificationRequestModal: React.FC<{ type: 'artist' | 'shop'; item: any; onSubmit: (type: 'artist' | 'shop', item: any) => Promise<void>; onClose: () => void }> = ({ type, item, onSubmit, onClose }) => {
    const handleSubmit = async () => {
        await onSubmit(type, item);
    }
    return (
        <Modal onClose={onClose} title="Request Verification" size="md">
            <div className="space-y-4 text-center">
                <CheckBadgeIcon className="w-16 h-16 text-brand-secondary mx-auto" />
                <p>Verify <strong>{item.name}</strong> to gain a trusted badge and more visibility.</p>
                <button onClick={handleSubmit} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Submit Request</button>
            </div>
        </Modal>
    )
}

export const AdminEditUserModal: React.FC<{ user: User; onSave: (id: string, data: any) => Promise<void>; onClose: () => void }> = ({ user, onSave, onClose }) => {
    const [name, setName] = useState(user.data.name);
    const [role, setRole] = useState(user.type);
    const [isVerified, setIsVerified] = useState('isVerified' in user.data ? user.data.isVerified : false);
    
    const handleSave = async () => {
        await onSave(user.id, { name, role, isVerified });
    }

    return (
        <Modal onClose={onClose} title="Edit User (Admin)" size="md">
            <div className="space-y-4">
                 <div>
                    <label className="text-sm font-medium text-brand-gray">Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2"/>
                </div>
                 <div>
                    <label className="text-sm font-medium text-brand-gray">Role</label>
                    <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2">
                        <option value="client">Client</option>
                        <option value="artist">Artist</option>
                        <option value="shop-owner">Shop Owner</option>
                        <option value="dual">Dual</option>
                    </select>
                </div>
                 <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} />
                    <span>Verified</span>
                </label>
                <button onClick={handleSave} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Save Changes</button>
            </div>
        </Modal>
    )
}

export const AdminEditShopModal: React.FC<{ shop: Shop; onSave: (id: string, data: any) => Promise<void>; onClose: () => void }> = ({ shop, onSave, onClose }) => {
    const [name, setName] = useState(shop.name);
    const [isVerified, setIsVerified] = useState(shop.isVerified);
    
    const handleSave = async () => {
        await onSave(shop.id, { name, isVerified });
    }

    return (
        <Modal onClose={onClose} title="Edit Shop (Admin)" size="md">
            <div className="space-y-4">
                 <div>
                    <label className="text-sm font-medium text-brand-gray">Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2"/>
                </div>
                 <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} />
                    <span>Verified</span>
                </label>
                <button onClick={handleSave} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Save Changes</button>
            </div>
        </Modal>
    )
}

export const BookingRequestDetailModal: React.FC<{ request: ClientBookingRequest; onClose: () => void; onRespond: (id: string, status: any) => Promise<void> }> = ({ request, onClose, onRespond }) => {
    return (
        <Modal onClose={onClose} title="Request Details" size="lg">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><strong>Client:</strong> {request.clientName}</div>
                    <div><strong>Service:</strong> {request.serviceName}</div>
                    <div><strong>Date:</strong> {new Date(request.startDate).toLocaleDateString()}</div>
                    <div><strong>Placement:</strong> {request.bodyPlacement}</div>
                    <div><strong>Size:</strong> {request.tattooWidth}" x {request.tattooHeight}"</div>
                    <div><strong>Budget:</strong> ${request.budget || 'N/A'}</div>
                </div>
                <div>
                    <strong>Message:</strong>
                    <p className="bg-gray-100 dark:bg-gray-800 p-3 rounded mt-1">{request.message}</p>
                </div>
                {request.referenceImageUrls && request.referenceImageUrls.length > 0 && (
                    <div>
                        <strong>References:</strong>
                        <div className="flex gap-2 mt-1 overflow-x-auto">
                            {request.referenceImageUrls.map((url, i) => (
                                <img key={i} src={url} alt="Ref" className="w-24 h-24 object-cover rounded" />
                            ))}
                        </div>
                    </div>
                )}
                {request.status === 'pending' && (
                    <div className="flex gap-4 mt-4">
                         <button onClick={() => onRespond(request.id, 'approved')} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg">Approve</button>
                         <button onClick={() => onRespond(request.id, 'declined')} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-lg">Decline</button>
                    </div>
                )}
            </div>
        </Modal>
    )
}

export const ArtistProfileView: React.FC<{ artist: Artist; updateArtist: (id: string, data: Partial<Artist>) => Promise<void>; deletePortfolioImage: (url: string) => Promise<void>; showToast: (msg: string, type?: 'success' | 'error') => void; openModal: (type: ModalState['type'], data?: any) => void; }> = ({ artist, updateArtist, deletePortfolioImage, showToast, openModal }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [bio, setBio] = useState(artist.bio);
    const [specialty, setSpecialty] = useState(artist.specialty);
    const [isGeneratingBio, setIsGeneratingBio] = useState(false);

    const handleSave = async () => {
        await updateArtist(artist.id, { bio, specialty });
        setIsEditing(false);
        showToast('Profile updated successfully!');
    }
    
    const handleGenerateBio = async () => {
        setIsGeneratingBio(true);
        try {
            const newBio = await generateArtistBio(artist.name, specialty, artist.city);
            setBio(newBio);
        } catch(e) {
            showToast('Failed to generate bio', 'error');
        } finally {
            setIsGeneratingBio(false);
        }
    }

    return (
        <div className="space-y-8">
             <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 relative group">
                {!isEditing && <button onClick={() => setIsEditing(true)} className="absolute top-4 right-4 text-brand-gray hover:text-brand-dark dark:hover:text-white"><EditIcon className="w-6 h-6" /></button>}
                
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                         <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=1A1A1D&color=F04E98`} alt={artist.name} className="w-full h-full object-cover"/>
                    </div>
                    <div className="flex-grow space-y-4 w-full">
                        <div>
                            <h2 className="text-3xl font-bold text-brand-dark dark:text-white flex items-center gap-2">
                                {artist.name}
                                {artist.isVerified && <CheckBadgeIcon className="w-6 h-6 text-brand-secondary" title="Verified"/>}
                            </h2>
                            <p className="text-brand-gray">{artist.city}</p>
                        </div>
                        
                        {isEditing ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-brand-gray">Specialty</label>
                                    <input type="text" value={specialty} onChange={e => setSpecialty(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-brand-gray">Bio</label>
                                    <div className="relative">
                                        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" />
                                        <button onClick={handleGenerateBio} disabled={isGeneratingBio} className="absolute bottom-2 right-2 text-xs bg-brand-primary/20 text-brand-primary px-2 py-1 rounded hover:bg-brand-primary hover:text-white transition-colors">
                                            {isGeneratingBio ? 'Generating...' : '✨ AI Write'}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleSave} className="bg-brand-primary text-white font-bold py-2 px-4 rounded">Save</button>
                                    <button onClick={() => setIsEditing(false)} className="bg-gray-200 dark:bg-gray-700 font-bold py-2 px-4 rounded">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <p className="text-brand-primary font-semibold">{artist.specialty}</p>
                                <p className="text-brand-dark dark:text-white">{artist.bio}</p>
                            </>
                        )}
                        
                         {!artist.isVerified && (
                            <button onClick={() => openModal('request-verification', artist)} className="text-sm text-brand-secondary underline">
                                Request Verification Badge
                            </button>
                        )}
                    </div>
                </div>
             </div>

             <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-brand-dark dark:text-white">Portfolio</h3>
                    <button onClick={() => openModal('upload-portfolio')} className="bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                        <UploadIcon className="w-5 h-5"/> Upload Work
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {artist.portfolio.map((img, i) => (
                        <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <img src={img.url} alt="Portfolio" className="w-full h-full object-cover" />
                            <button onClick={() => deletePortfolioImage(img.url)} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                <TrashIcon className="w-4 h-4"/>
                            </button>
                        </div>
                    ))}
                    {artist.portfolio.length === 0 && (
                        <div className="col-span-full text-center py-10 text-brand-gray">
                            No images uploaded yet.
                        </div>
                    )}
                </div>
             </div>
        </div>
    )
}

export const ClientProfileView: React.FC<{ client: Client; bookings: ClientBookingRequest[] }> = ({ client, bookings }) => {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 flex items-center gap-6">
                 <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                     <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(client.name)}&background=1A1A1D&color=F04E98`} alt={client.name} className="w-full h-full object-cover"/>
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-brand-dark dark:text-white">{client.name}</h1>
                    <p className="text-brand-gray">Client Account</p>
                </div>
            </div>
            {/* Bookings are handled in MyBookingsView generally, but simple list here */}
            <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800">
                <h2 className="text-2xl font-bold text-brand-dark dark:text-white mb-4">Your Stats</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-brand-primary">{bookings.length}</p>
                        <p className="text-sm text-brand-gray">Total Bookings</p>
                    </div>
                     <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-brand-primary">{bookings.filter(b => b.status === 'completed').length}</p>
                        <p className="text-sm text-brand-gray">Tattoos Completed</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- ADDED: ReportModal ---
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
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2" 
                    placeholder="Details about the incident..."
                ></textarea>
                <button onClick={() => onSubmit(targetId, type, reason)} disabled={!reason.trim()} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg disabled:bg-gray-600">Submit Report</button>
            </div>
        </Modal>
    );
};

// --- UPDATED: PaymentModal with Subscription Fee Logic ---
export const PaymentModal: React.FC<{ request: ClientBookingRequest; onProcessPayment: (requestId: string) => Promise<void>; onClose: () => void }> = ({ request, onProcessPayment, onClose }) => {
    const { data } = useAppStore();
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Calculate fees dynamically
    const artist = data.artists.find(a => a.id === request.artistId);
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
