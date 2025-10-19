// @/components/views/ShopOwnerDashboard.tsx

import React, { useState, useMemo } from 'react';
import type { Shop, Booth, PaymentMethods, ModalState, Booking, Artist } from '../../types';
import { EditIcon, PriceIcon, CalendarIcon } from '../shared/Icons';

interface ShopOwnerDashboardProps {
  shop: Shop | undefined;
  booths: Booth[];
  bookings: Booking[];
  artists: Artist[];
  updateShop: (shopId: string, data: Partial<Shop>) => void;
  addBooth: (shopId: string, boothData: Omit<Booth, 'id' | 'shopId'>) => void;
  updateBooth: (boothId: string, data: Partial<Booth>) => void;
  deleteBooth: (boothId: string) => void;
  openModal: (type: ModalState['type'], data?: any) => void;
}

export const ShopOwnerDashboard: React.FC<ShopOwnerDashboardProps> = ({
  shop,
  booths,
  bookings,
  artists,
  updateShop,
  addBooth,
  updateBooth,
  deleteBooth,
  openModal,
}) => {
  const [newBoothName, setNewBoothName] = useState('');
  const [newBoothRate, setNewBoothRate] = useState(100);
  const [editingPayments, setEditingPayments] = useState(false);
  const [payments, setPayments] = useState<PaymentMethods>(shop?.paymentMethods || {});

  const upcomingBookings = useMemo(() => {
    return bookings
      .filter(b => new Date(b.endDate) >= new Date())
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [bookings]);

  if (!shop) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-brand-dark dark:text-white">No Shop Assigned</h2>
        <p className="text-brand-gray">Please contact support to have your shop linked to your account.</p>
      </div>
    );
  }

  const handleAddBooth = () => {
    if (newBoothName.trim() && newBoothRate > 0) {
      addBooth(shop.id, { name: newBoothName, dailyRate: newBoothRate });
      setNewBoothName('');
      setNewBoothRate(100);
    }
  };

  const handleSavePayments = () => {
    updateShop(shop.id, { paymentMethods: payments });
    setEditingPayments(false);
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Shop & Payment Info */}
      <div className="lg:col-span-1 space-y-8">
        <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
          <img src={`${shop.imageUrl}?random=${shop.id}`} alt={shop.name} className="w-full h-48 object-cover rounded-lg mb-4" />
          <h2 className="text-3xl font-bold text-brand-dark dark:text-white">{shop.name}</h2>
          <p className="text-brand-gray">{shop.address}</p>
        </div>

        <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-brand-dark dark:text-white">Payment Methods</h3>
            <button onClick={() => setEditingPayments(!editingPayments)} className="text-sm text-brand-primary hover:underline">
              {editingPayments ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editingPayments ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-brand-gray">Interac Email</label>
                <input type="email" value={payments.email || ''} onChange={e => setPayments(p => ({...p, email: e.target.value}))} className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 text-sm" />
              </div>
               <div>
                <label className="text-xs text-brand-gray">PayPal Link</label>
                <input type="text" value={payments.paypal || ''} onChange={e => setPayments(p => ({...p, paypal: e.target.value}))} className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 text-sm" />
              </div>
               <div>
                <label className="text-xs text-brand-gray">BTC Wallet</label>
                <input type="text" value={payments.btc || ''} onChange={e => setPayments(p => ({...p, btc: e.target.value}))} className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded p-2 text-sm" />
              </div>
              <button onClick={handleSavePayments} className="w-full bg-brand-primary text-white font-bold py-2 rounded-lg mt-2">Save Payments</button>
            </div>
          ) : (
             <div className="space-y-2 text-sm">
                <p><strong className="text-gray-500 dark:text-gray-400">Interac:</strong> {payments.email || 'Not set'}</p>
                <p><strong className="text-gray-500 dark:text-gray-400">PayPal:</strong> {payments.paypal || 'Not set'}</p>
                <p><strong className="text-gray-500 dark:text-gray-400">BTC:</strong> {payments.btc || 'Not set'}</p>
             </div>
          )}
        </div>
      </div>

      {/* Right Column: Booth Management & Bookings */}
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
          <h3 className="text-2xl font-bold text-brand-dark dark:text-white mb-6">Manage Booths</h3>
          <div className="space-y-4">
              {booths.map(booth => (
                  <div key={booth.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                      <p className="font-semibold text-brand-dark dark:text-white">{booth.name}</p>
                      <div className="flex items-center gap-4">
                           <p className="text-lg font-bold text-brand-primary">${booth.dailyRate}<span className="text-sm font-normal text-brand-gray">/day</span></p>
                           <button onClick={() => openModal('edit-booth', booth)} className="text-brand-gray hover:text-brand-dark dark:hover:text-white"><EditIcon className="w-5 h-5"/></button>
                           <button onClick={() => deleteBooth(booth.id)} className="text-red-500 hover:text-red-400 text-sm">Delete</button>
                      </div>
                  </div>
              ))}
          </div>
           <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
               <h4 className="text-xl font-bold text-brand-dark dark:text-white mb-4">Add New Booth</h4>
               <div className="flex items-center gap-4">
                  <div className="relative flex-grow">
                      <EditIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                      <input type="text" placeholder="Booth Name (e.g., 'The North Corner')" value={newBoothName} onChange={e => setNewBoothName(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg py-3 pl-10 pr-4 text-brand-dark dark:text-white"/>
                  </div>
                   <div className="relative w-48">
                      <PriceIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                      <input type="number" placeholder="Daily Rate" value={newBoothRate} onChange={e => setNewBoothRate(Number(e.target.value))} className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg py-3 pl-10 pr-4 text-brand-dark dark:text-white"/>
                   </div>
                  <button onClick={handleAddBooth} className="bg-brand-secondary text-white font-bold py-3 px-6 rounded-lg">Add</button>
               </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
           <h3 className="text-2xl font-bold text-brand-dark dark:text-white mb-6">Upcoming Bookings</h3>
           <div className="space-y-4">
            {upcomingBookings.length > 0 ? (
              upcomingBookings.map(booking => {
                const artist = artists.find(a => a.id === booking.artistId);
                const booth = booths.find(b => b.id === booking.boothId);
                return (
                  <div key={booking.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-brand-dark dark:text-white">{artist?.name || 'Unknown Artist'} at <span className="text-brand-primary">{booth?.name || 'Unknown Booth'}</span></p>
                       <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${booking.paymentStatus === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {booking.paymentStatus}
                       </span>
                    </div>
                    <p className="text-sm text-brand-gray mt-1 flex items-center"><CalendarIcon className="w-4 h-4 mr-2" />{new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}</p>
                  </div>
                )
              })
            ) : (
              <p className="text-brand-gray text-center py-4">No upcoming bookings scheduled.</p>
            )}
           </div>
        </div>
      </div>
    </div>
  );
};