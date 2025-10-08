import React, { useState, useMemo } from 'react';
import type { Artist, Booking, Shop } from '../../types';
import { LocationIcon, PaletteIcon, DirectionsIcon } from '../shared/Icons';

interface ClientSearchViewProps {
  artists: Artist[];
  bookings: Booking[];
  shops: Shop[];
  userLocation: { lat: number; lng: number } | null;
  getLocation: () => void;
  onSelectArtist: (artist: Artist) => void;
}

export const ClientSearchView: React.FC<ClientSearchViewProps> = ({ artists, bookings, shops, userLocation, getLocation, onSelectArtist }) => {
    const [city, setCity] = useState('');
    const [specialty, setSpecialty] = useState('');

    const availableArtists = useMemo(() => {
        const bookedArtistIdsInCity = new Set(
            bookings
                .filter(b => city === '' || b.city.toLowerCase().includes(city.toLowerCase()))
                .map(b => b.artistId)
        );

        return artists.filter(artist =>
            bookedArtistIdsInCity.has(artist.id) &&
            (specialty === '' || artist.specialty.toLowerCase().includes(specialty.toLowerCase()))
        );
    }, [artists, bookings, city, specialty]);
    
    const getArtistBookingInfo = (artistId: string) => {
        const artistBookings = bookings.filter(b => b.artistId === artistId && (city === '' || b.city.toLowerCase().includes(city.toLowerCase())));
        if (artistBookings.length === 0) return null;
        const latestBooking = artistBookings.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
        const shop = shops.find(s => s.id === latestBooking.shopId);
        return {
            shopName: shop?.name || "Private Studio",
            city: latestBooking.city,
            dates: `${new Date(latestBooking.startDate).toLocaleDateString()} to ${new Date(latestBooking.endDate).toLocaleDateString()}`,
            shop: shop,
        };
    };

    return (
        <div>
            <div className="bg-gray-900/50 rounded-2xl p-6 mb-8 border border-gray-800 backdrop-blur-sm">
                <h2 className="text-3xl font-bold text-white mb-2">Discover Your Next Artist</h2>
                <p className="text-brand-gray mb-6">Find talented tattoo artists available for booking in your city.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative lg:col-span-2">
                        <LocationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                            type="text"
                            placeholder="Enter city..."
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-brand-gray focus:ring-2 focus:ring-brand-primary focus:outline-none"
                        />
                    </div>
                    <div className="relative">
                        <PaletteIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                            type="text"
                            placeholder="Filter by specialty..."
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-brand-gray focus:ring-2 focus:ring-brand-primary focus:outline-none"
                        />
                    </div>
                     <button onClick={getLocation} className="w-full bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-80 transition-colors flex items-center justify-center space-x-2">
                        <LocationIcon className="w-5 h-5" />
                        <span>Find Near Me</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {availableArtists.map(artist => {
                    const bookingInfo = getArtistBookingInfo(artist.id);
                    if (!bookingInfo) return null;
                    return (
                        <div key={artist.id} className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col overflow-hidden group transform transition-transform duration-300 hover:-translate-y-1">
                            <div className="relative h-56 cursor-pointer" onClick={() => onSelectArtist(artist)}>
                                <img src={`${artist.portfolio[0]}?random=${artist.id}`} alt={`${artist.name}'s work`} className="w-full h-full object-cover"/>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                <div className="absolute bottom-0 left-0 p-4">
                                    <h3 className="text-2xl font-bold text-white">{artist.name}</h3>
                                    <p className="text-brand-primary font-semibold">{artist.specialty}</p>
                                </div>
                            </div>
                            <div className="p-4 flex-grow">
                                <p className="text-sm font-bold text-gray-300 mb-2">Available in {bookingInfo.city}</p>
                                <p className="text-sm text-brand-gray">
                                    At <span className="font-semibold text-gray-300">{bookingInfo.shopName}</span> from {bookingInfo.dates}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                                <img src={`${artist.portfolio[1]}?random=${artist.id}-2`} alt="" className="h-24 w-full object-cover rounded"/>
                                <img src={`${artist.portfolio[2]}?random=${artist.id}-3`} alt="" className="h-24 w-full object-cover rounded"/>
                            </div>
                             <div className="p-4 bg-gray-800/50 grid grid-cols-2 gap-2">
                                <button onClick={() => onSelectArtist(artist)} className="w-full bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-80 transition-colors">
                                    View Portfolio
                                </button>
                                {bookingInfo.shop && (
                                <a 
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${bookingInfo.shop.lat},${bookingInfo.shop.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 text-center"
                                >
                                    <DirectionsIcon className="w-5 h-5" />
                                    <span>Directions</span>
                                </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {availableArtists.length === 0 && (
                <div className="text-center py-16 col-span-full">
                    <p className="text-brand-gray">No artists available in this city. Broaden your search!</p>
                </div>
            )}
        </div>
    );
};