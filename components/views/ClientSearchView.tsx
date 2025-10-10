// @/components/views/ClientSearchView.tsx
// FIX: Implement the ClientSearchView component to display a searchable list of artists for clients.

import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import type { Artist } from '../../types';
import { SearchIcon, LocationIcon, PaletteIcon } from '../shared/Icons';
import { Loader } from '../shared/Loader';
import { ErrorDisplay } from '../shared/ErrorDisplay';

const ArtistCard: React.FC<{ artist: Artist; onSelect: (artist: Artist) => void }> = ({ artist, onSelect }) => (
    <div 
        className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden cursor-pointer group transform hover:-translate-y-1 transition-transform duration-300"
        onClick={() => onSelect(artist)}
    >
        <img 
            src={artist.portfolio.length > 0 ? `${artist.portfolio[0]}?random=${artist.id}` : `https://ui-avatars.com/api/?name=${artist.name.replace(' ', '+')}&background=1A1A1D&color=F04E98`}
            alt={artist.name} 
            className="w-full h-64 object-cover" 
        />
        <div className="p-4">
            <h3 className="text-lg font-bold text-white group-hover:text-brand-primary transition-colors">{artist.name}</h3>
            <p className="text-sm text-brand-primary font-semibold">{artist.specialty}</p>
            <p className="text-sm text-brand-gray flex items-center mt-1"><LocationIcon className="w-4 h-4 mr-1.5" />{artist.city}</p>
        </div>
    </div>
);

export const ClientSearchView: React.FC = () => {
    const { data: { artists }, isLoading, error, openModal } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [location, setLocation] = useState('');
    const [specialty, setSpecialty] = useState('');

    const filteredArtists = useMemo(() => {
        return artists.filter(artist => 
            artist.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            artist.city.toLowerCase().includes(location.toLowerCase()) &&
            artist.specialty.toLowerCase().includes(specialty.toLowerCase())
        );
    }, [artists, searchTerm, location, specialty]);
    
    if (isLoading) {
        return <div className="flex justify-center mt-16"><Loader /></div>;
    }

    if (error) {
        return <ErrorDisplay message={error} />;
    }

    return (
        <div>
            <div className="bg-gray-900/50 rounded-lg p-4 mb-8 border border-gray-800 flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-grow w-full md:w-auto">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                    <input
                        type="text"
                        placeholder="Search by artist name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    />
                </div>
                 <div className="relative flex-grow w-full md:w-auto">
                    <LocationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                    <input
                        type="text"
                        placeholder="Filter by city..."
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    />
                </div>
                <div className="relative flex-grow w-full md:w-auto">
                    <PaletteIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                    <input
                        type="text"
                        placeholder="Filter by specialty..."
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredArtists.map(artist => (
                    <ArtistCard key={artist.id} artist={artist} onSelect={() => openModal('artist-detail', artist)} />
                ))}
            </div>
             {filteredArtists.length === 0 && (
                <div className="text-center py-16">
                    <h3 className="text-xl font-semibold text-white">No Artists Found</h3>
                    <p className="text-brand-gray mt-2">Try adjusting your search terms or filters.</p>
                </div>
            )}
        </div>
    );
};
