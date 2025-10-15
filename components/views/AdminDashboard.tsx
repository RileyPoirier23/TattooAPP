
// @/components/views/AdminDashboard.tsx

import React from 'react';
import type { MockData, User, VerificationRequest } from '../../types';
import { XIcon, CheckBadgeIcon } from '../shared/Icons';

interface AdminDashboardProps {
    data: MockData;
    allUsers: User[];
    deleteUser: (userId: string) => void;
    deleteShop: (shopId: string) => void;
    respondToVerificationRequest: (requestId: string, status: 'approved' | 'rejected') => void;
}

const TableCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-gray-900/50 rounded-2xl border border-gray-800">
        <h3 className="text-xl font-bold text-white p-4 border-b border-gray-800">{title}</h3>
        <div className="overflow-x-auto">
            {children}
        </div>
    </div>
);

const Table: React.FC<{ headers: string[]; children: React.ReactNode }> = ({ headers, children }) => (
    <table className="w-full text-sm text-left text-brand-gray">
        <thead className="text-xs text-gray-400 uppercase bg-gray-800/50">
            <tr>
                {headers.map(h => <th key={h} scope="col" className="px-6 py-3">{h}</th>)}
            </tr>
        </thead>
        <tbody>
            {children}
        </tbody>
    </table>
);

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ data, allUsers, deleteUser, deleteShop, respondToVerificationRequest }) => {
    
    const handleDeleteUser = (user: User) => {
        if (window.confirm(`Are you sure you want to delete user ${user.data.name} (${user.email})? This action cannot be undone.`)) {
            deleteUser(user.id);
        }
    };

    const handleDeleteShop = (shop: any) => {
        if (window.confirm(`Are you sure you want to delete shop ${shop.name}? This action cannot be undone.`)) {
            deleteShop(shop.id);
        }
    };

    const pendingVerifications = data.verificationRequests.filter(v => v.status === 'pending');

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>

            {pendingVerifications.length > 0 && (
                <TableCard title="Pending Verification Requests">
                    <Table headers={['Request ID', 'Name', 'Type', 'Submitted', 'Actions']}>
                        {pendingVerifications.map(req => (
                            <tr key={req.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                <td className="px-6 py-4 font-mono text-xs">{req.id}</td>
                                <td className="px-6 py-4 font-medium text-white">{req.itemName}</td>
                                <td className="px-6 py-4 capitalize">{req.type}</td>
                                <td className="px-6 py-4">{new Date(req.createdAt).toLocaleDateString()}</td>
                                <td className="px-6 py-4 flex gap-2">
                                    <button onClick={() => respondToVerificationRequest(req.id, 'approved')} className="text-xs bg-green-600 text-white font-semibold py-1 px-3 rounded-lg">Approve</button>
                                    <button onClick={() => respondToVerificationRequest(req.id, 'rejected')} className="text-xs bg-red-600 text-white font-semibold py-1 px-3 rounded-lg">Decline</button>
                                </td>
                            </tr>
                        ))}
                    </Table>
                </TableCard>
            )}

            <TableCard title="All Users">
                <Table headers={['ID', 'Email', 'Name', 'Role', 'Verified', 'Actions']}>
                    {allUsers.map(user => (
                        <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-6 py-4 font-mono text-xs">{user.id}</td>
                            <td className="px-6 py-4">{user.email}</td>
                            <td className="px-6 py-4 font-medium text-white">{'data' in user ? user.data.name : 'N/A'}</td>
                            <td className="px-6 py-4 capitalize">{user.type}</td>
                            <td className="px-6 py-4">
                                {('data' in user && 'isVerified' in user.data) ? (
                                    user.data.isVerified ? (
                                        <CheckBadgeIcon className="w-6 h-6 text-green-400" title="Verified" />
                                    ) : (
                                        <XIcon className="w-6 h-6 text-brand-gray" title="Not Verified" />
                                    )
                                ) : (
                                    <span className="text-xs text-gray-500">N/A</span>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <button onClick={() => handleDeleteUser(user)} className="text-red-500 hover:text-red-400"><XIcon className="w-5 h-5"/></button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </TableCard>

            <TableCard title="Shops">
                <Table headers={['ID', 'Name', 'Location', 'Rating', 'Verified', 'Actions']}>
                    {data.shops.map(shop => (
                        <tr key={shop.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-6 py-4 font-mono text-xs">{shop.id}</td>
                            <td className="px-6 py-4 font-medium text-white">{shop.name}</td>
                            <td className="px-6 py-4">{shop.location}</td>
                            <td className="px-6 py-4">{shop.rating}</td>
                            <td className="px-6 py-4">
                                {shop.isVerified ? (
                                    <CheckBadgeIcon className="w-6 h-6 text-green-400" title="Verified" />
                                ) : (
                                    <XIcon className="w-6 h-6 text-brand-gray" title="Not Verified" />
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <button onClick={() => handleDeleteShop(shop)} className="text-red-500 hover:text-red-400"><XIcon className="w-5 h-5"/></button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </TableCard>
            
            <TableCard title="Booths">
                 <Table headers={['ID', 'Name', 'Shop ID', 'Daily Rate']}>
                    {data.booths.map(booth => (
                        <tr key={booth.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-6 py-4 font-mono text-xs">{booth.id}</td>
                            <td className="px-6 py-4 font-medium text-white">{booth.name}</td>
                            <td className="px-6 py-4 font-mono text-xs">{booth.shopId}</td>
                            <td className="px-6 py-4">${booth.dailyRate}</td>
                        </tr>
                    ))}
                </Table>
            </TableCard>

             <TableCard title="Artist Booth Bookings">
                 <Table headers={['ID', 'Artist ID', 'Shop ID', 'Dates', 'Status']}>
                    {data.bookings.map(booking => (
                        <tr key={booking.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-6 py-4 font-mono text-xs">{booking.id}</td>
                            <td className="px-6 py-4 font-mono text-xs">{booking.artistId}</td>
                            <td className="px-6 py-4 font-mono text-xs">{booking.shopId}</td>
                            <td className="px-6 py-4">{booking.startDate} to {booking.endDate}</td>
                            <td className="px-6 py-4 capitalize">{booking.paymentStatus}</td>
                        </tr>
                    ))}
                </Table>
            </TableCard>

             <TableCard title="Client Booking Requests">
                 <Table headers={['ID', 'Client ID', 'Artist ID', 'Dates', 'Status']}>
                    {data.clientBookingRequests.map(req => (
                        <tr key={req.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-6 py-4 font-mono text-xs">{req.id}</td>
                            <td className="px-6 py-4 font-mono text-xs">{req.clientId}</td>
                            <td className="px-6 py-4 font-mono text-xs">{req.artistId}</td>
                            <td className="px-6 py-4">{req.startDate} to {req.endDate}</td>
                            <td className="px-6 py-4 capitalize">{req.status}</td>
                        </tr>
                    ))}
                </Table>
            </TableCard>
        </div>
    );
};
