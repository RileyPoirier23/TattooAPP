// @/components/Header.tsx

import React from 'react';
import type { ViewMode, User } from '../types';
import { NeedleIcon, UserCircleIcon } from './shared/Icons';

interface HeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  user: User | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onProfileClick: () => void;
  onDashboardClick: () => void;
  onHomeClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  viewMode, 
  setViewMode, 
  user, 
  onLoginClick, 
  onLogoutClick,
  onProfileClick,
  onDashboardClick,
  onHomeClick
}) => {
  const getButtonClasses = (mode: ViewMode) => {
    return viewMode === mode
      ? 'bg-brand-primary text-white'
      : 'bg-gray-800 text-brand-gray hover:bg-gray-700';
  };

  return (
    <header className="bg-brand-dark/80 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-800">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div 
          className="flex items-center space-x-3 cursor-pointer"
          onClick={onHomeClick}
          aria-label="Go to homepage"
        >
          <NeedleIcon className="w-8 h-8 text-brand-primary" />
          <h1 className="text-2xl font-bold text-white tracking-tighter">InkSpace</h1>
        </div>
        <div className="flex items-center space-x-4">
            <div className="flex items-center bg-gray-900 rounded-full p-1">
                <button
                    onClick={() => { setViewMode('artist'); onHomeClick(); }}
                    className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 ${getButtonClasses('artist')}`}
                >
                    I'm an Artist
                </button>
                <button
                    onClick={() => { setViewMode('client'); onHomeClick(); }}
                    className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 ${getButtonClasses('client')}`}
                >
                    I'm a Client
                </button>
            </div>
            {user ? (
                 <div className="flex items-center space-x-3">
                    {user.type === 'artist' && (
                       <button onClick={onProfileClick} className="text-sm font-semibold text-brand-gray hover:text-white transition-colors">My Profile</button>
                    )}
                    {user.type === 'shop-owner' && (
                       <button onClick={onDashboardClick} className="text-sm font-semibold text-brand-gray hover:text-white transition-colors">My Dashboard</button>
                    )}
                    <button onClick={onLogoutClick} className="text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-full transition-colors">Logout</button>
                 </div>
            ) : (
                <button 
                  onClick={onLoginClick}
                  className="flex items-center space-x-2 bg-brand-secondary hover:bg-opacity-80 text-white font-bold py-2 px-4 rounded-full transition-colors"
                >
                  <UserCircleIcon className="w-5 h-5" />
                  <span>Login / Sign Up</span>
                </button>
            )}
        </div>
      </div>
    </header>
  );
};