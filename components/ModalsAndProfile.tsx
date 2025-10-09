// @/components/ModalsAndProfile.tsx

import React, { useState } from 'react';
import type { Artist, Shop, Booking, Booth, Review, AuthCredentials, RegisterDetails, UserRole, GroundingChunk } from '../types';
import { LocationIcon, StarIcon, PriceIcon, XIcon, EditIcon } from './shared/Icons';
import { generateArtistBio, getShopInfo } from '../services/geminiService';
import { MapEmbed } from './shared/MapEmbed';
import { Loader } from './shared/Loader';

// --- SHARED COMPONENTS ---

const StarRating: React.FC<{ rating: number; className?: string }> = ({ rating, className = 'w-5 h-5' }) => {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    return (
        <div className="flex items-center">
            {[...Array(fullStars)].map((_, i) => <StarIcon key={`full-${i}`} className={`${className} text-yellow-400`} />)}
            {halfStar && <StarIcon key="half" className={`${className} text-yellow-400`} style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }} />}
            {[...Array(emptyStars)].map((_, i) => <StarIcon key={`empty-${i}`} className={`${className} text-gray-600`} />)}
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

// --- AUTHENTICATION MODAL ---

export const AuthModal: React.FC<{onLogin: (credentials: AuthCredentials) => void; onRegister: (details: RegisterDetails) => void; onClose: () => void;}> = ({ onLogin, onRegister, onClose }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [city, setCity] = useState('');
    const [role, setRole] = useState<UserRole>('artist');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isRegistering) {
            onRegister({ username, password, type: role, name, city });
        } else {
            onLogin({ username, password });
        }
    };
    
    return (
        <Modal onClose={onClose} title={isRegistering ? "Create Account" : "Welcome Back"} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                {isRegistering && (
                    <>
                        <div className="mb-4">
                            <label className="text-sm font-bold text-brand-gray mb-2 block">I am a...</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['artist', 'client', 'shop-owner'] as UserRole[]).map(r => (
                                    <button type="button" key={r} onClick={() => setRole(r)} className={`p-2 rounded-lg text-sm capitalize ${role === r ? 'bg-brand-primary text-white' : 'bg-gray-800 text-gray-300'}`}>
                                        {r.replace('-', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                           <label className="text-sm text-brand-gray" htmlFor="name">Full Name</label>
                           <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded p-2 mt-1"/>
                        </div>
                        {role === 'artist' && (
                             <div>
                               <label className="text-sm text-brand-gray" htmlFor="city">Your City (e.g., Moncton, NB)</label>
                               <input id="city" type="text" value={city} onChange={e => setCity(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded p-2 mt-1"/>
                            </div>
                        )}
                    </>
                )}
                <div>
                   <label className="text-sm text-brand-gray" htmlFor="username">Username</label>
                   <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded p-2 mt-1"/>
                </div>
                <div>
                   <label className="text-sm text-brand-gray" htmlFor="password">Password</label>
                   <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-800 border-gray-700 rounded p-2 mt-1"/>
                </div>
                <button type="submit" className="w-full bg-brand-secondary text-white font-bold py-3 rounded-lg mt-2">
                    {isRegistering ? 'Sign Up' : 'Login'}
                </button>
                <p className="text-center text-sm">
                    <span className="text-brand-gray">{isRegistering ? 'Already have an account?' : "Don't have an account?"}</span>
                    <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="font-semibold text-brand-primary ml-1">
                        {isRegistering ? 'Login' : 'Sign Up'}
                    </button>
                </p>
            </form>
        </Modal>
    );
};


// --- DETAIL & ACTION MODALS ---

export const ArtistDetailModal: React.FC<{ artist: Artist; bookings: Booking[]; shops: Shop[]; onClose: () => void; }> = ({ artist, bookings, shops, onClose }) => {
    const artistBookings = bookings.filter(b => b.artistId === artist.id);
    return (
        <Modal onClose={onClose} title={artist.name}>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {artist.portfolio.map((url, index) => (
                        <img key={index} src={`${url}?random=${artist.id}-${index}`} alt={`${artist.name}'s portfolio ${index+1}`} className="w-full h-48 object-cover rounded-lg" />
                    ))}
                </div>
                 <div>
                    <h3 className="text-lg font-bold text-brand-primary">{artist.specialty}</h3>
                    <p className="text-brand-light mt-2">{artist.bio}</p>
                </div>
                <div>
                    <h4 className="font-bold text-white mb-2">Upcoming Availability</h4>
                    <ul className="space-y-2">
                        {artistBookings.length > 0 ? artistBookings.map(booking => {
                            const shop = shops.find(s => s.id === booking.shopId);
                            return (
                                <li key={booking.id} className="bg-gray-800 p-3 rounded-lg text-sm">
                                    <p className="font-semibold text-gray-300">{shop?.name || 'Private Studio'}</p>
                                    <p className="text-brand-gray">{booking.city}</p>
                                    <p className="text-brand-gray">{new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}</p>
                                </li>
                            )
                        }) : <p className="text-brand-gray text-sm">No upcoming guest spots scheduled.</p>}
                    </ul>
                </div>
                <button className="w-full bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-80 transition-colors">
                    Request Booking with {artist.name}
                </button>
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
                                    <p className="font-semibold text-gray-300">{review.author}</p>
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

export const BookingModal: React.FC<{shop: Shop, booths: Booth[], onClose: () => void, onConfirmBooking: (bookingData: Omit<Booking, 'id' | 'artistId'>) => void}> = ({ shop, booths, onClose, onConfirmBooking }) => {
    const [step, setStep] = useState(1);
    const [selectedBoothId, setSelectedBoothId] = useState<string | null>(booths.length > 0 ? booths[0].id : null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleConfirm = () => {
        if (selectedBoothId && startDate && endDate) {
            onConfirmBooking({
                shopId: shop.id,
                boothId: selectedBoothId,
                city: shop.location,
                startDate,
                endDate
            });
            setStep(2);
        }
    };

    return (
        <Modal onClose={onClose} title={step === 1 ? `Book a Booth at ${shop.name}` : 'Booking Initiated'} size="md">
            {step === 1 ? (
                 <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-brand-gray mb-1 block">Select Booth</label>
                        <select value={selectedBoothId || ''} onChange={e => setSelectedBoothId(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded p-2">
                           {booths.map(b => <option key={b.id} value={b.id}>{b.name} - ${b.dailyRate}/day</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="text-sm font-medium text-brand-gray mb-1 block">Start Date</label>
                             <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded p-2"/>
                        </div>
                        <div>
                             <label className="text-sm font-medium text-brand-gray mb-1 block">End Date</label>
                             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded p-2"/>
                        </div>
                    </div>
                    <button onClick={handleConfirm} disabled={!selectedBoothId || !startDate || !endDate} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600">
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


// --- PROFILE VIEW ---

export const ArtistProfileView: React.FC<{ artist: Artist; updateArtist: (artistId: string, data: Partial<Artist>) => void; showToast: (message: string, type?: 'success' | 'error') => void; }> = ({ artist, updateArtist, showToast }) => {
    const [bio, setBio] = useState(artist.bio);
    const [specialty, setSpecialty] = useState(artist.specialty);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleSave = () => {
        updateArtist(artist.id, { bio, specialty });
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
                <img src={`${artist.portfolio[0]}?random=${artist.id}`} alt={artist.name} className="w-24 h-24 object-cover rounded-full border-4 border-gray-700" />
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
                            {isGenerating ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Generating...
                                </>
                            ) : (
                                '✨ Generate with AI'
                            )}
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
                     <h3 className="text-sm font-medium text-brand-gray mb-2">Portfolio</h3>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {artist.portfolio.map((url, i) => (
                             <div key={i} className="relative group">
                                <img src={`${url}?random=${artist.id}-${i}`} alt={`Portfolio piece ${i}`} className="w-full h-32 object-cover rounded-lg" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <button className="text-white" title="Edit image">
                                        <EditIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button className="w-full h-32 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center text-brand-gray hover:bg-gray-800 hover:border-gray-600 transition-colors">
                            + Add
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