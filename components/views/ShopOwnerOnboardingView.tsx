// @/components/views/ShopOwnerOnboardingView.tsx

import React, { useState } from 'react';
import type { Shop, ShopOwnerUser } from '../../types';

interface ShopOwnerOnboardingViewProps {
  owner: ShopOwnerUser;
  createShop: (shopData: Omit<Shop, 'id' | 'isVerified' | 'rating' | 'reviews' | 'averageArtistRating' | 'ownerId'>) => Promise<void>;
}

export const ShopOwnerOnboardingView: React.FC<ShopOwnerOnboardingViewProps> = ({ owner, createShop }) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [amenities, setAmenities] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const shopData = {
      name,
      location,
      address,
      lat,
      lng,
      amenities: amenities.split(',').map(a => a.trim()).filter(Boolean),
      imageUrl,
      paymentMethods: {},
    };
    await createShop(shopData);
    // The store will handle navigation on success
    setIsSubmitting(false);
  };

  const inputClasses = "w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-2 text-brand-dark dark:text-white";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-4xl font-bold text-brand-dark dark:text-white text-center mb-2">Welcome, {owner.data.name}!</h1>
      <p className="text-brand-gray text-center mb-8">Let's set up your shop on InkSpace.</p>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 space-y-6">
        <div>
          <label htmlFor="shopName" className="block text-sm font-medium text-brand-gray mb-1">Shop Name</label>
          <input type="text" id="shopName" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
        </div>
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-brand-gray mb-1">City (e.g., Toronto, ON)</label>
          <input type="text" id="location" value={location} onChange={e => setLocation(e.target.value)} required className={inputClasses} />
        </div>
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-brand-gray mb-1">Full Address</label>
          <input type="text" id="address" value={address} onChange={e => setAddress(e.target.value)} required className={inputClasses} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="lat" className="block text-sm font-medium text-brand-gray mb-1">Latitude</label>
            <input type="number" id="lat" step="any" value={lat} onChange={e => setLat(parseFloat(e.target.value))} required className={inputClasses} />
          </div>
          <div>
            <label htmlFor="lng" className="block text-sm font-medium text-brand-gray mb-1">Longitude</label>
            <input type="number" id="lng" step="any" value={lng} onChange={e => setLng(parseFloat(e.target.value))} required className={inputClasses} />
          </div>
        </div>
         <div>
            <label htmlFor="amenities" className="block text-sm font-medium text-brand-gray mb-1">Amenities (comma-separated)</label>
            <input type="text" id="amenities" value={amenities} onChange={e => setAmenities(e.target.value)} placeholder="e.g. WiFi, Private Rooms, Free Snacks" className={inputClasses} />
        </div>
         <div>
            <label htmlFor="imageUrl" className="block text-sm font-medium text-brand-gray mb-1">Shop Image URL</label>
            <input type="url" id="imageUrl" value={imageUrl} onChange={e => setImageUrl(e.target.value)} required className={inputClasses} />
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600">
            {isSubmitting ? 'Creating Shop...' : 'Create My Shop'}
        </button>
      </form>
    </div>
  );
};