// @/components/views/SettingsView.tsx

import React, { useState } from 'react';
import type { User } from '../../types';

interface SettingsViewProps {
    user: User;
    onUpdateUser: (userId: string, updatedData: Partial<User['data']>) => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdateUser, showToast }) => {
    const [name, setName] = useState(user.data.name);
    const [city, setCity] = useState('city' in user.data ? user.data.city : '');
    
    const handleSave = () => {
        const updatedData: Partial<User['data']> = { name };
        if (user.type === 'artist' || user.type === 'dual') {
            (updatedData as any).city = city;
        }
        onUpdateUser(user.id, updatedData);
        showToast('Settings saved successfully!');
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold text-brand-dark dark:text-white mb-8">Account Settings</h1>

            <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 space-y-6">
                <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-brand-gray mb-1">Full Name</label>
                    <input
                        type="text"
                        id="fullName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg py-2 px-3 text-brand-dark dark:text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    />
                </div>
                
                {(user.type === 'artist' || user.type === 'dual') && (
                     <div>
                        <label htmlFor="city" className="block text-sm font-medium text-brand-gray mb-1">City</label>
                        <input
                            type="text"
                            id="city"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg py-2 px-3 text-brand-dark dark:text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                        />
                    </div>
                )}
                
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-brand-gray mb-1">Email</label>
                    <input
                        type="text"
                        id="email"
                        value={user.email}
                        disabled
                        className="w-full bg-gray-200 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg py-2 px-3 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    />
                </div>
                
                <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                    <button onClick={handleSave} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-opacity-80 transition-colors">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};