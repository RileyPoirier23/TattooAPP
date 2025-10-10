// @/components/views/ArtistSearchView.tsx

import React, { useState, useMemo } from 'react';
import type { Shop, Booth, User } from '../../types';
import { LocationIcon, StarIcon, SearchIcon, DirectionsIcon } from '../shared/Icons';

interface ShopCardProps {
    shop: Shop & { booths: Booth[] };
    onShopClick: (shop: Shop) => void;
    onGetDirections: (address: string) => void;
    user: User | null;
    onLoginClick: () => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

const ShopCard: React.FC<ShopCardProps> = ({ shop, onShopClick, onGetDirections, user, onLoginClick, showToast }) => {
    const availableBoothsCount = shop.booths.length;
    const minRate = useMemo(() => {
        if (shop.booths.length === 0) return 0;
        return Math.min(...shop.booths.map(b => b.dailyRate));
    }, [shop.booths]);

    const handleViewDetails = () => {
        if (!user) {
            showToast('Please log in to view shop details and book.', 'error');
            onLoginClick();
            return;
        }
        onShopClick(shop);
    };

    return (
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 backdrop-blur-sm overflow-hidden flex flex-col transition-all duration-300 hover:border-brand-primary/50 hover:shadow-lg hover:shadow-brand-primary/10">
            <img src={`${shop.imageUrl}?random=${shop.id}`} alt={shop.name} className="w-full h-48 object-cover" />
            <div className="p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-xl text-white">{shop.name}</h3>
                    <div className="flex items-center space-x-1 bg-gray-800 px-2 py-1 rounded-full text-sm">
                        <StarIcon className="w-4 h-4 text-yellow-400" />
                        <span className="font-semibold text-white">{shop.rating.toFixed(1)}</span>
                    </div>
                </div>
                <p className="flex items-center text-sm text-brand-gray mb-4">
                    <LocationIcon className="w-4 h-4 mr-2" />
                    {shop.location}
                </p>
                
                <div className="mt-auto space-y-3">
                     <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Available Booths:</span>
                        <span className="font-semibold text-white">{availableBoothsCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Starts from:</span>
                        <span className="font-semibold text-brand-primary">${minRate > 0 ? minRate : 'N/A'}/day</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                         <button 
                            onClick={() => onGetDirections(shop.address)}
                            className="w-full bg-gray-700/50 text-white font-semibold py-2 px-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2 text-sm">
                            <DirectionsIcon className="w-4 h-4"/>
                            <span>Directions</span>
                        </button>
                        <button 
                            onClick={handleViewDetails} 
                            disabled={!shop.isVerified}
                            className="w-full bg-brand-primary text-white font-bold py-2 px-3 rounded-lg hover:bg-opacity-80 transition-colors text-sm disabled:bg-gray-600 disabled:cursor-not-allowed">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ArtistSearchViewProps {
    shops: (Shop & { booths: Booth[] })[];
    onShopClick: (shop: Shop) => void;
    onGetDirections: (address: string) => void;
    userLocation: { lat: number, lng: number } | null;
    getLocation: () => void;
    isGettingLocation: boolean;
    user: User | null;
    onLoginClick: () => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

export const ArtistSearchView: React.FC<ArtistSearchViewProps> = ({ shops, onShopClick, onGetDirections, userLocation, getLocation, isGettingLocation, user, onLoginClick, showToast }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [showVerified, setShowVerified] = useState(true);

    const filteredShops = useMemo(() => {
        return shops.filter(shop => {
            const verifiedMatch = shop.isVerified === showVerified;
            const nameMatch = shop.name.toLowerCase().includes(searchTerm.toLowerCase());
            const locationMatch = shop.location.toLowerCase().includes(locationFilter.toLowerCase());
            return verifiedMatch && nameMatch && locationMatch;
        });
    }, [shops, searchTerm, locationFilter, showVerified]);

    return (
        <div className="space-y-8">
            <div className="bg-gray-900/50 rounded-2xl p-4 md:p-6 border border-gray-800 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div className="lg:col-span-1">
                        <label htmlFor="shop-search" className="text-sm font-semibold text-brand-gray mb-2 block">Shop Name</label>
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                            <input
                                id="shop-search"
                                type="text"
                                placeholder="Search by shop name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                            />
                        </div>
                    </div>
                    <div className="lg:col-span-1">
                        <label htmlFor="location-search" className="text-sm font-semibold text-brand-gray mb-2 block">Location</label>
                        <div className="relative">
                            <LocationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                            <input
                                id="location-search"
                                type="text"
                                placeholder="e.g. Toronto, ON"
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                            />
                        </div>
                    </div>
                    <div className="lg:col-span-1">
                        <label className="text-sm font-semibold text-brand-gray mb-2 block">Listing Type</label>
                        <div className="flex items-center bg-gray-800 rounded-full p-1 h-[50px]">
                            <button
                                onClick={() => setShowVerified(true)}
                                className={`px-4 py-2 w-full text-sm font-semibold rounded-full transition-colors duration-300 ${showVerified ? 'bg-brand-primary text-white' : 'text-brand-gray hover:bg-gray-700'}`}
                            >
                                Verified
                            </button>
                            <button
                                onClick={() => setShowVerified(false)}
                                className={`px-4 py-2 w-full text-sm font-semibold rounded-full transition-colors duration-300 ${!showVerified ? 'bg-brand-primary text-white' : 'text-brand-gray hover:bg-gray-700'}`}
                            >
                                Unverified
                            </button>
                        </div>
                    </div>
                     <div className="lg:col-span-1">
                        <button onClick={getLocation} disabled={isGettingLocation} className="w-full bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 disabled:bg-gray-600 h-[50px]">
                           {isGettingLocation ? 'Locating...' : 'Find Shops Near Me'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredShops.map(shop => (
                    <ShopCard 
                        key={shop.id} 
                        shop={shop} 
                        onShopClick={onShopClick} 
                        onGetDirections={onGetDirections} 
                        user={user} 
                        onLoginClick={onLoginClick} 
                        showToast={showToast} 
                    />
                ))}
            </div>
            {filteredShops.length === 0 && (
                <div className="text-center py-16 text-brand-gray">
                    <p className="text-lg">No shops found matching your criteria.</p>
                    <p>Try adjusting your search filters.</p>
                </div>
            )}
        </div>
    );
};