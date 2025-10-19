// @/components/views/ClientSearchView.tsx
// FIX: Implement the ClientSearchView component to display a searchable list of artists for clients.

import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import type { Artist, Review, User } from '../../types';
import { SearchIcon, LocationIcon, PaletteIcon, CrosshairsIcon, CheckBadgeIcon, StarIcon } from '../shared/Icons';
import { Loader } from '../shared/Loader';
import { ErrorDisplay } from '../shared/ErrorDisplay';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { getCityFromCoords } from '../../services/googlePlacesService';
import { fetchArtistReviews } from '../../services/apiService';
import { getRecommendations } from '../../services/geminiService';


const ArtistCard: React.FC<{ artist: Artist; onSelect: (artist: Artist) => void }> = ({ artist, onSelect }) => (
    <div 
        className="relative bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden cursor-pointer group transform hover:-translate-y-1 transition-transform duration-300"
        onClick={() => onSelect(artist)}
    >
        {artist.isVerified && (
            <div className="absolute top-2 right-2 bg-brand-secondary text-white text-xs font-bold px-2 py-1 rounded-full flex items-center z-10 shadow-lg">
                <CheckBadgeIcon className="w-4 h-4 mr-1" />
                VERIFIED
            </div>
        )}
        {artist.averageRating && artist.averageRating > 0 && (
            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center z-10 backdrop-blur-sm">
                <StarIcon className="w-4 h-4 mr-1 text-yellow-400" />
                {artist.averageRating.toFixed(1)}
            </div>
        )}
        <img 
            src={artist.portfolio.length > 0 ? `${artist.portfolio[0].url}?random=${artist.id}` : `https://ui-avatars.com/api/?name=${artist.name.replace(' ', '+')}&background=1A1A1D&color=F04E98`}
            alt={artist.name} 
            className="w-full h-64 object-cover" 
        />
        <div className="p-4">
            <h3 className="text-lg font-bold text-brand-dark dark:text-white group-hover:text-brand-primary transition-colors">{artist.name}</h3>
            <p className="text-sm text-brand-primary font-semibold">{artist.specialty}</p>
            <p className="text-sm text-brand-gray flex items-center mt-1"><LocationIcon className="w-4 h-4 mr-1.5" />{artist.city}</p>
        </div>
    </div>
);

