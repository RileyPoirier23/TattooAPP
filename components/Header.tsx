// @/components/Header.tsx

import React, { useState, useEffect, useRef } from 'react';
import type { ViewMode, User, Notification } from '../types';
import { NeedleIcon, UserCircleIcon, BellIcon, ChevronDownIcon, SunIcon, MoonIcon } from './shared/Icons';
import { useAppStore } from '../hooks/useAppStore';

// --- Self-contained User Menu Component ---
const UserMenu: React.FC<{
  user: User;
  onNavigate: (path: string) => void;
  onLogoutClick: () => void;
}> = React.memo(({ user, onNavigate, onLogoutClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigate = (path: string) => {
    onNavigate(path);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setIsOpen(prev => !prev)} className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 px-3 py-2 rounded-full">
        <UserCircleIcon className="w-6 h-6 text-brand-dark dark:text-brand-light" />
        <span className="text-sm font-semibold text-black dark:text-white hidden md:block">{user.data.name}</span>
        <ChevronDownIcon className="w-4 h-4 text-brand-gray" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 animate-[fadeIn_0.1s_ease-out]">
          {(user.type === 'artist' || user.type === 'client' || user.type === 'dual') && (
            <button onClick={() => handleNavigate('/profile')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">My Profile</button>
          )}
          {user.type === 'shop-owner' && (
            <button onClick={() => handleNavigate('/dashboard')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">My Dashboard</button>
          )}
          {(user.type === 'artist' || user.type === 'dual') && (
            <button onClick={() => handleNavigate('/availability')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">My Availability</button>
          )}
          <button onClick={() => handleNavigate('/bookings')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">My Bookings</button>
          {user.type !== 'admin' && (
            <button onClick={() => handleNavigate('/messages')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Messages</button>
          )}
          <button onClick={() => handleNavigate('/settings')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Settings</button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
          <button onClick={onLogoutClick} className="w-full text-left px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800">Logout</button>
        </div>
      )}
    </div>
  );
});


// --- Self-contained Notifications Dropdown Component ---
const NotificationsDropdown: React.FC<{
  notifications: Notification[];
  markNotificationsAsRead: () => void;
}> = React.memo(({ notifications, markNotificationsAsRead }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleToggle = () => {
    setIsOpen(prev => !prev);
    if (!isOpen && unreadCount > 0) {
      setTimeout(() => markNotificationsAsRead(), 1000); // Mark as read after opening
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={handleToggle} className="relative p-2 text-brand-gray hover:text-brand-dark dark:hover:text-white transition-colors" aria-label="View notifications">
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-brand-primary text-white text-xs items-center justify-center">{unreadCount}</span>
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 animate-[fadeIn_0.1s_ease-out]">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-brand-dark dark:text-white">Notifications</h4>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              [...notifications].reverse().map(notif => (
                <li key={notif.id} className={`p-3 text-sm border-b border-gray-100 dark:border-gray-800 ${!notif.read ? 'bg-brand-secondary/10' : ''}`}>
                  <p className="text-gray-700 dark:text-gray-300">{notif.message}</p>
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
  );
});

// --- Self-contained View Mode Toggle Component ---
const ViewModeToggle: React.FC<Pick<HeaderProps, 'user' | 'viewMode' | 'setViewMode' | 'onNavigate'>> = React.memo(({ user, viewMode, setViewMode, onNavigate }) => {
    const commonClasses = `px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-300`;
    const activeClasses = `bg-brand-primary text-white`;
    const inactiveClasses = `bg-transparent text-brand-gray hover:bg-gray-200 dark:hover:bg-gray-800`;
    const badgeClasses = `px-4 py-2 text-sm font-semibold rounded-full text-white cursor-default`;

    if (!user || user.type === 'artist' || user.type === 'client' || user.type === 'dual') {
       return (
            <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-full p-1">
                <button
                    onClick={() => { setViewMode('artist'); onNavigate('/shops'); }}
                    className={`${commonClasses} ${viewMode === 'artist' ? activeClasses : inactiveClasses}`}
                >
                    For Artists
                </button>
                <button
                    onClick={() => { setViewMode('client'); onNavigate('/artists'); }}
                    className={`${commonClasses} ${viewMode === 'client' ? activeClasses : inactiveClasses}`}
                >
                    For Clients
                </button>
            </div>
        );
    }
    
    if (user.type === 'shop-owner') {
         return <span className={`${badgeClasses} bg-brand-secondary`}>Shop Owner</span>;
    }
    
    if (user.type === 'admin') {
         return <span className={`${badgeClasses} bg-red-600`}>Admin</span>;
    }

    return null;
});


interface HeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  user: User | null;
  notifications: Notification[];
  markNotificationsAsRead: () => void;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onNavigate: (path: string) => void;
}


// --- Main Header Component ---
export const Header: React.FC<HeaderProps> = ({ 
  user,
  notifications,
  markNotificationsAsRead,
  onLoginClick, 
  onLogoutClick,
  onNavigate,
  viewMode,
  setViewMode,
}) => {
  const { theme, toggleTheme } = useAppStore();

  return (
    <header className="bg-brand-light/80 dark:bg-brand-dark/80 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div 
          className="flex items-center space-x-3 cursor-pointer"
          onClick={() => onNavigate('/')}
          aria-label="Go to homepage"
        >
          <NeedleIcon className="w-8 h-8 text-brand-primary" />
          <h1 className="text-2xl font-bold text-brand-dark dark:text-white tracking-tighter">InkSpace</h1>
        </div>
        <div className="flex items-center space-x-4">
            <ViewModeToggle user={user} viewMode={viewMode} setViewMode={setViewMode} onNavigate={onNavigate} />
            {user ? (
                 <div className="flex items-center space-x-3">
                    <button onClick={toggleTheme} className="p-2 text-brand-gray hover:text-brand-dark dark:hover:text-white transition-colors">
                      {theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
                    </button>
                    <NotificationsDropdown notifications={notifications} markNotificationsAsRead={markNotificationsAsRead} />
                    <UserMenu user={user} onNavigate={onNavigate} onLogoutClick={onLogoutClick} />
                 </div>
            ) : (
                <div className="flex items-center space-x-3">
                    <button onClick={toggleTheme} className="p-2 text-brand-gray hover:text-brand-dark dark:hover:text-white transition-colors">
                      {theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
                    </button>
                    <button 
                      onClick={onLoginClick}
                      className="flex items-center space-x-2 bg-brand-secondary hover:bg-opacity-80 text-white font-bold py-2 px-4 rounded-full transition-colors"
                    >
                      <UserCircleIcon className="w-5 h-5" />
                      <span>Login / Sign Up</span>
                    </button>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};
