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

type ArtistViewModel = Artist & {
    bookingInfo: {
        shopName: string;
        city: string;
        dates: string;
        shop: Shop | undefined;
        distance: number | null;
    } | null;
};

export const ClientSearchView: React.FC<ClientSearchViewProps> = ({ artists, bookings, shops, userLocation, getLocation, onSelectArtist }) => {
    const [city, setCity] = useState('');
    const [specialty, setSpecialty] = useState('');

    const availableArtists = useMemo(() => {
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

        const bookedArtistIdsInCity = new Set(
            bookings
                .filter(b => city === '' || b.city.toLowerCase().includes(city.toLowerCase()))
                .map(b => b.artistId)
        );

        const artistsWithBookingInfo: ArtistViewModel[] = artists
            .filter(artist =>
                bookedArtistIdsInCity.has(artist.id) &&
                (specialty === '' || artist.specialty.toLowerCase().includes(specialty.toLowerCase()))
            )
            .map(artist => {
                const bookingInfoData = getArtistBookingInfo(artist.id);
                const distance = userLocation && bookingInfoData?.shop 
                    ? getDistance(userLocation, { lat: bookingInfoData.shop.lat, lng: bookingInfoData.shop.lng }) 
                    : null;
                
                return {
                    ...artist,
                    bookingInfo: bookingInfoData ? { ...bookingInfoData, distance } : null,
                };
            });

        if (userLocation) {
            artistsWithBookingInfo.sort((a, b) => {
                const distA = a.bookingInfo?.distance ?? Infinity;
                const distB = b.bookingInfo?.distance ?? Infinity;
                return distA - distB;
            });
        }
        
        return artistsWithBookingInfo;

    }, [artists, bookings, shops, city, specialty, userLocation]);

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
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-brand-gray focus:ring-2 focus:ring-brand-primary focus:outline-none transition-shadow"
                        />
                    </div>
                    <div className="relative">
                        <PaletteIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                            type="text"
                            placeholder="Filter by specialty..."
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-brand-gray focus:ring-2 focus:ring-brand-primary focus:outline-none transition-shadow"
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
                    const { bookingInfo } = artist;
                    if (!bookingInfo) return null;
                    return (
                        <div key={artist.id} className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col overflow-hidden group transform transition-transform duration-300 hover:-translate-y-1">
                            <div className="relative h-56 cursor-pointer" onClick={() => onSelectArtist(artist)}>
                                <img src={`${artist.portfolio[0]}?random=${artist.id}`} alt={`${artist.name}'s work`} className="w-full h-full object-cover"/>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                 {bookingInfo.distance !== null && (
                                    <div className="absolute top-2 right-2 bg-brand-dark/80 text-white text-xs font-bold py-1 px-2 rounded-full">
                                        {bookingInfo.distance.toFixed(1)} km away
                                    </div>
                                )}
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
                    <p className="text-xl font-semibold text-white">No Artists Found</p>
                    <p className="text-brand-gray mt-2">Try adjusting your city or specialty filters, or check back soon for new artist availability.</p>
                </div>
            )}
        </div>
    );
};