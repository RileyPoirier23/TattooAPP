// @/components/Header.tsx

import React, { useState, useEffect, useRef } from 'react';
import type { ViewMode, User, Notification } from '../types';
import { NeedleIcon, UserCircleIcon, BellIcon } from './shared/Icons';

interface HeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  user: User | null;
  notifications: Notification[];
  markNotificationsAsRead: () => void;
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
  notifications,
  markNotificationsAsRead,
  onLoginClick, 
  onLogoutClick,
  onProfileClick,
  onDashboardClick,
  onHomeClick
}) => {
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBellClick = () => {
    setNotificationsOpen(prev => !prev);
    if (!isNotificationsOpen && unreadCount > 0) {
      // Mark as read when opening, with a slight delay for smoother UX
      setTimeout(() => markNotificationsAsRead(), 1000);
    }
  };

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
                    <div className="relative" ref={notificationsRef}>
                      <button onClick={handleBellClick} className="relative p-2 text-brand-gray hover:text-white transition-colors" aria-label="View notifications">
                        <BellIcon className="w-6 h-6" />
                        {unreadCount > 0 && (
                          <span className="absolute top-1 right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-brand-primary text-white text-xs items-center justify-center">{unreadCount}</span>
                          </span>
                        )}
                      </button>
                      {isNotificationsOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50">
                          <div className="p-3 border-b border-gray-700">
                            <h4 className="font-semibold text-white">Notifications</h4>
                          </div>
                          <ul className="max-h-96 overflow-y-auto">
                            {notifications.length > 0 ? (
                              [...notifications].reverse().map(notif => (
                                <li key={notif.id} className={`p-3 text-sm border-b border-gray-800 ${!notif.read ? 'bg-brand-secondary/10' : ''}`}>
                                  <p className="text-gray-300">{notif.message}</p>
                                  <p className="text-xs text-brand-gray mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                                </li>
                              ))
                            ) : (
                              <li className="p-4 text-center text-sm text-brand-gray">You have no new notifications.</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
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
