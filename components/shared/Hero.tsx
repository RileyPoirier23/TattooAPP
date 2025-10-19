// @/components/shared/Hero.tsx

import React from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ArrowRightIcon } from './Icons';

interface HeroProps {
  navigate: (path: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ navigate }) => {
  const { setViewMode } = useAppStore();

  return (
    <div className="text-center py-16 md:py-24">
      <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight tracking-tighter">
        Find Your Space.
        <br />
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary">
          Make Your Mark.
        </span>
      </h1>
      <p className="max-w-2xl mx-auto mt-6 text-lg text-brand-gray">
        InkSpace is the ultimate platform connecting tattoo artists with shops for guest spots, and clients with the perfect artist for their next piece.
      </p>
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          onClick={() => {
            setViewMode('client');
            navigate('/artists');
          }}
          className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-primary hover:bg-opacity-80 text-white font-bold py-3 px-6 rounded-full transition-transform transform hover:scale-105"
        >
          <span>Find an Artist</span>
          <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>
        <button
          onClick={() => {
            setViewMode('artist');
            navigate('/shops');
          }}
          className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-brand-light font-bold py-3 px-6 rounded-full transition-colors"
        >
          <span>Find a Booth</span>
          <ArrowRightIcon className="w-5 h-5 text-brand-gray transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
};
