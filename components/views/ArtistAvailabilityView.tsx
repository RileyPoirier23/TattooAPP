// @/components/views/ArtistAvailabilityView.tsx

import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';

export const ArtistAvailabilityView: React.FC = () => {
    const { user, data: { artistAvailability }, setArtistAvailability } = useAppStore();
    const [currentDate, setCurrentDate] = useState(new Date());

    const myAvailability = useMemo(() => {
        if (!user) return new Map();
        const userAvailability = artistAvailability.filter(a => a.artistId === user.id);
        return new Map(userAvailability.map(a => [a.date, a.status]));
    }, [artistAvailability, user]);

    const handleDateClick = (date: Date) => {
        if (!user) return;
        const dateString = date.toISOString().split('T')[0];
        const currentStatus = myAvailability.get(dateString);
        const newStatus = currentStatus === 'available' ? 'unavailable' : 'available';
        setArtistAvailability(dateString, newStatus);
    };

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();

    const renderDays = () => {
        const days = [];
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="w-full h-24 border border-gray-800"></div>);
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateString = date.toISOString().split('T')[0];
            const status = myAvailability.get(dateString);
            const isPast = date < new Date(new Date().toDateString());

            let statusClass = 'bg-gray-900/50 hover:bg-gray-800';
            if (status === 'available') statusClass = 'bg-green-500/30 hover:bg-green-500/50 border-green-500';
            if (status === 'unavailable') statusClass = 'bg-red-500/30 hover:bg-red-500/50 border-red-500';
            if (isPast) statusClass = 'bg-gray-800/50 text-gray-600';

            days.push(
                <button
                    key={day}
                    disabled={isPast}
                    onClick={() => handleDateClick(date)}
                    className={`p-2 w-full h-24 border border-gray-800 text-left align-top transition-colors ${statusClass}`}
                >
                    <span className="font-bold">{day}</span>
                    <span className="block text-xs mt-1 capitalize">{status}</span>
                </button>
            );
        }
        return days;
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-white mb-2">My Availability</h1>
            <p className="text-brand-gray mb-8">Click on a date to toggle your status. Clients will see this when considering booking requests.</p>

            <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="bg-gray-800 px-3 py-1 rounded-lg">&lt;</button>
                    <h2 className="text-2xl font-bold text-white">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="bg-gray-800 px-3 py-1 rounded-lg">&gt;</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-brand-gray mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="py-2">{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {renderDays()}
                </div>
                 <div className="flex items-center space-x-4 mt-4 text-sm">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500/30 border border-green-500 rounded"></div><span>Available</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500/30 border border-red-500 rounded"></div><span>Unavailable</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-900/50 border border-gray-800 rounded"></div><span>Not Set</span></div>
                </div>
            </div>
        </div>
    );
};
