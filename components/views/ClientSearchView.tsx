// @/components/views/ClientSearchView.tsx

import React, { useState, useMemo } from 'react';
import type { Artist, Booking } from '../../types';
import { LocationIcon, PaletteIcon, SearchIcon, StarIcon } from '../shared/Icons';

interface ArtistCardProps {
    artist: Artist & { bookings: Booking[] };
    onArtistClick: (artist: Artist) => void;
}

const ArtistCard: React.FC<ArtistCardProps> = ({ artist, onArtistClick }) => {
    return (
        <div 
            onClick={() => onArtistClick(artist)}
            className="bg-gray-900/50 rounded-2xl border border-gray-800 backdrop-blur-sm overflow-hidden flex flex-col group cursor-pointer transition-all duration-300 hover:border-brand-secondary/50 hover:shadow-lg hover:shadow-brand-secondary/10"
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
    bookings: Booking[];
    onArtistClick: (artist: Artist) => void;
}

export const ClientSearchView: React.FC<ClientSearchViewProps> = ({ artists, onArtistClick }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    
    const uniqueSpecialties = useMemo(() => {
        const specialties = new Set(artists.map(a => a.specialty));
        return Array.from(specialties);
    }, [artists]);

    const filteredArtists = useMemo(() => {
        return artists.filter(artist => {
            const nameMatch = artist.name.toLowerCase().includes(searchTerm.toLowerCase());
            const specialtyMatch = specialtyFilter ? artist.specialty === specialtyFilter : true;
            const locationMatch = artist.city.toLowerCase().includes(locationFilter.toLowerCase());
            return nameMatch && specialtyMatch && locationMatch;
        });
    }, [artists, searchTerm, specialtyFilter, locationFilter]);

    return (
         <div className="space-y-8">
            <div className="bg-gray-900/50 rounded-2xl p-4 md:p-6 border border-gray-800 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredArtists.map(artist => (
                    <ArtistCard key={artist.id} artist={artist} onArtistClick={onArtistClick} />
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
