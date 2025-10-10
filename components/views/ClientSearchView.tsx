// @/components/views/ClientSearchView.tsx
// FIX: Implement the ClientSearchView component to display a searchable list of artists for clients.

import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import type { Artist } from '../../types';
import { SearchIcon, LocationIcon, PaletteIcon, CrosshairsIcon, CheckBadgeIcon } from '../shared/Icons';
import { Loader } from '../shared/Loader';
import { ErrorDisplay } from '../shared/ErrorDisplay';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { getCityFromCoords } from '../../services/googlePlacesService';


const ArtistCard: React.FC<{ artist: Artist; onSelect: (artist: Artist) => void }> = ({ artist, onSelect }) => (
    <div 
        className="relative bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden cursor-pointer group transform hover:-translate-y-1 transition-transform duration-300"
        onClick={() => onSelect(artist)}
    >
        {artist.isVerified && (
            <div className="absolute top-2 right-2 bg-brand-secondary text-white text-xs font-bold px-2 py-1 rounded-full flex items-center z-10 shadow-lg">
                <CheckBadgeIcon className="w-4 h-4 mr-1" />
                VERIFIED
            </div>
        )}
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
    const { data: { artists }, isLoading, error, openModal, showToast } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [location, setLocation] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [isLocating, setIsLocating] = useState(false);
    const [showOnlyVerified, setShowOnlyVerified] = useState(false);
    const { isLoaded: isMapsLoaded, error: mapsError } = useGoogleMaps();

    const handleFindNearby = () => {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by your browser.", 'error');
            return;
        }

        if (!isMapsLoaded || mapsError) {
            showToast("Location service is currently unavailable.", 'error');
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const city = await getCityFromCoords({ lat: latitude, lng: longitude });
                    setLocation(city);
                    showToast(`Showing results for ${city}`);
                } catch (error) {
                    showToast(error instanceof Error ? error.message : "Could not determine your city.", 'error');
                } finally {
                    setIsLocating(false);
                }
            },
            (error) => {
                showToast("Unable to retrieve your location. Please check your browser permissions.", 'error');
                setIsLocating(false);
            }
        );
    };

    const filteredArtists = useMemo(() => {
        const artistsToFilter = showOnlyVerified ? artists.filter(a => a.isVerified) : artists;

        return artistsToFilter.filter(artist => 
            artist.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            artist.city.toLowerCase().includes(location.toLowerCase()) &&
            artist.specialty.toLowerCase().includes(specialty.toLowerCase())
        );
    }, [artists, searchTerm, location, specialty, showOnlyVerified]);
    
    if (isLoading) {
        return <div className="flex justify-center mt-16"><Loader /></div>;
    }

    if (error) {
        return <ErrorDisplay message={error} />;
    }

    return (
        <div>
            <div className="bg-gray-900/50 rounded-lg p-4 mb-8 border border-gray-800 flex flex-col md:flex-row items-center flex-wrap gap-4">
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
                 <button 
                    onClick={handleFindNearby}
                    disabled={isLocating || !isMapsLoaded}
                    className="flex items-center justify-center space-x-2 bg-brand-secondary hover:bg-opacity-80 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed w-full md:w-auto"
                >
                    {isLocating ? <div className="w-5 h-5"><Loader /></div> : <CrosshairsIcon className="w-5 h-5" />}
                    <span>Find Nearby</span>
                </button>
                <label htmlFor="verified-toggle-client" className="flex items-center cursor-pointer">
                  <span className="mr-3 text-sm font-medium text-brand-gray">Verified Only</span>
                  <div className="relative">
                    <input type="checkbox" id="verified-toggle-client" className="sr-only peer" checked={showOnlyVerified} onChange={() => setShowOnlyVerified(!showOnlyVerified)} />
                    <div className="w-12 h-7 rounded-full bg-gray-700 peer-checked:bg-brand-secondary transition-colors"></div>
                    <div className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-full"></div>
                  </div>
                </label>
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
