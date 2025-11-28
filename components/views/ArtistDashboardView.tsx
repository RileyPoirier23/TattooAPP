
// @/components/views/ArtistDashboardView.tsx

import React, { useState, useEffect } from 'react';
import type { Artist, ModalState, ArtistHours, IntakeFormSettings, ClientBookingRequest } from '../../types';
import { useAppStore } from '../../hooks/useAppStore';
import { ArtistProfileView } from '../ModalsAndProfile';
import { InboxStackIcon, UserCircleIcon, CalendarIcon, CogIcon, TrashIcon } from '../shared/Icons';
import { Loader } from '../shared/Loader';


const getStatusChip = (status: string) => {
    switch(status) {
        case 'paid':
        case 'approved':
            return 'bg-green-500/20 text-green-400';
        case 'unpaid':
        case 'pending':
            return 'bg-yellow-500/20 text-yellow-400';
        case 'declined':
        case 'no-show':
            return 'bg-red-500/20 text-red-400';
        case 'completed':
            return 'bg-blue-500/20 text-blue-400';
        case 'rescheduled':
            return 'bg-purple-500/20 text-purple-400';
        default:
            return 'bg-gray-500/20 text-gray-400';
    }
};

const BookingSection: React.FC<{ title: string; children: React.ReactNode; count: number; }> = ({ title, children, count }) => (
    <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
        <h2 className="text-2xl font-bold text-brand-dark dark:text-white mb-4 flex items-center gap-2">
            {title}
            {count > 0 && <span className="bg-brand-primary/20 text-brand-primary text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full">{count}</span>}
        </h2>
        <div className="space-y-4">{children}</div>
    </div>
);


// --- TAB: Profile & Portfolio ---
const ProfileTab: React.FC<{ artist: Artist; updateArtist: (id: string, data: Partial<Artist>) => Promise<void>; openModal: (type: ModalState['type'], data?: any) => void; deletePortfolioImage: (url: string) => Promise<void>; }> = ({ artist, updateArtist, openModal, deletePortfolioImage }) => {
    return <ArtistProfileView artist={artist} updateArtist={updateArtist} deletePortfolioImage={deletePortfolioImage} showToast={useAppStore().showToast} openModal={openModal} />;
};

