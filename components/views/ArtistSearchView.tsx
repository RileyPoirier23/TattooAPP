// @/components/views/ArtistSearchView.tsx
// FIX: Implement the ArtistSearchView component to display a searchable list of shops for artists.

import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import type { Shop } from '../../types';
import { SearchIcon, LocationIcon, StarIcon, CrosshairsIcon } from '../shared/Icons';
import { Loader } from '../shared/Loader';
import { ErrorDisplay } from '../shared/ErrorDisplay';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { getCityFromCoords } from '../../services/googlePlacesService';

const ShopCard: React.FC<{ shop: Shop; onSelect: (shop: Shop) => void }> = ({ shop, onSelect }) => (
    <div 
        className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden cursor-pointer group transform hover:-translate-y-1 transition-transform duration-300"
        onClick={() => onSelect(shop)}
    >
        <img src={`${shop.imageUrl}?random=${shop.id}`} alt={shop.name} className="w-full h-48 object-cover" />
        <div className="p-4">
            <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-white group-hover:text-brand-primary transition-colors">{shop.name}</h3>
                <div className="flex items-center space-x-1">
                    <StarIcon className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-semibold text-brand-light">{shop.rating.toFixed(1)}</span>
                </div>
            </div>
            <p className="text-sm text-brand-gray flex items-center mt-1"><LocationIcon className="w-4 h-4 mr-1.5" />{shop.location}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                {shop.amenities.slice(0, 3).map(amenity => (
                    <span key={amenity} className="text-xs bg-brand-primary/20 text-brand-primary font-semibold px-2 py-1 rounded-full">{amenity}</span>
                ))}
            </div>
        </div>
    </div>
);

export const ArtistSearchView: React.FC = () => {
    const { data: { shops }, isLoading, error, openModal, showToast } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [location, setLocation] = useState('');
    const [isLocating, setIsLocating] = useState(false);
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

    const filteredShops = useMemo(() => {
        return shops.filter(shop => 
            shop.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            shop.location.toLowerCase().includes(location.toLowerCase())
        );
    }, [shops, searchTerm, location]);
    
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
                        placeholder="Search by shop name..."
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
                 <button 
                    onClick={handleFindNearby}
                    disabled={isLocating || !isMapsLoaded}
                    className="flex items-center justify-center space-x-2 bg-brand-secondary hover:bg-opacity-80 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed w-full md:w-auto"
                >
                    {isLocating ? <div className="w-5 h-5"><Loader /></div> : <CrosshairsIcon className="w-5 h-5" />}
                    <span>Find Nearby</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredShops.map(shop => (
                    <ShopCard key={shop.id} shop={shop} onSelect={() => openModal('shop-detail', shop)} />
                ))}
            </div>

            {filteredShops.length === 0 && (
                <div className="text-center py-16">
                    <h3 className="text-xl font-semibold text-white">No Shops Found</h3>
                    <p className="text-brand-gray mt-2">Try adjusting your search terms or filters.</p>
                </div>
            )}
        </div>
    );
};