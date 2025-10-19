// @/components/views/AdminDashboard.tsx

import React, { useState } from 'react';
import type { MockData, User, Shop, ModalState } from '../../types';
import { XIcon, CheckBadgeIcon, EditIcon, UserCircleIcon, LocationIcon } from '../shared/Icons';

interface AdminDashboardProps {
    data: MockData;
    allUsers: User[];
    deleteUser: (userId: string) => void;
    deleteShop: (shopId: string) => void;
    respondToVerificationRequest: (requestId: string, status: 'approved' | 'rejected') => Promise<void>;
    openModal: (type: ModalState['type'], data?: any) => void;
}

const StatCard: React.FC<{ title: string; value: number | string, icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 flex items-center space-x-4">
        <div className="bg-brand-secondary/20 p-3 rounded-lg">{icon}</div>
        <div>
            <p className="text-sm text-brand-gray">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);

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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ data, allUsers, deleteUser, deleteShop, respondToVerificationRequest, openModal }) => {
    const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
    
    const SmallLoader = <div className="w-4 h-4 border-2 border-white border-t-transparent border-dashed rounded-full animate-spin"></div>;
    
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
    
    const handleVerificationResponse = async (requestId: string, status: 'approved' | 'rejected') => {
        setProcessingRequestId(requestId);
        try {
            await respondToVerificationRequest(requestId, status);
        } catch (error) {
            console.error("Failed to process verification request:", error);
        } finally {
            setProcessingRequestId(null);
        }
    };

    const pendingVerifications = data.verificationRequests.filter(v => v.status === 'pending');

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Total Users" value={allUsers.length} icon={<UserCircleIcon className="w-6 h-6 text-brand-secondary" />} />
                <StatCard title="Total Shops" value={data.shops.length} icon={<LocationIcon className="w-6 h-6 text-brand-secondary" />} />
                <StatCard title="Pending Verifications" value={pendingVerifications.length} icon={<CheckBadgeIcon className="w-6 h-6 text-brand-secondary" />} />
            </div>

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
                                    <button 
                                        onClick={() => handleVerificationResponse(req.id, 'approved')} 
                                        disabled={!!processingRequestId}
                                        className="text-xs bg-green-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-green-500 disabled:bg-gray-600 w-20 h-7 flex justify-center items-center"
                                    >
                                      {processingRequestId === req.id ? SmallLoader : 'Approve'}
                                    </button>
                                    <button 
                                        onClick={() => handleVerificationResponse(req.id, 'rejected')} 
                                        disabled={!!processingRequestId}
                                        className="text-xs bg-red-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-red-500 disabled:bg-gray-600 w-20 h-7 flex justify-center items-center"
                                    >
                                       {processingRequestId === req.id ? SmallLoader : 'Decline'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </Table>
                </TableCard>
            )}

            <TableCard title="All Users">
                <Table headers={['Email', 'Name', 'Role', 'Verified', 'Actions']}>
                    {allUsers.map(user => (
                        <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-6 py-4">{user.email}</td>
                            <td className="px-6 py-4 font-medium text-white">{'data' in user ? user.data.name : 'N/A'}</td>
                            <td className="px-6 py-4 capitalize">{user.type}</td>
                            <td className="px-6 py-4">
                                {('data' in user && 'isVerified' in user.data && user.data.isVerified) ? (
                                    <CheckBadgeIcon className="w-6 h-6 text-green-400" title="Verified" />
                                ) : (
                                    <XIcon className="w-6 h-6 text-brand-gray" title="Not Verified" />
                                )}
                            </td>
                            <td className="px-6 py-4 flex items-center gap-4">
                                <button onClick={() => openModal('admin-edit-user', user)} className="text-brand-gray hover:text-white" title="Edit User"><EditIcon className="w-5 h-5"/></button>
                                <button onClick={() => handleDeleteUser(user)} className="text-red-500 hover:text-red-400" title="Delete User"><XIcon className="w-5 h-5"/></button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </TableCard>

            <TableCard title="Shops">
                <Table headers={['Name', 'Location', 'Rating', 'Verified', 'Actions']}>
                    {data.shops.map(shop => (
                        <tr key={shop.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-6 py-4 font-medium text-white">{shop.name}</td>
                            <td className="px-6 py-4">{shop.location}</td>
                            <td className="px-6 py-4">{shop.averageArtistRating.toFixed(1)}</td>
                            <td className="px-6 py-4">
                                {shop.isVerified ? <CheckBadgeIcon className="w-6 h-6 text-green-400" title="Verified" /> : <XIcon className="w-6 h-6 text-brand-gray" title="Not Verified" />}
                            </td>
                            <td className="px-6 py-4 flex items-center gap-4">
                                <button onClick={() => openModal('admin-edit-shop', shop)} className="text-brand-gray hover:text-white" title="Edit Shop"><EditIcon className="w-5 h-5"/></button>
                                <button onClick={() => handleDeleteShop(shop)} className="text-red-500 hover:text-red-400" title="Delete Shop"><XIcon className="w-5 h-5"/></button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </TableCard>
        </div>
    );
};