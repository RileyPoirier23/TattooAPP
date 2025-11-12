// @/components/views/ArtistDashboardView.tsx

import React, { useState, useEffect } from 'react';
import type { Artist, ModalState, ArtistService, TimeSlot, ArtistHours, IntakeFormSettings } from '../../types';
import { generateArtistBio } from '../../services/geminiService';
import { useAppStore } from '../../hooks/useAppStore';
import { ArtistProfileView } from '../ModalsAndProfile';
import { CheckBadgeIcon, EditIcon, SparklesIcon, UploadIcon, TrashIcon, InstagramIcon, TikTokIcon, XIconSocial, CalendarIcon, PaletteIcon, UserCircleIcon, CogIcon } from '../shared/Icons';
import { Loader } from '../shared/Loader';

// --- TAB: Profile & Portfolio ---
const ProfileTab: React.FC<{ artist: Artist; updateArtist: (id: string, data: Partial<Artist>) => void; openModal: (type: ModalState['type'], data?: any) => void; deletePortfolioImage: (url: string) => Promise<void>; }> = ({ artist, updateArtist, openModal, deletePortfolioImage }) => {
    return <ArtistProfileView artist={artist} updateArtist={updateArtist} deletePortfolioImage={deletePortfolioImage} showToast={useAppStore().showToast} openModal={openModal} />;
};

