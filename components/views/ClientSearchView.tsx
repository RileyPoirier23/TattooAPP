// @/components/views/ClientSearchView.tsx

import React, { useState, useMemo } from 'react';
import type { Artist, Booking, User } from '../../types';
import { LocationIcon, PaletteIcon, SearchIcon, StarIcon } from '../shared/Icons';

interface ArtistCardProps {
    artist: Artist & { bookings: Booking[] };
    onArtistClick: (artist: Artist) => void;
    user: User | null;
    onLoginClick: () => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

const ArtistCard: React.FC<ArtistCardProps> = ({ artist, onArtistClick, user, onLoginClick, showToast }) => {

    const handleCardClick = () => {
        if (!artist.isVerified) {
            showToast('This artist is not yet bookable on InkSpace.', 'error');
            return;
        }
        if (!user) {
            showToast('Please log in to view artist portfolios and book.', 'error');
            onLoginClick();
            return;
        }
        onArtistClick(artist);
    };

    return (
        <div 
            onClick={handleCardClick}
            className={`bg-gray-900/50 rounded-2xl border border-gray-800 backdrop-blur-sm overflow-hidden flex flex-col group transition-all duration-300 hover:border-brand-secondary/50 hover:shadow-lg hover:shadow-brand-secondary/10 ${artist.isVerified ? 'cursor-pointer' : 'cursor-default'}`}
        >
            <div className="relative">
                <img src={artist.portfolio.length > 0 ? `${artist.portfolio[0]}?random=${artist.id}` : `https://ui-avatars.com/api/?name=${artist.name.replace(' ', '+')}&background=1A1A1D&color=F04E98`} alt={artist.name} className="w-full h-56 object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                 {artist.isVerified && (
                    <div className="absolute top-2 right-2 flex items-center bg-blue-500/80 text-white text-xs font-bold px-2 py-1 rounded-full">
                        <StarIcon className="w-3 h-3 mr-1" />
                        Verified
                    </div>
                )}
                <div className="absolute bottom-0 left-0 p-4">
                    <h3 className="font-bold text-xl text-white">{artist.name}</h3>
                    <p className="text-sm text-brand-gray">{artist.city}</p>
                </div>
            </div>
            <div className="p-4 border-t border-gray-800">
                <p className="flex items-center text-sm text-brand-primary">
                    <PaletteIcon className="w-4 h-4 mr-2" />
                    {artist.specialty}
                </p>
            </div>
        </div>
    );
};

interface ClientSearchViewProps {
    artists: (Artist & { bookings: Booking[] })[];
    onArtistClick: (artist: Artist) => void;
    user: User | null;
    onLoginClick: () => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

export const ClientSearchView: React.FC<ClientSearchViewProps> = ({ artists, onArtistClick, user, onLoginClick, showToast }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [showVerified, setShowVerified] = useState(true);
    
    const uniqueSpecialties = useMemo(() => {
        const specialties = new Set(artists.map(a => a.specialty));
        return Array.from(specialties);
    }, [artists]);

    const filteredArtists = useMemo(() => {
        return artists.filter(artist => {
            const verifiedMatch = artist.isVerified === showVerified;
            const nameMatch = artist.name.toLowerCase().includes(searchTerm.toLowerCase());
            const specialtyMatch = specialtyFilter ? artist.specialty === specialtyFilter : true;
            const locationMatch = artist.city.toLowerCase().includes(locationFilter.toLowerCase());
            return verifiedMatch && nameMatch && specialtyMatch && locationMatch;
        });
    }, [artists, searchTerm, specialtyFilter, locationFilter, showVerified]);

    return (
         <div className="space-y-8">
            <div className="bg-gray-900/50 rounded-2xl p-4 md:p-6 border border-gray-800 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label htmlFor="artist-search" className="text-sm font-semibold text-brand-gray mb-2 block">Artist Name</label>
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                            <input
                                id="artist-search"
                                type="text"
                                placeholder="Search by name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-brand-secondary focus:outline-none"
                            />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="specialty-filter" className="text-sm font-semibold text-brand-gray mb-2 block">Specialty</label>
                        <div className="relative">
                            <PaletteIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                             <select
                                id="specialty-filter"
                                value={specialtyFilter}
                                onChange={e => setSpecialtyFilter(e.target.value)}
                                className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white appearance-none focus:ring-2 focus:ring-brand-secondary focus:outline-none"
                            >
                                <option value="">All Specialties</option>
                                {uniqueSpecialties.map(spec => <option key={spec} value={spec}>{spec}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="location-search-client" className="text-sm font-semibold text-brand-gray mb-2 block">Location</label>
                        <div className="relative">
                            <LocationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                            <input
                                id="location-search-client"
                                type="text"
                                placeholder="e.g. Moncton, NB"
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-brand-secondary focus:outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-brand-gray mb-2 block">Listing Type</label>
                        <div className="flex items-center bg-gray-800 rounded-full p-1 h-[50px]">
                            <button
                                onClick={() => setShowVerified(true)}
                                className={`px-4 py-2 w-full text-sm font-semibold rounded-full transition-colors duration-300 ${showVerified ? 'bg-brand-secondary text-white' : 'text-brand-gray hover:bg-gray-700'}`}
                            >
                                Verified
                            </button>
                            <button
                                onClick={() => setShowVerified(false)}
                                className={`px-4 py-2 w-full text-sm font-semibold rounded-full transition-colors duration-300 ${!showVerified ? 'bg-brand-secondary text-white' : 'text-brand-gray hover:bg-gray-700'}`}
                            >
                                Unverified
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredArtists.map(artist => (
                    <ArtistCard 
                        key={artist.id} 
                        artist={artist} 
                        onArtistClick={onArtistClick} 
                        user={user}
                        onLoginClick={onLoginClick}
                        showToast={showToast}
                    />
                ))}
            </div>
             {filteredArtists.length === 0 && (
                <div className="text-center py-16 text-brand-gray">
                    <p className="text-lg">No artists found matching your criteria.</p>
                    <p>Try adjusting your search filters.</p>
                </div>
            )}
        </div>
    );
};