// --- TAB: Availability ---
const AvailabilityTab: React.FC<{ artist: Artist; updateArtist: (id: string, data: Partial<Artist>) => Promise<void>; }> = ({ artist, updateArtist }) => {
    const [hours, setHours] = useState<ArtistHours>(artist.hours || {});
    const [isSaving, setIsSaving] = useState(false);
    
    // Ensure state syncs if props update (e.g. after a fetch)
    useEffect(() => {
        if (artist.hours) {
            setHours(artist.hours);
        }
    }, [artist.hours]);

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
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Pass a clean copy of the hours object
            const cleanHours = JSON.parse(JSON.stringify(hours));
            await updateArtist(artist.id, { hours: cleanHours });
            useAppStore.getState().showToast('Availability saved successfully!', 'success');
        } catch (e) {
            console.error("Failed to save availability:", e);
            useAppStore.getState().showToast('Failed to save availability.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-dark dark:text-white">Weekly Hours</h2>
                <button onClick={handleSave} disabled={isSaving} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600 w-40 flex justify-center items-center">
                    {isSaving ? <Loader size="sm" color="white" /> : 'Save Hours'}
                </button>
            </div>
            <p className="text-brand-gray text-sm">Set your standard weekly working hours. Clients will use this to request booking dates. <br/> Days with no hours added are considered <strong>Closed</strong>.</p>
            <div className="space-y-4">
                {days.map((day, dayIndex) => (
                    <div key={dayIndex} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start border-b border-gray-200 dark:border-gray-800 pb-4">
                        <div className="md:col-span-1">
                            <h3 className="font-semibold text-lg text-brand-dark dark:text-white">{day}</h3>
                            {(!hours[dayIndex] || hours[dayIndex].length === 0) && (
                                <span className="text-xs font-bold text-red-400 uppercase tracking-wider bg-red-400/10 px-2 py-1 rounded mt-1 inline-block">Closed</span>
                            )}
                        </div>
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
                                <p className="text-brand-gray italic text-sm py-2">No hours set</p>
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
const IntakeSettingsTab: React.FC<{ artist: Artist; updateArtist: (id: string, data: Partial<Artist>) => Promise<void>; }> = ({ artist, updateArtist }) => {
    const [settings, setSettings] = useState<IntakeFormSettings>(artist.intakeSettings || { requireSize: true, requireDescription: true, requireLocation: true, requireBudget: false });

    const handleToggle = (key: keyof IntakeFormSettings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };
    
    const handleSave = async () => {
        try {
            await updateArtist(artist.id, { intakeSettings: settings });
            useAppStore.getState().showToast('Intake form settings saved!', 'success');
        } catch (e) {
             console.error("Failed to save intake settings:", e);
        }
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


// --- TAB: Booking Requests ---
const BookingRequestsTab: React.FC<{
    artist: Artist;
    allClientBookings: ClientBookingRequest[];
    onRespondToRequest: (requestId: string, status: 'approved' | 'declined') => void;
    onCompleteRequest: (requestId: string, status: 'completed' | 'rescheduled' | 'no-show') => void;
    openModal: (type: ModalState['type'], data?: any) => void;
}> = ({ artist, allClientBookings, onRespondToRequest, onCompleteRequest, openModal }) => {
    const myClientRequests = allClientBookings.filter(b => b.artistId === artist.id);
    
    // Robust filtering logic using midnight normalization
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isUpcoming = (dateString: string) => {
        const d = new Date(dateString);
        // We assume dateString is YYYY-MM-DD. When parsed as local time, 
        // if it's today, we want to include it.
        // Appending T23:59:59 ensures "today" counts as upcoming for the whole day.
        const target = new Date(dateString + 'T23:59:59');
        return target >= today;
    };

    const pending = myClientRequests.filter(b => b.status === 'pending');
    const upcoming = myClientRequests.filter(b => b.status === 'approved' && isUpcoming(b.endDate));
    const past = myClientRequests.filter(b => !pending.includes(b) && !upcoming.includes(b));

    // Helper to safe-guard display name
    const getClientName = (req: ClientBookingRequest) => {
        if (!req) return "Unknown";
        if (req.clientName && req.clientName !== 'Unknown Client') return req.clientName;
        if (req.guestName) return `${req.guestName} (Guest)`;
        return "Unknown Client";
    };

    return (
        <div className="space-y-8">
            <BookingSection title="Pending Requests" count={pending.length}>
                {pending.length > 0 ? pending.map(req => (
                    <div key={req.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                       <div className="flex justify-between items-center">
                            <div>
                               <p className="font-bold text-brand-dark dark:text-white flex items-center gap-2">
                                   Request from {getClientName(req)}
                               </p>
                                <p className="font-semibold text-brand-primary text-sm">{req.serviceName}</p>
                            </div>
                           <button onClick={() => openModal('booking-request-detail', req)} className="bg-brand-secondary text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-opacity-80">
                                View Details
                           </button>
                       </div>
                    </div>
                )) : <p className="text-brand-gray">No pending client requests.</p>}
            </BookingSection>

            <BookingSection title="Upcoming & Approved Sessions" count={upcoming.length}>
                 {upcoming.length > 0 ? upcoming.map(req => (
                    <div key={req.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-brand-dark dark:text-white">Session with {getClientName(req)}</p>
                                <p className="font-semibold text-brand-primary text-sm">{req.serviceName}</p>
                                <p className="text-sm text-brand-gray flex items-center mt-1"><CalendarIcon className="w-4 h-4 mr-1.5"/>{new Date(req.startDate).toLocaleDateString()}</p>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusChip(req.paymentStatus)}`}>{req.paymentStatus === 'unpaid' ? 'Deposit Due' : 'Deposit Paid'}</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
                            <button onClick={() => onCompleteRequest(req.id, 'completed')} className="bg-blue-600 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-blue-500">Mark Completed</button>
                            <button onClick={() => onCompleteRequest(req.id, 'rescheduled')} className="bg-purple-600 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-purple-500">Mark Rescheduled</button>
                            <button onClick={() => onCompleteRequest(req.id, 'no-show')} className="bg-red-600 text-white text-sm font-bold py-2 px-3 rounded-lg hover:bg-red-500">Mark No-Show</button>
                        </div>
                    </div>
                 )) : <p className="text-brand-gray">No upcoming sessions.</p>}
            </BookingSection>
            
            <BookingSection title="Past Sessions & Requests" count={past.length}>
                 {past.length > 0 ? past.map(req => (
                     <div key={req.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                         <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-brand-dark dark:text-white">Session with {getClientName(req)}</p>
                                <p className="font-semibold text-brand-primary text-sm">{req.serviceName}</p>
                                <p className="text-sm text-brand-gray">{new Date(req.startDate).toLocaleDateString()}</p>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusChip(req.status)}`}>{req.status}</span>
                         </div>
                     </div>
                 )) : <p className="text-brand-gray">No past sessions.</p>}
            </BookingSection>
        </div>
    );
};


// --- Main Dashboard Component ---
type ArtistDashboardTab = 'profile' | 'availability' | 'settings' | 'requests';

export const ArtistDashboardView: React.FC<{
    artist: Artist;
    updateArtist: (id: string, data: Partial<Artist>) => Promise<void>;
    deletePortfolioImage: (url: string) => Promise<void>;
    showToast: (msg: string, type?: 'success' | 'error') => void;
    openModal: (type: ModalState['type'], data?: any) => void;
    artistAvailability: any[]; // Kept for future specific date overrides
    setArtistAvailability: (date: string, status: 'available' | 'unavailable') => Promise<void>;
    allClientBookings: ClientBookingRequest[];
    onRespondToRequest: (requestId: string, status: 'approved' | 'declined') => void;
    onCompleteRequest: (requestId: string, status: 'completed' | 'rescheduled' | 'no-show') => void;
}> = (props) => {
    const [activeTab, setActiveTab] = useState<ArtistDashboardTab>('requests');

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
            case 'requests':
                return <BookingRequestsTab 
                    artist={props.artist} 
                    allClientBookings={props.allClientBookings} 
                    onRespondToRequest={props.onRespondToRequest} 
                    onCompleteRequest={props.onCompleteRequest} 
                    openModal={props.openModal} 
                />;
            default:
                return null;
        }
    };

    return (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
                 <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-200 dark:border-gray-800 space-y-2 sticky top-24">
                    <TabButton tabName="requests" label="Booking Requests" icon={<InboxStackIcon className="w-6 h-6"/>} />
                    <TabButton tabName="profile" label="Profile & Portfolio" icon={<UserCircleIcon className="w-6 h-6"/>} />
                    <TabButton tabName="availability" label="Weekly Hours" icon={<CalendarIcon className="w-6 h-6"/>} />
                    <TabButton tabName="settings" label="Intake Form Settings" icon={<CogIcon className="w-6 h-6"/>} />
                 </div>
            </div>
            <div className="lg:col-span-3">
                {renderContent()}
            </div>
        </div>
    );
};