// --- TAB: Availability ---
const AvailabilityTab: React.FC<{ artist: Artist; updateArtist: (id: string, data: Partial<Artist>) => void; }> = ({ artist, updateArtist }) => {
    const [hours, setHours] = useState<ArtistHours>(artist.hours || {});
    
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const handleAddTimeSlot = (dayIndex: number) => {
        const newHours = { ...hours };
        if (!newHours[dayIndex]) newHours[dayIndex] = [];
        newHours[dayIndex].push({ start: '09:00', end: '17:00' });
        setHours(newHours);
    };
    
    const handleRemoveTimeSlot = (dayIndex: number, slotIndex: number) => {
        const newHours = { ...hours };
        newHours[dayIndex].splice(slotIndex, 1);
        setHours(newHours);
    };

    const handleTimeChange = (dayIndex: number, slotIndex: number, type: 'start' | 'end', value: string) => {
        const newHours = { ...hours };
        newHours[dayIndex][slotIndex][type] = value;
        setHours(newHours);
    };
    
    const handleSave = () => {
        updateArtist(artist.id, { hours });
        useAppStore.getState().showToast('Availability saved!', 'success');
    };

    return (
        <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-dark dark:text-white">Weekly Hours</h2>
                <button onClick={handleSave} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg">Save Availability</button>
            </div>
            <p className="text-brand-gray text-sm">Set your standard weekly working hours. Clients will use this to request booking dates.</p>
            <div className="space-y-4">
                {days.map((day, dayIndex) => (
                    <div key={dayIndex} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start border-b border-gray-200 dark:border-gray-800 pb-4">
                        <h3 className="font-semibold text-lg text-brand-dark dark:text-white md:col-span-1">{day}</h3>
                        <div className="md:col-span-3 space-y-2">
                            {hours[dayIndex] && hours[dayIndex].length > 0 ? (
                                hours[dayIndex].map((slot, slotIndex) => (
                                    <div key={slotIndex} className="flex items-center gap-2">
                                        <input type="time" value={slot.start} onChange={(e) => handleTimeChange(dayIndex, slotIndex, 'start', e.target.value)} className="bg-gray-100 dark:bg-gray-800 rounded p-2 w-full"/>
                                        <span className="text-brand-gray">to</span>
                                        <input type="time" value={slot.end} onChange={(e) => handleTimeChange(dayIndex, slotIndex, 'end', e.target.value)} className="bg-gray-100 dark:bg-gray-800 rounded p-2 w-full"/>
                                        <button onClick={() => handleRemoveTimeSlot(dayIndex, slotIndex)} className="text-red-500 hover:text-red-400 p-1"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-brand-gray italic">Unavailable</p>
                            )}
                             <button onClick={() => handleAddTimeSlot(dayIndex)} className="text-sm text-brand-secondary font-semibold hover:underline">+ Add hours</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- TAB: Intake Form Settings ---
const IntakeSettingsTab: React.FC<{ artist: Artist; updateArtist: (id: string, data: Partial<Artist>) => void; }> = ({ artist, updateArtist }) => {
    const [settings, setSettings] = useState<IntakeFormSettings>(artist.intakeSettings || { requireSize: true, requireDescription: true, requireLocation: true, requireBudget: false });

    const handleToggle = (key: keyof IntakeFormSettings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };
    
    const handleSave = () => {
        updateArtist(artist.id, { intakeSettings: settings });
        useAppStore.getState().showToast('Intake form settings saved!', 'success');
    };

    const Checkbox = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
        <label className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <span className="font-medium text-brand-dark dark:text-white">{label}</span>
            <div className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-secondary"></div>
            </div>
        </label>
    );

    return (
        <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-dark dark:text-white">Client Intake Form</h2>
                <button onClick={handleSave} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg">Save Settings</button>
            </div>
            <p className="text-brand-gray text-sm">Choose which fields are required when a client sends you a booking request. Less requirements can lead to more inquiries, but more requirements can lead to better quality leads.</p>
            <div className="space-y-3">
                <Checkbox label="Require Tattoo Size (Width & Height)" checked={settings.requireSize} onChange={() => handleToggle('requireSize')} />
                <Checkbox label="Require Body Placement" checked={settings.requireLocation} onChange={() => handleToggle('requireLocation')} />
                <Checkbox label="Require Tattoo Description" checked={settings.requireDescription} onChange={() => handleToggle('requireDescription')} />
                <Checkbox label="Require Budget Estimate" checked={settings.requireBudget} onChange={() => handleToggle('requireBudget')} />
            </div>
        </div>
    );
};


// --- Main Dashboard Component ---
type ArtistDashboardTab = 'profile' | 'availability' | 'settings';

export const ArtistDashboardView: React.FC<{
    artist: Artist;
    updateArtist: (id: string, data: Partial<Artist>) => void;
    deletePortfolioImage: (url: string) => Promise<void>;
    showToast: (msg: string, type?: 'success' | 'error') => void;
    openModal: (type: ModalState['type'], data?: any) => void;
    artistAvailability: any[]; // Kept for future specific date overrides
    setArtistAvailability: (date: string, status: 'available' | 'unavailable') => Promise<void>;
}> = (props) => {
    const [activeTab, setActiveTab] = useState<ArtistDashboardTab>('profile');

    const TabButton: React.FC<{ tabName: ArtistDashboardTab; label: string; icon: React.ReactNode }> = ({ tabName, label, icon }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg font-semibold transition-colors ${activeTab === tabName ? 'bg-brand-secondary/20 text-brand-secondary' : 'text-brand-gray hover:bg-gray-200 dark:hover:bg-gray-800'}`}
        >
            {icon}
            {label}
        </button>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return <ProfileTab {...props} />;
            case 'availability':
                return <AvailabilityTab artist={props.artist} updateArtist={props.updateArtist} />;
            case 'settings':
                return <IntakeSettingsTab artist={props.artist} updateArtist={props.updateArtist} />;
            default:
                return null;
        }
    };

    return (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
                 <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-200 dark:border-gray-800 space-y-2 sticky top-24">
                    <TabButton tabName="profile" label="Profile & Portfolio" icon={<UserCircleIcon className="w-6 h-6"/>} />
                    <TabButton tabName="availability" label="Weekly Availability" icon={<CalendarIcon className="w-6 h-6"/>} />
                    <TabButton tabName="settings" label="Intake Form Settings" icon={<CogIcon className="w-6 h-6"/>} />
                 </div>
            </div>
            <div className="lg:col-span-3">
                {renderContent()}
            </div>
        </div>
    );
};
