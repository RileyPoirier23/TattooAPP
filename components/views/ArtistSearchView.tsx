// @/components/views/ArtistSearchView.tsx
// FIX: Implement the ArtistSearchView component to display a searchable list of shops for artists.

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import type { Artist, Shop } from '../../types';
import { SearchIcon, LocationIcon, StarIcon, CrosshairsIcon, CheckBadgeIcon } from '../shared/Icons';
import { Loader } from '../shared/Loader';
import { ErrorDisplay } from '../shared/ErrorDisplay';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { getCityFromCoords, findTattooShops } from '../../services/googlePlacesService';
import { getRecommendations } from '../../services/geminiService';

const ShopCard: React.FC<{ shop: Partial<Shop>; onSelect: (shop: Shop) => void }> = ({ shop, onSelect }) => (
    <div 
        className={`relative bg-white dark:bg-gray-900/50 rounded-lg border ${shop.isVerified ? 'border-brand-secondary/30 dark:border-brand-secondary/50' : 'border-gray-200 dark:border-gray-800'} overflow-hidden group transform hover:-translate-y-1 transition-transform duration-300 ${shop.isVerified ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => shop.isVerified && onSelect(shop as Shop)}
    >
        {shop.isVerified && (
            <div className="absolute top-2 right-2 bg-brand-secondary text-white text-xs font-bold px-2 py-1 rounded-full flex items-center z-10 shadow-lg">
                <CheckBadgeIcon className="w-4 h-4 mr-1" />
                VERIFIED
            </div>
        )}
        <img src={`${shop.imageUrl}?random=${shop.id}`} alt={shop.name} className="w-full h-48 object-cover" />
        <div className="p-4">
            <div className="flex justify-between items-start">
                <h3 className={`text-lg font-bold ${shop.isVerified ? 'text-brand-dark dark:text-white group-hover:text-brand-primary' : 'text-gray-500 dark:text-gray-400'} transition-colors`}>{shop.name}</h3>
                <div className="flex items-center space-x-1">
                    <StarIcon className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-semibold text-brand-dark dark:text-brand-light">{shop.averageArtistRating?.toFixed(1)}</span>
                </div>
            </div>
            <p className="text-sm text-brand-gray flex items-center mt-1"><LocationIcon className="w-4 h-4 mr-1.5" />{shop.address}</p>
            {shop.isVerified && shop.amenities && (
              <div className="mt-3 flex flex-wrap gap-2">
                  {shop.amenities.slice(0, 3).map(amenity => (
                      <span key={amenity} className="text-xs bg-brand-primary/20 text-brand-primary font-semibold px-2 py-1 rounded-full">{amenity}</span>
                  ))}
              </div>
            )}
        </div>
        {!shop.isVerified && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 text-center backdrop-blur-sm">
                <p className="text-brand-gray text-sm">This is an unverified listing. <br /> Shop owners can sign up to claim this page.</p>
            </div>
        )}
    </div>
);

const RecommendedShops: React.FC<{shops: Shop[], artist: Artist}> = ({shops, artist}) => {
    const [recommended, setRecommended] = useState<Shop[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { openModal } = useAppStore();

    useEffect(() => {
        const fetchRecs = async () => {
            try {
                const recommendedIds = await getRecommendations('shop', shops, artist);
                const recShops = shops.filter(s => recommendedIds.includes(s.id));
                setRecommended(recShops);
            } catch (error) {
                console.error("Failed to get recommendations:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRecs();
    }, [shops, artist]);
    
    if (isLoading) {
        return <div className="flex justify-center mt-8"><Loader /></div>;
    }

    if (recommended.length === 0) return null;

    return (
        <div className="mb-12">
            <h2 className="text-2xl font-bold text-brand-dark dark:text-white mb-4">✨ Recommended For You in <span className="text-brand-secondary">{artist.city}</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommended.map(shop => (
                    <ShopCard key={shop.id} shop={shop} onSelect={(s) => openModal('shop-detail', s)} />
                ))}
            </div>
            <hr className="border-gray-200 dark:border-gray-800 my-8" />
        </div>
    );
};


export const ArtistSearchView: React.FC = () => {
    const { user, data: { shops }, isLoading, error, openModal, showToast } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [location, setLocation] = useState('');
    const [searchedLocation, setSearchedLocation] = useState('');
    const [isLocating, setIsLocating] = useState(false);
    const [unverifiedShops, setUnverifiedShops] = useState<Partial<Shop>[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [showOnlyVerified, setShowOnlyVerified] = useState(false);
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
    const [isFilterMenuOpen, setFilterMenuOpen] = useState(false);

    const { isLoaded: isMapsLoaded, error: mapsError } = useGoogleMaps();

    const allAmenities = useMemo(() => {
        const amenitySet = new Set<string>();
        shops.forEach(shop => shop.amenities?.forEach(a => amenitySet.add(a)));
        return Array.from(amenitySet);
    }, [shops]);

    const handleAmenityToggle = (amenity: string) => {
        setSelectedAmenities(prev => 
            prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
        );
    };

    const handleLocationSearch = useCallback(async (loc: string) => {
        setSearchError(null);
        if (!loc.trim()) {
            setUnverifiedShops([]);
            setSearchedLocation('');
            return;
        }
        if (!isMapsLoaded) {
            showToast('Location services are not available.', 'error');
            return;
        }
        setIsSearching(true);
        setSearchedLocation(loc);
        setUnverifiedShops([]); // Clear previous results before new search
        try {
            const placesResults = await findTattooShops(loc);
            setUnverifiedShops(placesResults);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not search for local shops.';
            setSearchError(message);
        } finally {
            setIsSearching(false);
        }
    }, [isMapsLoaded, showToast]);

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
                    await handleLocationSearch(city);
                } catch (err) {
                    const message = err instanceof Error ? err.message : "Could not determine your city.";
                    setSearchError(message);
                } finally {
                    setIsLocating(false);
                }
            },
            () => {
                showToast("Unable to retrieve your location. Please check browser permissions.", 'error');
                setIsLocating(false);
            }
        );
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setLocation('');
        setSearchedLocation('');
        setSelectedAmenities([]);
        setShowOnlyVerified(false);
        setUnverifiedShops([]);
    };

    const combinedShops = useMemo(() => {
        const unverifiedOnly = unverifiedShops.filter(us => 
            !shops.some(vs => vs.name.toLowerCase().trim() === us.name?.toLowerCase().trim())
        );

        let allShops: Partial<Shop>[] = [...shops];
        
        if (!showOnlyVerified) {
            allShops = [...allShops, ...unverifiedOnly];
        }

        return allShops.filter(shop =>
            shop.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
            (searchedLocation ? shop.location?.toLowerCase().includes(searchedLocation.toLowerCase()) : true) &&
            (selectedAmenities.length > 0 ? selectedAmenities.every(a => shop.amenities?.includes(a)) : true)
        );
    }, [shops, unverifiedShops, searchTerm, searchedLocation, showOnlyVerified, selectedAmenities]);
    
    if (isLoading) {
        return <div className="flex justify-center mt-16"><Loader /></div>;
    }

    if (error) {
        return <ErrorDisplay message={error} />;
    }

    return (
        <div>
            <div className="bg-white dark:bg-gray-900/50 rounded-lg p-4 mb-8 border border-gray-200 dark:border-gray-800 flex flex-col items-center gap-4">
                 {mapsError && (
                    <div className="w-full bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-center mb-4">
                        <p className="text-red-300 font-semibold text-sm">Location Services Error</p>
                        <p className="text-xs text-red-300/80 mt-1">{mapsError.message}</p>
                    </div>
                )}
                <div className="w-full flex flex-col md:flex-row items-center gap-4">
                    <div className="relative flex-grow w-full md:w-auto">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                            type="text"
                            placeholder="Search by shop name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg py-3 pl-10 pr-4 text-brand-dark dark:text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                        />
                    </div>
                    <form className="flex-grow w-full md:w-auto flex gap-2" onSubmit={(e) => { e.preventDefault(); handleLocationSearch(location); }}>
                        <div className="relative flex-grow">
                            <LocationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                            <input
                                type="text"
                                placeholder="Filter by city..."
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg py-3 pl-10 pr-4 text-brand-dark dark:text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                                disabled={!!mapsError}
                            />
                        </div>
                        <button type="submit" disabled={!!mapsError || !isMapsLoaded} className="bg-brand-primary hover:bg-opacity-80 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">Search</button>
                    </form>
                     <button 
                        onClick={handleFindNearby}
                        disabled={isLocating || !isMapsLoaded || !!mapsError}
                        className="flex items-center justify-center space-x-2 bg-brand-secondary hover:bg-opacity-80 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed w-full md:w-auto"
                    >
                        {isLocating ? <div className="w-5 h-5"><Loader /></div> : <CrosshairsIcon className="w-5 h-5" />}
                        <span>Find Nearby</span>
                    </button>
                </div>
                 <div className="w-full flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-800/50">
                     <div className="relative">
                        <button onClick={() => setFilterMenuOpen(!isFilterMenuOpen)} className="flex items-center space-x-2 text-sm font-medium text-brand-gray bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                            <span>Filter by Amenities</span>
                        </button>
                        {isFilterMenuOpen && (
                            <div className="absolute top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 p-4">
                                <h4 className="font-semibold mb-2">Amenities</h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {allAmenities.map(amenity => (
                                        <label key={amenity} className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={selectedAmenities.includes(amenity)} onChange={() => handleAmenityToggle(amenity)} className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-brand-primary focus:ring-brand-primary" />
                                            <span>{amenity}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <label htmlFor="verified-toggle" className="flex items-center cursor-pointer flex-shrink-0">
                      <span className="mr-3 text-sm font-medium text-brand-gray">Verified Only</span>
                      <div className="relative">
                        <input type="checkbox" id="verified-toggle" className="sr-only peer" checked={showOnlyVerified} onChange={() => setShowOnlyVerified(!showOnlyVerified)} />
                        <div className="w-12 h-7 rounded-full bg-gray-300 dark:bg-gray-700 peer-checked:bg-brand-secondary transition-colors"></div>
                        <div className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-full"></div>
                      </div>
                    </label>
                    <button onClick={handleClearFilters} className="text-sm font-medium text-brand-gray hover:underline">Clear Filters</button>
                </div>
            </div>

            {(user?.type === 'artist' || user?.type === 'dual') && <RecommendedShops shops={shops} artist={user.data} />}

            {isSearching && <div className="flex justify-center mt-16"><Loader /></div>}

            {searchError && (
                 <div className="text-center py-16">
                    <h3 className="text-xl font-semibold text-red-400">Search Failed</h3>
                    <p className="text-brand-gray mt-2">{searchError}</p>
                </div>
            )}

            {!isSearching && !searchError && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {combinedShops.map(shop => (
                            <ShopCard key={shop.id} shop={shop} onSelect={(s) => openModal('shop-detail', s)} />
                        ))}
                    </div>

                    {combinedShops.length === 0 && (
                        <div className="text-center py-16">
                            <h3 className="text-xl font-semibold text-brand-dark dark:text-white">No Shops Found</h3>
                            {searchedLocation ? (
                                <p className="text-brand-gray mt-2">Your search for shops in <span className="font-bold text-brand-dark dark:text-white">{searchedLocation}</span> did not return any results.</p>
                            ) : (
                                <p className="text-brand-gray mt-2">Enter a city to find local tattoo shops.</p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};