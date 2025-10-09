import React, { useState, useMemo } from 'react';
import type { Shop, Booth } from '../../types';
import { LocationIcon, PriceIcon, SearchIcon, StarIcon, DirectionsIcon } from '../shared/Icons';

interface ArtistSearchViewProps {
  shops: Shop[];
  booths: Booth[];
  userLocation: { lat: number; lng: number } | null;
  getLocation: () => void;
  onSelectShop: (shop: Shop) => void;
}

const getDistance = (
  loc1: { lat: number; lng: number },
  loc2: { lat: number; lng: number }
): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180);
  const dLon = (loc2.lng - loc1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(loc1.lat * (Math.PI / 180)) *
      Math.cos(loc2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

export const ArtistSearchView: React.FC<ArtistSearchViewProps> = ({ shops, booths, userLocation, getLocation, onSelectShop }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [maxPrice, setMaxPrice] = useState(300);

    const sortedShops = useMemo(() => {
        if (!userLocation) return shops;
        return [...shops].sort((a, b) => {
            const distA = getDistance(userLocation, { lat: a.lat, lng: a.lng });
            const distB = getDistance(userLocation, { lat: b.lat, lng: b.lng });
            return distA - distB;
        });
    }, [shops, userLocation]);

    const filteredBooths = useMemo(() => {
        const shopIdOrder = sortedShops.map(s => s.id);

        return booths
            .filter(booth => {
                const shop = shops.find(s => s.id === booth.shopId);
                if (!shop) return false;
                const matchesSearch = shop.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      shop.name.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesPrice = booth.dailyRate <= maxPrice;
                return matchesSearch && matchesPrice;
            })
            .sort((a, b) => {
                // Sort booths based on their shop's distance-sorted order
                return shopIdOrder.indexOf(a.shopId) - shopIdOrder.indexOf(b.shopId);
            });

    }, [booths, shops, searchTerm, maxPrice, sortedShops]);

    const getShopForBooth = (shopId: string) => shops.find(s => s.id === shopId);

    return (
        <div>
            <div className="bg-gray-900/50 rounded-2xl p-6 mb-8 border border-gray-800 backdrop-blur-sm">
                <h2 className="text-3xl font-bold text-white mb-2">Find Your Next Guest Spot</h2>
                <p className="text-brand-gray mb-6">Search for available tattoo booths in shops around the world.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative lg:col-span-2">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                            type="text"
                            placeholder="Search by city or shop name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-brand-gray focus:ring-2 focus:ring-brand-primary focus:outline-none transition-shadow"
                        />
                    </div>
                    <div className="relative">
                        <PriceIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                            type="range"
                            min="50"
                            max="300"
                            step="10"
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(Number(e.target.value))}
                            className="w-full h-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-gray-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-primary"
                        />
                         <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-brand-gray bg-gray-800 px-2 rounded">
                            Up to ${maxPrice}
                        </span>
                    </div>
                     <button onClick={getLocation} className="w-full bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-80 transition-colors flex items-center justify-center space-x-2">
                        <LocationIcon className="w-5 h-5" />
                        <span>Find Near Me</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredBooths.map(booth => {
                    const shop = getShopForBooth(booth.shopId);
                    if (!shop) return null;
                    const distance = userLocation ? getDistance(userLocation, { lat: shop.lat, lng: shop.lng }) : null;

                    return (
                        <div key={booth.id} className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col overflow-hidden group transform transition-transform duration-300 hover:-translate-y-1">
                            <div className="relative">
                                <img src={`${shop.imageUrl}?random=${booth.id}`} alt={shop.name} className="w-full h-48 object-cover" />
                                {distance !== null && (
                                    <div className="absolute top-2 right-2 bg-brand-dark/80 text-white text-xs font-bold py-1 px-2 rounded-full">
                                        {distance.toFixed(1)} km away
                                    </div>
                                )}
                            </div>
                            <div className="p-5 flex-grow">
                                <h3 className="text-xl font-bold text-white truncate">{booth.name}</h3>
                                <p className="text-sm text-brand-primary font-semibold mb-2">{shop.name}</p>
                                <div className="flex items-center text-brand-gray text-sm mb-4">
                                    <LocationIcon className="w-4 h-4 mr-2" />
                                    <span>{shop.location}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-lg font-semibold text-white">${booth.dailyRate}<span className="text-sm font-normal text-brand-gray">/day</span></p>
                                    <div className="flex items-center">
                                        <StarIcon className="w-5 h-5 text-yellow-400 mr-1" />
                                        <span className="text-white font-bold">{shop.rating.toFixed(1)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-800/50 grid grid-cols-2 gap-2">
                                <button onClick={() => onSelectShop(shop)} className="w-full bg-brand-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-80 transition-colors">
                                    View Details
                                </button>
                                <a 
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 text-center"
                                >
                                    <DirectionsIcon className="w-5 h-5" />
                                    <span>Directions</span>
                                </a>
                            </div>
                        </div>
                    );
                })}
            </div>
             {filteredBooths.length === 0 && (
                <div className="text-center py-16 col-span-full">
                    <p className="text-xl font-semibold text-white">No Booths Found</p>
                    <p className="text-brand-gray mt-2">Try adjusting your search term or increasing the price range to find available spots.</p>
                </div>
            )}
        </div>
    );
};