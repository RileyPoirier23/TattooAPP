
// @/components/views/ShopOwnerOnboardingView.tsx

import React, { useState } from 'react';
import type { Shop, ShopOwnerUser } from '../../types';
import { LocationIcon, EditIcon, CheckBadgeIcon } from '../shared/Icons';

interface ShopOwnerOnboardingViewProps {
  owner: ShopOwnerUser;
  createShop: (shopData: Omit<Shop, 'id' | 'isVerified' | 'rating' | 'reviews' | 'averageArtistRating' | 'ownerId'>) => Promise<void>;
}

const StepIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => (
    <div className="flex items-center justify-center space-x-2 mb-8">
        {[...Array(totalSteps)].map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i + 1 <= currentStep ? 'w-8 bg-brand-primary' : 'w-2 bg-gray-300 dark:bg-gray-700'}`} />
        ))}
    </div>
);

export const ShopOwnerOnboardingView: React.FC<ShopOwnerOnboardingViewProps> = ({ owner, createShop }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [amenities, setAmenities] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

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
      imageUrl: imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1A1A1D&color=F04E98`,
      paymentMethods: {},
    };
    await createShop(shopData);
    setIsSubmitting(false);
  };

  const inputClasses = "w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-brand-dark dark:text-white border border-transparent focus:border-brand-primary focus:ring-0 transition-colors";

  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-brand-dark dark:text-white mb-2">Setup Your Shop</h1>
          <p className="text-brand-gray">Step {step} of {totalSteps}</p>
      </div>

      <StepIndicator currentStep={step} totalSteps={totalSteps} />

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-xl">
        
        {step === 1 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                <div className="text-center mb-6">
                    <EditIcon className="w-12 h-12 text-brand-secondary mx-auto mb-2" />
                    <h2 className="text-2xl font-bold text-brand-dark dark:text-white">Basic Info</h2>
                    <p className="text-sm text-brand-gray">What is your shop called?</p>
                </div>
                <div>
                    <label htmlFor="shopName" className="block text-sm font-bold text-brand-gray mb-1">Shop Name</label>
                    <input type="text" id="shopName" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} placeholder="e.g. Ink & Dagger" />
                </div>
                <button type="button" onClick={nextStep} disabled={!name} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600 mt-4">Next: Location</button>
            </div>
        )}

        {step === 2 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                <div className="text-center mb-6">
                    <LocationIcon className="w-12 h-12 text-brand-secondary mx-auto mb-2" />
                    <h2 className="text-2xl font-bold text-brand-dark dark:text-white">Location</h2>
                    <p className="text-sm text-brand-gray">Where can artists find you?</p>
                </div>
                <div>
                    <label htmlFor="location" className="block text-sm font-bold text-brand-gray mb-1">City</label>
                    <input type="text" id="location" value={location} onChange={e => setLocation(e.target.value)} required className={inputClasses} placeholder="e.g. Toronto, ON" />
                </div>
                <div>
                    <label htmlFor="address" className="block text-sm font-bold text-brand-gray mb-1">Full Address</label>
                    <input type="text" id="address" value={address} onChange={e => setAddress(e.target.value)} required className={inputClasses} placeholder="123 Queen St W" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="lat" className="block text-sm font-bold text-brand-gray mb-1">Latitude</label>
                        <input type="number" id="lat" step="any" value={lat} onChange={e => setLat(parseFloat(e.target.value))} required className={inputClasses} />
                    </div>
                    <div>
                        <label htmlFor="lng" className="block text-sm font-bold text-brand-gray mb-1">Longitude</label>
                        <input type="number" id="lng" step="any" value={lng} onChange={e => setLng(parseFloat(e.target.value))} required className={inputClasses} />
                    </div>
                </div>
                <p className="text-xs text-brand-gray">Tip: You can find lat/lng by right-clicking a spot on Google Maps.</p>
                <div className="flex gap-4 mt-6">
                    <button type="button" onClick={prevStep} className="w-1/3 bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-3 rounded-lg">Back</button>
                    <button type="button" onClick={nextStep} disabled={!location || !address || !lat || !lng} className="w-2/3 bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-600">Next: Details</button>
                </div>
            </div>
        )}

        {step === 3 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                <div className="text-center mb-6">
                    <CheckBadgeIcon className="w-12 h-12 text-brand-secondary mx-auto mb-2" />
                    <h2 className="text-2xl font-bold text-brand-dark dark:text-white">Shop Details</h2>
                    <p className="text-sm text-brand-gray">Make your listing stand out.</p>
                </div>
                <div>
                    <label htmlFor="amenities" className="block text-sm font-bold text-brand-gray mb-1">Amenities (comma-separated)</label>
                    <input type="text" id="amenities" value={amenities} onChange={e => setAmenities(e.target.value)} placeholder="WiFi, Private Rooms, Sterilization Area..." className={inputClasses} />
                </div>
                <div>
                    <label htmlFor="imageUrl" className="block text-sm font-bold text-brand-gray mb-1">Cover Image URL</label>
                    <input type="url" id="imageUrl" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className={inputClasses} placeholder="https://..." />
                </div>
                <div className="flex gap-4 mt-6">
                    <button type="button" onClick={prevStep} className="w-1/3 bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-white font-bold py-3 rounded-lg">Back</button>
                    <button type="submit" disabled={isSubmitting} className="w-2/3 bg-brand-secondary text-white font-bold py-3 rounded-lg disabled:bg-gray-600">
                        {isSubmitting ? 'Creating Shop...' : 'Finish & Create'}
                    </button>
                </div>
            </div>
        )}
      </form>
    </div>
  );
};