const RecommendedArtists: React.FC<{artists: Artist[], user: User}> = ({artists, user}) => {
    const [recommended, setRecommended] = useState<Artist[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { openModal, showToast } = useAppStore();

    useEffect(() => {
        const fetchRecs = async () => {
            if (user.type !== 'client' && user.type !== 'dual') {
                setIsLoading(false);
                return;
            }
            try {
                const recommendedIds = await getRecommendations('artist', artists, user.data);
                const recArtists = artists.filter(a => recommendedIds.includes(a.id));
                setRecommended(recArtists);
            } catch (error) {
                console.error("Failed to get recommendations:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRecs();
    }, [artists, user]);

    const handleSelectArtist = async (artist: Artist) => {
        try {
            const reviews = await fetchArtistReviews(artist.id);
            openModal('artist-detail', { artist, reviews });
        } catch (err) {
            showToast('Could not load artist reviews.', 'error');
            openModal('artist-detail', { artist, reviews: [] });
        }
    };
    
    if (isLoading) {
        return <div className="flex justify-center mt-8"><Loader /></div>;
    }

    if (recommended.length === 0) return null;

    const city = 'city' in user.data ? user.data.city : '';

    return (
        <div className="mb-12">
            <h2 className="text-2xl font-bold text-brand-dark dark:text-white mb-4">✨ Recommended For You {city && `in ${city}`}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {recommended.map(artist => (
                    <ArtistCard key={artist.id} artist={artist} onSelect={handleSelectArtist} />
                ))}
            </div>
            <hr className="border-gray-200 dark:border-gray-800 my-8" />
        </div>
    );
};

export const ClientSearchView: React.FC = () => {
    const { user, data: { artists }, isLoading, error, openModal, showToast } = useAppStore();
    
    // Live input state
    const [searchTerm, setSearchTerm] = useState('');
    const [location, setLocation] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [minRating, setMinRating] = useState(0);

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
            () => {
                showToast("Unable to retrieve your location. Please check your browser permissions.", 'error');
                setIsLocating(false);
            }
        );
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setLocation('');
        setSpecialty('');
        setMinRating(0);
        setShowOnlyVerified(false);
    };

    const handleSelectArtist = async (artist: Artist) => {
        try {
            const reviews = await fetchArtistReviews(artist.id);
            openModal('artist-detail', { artist, reviews });
        } catch (err) {
            showToast('Could not load artist reviews.', 'error');
            openModal('artist-detail', { artist, reviews: [] });
        }
    };

    const filteredArtists = useMemo(() => {
        const artistsToFilter = showOnlyVerified ? artists.filter(a => a.isVerified) : artists;
        return artistsToFilter.filter(artist => 
            artist.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            artist.city.toLowerCase().includes(location.toLowerCase()) &&
            artist.specialty.toLowerCase().includes(specialty.toLowerCase()) &&
            (artist.averageRating || 0) >= minRating
        );
    }, [artists, searchTerm, location, specialty, showOnlyVerified, minRating]);
    
    if (isLoading) {
        return <div className="flex justify-center mt-16"><Loader /></div>;
    }

    if (error) {
        return <ErrorDisplay message={error} />;
    }

    return (
        <div>
            <div className="bg-white dark:bg-gray-900/50 rounded-lg p-4 mb-8 border border-gray-200 dark:border-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                    <div className="relative w-full">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                            type="text"
                            placeholder="Search by artist name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg py-3 pl-10 pr-4 text-brand-dark dark:text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                        />
                    </div>
                    <div className="relative w-full">
                        <LocationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                            type="text"
                            placeholder="Filter by city..."
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg py-3 pl-10 pr-4 text-brand-dark dark:text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                        />
                    </div>
                    <div className="relative w-full">
                        <PaletteIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                            type="text"
                            placeholder="Filter by specialty..."
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg py-3 pl-10 pr-4 text-brand-dark dark:text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                        />
                    </div>
                     <div className="relative w-full">
                        <StarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <select
                            value={minRating}
                            onChange={e => setMinRating(Number(e.target.value))}
                            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg py-3 pl-10 pr-4 text-brand-dark dark:text-white focus:ring-2 focus:ring-brand-primary focus:outline-none appearance-none"
                        >
                            <option value="0">Any Rating</option>
                            <option value="4">4+ Stars</option>
                            <option value="3">3+ Stars</option>
                            <option value="2">2+ Stars</option>
                            <option value="1">1+ Stars</option>
                        </select>
                    </div>

                    <div className="md:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-4 mt-2">
                        <button 
                            type="button"
                            onClick={handleFindNearby}
                            disabled={isLocating || !isMapsLoaded}
                            className="flex items-center justify-center space-x-2 bg-brand-secondary hover:bg-opacity-80 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            {isLocating ? <div className="w-5 h-5"><Loader /></div> : <CrosshairsIcon className="w-5 h-5" />}
                            <span>Find Nearby</span>
                        </button>
                        <label htmlFor="verified-toggle-client" className="flex items-center cursor-pointer">
                          <span className="mr-3 text-sm font-medium text-brand-gray">Verified Only</span>
                          <div className="relative">
                            <input type="checkbox" id="verified-toggle-client" className="sr-only peer" checked={showOnlyVerified} onChange={() => setShowOnlyVerified(!showOnlyVerified)} />
                            <div className="w-12 h-7 rounded-full bg-gray-300 dark:bg-gray-700 peer-checked:bg-brand-secondary transition-colors"></div>
                            <div className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-full"></div>
                          </div>
                        </label>
                         <button onClick={handleClearFilters} className="text-sm font-medium text-brand-gray hover:underline">Clear Filters</button>
                    </div>
                </div>
            </div>
            
            {(user?.type === 'client' || user?.type === 'dual') && <RecommendedArtists artists={artists} user={user} />}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredArtists.map(artist => (
                    <ArtistCard key={artist.id} artist={artist} onSelect={handleSelectArtist} />
                ))}
            </div>
             {filteredArtists.length === 0 && (
                <div className="text-center py-16">
                    {searchTerm || location || specialty ? (
                        <>
                            <h3 className="text-xl font-semibold text-brand-dark dark:text-white">No Artists Found</h3>
                            <p className="text-brand-gray mt-2">Your search did not return any results. Try adjusting your filters.</p>
                        </>
                    ) : (
                         <>
                            <h3 className="text-xl font-semibold text-brand-dark dark:text-white">Find Your Artist</h3>
                            <p className="text-brand-gray mt-2">Use the search filters above to discover artists near you.</p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};